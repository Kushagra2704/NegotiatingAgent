export const instant = false;

import Image from "next/image";
import Link from "next/link";
import { Luggage, Bot, TrendingDown, CalendarDays, CheckCircle2, Clock, XCircle } from "lucide-react";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getRazorpay } from "@/lib/razorpay";
import SmartBottomNav from "@/components/SmartBottomNav";

type BookingStatus = "pending" | "confirmed" | "cancelled" | "completed";

const STATUS_CONFIG: Record<BookingStatus, { label: string; color: string; icon: React.ReactNode }> = {
  confirmed:  { label: "Confirmed",  color: "bg-green-100 text-green-700",  icon: <CheckCircle2 size={12} /> },
  completed:  { label: "Completed",  color: "bg-blue-100 text-blue-700",    icon: <CheckCircle2 size={12} /> },
  pending:    { label: "Pending",    color: "bg-yellow-100 text-yellow-700", icon: <Clock size={12} /> },
  cancelled:  { label: "Cancelled",  color: "bg-red-100 text-red-700",      icon: <XCircle size={12} /> },
};

function fmt(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
  });
}

const BOOKING_QUERY = `
  id, check_in_date, check_out_date, nights, nightly_price, total_price,
  status, payment_status, negotiation_id, listing_id, created_at,
  razorpay_order_id, razorpay_payment_id,
  listings (
    id, title, area, state, nightly_price,
    listing_images ( url, position )
  )
` as const;

async function fetchAndSyncBookings() {
  const { data, error } = await supabaseAdmin
    .from("bookings")
    .select(BOOKING_QUERY)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) console.error("[trips] query error:", error);

  const rows = (data ?? []) as unknown as BookingRaw[];

  // Sync bookings stuck in "auto_processing" — payment went through on Razorpay
  // but the polling loop timed out before confirming. Re-check Razorpay now.
  const needsSync = rows.filter((b) => b.payment_status === "auto_processing");
  if (needsSync.length === 0) return rows;

  const razorpay = getRazorpay();
  await Promise.allSettled(
    needsSync.map(async (bk) => {
      try {
        let captured = false;
        let paymentId = bk.razorpay_payment_id;

        if (paymentId) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const p = await (razorpay as any).payments.fetch(paymentId);
          captured = p.status === "captured" || p.status === "authorized";
        } else if (bk.razorpay_order_id) {
          // Check order status first — most reliable signal
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const order = await (razorpay as any).orders.fetch(bk.razorpay_order_id);
          if (order?.status === "paid") {
            captured = true;
            // Also try to get the payment ID from order payments
            try {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const orderPayments = await (razorpay as any).orders.fetchPayments(bk.razorpay_order_id);
              // fetchPayments may return { items: [...] } or an array directly
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const items: any[] = Array.isArray(orderPayments)
                ? orderPayments
                : (orderPayments?.items ?? []);
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const paid = items.find((p: any) => p.status === "captured" || p.status === "authorized");
              if (paid) paymentId = paid.id;
            } catch { /* payment ID is optional — order status is enough */ }
          }
        }

        if (captured) {
          await supabaseAdmin
            .from("bookings")
            .update({
              status: "confirmed",
              payment_status: "paid",
              ...(paymentId ? { razorpay_payment_id: paymentId } : {}),
            })
            .eq("id", bk.id);
        }
      } catch (e) {
        console.error("[trips] sync error for booking", bk.id, e);
      }
    })
  );

  // Re-fetch after updating so the page renders the correct statuses
  const { data: refreshed } = await supabaseAdmin
    .from("bookings")
    .select(BOOKING_QUERY)
    .order("created_at", { ascending: false })
    .limit(50);

  return (refreshed ?? []) as unknown as BookingRaw[];
}

type BookingRaw = {
  id: string;
  check_in_date: string;
  check_out_date: string;
  nights: number;
  nightly_price: number;
  total_price: number;
  status: BookingStatus;
  payment_status: string;
  negotiation_id: string | null;
  listing_id: string;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  created_at: string;
  listings: {
    id: string; title: string; area: string; state: string; nightly_price: number;
    listing_images: { url: string; position: number }[];
  } | null;
};

