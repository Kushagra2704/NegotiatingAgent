"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, TrendingDown, Clock, Send, User, Zap } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Negotiation, Turn } from "@/lib/database.types";

interface Props {
  negotiation: Negotiation;
  initialTurns: Turn[];
  listedPrice: number;
  listingTitle: string;
  bookingAlreadyConfirmed?: boolean;
}

export default function NegotiateChat({
  negotiation,
  initialTurns,
  listedPrice,
  listingTitle,
  bookingAlreadyConfirmed = false,
}: Props) {
  const [turns, setTurns] = useState<Turn[]>(initialTurns);
  const [status, setStatus] = useState(negotiation.status);
  const [finalPrice, setFinalPrice] = useState<number | null>(null);
  // Initialise from the server-side buyer_override flag — not from turn history
  const [isSteppedIn, setIsSteppedIn] = useState(negotiation.buyer_override ?? false);
  const [buyerMessage, setBuyerMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  // Payment state
  const [showApprovalCard, setShowApprovalCard] = useState(false);
  const [bookingConfirmed, setBookingConfirmed] = useState(bookingAlreadyConfirmed);
  const [paymentPending, setPaymentPending] = useState(false);
  const [razorpayProcessing, setRazorpayProcessing] = useState(false);
  const [closeMode] = useState<"auto" | "approval">(
    (negotiation.close_mode as "auto" | "approval") ?? "auto"
  );
  const paymentTriggeredRef = useRef(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);

  // Load Razorpay checkout script once
  useEffect(() => {
    if (document.getElementById("razorpay-script")) return;
    const script = document.createElement("script");
    script.id = "razorpay-script";
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    document.body.appendChild(script);
  }, []);

  const lastAgentOffer =
    turns.filter((t) => t.role === "agent" && t.allowed_offer).at(-1)
      ?.allowed_offer ?? negotiation.current_offer;
  const savings = lastAgentOffer ? listedPrice - lastAgentOffer : 0;
  const savingsPct = lastAgentOffer
    ? Math.round((savings / listedPrice) * 100)
    : 0;

  async function triggerPayment(modeOverride?: "auto" | "approval") {
    if (paymentTriggeredRef.current) return;
    paymentTriggeredRef.current = true;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { paymentTriggeredRef.current = false; return; }
    setPaymentPending(true);

    const effectiveMode = modeOverride ?? closeMode;

    // Auto mode: server-side UPI payment — no user interaction needed
    if (effectiveMode === "auto") {
      setRazorpayProcessing(true);
      const autoRes = await fetch("/api/booking/auto-charge", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ negotiation_id: negotiation.id }),
      });
      setRazorpayProcessing(false);

      if (autoRes.ok) {
        setBookingConfirmed(true);
        setPaymentPending(false);
        setShowApprovalCard(false);
      } else {
        setPaymentPending(false);
        paymentTriggeredRef.current = false;
      }
      return;
    }

    // Approval mode (or auto fallback): open Razorpay checkout modal
    const res = await fetch("/api/booking/create-order", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ negotiation_id: negotiation.id }),
    });
    if (!res.ok) {
      setPaymentPending(false);
      paymentTriggeredRef.current = false;
      return;
    }
    const orderData = await res.json();
    const accessToken = session.access_token;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rzp = new (window as any).Razorpay({
      key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      order_id: orderData.razorpay_order_id,
      currency: "INR",
      name: "NegotiAgent",
      description: `${orderData.nights} nights · ₹${(orderData.agreed_price ?? 0).toLocaleString("en-IN")}/night`,
      theme: { color: "#FF385C" },
      handler: async (response: {
        razorpay_order_id: string;
        razorpay_payment_id: string;
        razorpay_signature: string;
      }) => {
        const verifyRes = await fetch("/api/booking/verify-payment", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            booking_id: orderData.booking_id,
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
          }),
        });
        if (verifyRes.ok) {
          setBookingConfirmed(true);
          setPaymentPending(false);
          setShowApprovalCard(false);
        }
      },
      modal: {
        ondismiss: () => {
          setPaymentPending(false);
          paymentTriggeredRef.current = false;
        },
      },
    });
    rzp.open();
  }

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const onScroll = () => {
      isAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  // Poll for host replies and agent responses every 2s via admin-backed API
  useEffect(() => {
    if (status !== "active") return;

    let token = "";
    supabase.auth.getSession().then(({ data: { session } }) => {
      token = session?.access_token ?? "";
    });

    const interval = setInterval(async () => {
      if (!token) {
        const { data: { session } } = await supabase.auth.getSession();
        token = session?.access_token ?? "";
      }
      if (!token) return;

      const res = await fetch(
        `/api/negotiate/poll?negotiation_id=${negotiation.id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) return;

      const data = await res.json();
      if (data.turns && data.turns.length > 0) setTurns(data.turns);
      if (data.status && data.status !== "active") {
        setStatus(data.status as typeof status);
        if (data.current_offer) setFinalPrice(data.current_offer);
        if (data.status === "accepted") {
          if (data.close_mode === "approval") {
            setShowApprovalCard(true);
          } else {
            triggerPayment();
          }
        }
      }
    }, 2000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [negotiation.id, status]);

  useEffect(() => {
    if (isAtBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [turns]);

  async function sendBuyerMessage() {
    if (!buyerMessage.trim() || isSending) return;
    setIsSending(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setIsSending(false); return; }

    const optimisticTurn: Turn = {
      id: `opt-${Date.now()}`,
      negotiation_id: negotiation.id,
      turn_number: (turns.at(-1)?.turn_number ?? 0) + 1,
      role: "buyer",
      message: buyerMessage.trim(),
      action: null,
      allowed_offer: null,
      model_used: null,
      is_critical: false,
      latency_ms: null,
      prompt_tokens: null,
      completion_tokens: null,
      cost_usd: null,
      guardrail_passed: true,
      retry_count: 0,
      created_at: new Date().toISOString(),
    };
    setTurns((prev) => [...prev, optimisticTurn]);
    setBuyerMessage("");
    isAtBottomRef.current = true;

    const res = await fetch("/api/negotiate/buyer-turn", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ negotiation_id: negotiation.id, message: buyerMessage.trim() }),
    });
    if (res.ok) {
      const data = await res.json();
      setTurns((prev) => prev.map((t) => t.id === optimisticTurn.id ? data.turn : t));
    }
    setIsSending(false);
  }

  const lastTurn = turns.at(-1);
  const agentSentLast = lastTurn?.role === "agent";
  const buyerSentLast = lastTurn?.role === "buyer";
  const waitingForHostAfterAgent = !isSteppedIn && agentSentLast && status === "active";
  const waitingForHostAfterBuyer = isSteppedIn && buyerSentLast && status === "active";
  const buyerCanType = isSteppedIn && !buyerSentLast && status === "active";

  const displayPrice = finalPrice ?? lastAgentOffer ?? 0;

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Price progress */}
      <div className="px-4 py-3 border-b border-airbnb-border">
        <div className="flex items-center justify-between">
          <div className="text-center">
            <p className="text-xs text-airbnb-gray">Listed</p>
            <p className="text-sm font-bold text-airbnb-dark line-through">
              ₹{listedPrice.toLocaleString("en-IN")}
            </p>
          </div>
          <div className="flex-1 mx-3">
            <div className="h-1 bg-airbnb-light rounded-full overflow-hidden">
              <div
                className="h-full bg-airbnb-pink rounded-full transition-all duration-500"
                style={{ width: `${Math.min(savingsPct * 3, 100)}%` }}
              />
            </div>
            {savingsPct > 0 && (
              <div className="flex items-center justify-center mt-1 gap-1">
                <TrendingDown size={12} className="text-green-600" />
                <span className="text-xs text-green-600 font-medium">
                  {savingsPct}% saved
                </span>
              </div>
            )}
          </div>
          <div className="text-center">
            <p className="text-xs text-airbnb-gray">Current offer</p>
            {lastAgentOffer ? (
              <p className="text-sm font-bold text-green-600">
                ₹{lastAgentOffer.toLocaleString("en-IN")}
              </p>
            ) : (
              <p className="text-sm font-bold text-airbnb-gray">—</p>
            )}
          </div>
        </div>
      </div>

      {/* Chat messages */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {turns.map((turn) => {
          const isLeft = turn.role === "host";
          const isAgent = turn.role === "agent";
          const isBuyer = turn.role === "buyer";
          const bubbleBg = isLeft
            ? "bg-airbnb-bg rounded-tl-sm"
            : isAgent
            ? "bg-airbnb-pink rounded-tr-sm"
            : "bg-indigo-500 rounded-tr-sm";

          return (
            <div key={turn.id} className={`flex ${isLeft ? "justify-start" : "justify-end"}`}>
              {isLeft && (
                <div className="w-7 h-7 bg-sky-600 rounded-full flex items-center justify-center mr-2 mt-auto shrink-0">
                  <span className="text-[9px] font-bold text-white">H</span>
                </div>
              )}
              <div className="flex flex-col max-w-[78%]">
                <div className={`w-full rounded-2xl px-3.5 py-2.5 ${bubbleBg}`}>
                  {isAgent && (
                    <p className="text-[10px] font-semibold text-white/80 mb-1">
                      AI Agent
                      {turn.allowed_offer && (
                        <span className="ml-1 font-normal text-white/60">
                          · offering ₹{turn.allowed_offer.toLocaleString("en-IN")}
                        </span>
                      )}
                    </p>
                  )}
                  {isBuyer && (
                    <p className="text-[10px] font-semibold text-white/80 mb-1">You</p>
                  )}
                  {isLeft && (
                    <p className="text-[10px] font-semibold text-airbnb-gray mb-1">Host</p>
                  )}
                  <p
                    className={`text-sm leading-relaxed whitespace-pre-wrap ${
                      isLeft ? "text-airbnb-dark" : "text-white"
                    }`}
                  >
                    {turn.message}
                  </p>
                  <p className={`text-[10px] mt-1 ${isLeft ? "text-airbnb-gray" : "text-white/60"}`}>
                    {new Date(turn.created_at).toLocaleTimeString("en-IN", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Bottom status bar */}
      <div className="border-t border-airbnb-border bg-white shrink-0">
        {/* Step-in banner when buyer has taken over */}
        {isSteppedIn && status === "active" && (
          <div className="flex items-center gap-2 px-4 pt-3 pb-1">
            <div className="flex-1 flex items-center gap-1.5 bg-indigo-50 rounded-lg px-3 py-1.5">
              <User size={12} className="text-indigo-500 shrink-0" />
              <p className="text-[11px] text-indigo-700 font-medium">You&apos;re negotiating directly</p>
            </div>
            <button
              onClick={async () => {
                setIsSteppedIn(false);
                const { data: { session } } = await supabase.auth.getSession();
                if (!session) return;
                const res = await fetch("/api/negotiate/resume-agent", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${session.access_token}`,
                  },
                  body: JSON.stringify({ negotiation_id: negotiation.id }),
                });
                if (!res.ok) return;
                const data = await res.json();
                if (data.agent_turn) {
                  setTurns((prev) => [...prev, data.agent_turn]);
                  isAtBottomRef.current = true;
                }
                if (data.deal_closed) {
                  setStatus("accepted");
                  if (data.final_price) setFinalPrice(data.final_price);
                  if (data.close_mode === "approval") {
                    setShowApprovalCard(true);
                  } else {
                    triggerPayment();
                  }
                }
              }}
              className="text-[11px] text-airbnb-gray underline"
            >
              Let agent resume
            </button>
          </div>
        )}

        <div className="px-4 py-3">
          {/* Razorpay processing overlay — shown while auto-charge runs */}
          {razorpayProcessing && (
            <div className="bg-white border border-airbnb-border rounded-xl p-4">
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/razorpay-logo.png" alt="Razorpay" className="h-6 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-airbnb-dark">Processing payment</p>
                  <p className="text-xs text-airbnb-gray mt-0.5">Agent is completing your booking via Razorpay…</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}

          {/* Booking confirmed */}
          {bookingConfirmed && (
            <div className="bg-green-100 border border-green-300 rounded-xl p-4 text-center">
              <p className="text-2xl mb-1">✅</p>
              <p className="text-sm font-semibold text-green-800">Booking confirmed!</p>
              <p className="text-xs text-green-700 mt-1">
                ₹{(displayPrice * 3).toLocaleString("en-IN")} paid · 3 nights
              </p>
            </div>
          )}

          {/* Approval card — host has accepted, waiting for buyer to confirm payment */}
          {status === "accepted" && !bookingConfirmed && showApprovalCard && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-green-700">
                  🎉 Agent secured ₹{displayPrice.toLocaleString("en-IN")}/night
                </p>
                <span className="text-xs bg-green-200 text-green-800 font-semibold px-2 py-0.5 rounded-full">
                  {savingsPct}% off
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-green-600 border-t border-green-200 pt-2 mb-3">
                <span>3 nights</span>
                <span>₹{displayPrice.toLocaleString("en-IN")} × 3</span>
                <span className="font-semibold text-green-700">= ₹{(displayPrice * 3).toLocaleString("en-IN")}</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowApprovalCard(false)}
                  className="flex-1 py-2 text-sm border border-red-200 text-red-500 rounded-lg"
                >
                  Decline
                </button>
                <button
                  onClick={() => triggerPayment("approval")}
                  disabled={paymentPending}
                  className="flex-1 py-2 text-sm font-semibold bg-[#072654] text-white rounded-lg disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {paymentPending ? "Opening…" : (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src="/razorpay-logo.png" alt="" className="h-3.5 brightness-0 invert" />
                      <span>Pay ₹{(displayPrice * 3).toLocaleString("en-IN")}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Auto-mode accepted — payment modal opens immediately; show card with CTA as fallback */}
          {status === "accepted" && !bookingConfirmed && !showApprovalCard && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-green-700">
                  🎉 Agent secured ₹{displayPrice.toLocaleString("en-IN")}/night
                </p>
                <span className="text-xs bg-green-200 text-green-800 font-semibold px-2 py-0.5 rounded-full">
                  {savingsPct}% off
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-green-600 border-t border-green-200 pt-2 mb-3">
                <span>3 nights</span>
                <span>₹{displayPrice.toLocaleString("en-IN")} × 3</span>
                <span className="font-semibold text-green-700">= ₹{(displayPrice * 3).toLocaleString("en-IN")}</span>
              </div>
              <button
                onClick={() => triggerPayment()}
                disabled={paymentPending}
                className="w-full py-2.5 text-sm font-semibold bg-airbnb-pink text-white rounded-xl disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {paymentPending ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    Opening Razorpay…
                  </>
                ) : (
                  `Pay ₹${(displayPrice * 3).toLocaleString("en-IN")} to confirm booking`
                )}
              </button>
            </div>
          )}

          {status === "walked_away" && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
              <p className="text-sm font-semibold text-red-700">
                Negotiation ended — host price was above your limit
              </p>
            </div>
          )}

          {/* Buyer direct input */}
          {buyerCanType && (
            <div className="flex items-end gap-2">
              <textarea
                value={buyerMessage}
                onChange={(e) => setBuyerMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendBuyerMessage();
                  }
                }}
                placeholder="Message the host directly…"
                rows={1}
                className="flex-1 resize-none bg-airbnb-bg rounded-xl px-4 py-3 text-sm text-airbnb-dark placeholder:text-airbnb-gray focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
              <button
                onClick={sendBuyerMessage}
                disabled={!buyerMessage.trim() || isSending}
                className="w-10 h-10 rounded-xl bg-indigo-500 flex items-center justify-center disabled:opacity-40 shrink-0"
              >
                <Send size={16} className="text-white" />
              </button>
            </div>
          )}

          {waitingForHostAfterBuyer && (
            <div className="flex items-center gap-3 bg-indigo-50 rounded-xl px-4 py-3">
              <Clock size={16} className="text-indigo-400 shrink-0 animate-pulse" />
              <div>
                <p className="text-xs font-semibold text-indigo-700">Waiting for host to reply</p>
                <p className="text-xs text-indigo-500 mt-0.5">You sent a direct message</p>
              </div>
            </div>
          )}

          {/* Normal agent mode — step-in CTA inline */}
          {waitingForHostAfterAgent && (
            <div className="flex items-center gap-2 bg-sky-50 rounded-xl px-4 py-3">
              <Clock size={15} className="text-sky-500 shrink-0 animate-pulse" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-sky-700">Waiting for host to reply</p>
                <p className="text-xs text-sky-500 mt-0.5 truncate">Your agent sent an offer</p>
              </div>
              <button
                onClick={() => setIsSteppedIn(true)}
                className="flex items-center gap-1 shrink-0 text-[11px] font-semibold text-indigo-600 border border-indigo-200 rounded-lg px-2.5 py-1.5 hover:bg-indigo-50 transition-colors"
              >
                <Zap size={11} />
                Step in
              </button>
            </div>
          )}

          {!isSteppedIn && !agentSentLast && status === "active" && (
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-airbnb-bg rounded-xl px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shrink-0" />
                  <Bot size={13} className="text-airbnb-pink shrink-0" />
                  <p className="text-xs text-airbnb-gray truncate">
                    Agent composing… · Turn {turns.length}/{negotiation.max_turns}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsSteppedIn(true)}
                className="flex items-center gap-1 shrink-0 text-[11px] font-semibold text-indigo-600 border border-indigo-200 rounded-lg px-2.5 py-1.5 hover:bg-indigo-50 transition-colors"
              >
                <Zap size={11} />
                Step in
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
