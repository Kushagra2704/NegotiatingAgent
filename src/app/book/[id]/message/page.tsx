export const instant = false;

import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, X } from "lucide-react";
import { getListingById } from "@/lib/listings";

export const dynamic = 'force-dynamic';

export default async function MessageHostPage(
  props: PageProps<"/book/[id]/message">
) {
  const { id } = await props.params;
  const listing = await getListingById(id);
  if (!listing) notFound();

  const host = listing.profiles;
  const hostName = host?.full_name ?? "Host";
  const hostAvatar = host?.avatar_url ?? "https://randomuser.me/api/portraits/men/32.jpg";

  return (
    <div className="bg-white min-h-dvh pb-28">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-5 pb-4">
        <Link href={`/book/${listing.id}`}>
          <ArrowLeft size={22} className="text-airbnb-dark" />
        </Link>
        <Link href={`/listing/${listing.id}`}>
          <X size={22} className="text-airbnb-dark" />
        </Link>
      </div>

      <div className="px-4">
        <h1 className="text-2xl font-bold text-airbnb-dark mb-2">
          Message the host
        </h1>
        <p className="text-sm text-airbnb-gray mb-6 leading-relaxed">
          Share why you are traveling, who is coming with you, and what you love
          about the space.
        </p>

        {/* Host card */}
        <div className="bg-airbnb-bg rounded-2xl p-4 mb-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="relative w-12 h-12 shrink-0">
              <Image
                src={hostAvatar}
                alt={hostName}
                fill
                className="rounded-full object-cover"
                sizes="48px"
              />
              {listing.is_superhost && (
                <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-airbnb-pink rounded-full" />
              )}
            </div>
            <div>
              <p className="text-sm font-semibold text-airbnb-dark">
                {hostName}
              </p>
              <p className="text-xs text-airbnb-gray">
                Hosting since {host?.host_since ?? "2019"}
              </p>
            </div>
          </div>
          <p className="text-sm text-airbnb-dark">
            Hello, please let me know a little about your trip
          </p>
        </div>

        {/* Message textarea */}
        <textarea
          rows={5}
          placeholder={`Hi ${hostName}! I'll be visiting...`}
          className="w-full border border-airbnb-border rounded-xl px-4 py-3 text-sm text-airbnb-dark placeholder:text-airbnb-light focus:outline-none focus:border-airbnb-dark resize-none"
        />
      </div>

      {/* Sticky Next button */}
      <div className="fixed bottom-0 inset-x-0 max-w-[430px] mx-auto bg-white px-4 py-4 z-50">
        <div className="flex gap-1 mb-3 h-0.5">
          <div className="flex-1 bg-airbnb-dark rounded-full" />
          <div className="flex-1 bg-airbnb-dark rounded-full" />
          <div className="flex-1 bg-airbnb-light rounded-full" />
        </div>
        <Link
          href={`/book/${listing.id}/confirm`}
          className="block w-full bg-airbnb-dark text-white font-semibold py-4 rounded-xl text-sm text-center"
        >
          Next
        </Link>
      </div>
    </div>
  );
}