export default async function TripsPage() {
  const all = await fetchAndSyncBookings();

  return (
    <div className="pb-24 min-h-dvh bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-6 pb-4 border-b border-airbnb-border">
        <h1 className="text-2xl font-bold text-airbnb-dark">My Trips</h1>
        <Luggage size={22} className="text-airbnb-pink" />
      </div>

      {all.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-8 pt-20 pb-8">
          <div className="mb-6 w-16 h-16 bg-airbnb-bg rounded-full flex items-center justify-center">
            <Luggage size={28} className="text-airbnb-pink" />
          </div>
          <h2 className="text-xl font-bold text-airbnb-dark mb-2">No trips yet</h2>
          <p className="text-sm text-airbnb-gray text-center leading-relaxed mb-8">
            Once your AI agent closes a deal, your confirmed stays will appear here.
          </p>
          <Link
            href="/"
            className="bg-airbnb-pink text-white font-semibold text-sm px-8 py-3 rounded-xl"
          >
            Browse listings
          </Link>
        </div>
      ) : (
        <div className="divide-y divide-airbnb-border">
          {all.map((booking) => {
            const listing = booking.listings;
            if (!listing) return null;

            const images = [...(listing.listing_images ?? [])]
              .sort((a, b) => a.position - b.position)
              .map((i) => i.url);
            const thumb = images[0] ?? "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=400";

            const statusCfg = STATUS_CONFIG[booking.status] ?? {
              label: booking.status,
              color: "bg-gray-100 text-gray-600",
              icon: null,
            };

            const listedPrice = listing.nightly_price;
            const paidPrice = booking.nightly_price;
            const savedPct = paidPrice < listedPrice
              ? Math.round(((listedPrice - paidPrice) / listedPrice) * 100)
              : 0;

            const href = booking.negotiation_id
              ? `/negotiate/${booking.negotiation_id}`
              : `/listing/${booking.listing_id}`;

            return (
              <Link
                key={booking.id}
                href={href}
                className="flex gap-4 px-4 py-5 hover:bg-airbnb-bg transition-colors"
              >
                {/* Thumbnail */}
                <div className="relative w-24 h-20 shrink-0 rounded-xl overflow-hidden">
                  <Image
                    src={thumb}
                    alt={listing.title}
                    fill
                    className="object-cover"
                    sizes="96px"
                  />
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-0.5">
                    <p className="text-sm font-semibold text-airbnb-dark leading-snug truncate">
                      {listing.title}
                    </p>
                    <span className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${statusCfg.color}`}>
                      {statusCfg.icon}
                      {statusCfg.label}
                    </span>
                  </div>

                  <p className="text-xs text-airbnb-gray mb-2">
                    {listing.area}, {listing.state}
                  </p>

                  {/* Dates */}
                  <div className="flex items-center gap-1.5 mb-2">
                    <CalendarDays size={11} className="text-airbnb-gray shrink-0" />
                    <p className="text-xs text-airbnb-gray">
                      {fmt(booking.check_in_date)} → {fmt(booking.check_out_date)}
                      <span className="ml-1 text-airbnb-light">· {booking.nights}n</span>
                    </p>
                  </div>

                  {/* Price */}
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-semibold text-airbnb-dark">
                      ₹{booking.nightly_price.toLocaleString("en-IN")}/night
                    </p>
                    {savedPct > 0 && (
                      <span className="flex items-center gap-0.5 text-xs font-medium text-green-600">
                        <TrendingDown size={11} />
                        {savedPct}% off
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-airbnb-gray mt-0.5">
                    Total: ₹{booking.total_price.toLocaleString("en-IN")}
                    {booking.payment_status === "paid" && (
                      <span className="ml-2 text-green-600 font-medium">· Paid</span>
                    )}
                  </p>

                  {/* AI negotiated badge */}
                  {booking.negotiation_id && (savedPct > 0) && (
                    <div className="flex items-center gap-1 mt-1.5">
                      <Bot size={10} className="text-airbnb-pink" />
                      <span className="text-[10px] text-airbnb-pink font-medium">
                        AI-negotiated price
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
