"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { ShieldCheck, Zap, Loader2 } from "lucide-react";

type MandateStatus = "loading" | "none" | "active" | "setting_up";

export default function AutoPaySetup() {
  const [status, setStatus] = useState<MandateStatus>("loading");

  // Load Razorpay checkout script
  useEffect(() => {
    if (document.getElementById("razorpay-script")) return;
    const script = document.createElement("script");
    script.id = "razorpay-script";
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    document.body.appendChild(script);
  }, []);

  // Check if mandate already set up
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { setStatus("none"); return; }
      const res = await fetch("/api/mandate/status", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setStatus(data.has_mandate ? "active" : "none");
      } else {
        setStatus("none");
      }
    });
  }, []);

  async function setupMandate() {
    setStatus("setting_up");
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setStatus("none"); return; }

    // Get checkout config from server
    const res = await fetch("/api/mandate/setup", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({}),
    });
    if (!res.ok) { setStatus("none"); return; }

    const config = await res.json();
    const accessToken = session.access_token;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rzp = new (window as any).Razorpay({
      key: config.razorpay_key,
      order_id: config.order_id,
      customer_id: config.customer_id,
      amount: config.amount,
      currency: config.currency,
      name: config.name,
      description: config.description,
      prefill: config.prefill,
      recurring: config.recurring,
      theme: { color: "#FF385C" },
      handler: async (response: {
        razorpay_payment_id: string;
        razorpay_order_id: string;
        razorpay_signature: string;
      }) => {
        const saveRes = await fetch("/api/mandate/save-token", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            payment_id: response.razorpay_payment_id,
            customer_id: config.customer_id,
          }),
        });
        if (saveRes.ok) {
          setStatus("active");
        } else {
          setStatus("none");
        }
      },
      modal: { ondismiss: () => setStatus("none") },
    });
    rzp.open();
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-airbnb-border p-8 w-full max-w-sm text-center">
      <div className="w-14 h-14 rounded-full bg-airbnb-pink/10 flex items-center justify-center mx-auto mb-4">
        <Zap size={28} className="text-airbnb-pink" />
      </div>

      <h1 className="text-lg font-bold text-airbnb-dark mb-1">Auto-Pay Setup</h1>
      <p className="text-sm text-airbnb-gray mb-6">
        Authorise a mandate up to <span className="font-semibold text-airbnb-dark">₹10,000</span> so your
        agent can complete bookings automatically — no checkout modal needed.
      </p>

      {status === "loading" && (
        <div className="flex items-center justify-center gap-2 text-airbnb-gray">
          <Loader2 size={16} className="animate-spin" />
          <span className="text-sm">Checking mandate…</span>
        </div>
      )}

      {status === "active" && (
        <div className="flex items-center justify-center gap-2 text-green-600 bg-green-50 rounded-xl px-4 py-3">
          <ShieldCheck size={18} />
          <span className="text-sm font-semibold">Auto-Pay active · up to ₹10,000</span>
        </div>
      )}

      {(status === "none" || status === "setting_up") && (
        <button
          onClick={setupMandate}
          disabled={status === "setting_up"}
          className="w-full py-3 bg-airbnb-pink text-white text-sm font-semibold rounded-xl disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {status === "setting_up" ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Opening mandate…
            </>
          ) : (
            "Authorise Auto-Pay Mandate"
          )}
        </button>
      )}

      <p className="text-[11px] text-airbnb-gray mt-4">
        One-time setup. Only charged when your agent closes a deal in Auto mode.
      </p>
    </div>
  );
}
