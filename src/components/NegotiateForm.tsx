"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { Info, Plus, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { ListingFull } from "@/lib/database.types";

const PRESET_ADDONS = [
  "Early check-in",
  "Late checkout",
  "Extra bed / cot",
  "Airport transfer",
  "Complimentary breakfast",
  "Guided local tour",
];

export default function NegotiateForm({ listing }: { listing: ListingFull }) {
  const router = useRouter();
  const [targetPrice, setTargetPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [closeMode, setCloseMode] = useState<"approval" | "auto">("approval");
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);
  const [customAddon, setCustomAddon] = useState("");
  const customInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  function togglePreset(addon: string) {
    setSelectedAddons((prev) =>
      prev.includes(addon) ? prev.filter((a) => a !== addon) : [...prev, addon]
    );
  }

  function addCustom() {
    const trimmed = customAddon.trim();
    if (!trimmed || selectedAddons.includes(trimmed)) return;
    setSelectedAddons((prev) => [...prev, trimmed]);
    setCustomAddon("");
    customInputRef.current?.focus();
  }

  const suggestedTarget = Math.round(listing.nightly_price * 0.85);
  const suggestedMax = Math.round(listing.nightly_price * 0.95);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.replace(
          `/login?next=/listing/${listing.id}/negotiate`
        );
      } else {
        setAuthChecked(true);
      }
    });
  }, [listing.id, router]);

  async function handleStart() {
    if (!targetPrice || !maxPrice) return;
    const target = Number(targetPrice);
    const walkAway = Number(maxPrice);

    if (walkAway <= target) {
      setError("Walk-away price must be higher than your target price.");
      return;
    }

    setLoading(true);
    setError(null);

    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token ?? "";

    const res = await fetch("/api/negotiate/start", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        listing_id: listing.id,
        target_price: target,
        walk_away_price: walkAway,
        close_mode: closeMode,
        desired_addons: selectedAddons.length > 0 ? selectedAddons : undefined,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Failed to start negotiation. Try again.");
      setLoading(false);
      return;
    }

    router.push(`/negotiate/${data.negotiation_id}`);
  }

  if (!authChecked) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-sm text-airbnb-gray">Checking session…</div>
      </div>
    );
  }

  return (
    <div className="px-4 space-y-5">
      {/* Target price */}
      <div>
        <label className="text-sm font-semibold text-airbnb-dark block mb-1.5">
          Your target price{" "}
          <span className="text-airbnb-gray font-normal">(per night)</span>
        </label>
        <p className="text-xs text-airbnb-gray mb-2">
          Agent will aim for this. Suggested: Rs.{suggestedTarget.toLocaleString("en-IN")}
        </p>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-airbnb-dark font-medium text-sm">
            Rs.
          </span>
          <input
            type="number"
            value={targetPrice}
            onChange={(e) => setTargetPrice(e.target.value)}
            placeholder={suggestedTarget.toString()}
            className="w-full border border-airbnb-border rounded-xl pl-10 pr-4 py-3 text-sm text-airbnb-dark placeholder:text-airbnb-light focus:outline-none focus:border-airbnb-dark"
          />
        </div>
      </div>

      {/* Max price */}
      <div>
        <div className="flex items-center gap-1.5 mb-1.5">
          <label className="text-sm font-semibold text-airbnb-dark">
            Walk-away price{" "}
            <span className="text-airbnb-gray font-normal">(per night)</span>
          </label>
          <Info size={14} className="text-airbnb-gray" />
        </div>
        <p className="text-xs text-airbnb-gray mb-2">
          Locked - never shared with the host. Agent walks away if price exceeds this.
        </p>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-airbnb-dark font-medium text-sm">
            Rs.
          </span>
          <input
            type="number"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            placeholder={suggestedMax.toString()}
            className="w-full border border-airbnb-border rounded-xl pl-10 pr-4 py-3 text-sm text-airbnb-dark placeholder:text-airbnb-light focus:outline-none focus:border-airbnb-dark"
          />
        </div>
      </div>

      {/* Close mode */}
      <div>
        <label className="text-sm font-semibold text-airbnb-dark block mb-3">
          When a deal is reached...
        </label>
        <div className="space-y-2">
          {(["approval", "auto"] as const).map((mode) => (
            <button
              key={mode}
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
                    ? "Agent drafts each reply. You review and approve before it is sent to the host."
                    : "Agent negotiates fully on your behalf. Watch it happen live. Charged automatically within your cap."}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Add-ons */}
      <div>
        <label className="text-sm font-semibold text-airbnb-dark block mb-1.5">
          Add-ons{" "}
          <span className="text-airbnb-gray font-normal">(optional)</span>
        </label>
        <p className="text-xs text-airbnb-gray mb-3">
          If the price won't go lower, the agent asks the host to include these in your stay.
        </p>

        {/* Preset chips */}
        <div className="flex flex-wrap gap-2 mb-3">
          {PRESET_ADDONS.map((addon) => {
            const active = selectedAddons.includes(addon);
            return (
              <button
                key={addon}
                type="button"
                onClick={() => togglePreset(addon)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  active
                    ? "bg-airbnb-dark text-white border-airbnb-dark"
                    : "bg-white text-airbnb-dark border-airbnb-border"
                }`}
              >
                {active && <span className="mr-1">✓</span>}
                {addon}
              </button>
            );
          })}
        </div>

        {/* Custom add-on input */}
        <div className="flex gap-2">
          <input
            ref={customInputRef}
            type="text"
            value={customAddon}
            onChange={(e) => setCustomAddon(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCustom())}
            placeholder="Add custom…"
            className="flex-1 border border-airbnb-border rounded-xl px-3 py-2 text-sm text-airbnb-dark placeholder:text-airbnb-light focus:outline-none focus:border-airbnb-dark"
          />
          <button
            type="button"
            onClick={addCustom}
            disabled={!customAddon.trim()}
            className="w-9 h-9 flex items-center justify-center bg-airbnb-dark rounded-xl text-white disabled:opacity-30 shrink-0"
          >
            <Plus size={16} />
          </button>
        </div>

        {/* Custom addon tags */}
        {selectedAddons.filter((a) => !PRESET_ADDONS.includes(a)).length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {selectedAddons
              .filter((a) => !PRESET_ADDONS.includes(a))
              .map((addon) => (
                <span
                  key={addon}
                  className="flex items-center gap-1 text-xs bg-airbnb-bg text-airbnb-dark px-3 py-1.5 rounded-full border border-airbnb-border"
                >
                  {addon}
                  <button
                    type="button"
                    onClick={() => setSelectedAddons((prev) => prev.filter((a) => a !== addon))}
                    className="text-airbnb-gray hover:text-airbnb-dark"
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
          </div>
        )}
      </div>

      {/* Disclosure */}
      <div className="bg-airbnb-bg rounded-xl p-3">
        <p className="text-xs text-airbnb-gray leading-relaxed">
          <span className="font-semibold text-airbnb-dark">AI disclosure:</span>{" "}
          The agent will introduce itself as an AI acting on your behalf in its first message to the host. This is required.
        </p>
      </div>

      {error && (
        <p className="text-sm text-red-500 bg-red-50 rounded-xl px-4 py-3">
          {error}
        </p>
      )}

      <button
        onClick={handleStart}
        disabled={!targetPrice || !maxPrice || loading}
        className="w-full bg-airbnb-pink text-white font-semibold py-4 rounded-xl text-sm disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? "Starting negotiation…" : "Start Negotiation"}
      </button>
    </div>
  );
}
