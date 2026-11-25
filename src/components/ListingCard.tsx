"use client";

import Image from "next/image";
import Link from "next/link";
import { Heart, Star } from "lucide-react";
import type { ListingFull } from "@/lib/database.types";
import { getImages } from "@/lib/listings";

interface ListingCardProps {
  listing: ListingFull;
  nights?: number;
}

export default function ListingCard({ listing, nights = 2 }: ListingCardProps) {
  const images = getImages(listing);

  return (
    <Link href={`/listing/${listing.id}`} className="block">
      <div className="relative aspect-square rounded-xl overflow-hidden mb-2">
        <Image
          src={images[0] ?? "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800"}
          alt={listing.title}
          fill
          className="object-cover"
          sizes="(max-width: 430px) 50vw, 215px"
        />
        {listing.is_guest_favorite && (
          <div className="absolute top-2 left-2 bg-white rounded-full px-2.5 py-1 text-xs font-semibold shadow-sm">
            Guest favorite
          </div>
        )}
        <button
          onClick={(e) => e.preventDefault()}
          className="absolute top-2 right-2 w-8 h-8 flex items-center justify-center"
        >
          <Heart
            size={20}
            className="text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]"
            strokeWidth={2}
          />
        </button>
      </div>

      <div>
        <div className="flex items-start justify-between gap-1">
          <p className="text-sm text-airbnb-dark font-medium leading-tight truncate">
            {listing.property_type} in {listing.area}
          </p>
          <div className="flex items-center gap-0.5 shrink-0">
            <Star size={12} fill="currentColor" className="text-airbnb-dark" />
            <span className="text-xs text-airbnb-dark font-medium">
              {listing.rating}
            </span>
          </div>
        </div>
        <p className="text-sm text-airbnb-gray truncate">{listing.area}</p>
        <p className="text-sm text-airbnb-gray">Nov 20 – 22</p>
        <p className="text-sm mt-0.5">
          <span className="font-semibold text-airbnb-dark">
            ₹{(listing.nightly_price * nights).toLocaleString("en-IN")}
          </span>
          <span className="text-airbnb-gray"> for {nights} nights</span>
        </p>
      </div>
    </Link>
  );
}
