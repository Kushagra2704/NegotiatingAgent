export const instant = false;

import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Share2, Heart, Star, Shield } from "lucide-react";
import { getListingById, getImages, getAmenities } from "@/lib/listings";

export const dynamic = 'force-dynamic';

export default async function ListingDetailPage(
  props: PageProps<"/listing/[id]">
) {
  const { id } = await props.params;
  const listing = await getListingById(id);
  if (!listing) notFound();

  const images = getImages(listing);
  const amenities = getAmenities(listing);
  const host = listing.profiles;

  const totalPrice = listing.nightly_price * 2;
  const originalTotal = listing.original_price ? listing.original_price * 2 : null;

  return (
    <div className="bg-white pb-28">
      {/* Hero image */}
      <div className="relative h-72 overflow-hidden bg-airbnb-light">
        <Image
          src={images[0] ?? "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800"}
          alt={listing.title}
          fill
          className="object-cover"
          priority
          sizes="430px"
        />
        {/* Top buttons */}
        <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
          <Link
            href="/"
            className="w-9 h-9 bg-white rounded-full flex items-center justify-center shadow-md"
          >
            <ArrowLeft size={18} className="text-airbnb-dark" />
          </Link>
          <div className="flex items-center gap-2">
            <button className="w-9 h-9 bg-white rounded-full flex items-center justify-center shadow-md">
              <Share2 size={16} className="text-airbnb-dark" />
            </button>
            <button className="w-9 h-9 bg-white rounded-full flex items-center justify-center shadow-md">
              <Heart size={16} className="text-airbnb-dark" />
            </button>
          </div>
        </div>
        {/* Image counter */}
        <div className="absolute bottom-3 right-3 bg-white/80 rounded-full px-2.5 py-1 text-xs font-medium text-airbnb-dark">
          1 / {images.length}
        </div>
      </div>

      {/* White content card — overlaps image bottom */}
      <div className="-mt-5 relative bg-white rounded-t-3xl pt-5 px-5 z-10">
        {/* Title */}
        <h1 className="text-xl font-bold text-airbnb-dark leading-tight mb-1">
          {listing.title}
        </h1>
        <p className="text-sm text-airbnb-gray mb-0.5">
          Entire rental unit in {listing.area}, {listing.state}
        </p>
        <p className="text-sm text-airbnb-gray mb-4">
          {listing.max_guests} guests · {listing.bedrooms} bedroom{listing.bedrooms !== 1 ? "s" : ""} · {listing.beds} bed{listing.beds !== 1 ? "s" : ""} · {listing.baths} bath
        </p>

        {/* Stats row */}
        <div className="flex items-center divide-x divide-airbnb-border border border-airbnb-border rounded-2xl overflow-hidden mb-5">
          <div className="flex-1 flex flex-col items-center py-3 px-2">
            <div className="flex items-center gap-1">
              <Star size={14} fill="currentColor" className="text-airbnb-dark" />
              <span className="text-sm font-bold text-airbnb-dark">
                {listing.rating}
              </span>
            </div>
            <div className="flex mt-0.5 gap-0.5">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star
                  key={s}
                  size={8}
                  fill={s <= Math.round(listing.rating ?? 0) ? "currentColor" : "none"}
                  className="text-airbnb-dark"
                />
              ))}
            </div>
          </div>
          <div className="flex-1 flex flex-col items-center py-3 px-2">
            <div className="flex items-center gap-1">
              <span className="text-xs">🌿</span>
              <span className="text-xs font-bold text-airbnb-dark">Guest</span>
              <span className="text-xs">🌿</span>
            </div>
            <span className="text-xs text-airbnb-dark mt-0.5">favorite</span>
          </div>
          <div className="flex-1 flex flex-col items-center py-3 px-2">
            <span className="text-sm font-bold text-airbnb-dark">
              {listing.review_count}
            </span>
            <span className="text-xs text-airbnb-dark mt-0.5">Reviews</span>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-airbnb-border mb-4" />

        {/* Host */}
        <div className="flex items-center gap-3 mb-4">
          <div className="relative w-12 h-12 shrink-0">
            <Image
              src={host?.avatar_url ?? "https://randomuser.me/api/portraits/men/32.jpg"}
              alt={host?.full_name ?? "Host"}
              fill
              className="rounded-full object-cover"
              sizes="48px"
            />
            {listing.is_superhost && (
              <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-airbnb-pink rounded-full flex items-center justify-center">
                <Shield size={9} className="text-white" fill="white" />
              </div>
            )}
          </div>
          <div>
            <p className="text-sm font-semibold text-airbnb-dark">
              Hosted by {host?.full_name ?? "Host"}
            </p>
            <p className="text-xs text-airbnb-gray">
              {listing.is_superhost ? "Superhost · " : ""}
              {host?.host_since ? `${new Date().getFullYear() - host.host_since} years hosting` : ""}
            </p>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-airbnb-border mb-4" />

        {/* Location feature */}
        <div className="flex gap-3 mb-4">
          <div className="text-2xl shrink-0">🏖</div>
          <div>
            <p className="text-sm font-semibold text-airbnb-dark">
              In {listing.area}, near the {listing.state === "Goa" ? "beach" : "hills"}
            </p>
            <p className="text-xs text-airbnb-gray leading-relaxed mt-0.5">
              {listing.location_text}
            </p>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-airbnb-border mb-4" />

        {/* Amenities */}
        <div className="mb-4">
          <h3 className="text-base font-semibold text-airbnb-dark mb-3">
            What this place offers
          </h3>
          <div className="grid grid-cols-2 gap-y-3">
            {amenities.slice(0, 6).map((a) => (
              <div key={a} className="flex items-center gap-2 text-sm text-airbnb-dark">
                <span>✓</span>
                <span>{a}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-airbnb-border mb-4" />

        {/* Description */}
        <div className="mb-4">
          <h3 className="text-base font-semibold text-airbnb-dark mb-2">
            About this place
          </h3>
          <p className="text-sm text-airbnb-gray leading-relaxed">
            {listing.description}
          </p>
        </div>
      </div>

      {/* Sticky booking bar */}
      <div className="fixed bottom-0 inset-x-0 max-w-[430px] mx-auto bg-white border-t border-airbnb-border px-4 py-3 z-50">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="flex items-baseline gap-1.5">
              {originalTotal && (
                <span className="text-sm text-airbnb-gray line-through">
                  ₹{originalTotal.toLocaleString("en-IN")}
                </span>
              )}
              <span className="text-base font-bold text-airbnb-dark">
                ₹{totalPrice.toLocaleString("en-IN")}
              </span>
            </div>
            <p className="text-xs text-airbnb-gray">
              For 2 nights · {listing.check_in} – {listing.check_out}
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href={`/book/${listing.id}`}
              className="border border-airbnb-dark text-airbnb-dark text-sm font-semibold px-4 py-2.5 rounded-xl"
            >
              Reserve
            </Link>
            <Link
              href={`/listing/${listing.id}/negotiate`}
              className="bg-airbnb-pink text-white text-sm font-semibold px-4 py-2.5 rounded-xl whitespace-nowrap"
            >
              🤖 Negotiate
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
