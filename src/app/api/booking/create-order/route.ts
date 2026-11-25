import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createClient } from "@supabase/supabase-js";
import { getRazorpay } from "@/lib/razorpay";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.replace("Bearer ", "");
  if (!token) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const anonClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { data: { user } } = await anonClient.auth.getUser(token);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { negotiation_id } = await req.json() as { negotiation_id: string };
  if (!negotiation_id) return Response.json({ error: "negotiation_id required" }, { status: 400 });

  // Fetch negotiation
  const { data: neg } = await supabaseAdmin
    .from("negotiations")
    .select("*")
    .eq("id", negotiation_id)
    .single();

  if (!neg) return Response.json({ error: "Not found" }, { status: 404 });
  if (neg.guest_id !== user.id) return Response.json({ error: "Forbidden" }, { status: 403 });
  if (neg.status !== "accepted") return Response.json({ error: "Deal not yet accepted" }, { status: 409 });
  if (neg.booking_id) {
    // Booking already created — return existing order info
    const { data: existing } = await supabaseAdmin
      .from("bookings")
      .select("id, razorpay_order_id, total_price, nightly_price")
      .eq("id", neg.booking_id)
      .single();
    return Response.json({ booking_id: existing?.id, razorpay_order_id: existing?.razorpay_order_id, amount: existing?.total_price });
  }

  // Fetch listing for details
  const { data: listing } = await supabaseAdmin
    .from("listings")
    .select("id, title, nightly_price, check_in, check_out")
    .eq("id", neg.listing_id)
    .single();

  const agreedPrice = neg.current_offer ?? listing?.nightly_price ?? 0;
  let nights = 2;
  try { nights = JSON.parse(neg.outcome_note ?? "{}").nights ?? 2; } catch { /* default */ }
  const totalPrice = agreedPrice * nights;

  // Create Razorpay order (amount in paise)
  const razorpay = getRazorpay();
  const order = await razorpay.orders.create({
    amount: totalPrice * 100,
    currency: "INR",
    receipt: `neg_${negotiation_id.slice(0, 8)}`,
    notes: {
      negotiation_id,
      listing_id: neg.listing_id,
      guest_id: user.id,
    },
  });

  // Create booking row
  const checkIn = new Date();
  checkIn.setDate(checkIn.getDate() + 7);
  const checkOut = new Date(checkIn);
  checkOut.setDate(checkOut.getDate() + nights);

  const { data: booking } = await supabaseAdmin
    .from("bookings")
    .insert({
      listing_id: neg.listing_id,
      guest_id: user.id,
      negotiation_id,
      check_in_date: checkIn.toISOString().split("T")[0],
      check_out_date: checkOut.toISOString().split("T")[0],
      nights,
      guests: 1,
      nightly_price: agreedPrice,
      total_price: totalPrice,
      status: "pending",
      razorpay_order_id: order.id,
      payment_status: "initiated",
    })
    .select()
    .single();

  // Link booking to negotiation
  await supabaseAdmin
    .from("negotiations")
    .update({ booking_id: booking?.id })
    .eq("id", negotiation_id);

  return Response.json({
    booking_id: booking?.id,
    razorpay_order_id: order.id,
    amount: totalPrice,
    currency: "INR",
    nights,
    agreed_price: agreedPrice,
    listing_title: listing?.title ?? "",
  });
}
