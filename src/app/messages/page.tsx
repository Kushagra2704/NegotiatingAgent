export const instant = false;

import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { Bot, TrendingDown } from "lucide-react";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import SmartBottomNav from "@/components/SmartBottomNav";
import FilterPills from "@/components/FilterPills";

export const dynamic = 'force-dynamic';

type NegStatus = "active" | "accepted" | "rejected" | "expired" | "walked_away";

const STATUS_LABEL: Record<NegStatus, { label: string; color: string }> = {
  active:     { label: "Active",      color: "bg-green-100 text-green-700" },
  accepted:   { label: "Deal closed", color: "bg-blue-100 text-blue-700" },
  walked_away:{ label: "Walked away", color: "bg-red-100 text-red-700" },
  rejected:   { label: "Rejected",    color: "bg-red-100 text-red-700" },
  expired:    { label: "Expired",     color: "bg-gray-100 text-gray-600" },
};

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab = "all" } = await searchParams;

  const { data: negotiations } = await supabaseAdmin
    .from("negotiations")
    .select(`
      id, status, current_offer, created_at, listing_id,
      listings ( id, title, nightly_price, area, state,
        listing_images ( url, position )
      )
    `)
    .order("created_at", { ascending: false })
    .limit(50);

  type NegRow = {
    id: string;
    status: NegStatus;
    current_offer: number | null;
    created_at: string;
    listing_id: string;
    listings: {
      id: string; title: string; nightly_price: number; area: string; state: string;
      listing_images: { url: string; position: number }[];
    } | null;
  };
  const allNegs = (negotiations as unknown as NegRow[]) ?? [];

  type LastTurnRow = {
    negotiation_id: string;
    message: string;
    allowed_offer: number | null;
    turn_number: number;
  };
  let lastTurns: LastTurnRow[] = [];
  if (allNegs.length > 0) {
    const { data } = await supabaseAdmin
      .from("turns")
      .select("negotiation_id, message, allowed_offer, turn_number")
      .in("negotiation_id", allNegs.map((n) => n.id))
      .eq("role", "agent")
      .order("turn_number", { ascending: false });
    lastTurns = (data ?? []) as LastTurnRow[];
  }

  const lastTurnMap = new Map<string, LastTurnRow>();
  for (const t of lastTurns) {
    if (!lastTurnMap.has(t.negotiation_id)) lastTurnMap.set(t.negotiation_id, t);
  }

  const negs = allNegs.filter((n) => {
    if (tab === "active")    return n.status === "active";
    if (tab === "confirmed") return n.status === "accepted";
    if (tab === "ended")     return ["walked_away", "rejected", "expired"].includes(n.status);
    return true;
  });

  return (
    <div className="pb-20 min-h-dvh bg-white">
      <div className="flex items-center justify-between px-4 pt-6 pb-4 border-b border-airbnb-border">
        <h1 className="text-2xl font-bold text-airbnb-dark">My Negotiations</h1>
        <Bot size={22} className="text-airbnb-pink" />
      </div>

      <Suspense>
        <FilterPills basePath="/messages" />
      </Suspense>

      {allNegs.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-8 pt-16 pb-8">
          <div className="mb-6 w-16 h-16 bg-airbnb-bg rounded-full flex items-center justify-center">
            <Bot size={28} className="text-airbnb-pink" />
          </div>
          <h2 className="text-xl font-bold text-airbnb-dark mb-2">No negotiations yet</h2>
          <p className="text-sm text-airbnb-gray text-center leading-relaxed mb-8">
            Find a listing and hit &ldquo;Negotiate&rdquo; to let your AI agent get you a better price.
          </p>
          <Link href="/" className="bg-airbnb-pink text-white font-semibold text-sm px-8 py-3 rounded-xl">
            Browse listings
          </Link>
        </div>
      ) : negs.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-8 pt-16 pb-8">
          <div className="mb-6 w-16 h-16 bg-airbnb-bg rounded-full flex items-center justify-center">
            <Bot size={28} className="text-airbnb-gray" />
          </div>
          <h2 className="text-xl font-bold text-airbnb-dark mb-2">No {tab} negotiations</h2>
          <p className="text-sm text-airbnb-gray text-center">Try a different filter above.</p>
        </div>
      ) : (
        <div className="divide-y divide-airbnb-border">
          {negs.map((n) => {
            const listing = n.listings;
            if (!listing) return null;

            const images = [...(listing.listing_images ?? [])]
              .sort((a, b) => a.position - b.position)
              .map((i) => i.url);
            const thumb = images[0] ?? "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=400";
            const lastTurn = lastTurnMap.get(n.id);
            const status = STATUS_LABEL[n.status as NegStatus] ?? { label: n.status, color: "bg-gray-100 text-gray-600" };
            const offer = n.current_offer;
            const savingPct = offer ? Math.round(((listing.nightly_price - offer) / listing.nightly_price) * 100) : 0;

            return (
              <Link
                key={n.id}
                href={`/negotiate/${n.id}`}
                className="flex items-start gap-3 px-4 py-4 hover:bg-airbnb-bg transition-colors"
              >
                <div className="relative w-14 h-14 shrink-0 rounded-xl overflow-hidden">
                  <Image src={thumb} alt={listing.title} fill className="object-cover" sizes="56px" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-0.5">
                    <p className="text-sm font-semibold text-airbnb-dark truncate">{listing.title}</p>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${status.color}`}>
                      {status.label}
                    </span>
                  </div>
                  <p className="text-xs text-airbnb-gray mb-1">{listing.area}, {listing.state}</p>
                  {lastTurn && (
                    <p className="text-xs text-airbnb-gray truncate">
                      <Bot size={10} className="inline mr-1 text-airbnb-pink" />
                      {lastTurn.message.slice(0, 70)}{lastTurn.message.length > 70 ? "…" : ""}
                    </p>
                  )}
                  {offer && savingPct > 0 && (
                    <div className="flex items-center gap-1 mt-1.5">
                      <TrendingDown size={11} className="text-green-600" />
                      <span className="text-xs font-medium text-green-600">
                        ₹{offer.toLocaleString("en-IN")}/night · {savingPct}% off
                      </span>
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <SmartBottomNav />
    </div>
  );
}
