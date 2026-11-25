"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, X, Plus } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Listing } from "@/lib/database.types";

const PRESET_ADDONS = ["Early check-in", "Late check-out", "Airport pickup", "Welcome breakfast"];

export default function NegotiateSetup({ listing }: { listing: Listing }) {
  const router = useRouter();
  const listed = listing.nightly_price;

  const [targetPrice, setTargetPrice] = useState(Math.round(listed * 0.80));
  const [walkAwayPrice, setWalkAwayPrice] = useState(Math.round(listed * 0.92));
  const [addons, setAddons] = useState<string[]>([]);
  const [addonInput, setAddonInput] = useState("");
  const [nights, setNights] = useState(2);
  const [closeMode, setCloseMode] = useState<"approval" | "auto">("approval");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const savingPct = targetPrice < listed
    ? Math.round(((listed - targetPrice) / listed) * 100)
    : 0;

  function addAddon(value: string) {
    const trimmed = value.trim();
    if (trimmed && !addons.includes(trimmed)) {
      setAddons((prev) => [...prev, trimmed]);
    }
    setAddonInput("");
  }

  function removeAddon(a: string) {
    setAddons((prev) => prev.filter((x) => x !== a));
  }

  function togglePreset(a: string) {
    if (addons.includes(a)) removeAddon(a);
    else setAddons((prev) => [...prev, a]);
  }

  const targetError =
    targetPrice <= 0 ? "Enter a valid price" :
    targetPrice >= listed ? `Must be less than ₹${listed.toLocaleString("en-IN")}` :
    null;

  const walkAwayError =
    walkAwayPrice <= targetPrice ? "Must be higher than your target" :
    walkAwayPrice > listed ? `Can't exceed listed price ₹${listed.toLocaleString("en-IN")}` :
    null;

  const canStart = !targetError && !walkAwayError && !loading;

  async function startNegotiation() {
    if (!canStart) return;
    setError(null);
    setLoading(true);

    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;
    if (!token) {
      router.push(`/login?next=/listing/${listing.id}/negotiate`);
      return;
    }

    const res = await fetch("/api/negotiate/start", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        listing_id: listing.id,
        target_price: targetPrice,
        walk_away_price: walkAwayPrice,
        nights,
        close_mode: closeMode,
        desired_addons: addons.length > 0 ? addons : undefined,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Something went wrong. Please try again.");
      setLoading(false);
      return;
    }

    router.push(`/negotiate/${data.negotiation_id}`);
  }

  return (
    <div className="px-5 pt-6 space-y-5">
      {/* Listed price */}
      <div className="bg-airbnb-bg rounded-2xl p-4">
        <p className="text-xs text-airbnb-gray mb-1">Listed at</p>
        <p className="text-2xl font-bold text-airbnb-dark">
          ₹{listed.toLocaleString("en-IN")}
          <span className="text-sm font-normal text-airbnb-gray">/night</span>
        </p>
      </div>

      {/* Nights */}
      <div>
        <label className="text-sm font-semibold text-airbnb-dark block mb-2">
          Number of nights
        </label>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5, 7].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setNights(n)}
              className={`flex-1 py-2.5 rounded-xl border-2 text-sm font-semibold transition-colors ${
                nights === n
                  ? "border-airbnb-dark bg-airbnb-dark text-white"
                  : "border-airbnb-border text-airbnb-dark bg-white"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* Target price */}
      <div>
        <label className="text-sm font-semibold text-airbnb-dark block mb-1.5">
          Your target price <span className="text-airbnb-gray font-normal">(aim for this)</span>
        </label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-airbnb-gray">₹</span>
          <input
            type="number"
            value={targetPrice || ""}
            onChange={(e) => setTargetPrice(Number(e.target.value))}
            placeholder={String(Math.round(listed * 0.80))}
            className="w-full border border-airbnb-border rounded-xl pl-8 pr-4 py-3 text-sm text-airbnb-dark focus:outline-none focus:border-airbnb-dark"
          />
          {savingPct > 0 && !targetError && (
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-green-600">
              {savingPct}% off
            </span>
          )}
        </div>
        {targetError && <p className="text-xs text-red-500 mt-1">{targetError}</p>}
        <p className="text-xs text-airbnb-gray mt-1">
          Your agent will work toward this price. Saving ₹{Math.max(0, listed - targetPrice).toLocaleString("en-IN")}/night if successful.
        </p>
      </div>

      {/* Walk-away price */}
      <div>
        <label className="text-sm font-semibold text-airbnb-dark block mb-1.5">
          Walk-away price <span className="text-airbnb-gray font-normal">(max you'll pay)</span>
        </label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-airbnb-gray">₹</span>
          <input
            type="number"
            value={walkAwayPrice || ""}
            onChange={(e) => setWalkAwayPrice(Number(e.target.value))}
            placeholder={String(Math.round(listed * 0.92))}
            className="w-full border border-airbnb-border rounded-xl pl-8 pr-4 py-3 text-sm text-airbnb-dark focus:outline-none focus:border-airbnb-dark"
          />
        </div>
        {walkAwayError && <p className="text-xs text-red-500 mt-1">{walkAwayError}</p>}
        <p className="text-xs text-airbnb-gray mt-1">
          Agent walks away if host won't go below this. Must be above your target.
        </p>
      </div>

      {/* Close mode */}
      <div>
        <label className="text-sm font-semibold text-airbnb-dark block mb-3">
          When a deal is reached…
        </label>
        <div className="space-y-2">
          {(["approval", "auto"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setCloseMode(mode)}
              className={`w-full flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-colors ${
                closeMode === mode
                  ? "border-airbnb-dark bg-white"
                  : "border-airbnb-border bg-white"
              }`}
            >
              <div
                className={`mt-0.5 w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
                  closeMode === mode ? "border-airbnb-dark" : "border-airbnb-border"
                }`}
              >
                {closeMode === mode && (
                  <div className="w-2 h-2 rounded-full bg-airbnb-dark" />
                )}
              </div>
              <div>
                <p className="text-sm font-semibold text-airbnb-dark">
                  {mode === "approval" ? "Approval mode" : "Auto mode"}
                </p>
                <p className="text-xs text-airbnb-gray mt-0.5">
                  {mode === "approval"
                    ? "Agent negotiates fully on your behalf. When a deal is reached, you review the agreed price and confirm payment."
                    : "Agent negotiates and pays automatically within your cap. No action needed from you."}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Add-ons */}
      <div>
        <label className="text-sm font-semibold text-airbnb-dark block mb-2">
          Request add-ons <span className="text-airbnb-gray font-normal">(optional)</span>
        </label>

        {/* Preset chips */}
        <div className="flex flex-wrap gap-2 mb-3">
          {PRESET_ADDONS.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => togglePreset(a)}
              className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${
                addons.includes(a)
                  ? "bg-airbnb-dark text-white border-airbnb-dark"
                  : "bg-white text-airbnb-gray border-airbnb-border"
              }`}
            >
              {a}
            </button>
          ))}
        </div>

        {/* Custom add-on input */}
        <div className="flex gap-2">
          <input
            type="text"
            value={addonInput}
            onChange={(e) => setAddonInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); addAddon(addonInput); }
            }}
            placeholder="Type a custom add-on…"
            className="flex-1 border border-airbnb-border rounded-xl px-3 py-2.5 text-sm text-airbnb-dark placeholder:text-airbnb-light focus:outline-none focus:border-airbnb-dark"
          />
          <button
            type="button"
            onClick={() => addAddon(addonInput)}
            disabled={!addonInput.trim()}
            className="bg-airbnb-bg border border-airbnb-border rounded-xl px-3 py-2.5 disabled:opacity-40"
          >
            <Plus size={16} className="text-airbnb-dark" />
          </button>
        </div>

        {/* Selected add-ons */}
        {addons.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {addons.map((a) => (
              <span
                key={a}
                className="flex items-center gap-1 text-xs bg-airbnb-dark text-white px-2.5 py-1 rounded-full"
              >
                {a}
                <button type="button" onClick={() => removeAddon(a)}>
                  <X size={11} />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="bg-green-50 border border-green-200 rounded-2xl p-4 space-y-1">
        <p className="text-xs font-semibold text-green-700">Your agent will:</p>
        <p className="text-xs text-green-700">
          • Book {nights} night{nights !== 1 ? "s" : ""} · Open around ₹{Math.round(listed * 0.75).toLocaleString("en-IN")}/night and work toward ₹{targetPrice.toLocaleString("en-IN")}
        </p>
        <p className="text-xs text-green-700">
          • Walk away if host won&apos;t go below ₹{walkAwayPrice.toLocaleString("en-IN")}
        </p>
        {addons.length > 0 && (
          <p className="text-xs text-green-700">• Request: {addons.join(", ")}</p>
        )}
        <p className="text-xs text-green-700">• Use market comparables to justify the offer</p>
      </div>

      {error && (
        <p className="text-sm text-red-500 bg-red-50 rounded-xl px-4 py-3">{error}</p>
      )}

      <button
        onClick={startNegotiation}
        disabled={!canStart}
        className="w-full bg-airbnb-pink text-white font-semibold py-4 rounded-2xl text-sm disabled:opacity-50 flex items-center justify-center gap-2"
      >
        <Bot size={18} />
        {loading ? "Starting negotiation…" : "Start AI negotiation"}
      </button>
    </div>
  );
}
