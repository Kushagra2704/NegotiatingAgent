export const instant = false;

import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Bot } from "lucide-react";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getListingById, getImages } from "@/lib/listings";
import NegotiateChat from "./NegotiateChat";
import type { Turn } from "@/lib/database.types";

export const dynamic = 'force-dynamic';

export default async function ActiveNegotiationPage(
  props: PageProps<"/negotiate/[id]">
) {
  const { id } = await props.params;

  // id here is the negotiation UUID, not the listing id
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

  // Check if booking is already confirmed so the chat doesn't re-show the Pay button
  let bookingAlreadyConfirmed = false;
  if (negotiation.booking_id) {
    const { data: booking } = await supabaseAdmin
      .from("bookings")
      .select("payment_status, status")
      .eq("id", negotiation.booking_id)
      .single();
    bookingAlreadyConfirmed =
      booking?.payment_status === "paid" ||
      booking?.payment_status === "auto_processing" || // payment triggered, treat as done
      booking?.status === "confirmed" ||
      booking?.status === "completed";
  }

  return (
    <div className="bg-white min-h-dvh flex flex-col max-h-dvh">
      {/* Header */}
      <div className="border-b border-airbnb-border px-4 pt-4 pb-3 shrink-0">
        <div className="flex items-center gap-3 mb-3">
          <Link href="/messages">
            <ArrowLeft size={20} className="text-airbnb-dark" />
          </Link>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-airbnb-dark truncate">
              {listing.title}
            </p>
            <p className="text-xs text-airbnb-gray">
              {listing.check_in} - {listing.check_out}
            </p>
          </div>
          <div className="relative w-10 h-10 shrink-0">
            <Image
              src={
                images[0] ??
                "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800"
              }
              alt={listing.title}
              fill
              className="object-cover rounded-lg"
              sizes="40px"
            />
          </div>
        </div>

        <div className="bg-airbnb-bg rounded-xl p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <Bot size={14} className="text-airbnb-pink" />
            <span className="text-xs font-medium text-airbnb-dark">
              AI negotiating on your behalf
            </span>
          </div>
          <span className="text-xs text-airbnb-gray">
            {negotiation.status === "active" ? "Active" : negotiation.status}
          </span>
        </div>
      </div>

      {/* Chat component (client) */}
      <NegotiateChat
        negotiation={negotiation}
        initialTurns={turns}
        listedPrice={listing.nightly_price}
        listingTitle={listing.title}
        bookingAlreadyConfirmed={bookingAlreadyConfirmed}
      />
    </div>
  );
}
