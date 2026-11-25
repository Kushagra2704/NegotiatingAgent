"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, TrendingDown, Send } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Negotiation, Turn } from "@/lib/database.types";

interface Props {
  negotiation: Negotiation;
  initialTurns: Turn[];
  listedPrice: number;
  listingTitle: string;
}

export default function HostNegotiateChat({
  negotiation,
  initialTurns,
  listedPrice,
  listingTitle,
}: Props) {
  const [turns, setTurns] = useState<Turn[]>(initialTurns);
  const [hostInput, setHostInput] = useState("");
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState(negotiation.status);
  const [finalPrice, setFinalPrice] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const sendingRef = useRef(false);

  const lastAgentOffer =
    turns.filter((t) => t.role === "agent" && t.allowed_offer).at(-1)
      ?.allowed_offer ?? negotiation.current_offer;
  const savings = lastAgentOffer ? listedPrice - lastAgentOffer : 0;
  const savingsPct = lastAgentOffer ? Math.round((savings / listedPrice) * 100) : 0;

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const onScroll = () => {
      isAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  // Poll via admin-backed endpoint — bypasses RLS so buyer direct turns are visible
  useEffect(() => {
    if (status !== "active") return;
    let token = "";
    supabase.auth.getSession().then(({ data: { session } }) => {
      token = session?.access_token ?? "";
    });

    const interval = setInterval(async () => {
      if (sendingRef.current) return;
      if (!token) {
        const { data: { session } } = await supabase.auth.getSession();
        token = session?.access_token ?? "";
      }
      if (!token) return;

      const res = await fetch(
        `/api/negotiate/poll?negotiation_id=${negotiation.id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok || sendingRef.current) return;

      const data = await res.json();
      if (data.turns && data.turns.length > 0) setTurns(data.turns);
      if (data.status && data.status !== "active") {
        setStatus(data.status as typeof status);
        if (data.current_offer) setFinalPrice(data.current_offer);
      }
    }, 2500);
    return () => clearInterval(interval);
  }, [negotiation.id, status]);

  useEffect(() => {
    if (isAtBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [turns]);

  function scrollToBottom() {
    isAtBottomRef.current = true;
    bottomRef.current?.scrollIntoView({ behavior: "instant" });
  }

  async function sendReply() {
    if (!hostInput.trim() || sending) return;

    const message = hostInput.trim();
    setHostInput("");
    sendingRef.current = true;
    setSending(true);
    setError(null);

    // Optimistic host turn
    const optimisticId = `optimistic-${Date.now()}`;
    const optimisticTurn: Turn = {
      id: optimisticId,
      negotiation_id: negotiation.id,
      turn_number: (turns.at(-1)?.turn_number ?? 0) + 1,
      role: "host",
      message,
      action: null,
      allowed_offer: null,
      model_used: null,
      is_critical: false,
      latency_ms: null,
      prompt_tokens: null,
      completion_tokens: null,
      cost_usd: null,
      guardrail_passed: null,
      retry_count: 0,
      created_at: new Date().toISOString(),
    };
    setTurns((prev) => [...prev, optimisticTurn]);
    scrollToBottom();

    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token ?? "";

    const res = await fetch("/api/negotiate/turn", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ negotiation_id: negotiation.id, host_message: message }),
    });

    const data = await res.json();

    if (!res.ok) {
      setTurns((prev) => prev.filter((t) => t.id !== optimisticId));
      setError(data.error ?? "Something went wrong");
      sendingRef.current = false;
      setSending(false);
      return;
    }

    // Use the API response directly — avoids re-fetching via anon client (blocked by RLS)
    setTurns((prev) => {
      const withoutOptimistic = prev.filter((t) => t.id !== optimisticId);
      const next = [...withoutOptimistic];
      if (data.host_turn) next.push(data.host_turn as Turn);
      if (data.agent_turn) next.push(data.agent_turn as Turn);
      return next;
    });
    scrollToBottom();

    if (data.negotiation_status !== "active") {
      setStatus(data.negotiation_status);
      if (data.final_price) setFinalPrice(data.final_price);
    }

    sendingRef.current = false;
    setSending(false);
  }

  const lastTurn = turns.at(-1);
  const lastAgentTurn = [...turns].reverse().find((t) => t.role === "agent");
  // Host must reply after both agent and direct buyer messages
  const awaitingReply = (lastTurn?.role === "agent" || lastTurn?.role === "buyer") && status === "active";
  const isPendingConfirm = lastAgentTurn?.action === "accept" && status === "active";
  // Buyer-override mode: at least one buyer turn exists
  const buyerOverrideMode = turns.some((t) => t.role === "buyer");

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Price bar */}
      <div className="px-4 py-3 border-b border-airbnb-border">
        <div className="flex items-center justify-between">
          <div className="text-center">
            <p className="text-xs text-airbnb-gray">Listed</p>
            <p className="text-sm font-bold text-airbnb-dark">
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
                  {savingsPct}% off listed
                </span>
              </div>
            )}
          </div>
          <div className="text-center">
            <p className="text-xs text-airbnb-gray">Agent offer</p>
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

      {/* Chat */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {turns.map((turn) => {
          const isHost = turn.role === "host";
          const isAgent = turn.role === "agent";
          const isBuyer = turn.role === "buyer";
          // Host on right; agent and buyer (direct) on left
          return (
            <div key={turn.id} className={`flex ${isHost ? "justify-end" : "justify-start"}`}>
              {isAgent && (
                <div className="w-7 h-7 bg-airbnb-pink rounded-full flex items-center justify-center mr-2 mt-auto shrink-0">
                  <Bot size={14} className="text-white" />
                </div>
              )}
              {isBuyer && (
                <div className="w-7 h-7 bg-indigo-500 rounded-full flex items-center justify-center mr-2 mt-auto shrink-0">
                  <span className="text-[9px] font-bold text-white">G</span>
                </div>
              )}
              <div className="flex flex-col max-w-[78%]">
                <div className={`w-full rounded-2xl px-3.5 py-2.5 ${
                  isHost
                    ? "bg-airbnb-dark rounded-tr-sm"
                    : isAgent
                    ? "bg-airbnb-bg rounded-tl-sm"
                    : "bg-indigo-50 rounded-tl-sm border border-indigo-100"
                }`}>
                  {isAgent && (
                    <p className="text-[10px] font-semibold text-airbnb-pink mb-1">
                      AI Agent
                      {turn.allowed_offer && (
                        <span className="ml-1 font-normal text-airbnb-gray">
                          · offering ₹{turn.allowed_offer.toLocaleString("en-IN")}
                        </span>
                      )}
                    </p>
                  )}
                  {isBuyer && (
                    <p className="text-[10px] font-semibold text-indigo-500 mb-1">Guest (direct)</p>
                  )}
                  {isHost && (
                    <p className="text-[10px] font-semibold text-white/60 mb-1">You</p>
                  )}
                  <p className={`text-sm leading-relaxed whitespace-pre-wrap ${
                    isHost ? "text-white" : isBuyer ? "text-indigo-900" : "text-airbnb-dark"
                  }`}>
                    {turn.message}
                  </p>
                  <p className={`text-[10px] mt-1 ${
                    isHost ? "text-white/60" : isBuyer ? "text-indigo-400" : "text-airbnb-gray"
                  }`}>
                    {new Date(turn.created_at).toLocaleTimeString("en-IN", {
                      hour: "2-digit", minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            </div>
          );
        })}

        {/* Only show agent typing dots when NOT in buyer-override mode */}
        {sending && !buyerOverrideMode && (
          <div className="flex justify-start">
            <div className="w-7 h-7 bg-airbnb-pink rounded-full flex items-center justify-center mr-2 mt-auto shrink-0">
              <Bot size={14} className="text-white" />
            </div>
            <div className="bg-airbnb-bg rounded-2xl rounded-tl-sm px-4 py-3">
              <div className="flex gap-1 items-center h-4">
                <div className="w-1.5 h-1.5 bg-airbnb-gray rounded-full animate-bounce [animation-delay:0ms]" />
                <div className="w-1.5 h-1.5 bg-airbnb-gray rounded-full animate-bounce [animation-delay:150ms]" />
                <div className="w-1.5 h-1.5 bg-airbnb-gray rounded-full animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Reply area */}
      <div className="border-t border-airbnb-border px-4 py-3 bg-white shrink-0">
        {status === "accepted" && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
            <p className="text-sm font-semibold text-green-700">
              Deal closed at ₹{(finalPrice ?? lastAgentOffer)?.toLocaleString("en-IN")}/night
            </p>
          </div>
        )}
        {status === "walked_away" && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
            <p className="text-sm font-semibold text-red-700">
              Agent walked away — price exceeded the guest&apos;s limit
            </p>
          </div>
        )}

        {awaitingReply && (
          <div className="space-y-2">
            {isPendingConfirm && (
              <p className="text-xs font-medium text-green-600">
                Agent is asking for confirmation — say yes to close the deal
              </p>
            )}
            <div className="flex gap-2">
              <input
                type="text"
                value={hostInput}
                onChange={(e) => setHostInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) sendReply(); }}
                placeholder={
                  isPendingConfirm
                    ? "e.g. Yes, confirmed! Looking forward to your stay."
                    : "e.g. Best I can do is ₹8,500/night"
                }
                className="flex-1 border border-airbnb-border rounded-xl px-3 py-2.5 text-sm text-airbnb-dark placeholder:text-airbnb-light focus:outline-none focus:border-airbnb-dark"
              />
              <button
                onClick={sendReply}
                disabled={!hostInput.trim() || sending}
                className="bg-airbnb-dark text-white px-4 py-2.5 rounded-xl disabled:opacity-40"
              >
                <Send size={16} />
              </button>
            </div>
            {error && <p className="text-xs text-red-500">{error}</p>}
          </div>
        )}

        {!awaitingReply && status === "active" && (
          buyerOverrideMode ? (
            <div className="bg-indigo-50 rounded-xl px-4 py-3 flex items-center gap-2">
              <div className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse" />
              <p className="text-xs text-indigo-700">Waiting for guest to reply directly…</p>
            </div>
          ) : (
            <div className="bg-airbnb-bg rounded-xl px-4 py-3 flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <p className="text-xs text-airbnb-gray">Agent is composing a response…</p>
            </div>
          )
        )}
      </div>
    </div>
  );
}
