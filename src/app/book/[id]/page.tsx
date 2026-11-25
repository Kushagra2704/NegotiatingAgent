export const instant = false;

import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { X, Star } from "lucide-react";
import { getListingById, getImages } from "@/lib/listings";

export const dynamic = 'force-dynamic';

export default async function BookReviewPage(props: PageProps<"/book/[id]">) {
  const { id } = await props.params;
  const listing = await getListingById(id);
  if (!listing) notFound();

  const images = getImages(listing);
  const nights = 2;
  const total = listing.nightly_price * nights;
  const discount = listing.original_price
    ? (listing.original_price - listing.nightly_price) * nights
    : 97.17;

  return (
    <div className="bg-white min-h-dvh pb-28">
      {/* Header */}
      <div className="flex items-center justify-end px-4 pt-5 pb-2">
        <Link href={`/listing/${listing.id}`}>
          <X size={22} className="text-airbnb-dark" />
        </Link>
      </div>

      <div className="px-4">
        <h1 className="text-2xl font-bold text-airbnb-dark mb-6">
          Review and continue
        </h1>

        {/* Property card */}
        <div className="border border-airbnb-border rounded-2xl overflow-hidden mb-6">
          <div className="flex gap-3 p-4">
            <div className="relative w-20 h-20 rounded-xl overflow-hidden shrink-0">
              <Image
                src={images[0] ?? "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800"}
                alt={listing.title}
                fill
                className="object-cover"
                sizes="80px"
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-airbnb-dark leading-tight">
                {listing.title}
              </p>
              <div className="flex items-center gap-1 mt-1">
                <Star size={11} fill="currentColor" className="text-airbnb-dark" />
                <span className="text-xs text-airbnb-dark">
                  {listing.rating}
                </span>
                <span className="text-xs text-airbnb-gray">
                  ({listing.review_count})
                </span>
                {listing.is_guest_favorite && (
                  <span className="text-xs text-airbnb-gray">
                    · 🌿 Guest favorite
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Dates row */}
          <div className="border-t border-airbnb-border px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-airbnb-dark">Dates</p>
              <p className="text-sm text-airbnb-dark">
                {listing.check_in} - {listing.check_out}, 2026
              </p>
            </div>
            <button className="border border-airbnb-border rounded-xl px-4 py-2 text-xs font-semibold text-airbnb-dark">
              Change
            </button>
          </div>

          {/* Guests row */}
          <div className="border-t border-airbnb-border px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-airbnb-dark">Guests</p>
              <p className="text-sm text-airbnb-dark">1 adult</p>
            </div>
            <button className="border border-airbnb-border rounded-xl px-4 py-2 text-xs font-semibold text-airbnb-dark">
              Change
            </button>
          </div>

          {/* Total price row */}
          <div className="border-t border-airbnb-border px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-airbnb-dark">
                Total price
              </p>
              <p className="text-sm text-airbnb-dark">
                ₹{total.toLocaleString("en-IN")} including taxes INR
              </p>
              <p className="text-sm text-airbnb-gold font-medium">
                ₹{discount.toFixed(2)} discount applied
              </p>
            </div>
            <button className="border border-airbnb-border rounded-xl px-4 py-2 text-xs font-semibold text-airbnb-dark">
              Details
            </button>
          </div>

          {/* Cancellation row */}
          <div className="border-t border-airbnb-border px-4 py-3">
            <p className="text-sm font-semibold text-airbnb-dark">
              Free cancellation
            </p>
            <p className="text-sm text-airbnb-dark">
              {listing.cancellation_policy}{" "}
              <span className="underline">Full policy</span>
            </p>
          </div>
        </div>
      </div>

      {/* Sticky Next button */}
      <div className="fixed bottom-0 inset-x-0 max-w-[430px] mx-auto bg-white px-4 py-4 z-50">
        {/* Progress dots */}
        <div className="flex gap-1 mb-3 h-0.5">
          <div className="flex-1 bg-airbnb-dark rounded-full" />
          <div className="flex-1 bg-airbnb-light rounded-full" />
          <div className="flex-1 bg-airbnb-light rounded-full" />
        </div>
        <Link
          href={`/book/${listing.id}/message`}
          className="block w-full bg-airbnb-dark text-white font-semibold py-4 rounded-xl text-sm text-center"
        >
          Next
        </Link>
      </div>
    </div>
  );
}
