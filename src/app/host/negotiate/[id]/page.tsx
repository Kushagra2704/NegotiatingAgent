
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Bot } from "lucide-react";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getListingById, getImages } from "@/lib/listings";
import HostNegotiateChat from "./HostNegotiateChat";
import type { Turn } from "@/lib/database.types";

export const dynamic = 'force-dynamic';

export default async function HostNegotiatePage(
  props: PageProps<"/host/negotiate/[id]">
) {
  const { id } = await props.params;

  const { data: negotiation } = await supabaseAdmin
    .from("negotiations")
    .select("*")
    .eq("id", id)
    .single();

  if (!negotiation) notFound();

  const listing = await getListingById(negotiation.listing_id);
  if (!listing) notFound();

  const { data: initialTurns } = await supabaseAdmin
    .from("turns")
    .select("*")
    .eq("negotiation_id", id)
    .order("turn_number", { ascending: true });

  const turns: Turn[] = initialTurns ?? [];
  const images = getImages(listing);

  return (
    <div className="bg-white min-h-dvh flex flex-col max-h-dvh">
      <div className="border-b border-airbnb-border px-4 pt-4 pb-3 shrink-0">
        <div className="flex items-center gap-3 mb-3">
          <Link href="/host/negotiations">
            <ArrowLeft size={20} className="text-airbnb-dark" />
          </Link>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-airbnb-dark truncate">
              {listing.title}
            </p>
            <p className="text-xs text-airbnb-gray">{listing.area}, {listing.state}</p>
          </div>
          <div className="relative w-10 h-10 shrink-0">
            <Image
              src={images[0] ?? "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800"}
              alt={listing.title}
              fill
              className="object-cover rounded-lg"
              sizes="40px"
            />
          </div>
        </div>

        <div className="bg-sky-50 rounded-xl p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot size={14} className="text-airbnb-pink" />
            <span className="text-xs font-medium text-airbnb-dark">
              AI agent negotiating on behalf of a guest
            </span>
          </div>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
            negotiation.status === "active"
              ? "bg-green-100 text-green-700"
              : negotiation.status === "accepted"
              ? "bg-blue-100 text-blue-700"
              : "bg-red-100 text-red-700"
          }`}>
            {negotiation.status}
          </span>
        </div>
      </div>

      <HostNegotiateChat
        negotiation={negotiation}
        initialTurns={turns}
        listedPrice={listing.nightly_price}
        listingTitle={listing.title}
      />
    </div>
  );
}
