import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getListingById } from "@/lib/listings";
import NegotiateSetup from "./NegotiateSetup";

export default async function NegotiateSetupPage(
  props: PageProps<"/listing/[id]/negotiate">
) {
  const { id } = await props.params;
  const listing = await getListingById(id);
  if (!listing) notFound();

  return (
    <div className="bg-white min-h-dvh pb-10">
      <div className="px-4 pt-5 pb-3 flex items-center gap-3 border-b border-airbnb-border">
        <Link href={`/listing/${id}`}>
          <ArrowLeft size={20} className="text-airbnb-dark" />
        </Link>
        <div>
          <h1 className="text-base font-bold text-airbnb-dark">Set up your AI agent</h1>
          <p className="text-xs text-airbnb-gray truncate max-w-[260px]">{listing.title}</p>
        </div>
      </div>

      <NegotiateSetup listing={listing} />
    </div>
  );
}
