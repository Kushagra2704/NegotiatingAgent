
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, X, ChevronRight, Star } from "lucide-react";
import { getListingById, getImages } from "@/lib/listings";

export const dynamic = 'force-dynamic';

export default async function ConfirmPayPage(
  props: PageProps<"/book/[id]/confirm">
) {
  const { id } = await props.params;
  const listing = await getListingById(id);
  if (!listing) notFound();

  const images = getImages(listing);
  const nights = 2;
  const baseTotal = listing.nightly_price * nights;
  const specialOffer1 = Math.round(baseTotal * 0.14);
  const specialOffer2 = Math.round(baseTotal * 0.175);
  const airbnbDiscount = 97;
  const taxes = Math.round(baseTotal * 0.024);
  const finalTotal = baseTotal - specialOffer1 - specialOffer2 - airbnbDiscount + taxes;

  return (
    <div className="bg-white min-h-dvh pb-32">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-5 pb-4">
        <Link href={`/book/${listing.id}/message`}>
          <ArrowLeft size={22} className="text-airbnb-dark" />
        </Link>
        <h1 className="text-base font-semibold text-airbnb-dark">
          Confirm and pay
        </h1>
        <Link href={`/listing/${listing.id}`}>
          <X size={22} className="text-airbnb-dark" />
        </Link>
      </div>

      <div className="px-4 space-y-0">
        {/* Property summary card */}
        <div className="border border-airbnb-border rounded-2xl overflow-hidden mb-5">
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
                <span className="text-xs">{listing.rating}</span>
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

          <div className="border-t border-airbnb-border px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-airbnb-dark">Guests</p>
              <p className="text-sm text-airbnb-dark">1 adult</p>
            </div>
            <button className="border border-airbnb-border rounded-xl px-4 py-2 text-xs font-semibold text-airbnb-dark">
              Change
            </button>
          </div>

          <div className="border-t border-airbnb-border px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-airbnb-dark">
                Total price
              </p>
              <p className="text-sm text-airbnb-dark">
                ₹{finalTotal.toLocaleString("en-IN")} including taxes INR
              </p>
              <p className="text-sm text-airbnb-gold font-medium">
                ₹{airbnbDiscount}.17 discount applied
              </p>
            </div>
            <button className="border border-airbnb-border rounded-xl px-4 py-2 text-xs font-semibold text-airbnb-dark">
              Details
            </button>
          </div>

          <div className="border-t border-airbnb-border px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-airbnb-dark">
                Free cancellation
              </p>
              <p className="text-sm text-airbnb-dark">
                {listing.cancellation_policy}
              </p>
            </div>
          </div>
        </div>

        {/* Message to host */}
        <button className="w-full flex items-center justify-between border border-airbnb-border rounded-2xl px-4 py-4 mb-5">
          <div className="text-left">
            <p className="text-sm font-semibold text-airbnb-dark">
              Message to the host
            </p>
            <p className="text-sm text-airbnb-gray">hi</p>
          </div>
          <ChevronRight size={18} className="text-airbnb-gray shrink-0" />
        </button>

        {/* Price details */}
        <div>
          <h3 className="text-base font-semibold text-airbnb-dark mb-3">
            Price details
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-airbnb-dark">
                {nights} nights x ₹{listing.nightly_price.toLocaleString("en-IN")}
              </span>
              <span className="text-airbnb-dark font-medium">
                ₹{baseTotal.toLocaleString("en-IN")}.00
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-airbnb-dark">Special offer</span>
              <span className="text-airbnb-green font-medium">
                -₹{specialOffer1.toLocaleString("en-IN")}.84
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-airbnb-dark">Special offer</span>
              <span className="text-airbnb-green font-medium">
                -₹{specialOffer2.toLocaleString("en-IN")}.45
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-airbnb-dark">Discount from NegotiateAI</span>
              <span className="text-airbnb-green font-medium">
                -₹{airbnbDiscount}.17
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-airbnb-dark">Taxes</span>
              <span className="text-airbnb-dark font-medium">
                ₹{taxes.toLocaleString("en-IN")}.04
              </span>
            </div>
            <div className="border-t border-airbnb-border pt-3 flex items-center justify-between">
              <span className="text-sm font-bold text-airbnb-dark">Total (INR)</span>
              <span className="text-sm font-bold text-airbnb-dark">
                ₹{finalTotal.toLocaleString("en-IN")}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky confirm button */}
      <div className="fixed bottom-0 inset-x-0 max-w-[430px] mx-auto bg-white border-t border-airbnb-border px-4 py-4 z-50">
        <button className="w-full bg-airbnb-pink text-white font-semibold py-4 rounded-xl text-sm">
          Confirm and pay
        </button>
      </div>
    </div>
  );
}
