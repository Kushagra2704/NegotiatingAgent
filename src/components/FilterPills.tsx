"use client";

import { useRouter, useSearchParams } from "next/navigation";

const PILLS = [
  { label: "All",       value: "all" },
  { label: "Active",    value: "active" },
  { label: "Confirmed", value: "confirmed" },
  { label: "Ended",     value: "ended" },
] as const;

export default function FilterPills({ basePath }: { basePath: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = searchParams.get("tab") ?? "all";

  function setTab(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all") params.delete("tab");
    else params.set("tab", value);
    const qs = params.toString();
    router.push(`${basePath}${qs ? `?${qs}` : ""}`);
  }

  return (
    <div className="flex gap-2 px-4 py-3 overflow-x-auto scrollbar-hide border-b border-airbnb-border">
      {PILLS.map(({ label, value }) => (
        <button
          key={value}
          onClick={() => setTab(value)}
          className={`shrink-0 text-xs font-semibold px-4 py-1.5 rounded-full border transition-colors ${
            current === value
              ? "bg-airbnb-dark text-white border-airbnb-dark"
              : "bg-white text-airbnb-gray border-airbnb-border"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
