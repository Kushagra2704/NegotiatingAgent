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
  if (neg.status !== "accepted") return Response.json({ error: "Deal not accepted" }, { status: 409 });

  // Idempotency — booking already created
  if (neg.booking_id) {
    const { data: existing } = await supabaseAdmin
      .from("bookings")
      .select("id, payment_status")
      .eq("id", neg.booking_id)
      .single();
    return Response.json({ ok: true, booking_id: existing?.id, auto_charged: true });
  }

  const { data: listing } = await supabaseAdmin
    .from("listings")
    .select("title, nightly_price")
    .eq("id", neg.listing_id)
    .single();

  const agreedPrice = neg.current_offer ?? listing?.nightly_price ?? 0;
  let nights = 2;
  try { nights = JSON.parse(neg.outcome_note ?? "{}").nights ?? 2; } catch { /* default */ }
  const totalAmount = agreedPrice * nights;
  const amountPaise = totalAmount * 100;

  const razorpay = getRazorpay();

  // Step 1: Create order
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const order = await (razorpay as any).orders.create({
    amount: amountPaise,
    currency: "INR",
    payment_capture: 1,
    receipt: `auto_${negotiation_id.slice(0, 8)}`,
    notes: { negotiation_id, type: "auto_charge" },
  });

  // Step 2: Trigger payment server-side via UPI collect
  // In Razorpay test mode, success@razorpay auto-approves without any user interaction
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let paymentId = "";
  let paymentStatus = "auto_processing";

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const paymentResp = await (razorpay as any).payments.createPaymentJson({
      amount: amountPaise,
      currency: "INR",
      order_id: order.id,
      method: "upi",
      vpa: "success@razorpay",
      email: user.email ?? "demo@negotiagent.com",
      contact: "9999999999",
      notes: { negotiation_id },
    });

    paymentId = paymentResp?.razorpay_payment_id ?? paymentResp?.id ?? "";

    // Poll briefly for payment completion (test mode resolves quickly)
    if (paymentId) {
      for (let i = 0; i < 6; i++) {
        await new Promise((r) => setTimeout(r, 800));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const p = await (razorpay as any).payments.fetch(paymentId);
        if (p.status === "captured" || p.status === "authorized") {
          paymentStatus = "paid";
          if (p.status === "authorized") {
            try { await razorpay.payments.capture(paymentId, amountPaise, "INR"); } catch { /* already captured */ }
          }
          break;
        }
        if (p.status === "failed") break;
      }
    }
  } catch (err) {
    console.error("[auto-charge] payment error:", err);
    // Don't block booking creation — confirm optimistically for demo
  }

  // Step 3: Create booking row
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
      total_price: totalAmount,
      status: paymentStatus === "paid" ? "confirmed" : "pending",
      razorpay_order_id: order.id,
      razorpay_payment_id: paymentId || null,
      payment_status: paymentStatus,
    })
    .select()
    .single();

  await supabaseAdmin
    .from("negotiations")
    .update({ booking_id: booking?.id })
    .eq("id", negotiation_id);

  return Response.json({
    ok: true,
    booking_id: booking?.id,
    auto_charged: true,
    agreed_price: agreedPrice,
    nights,
    total: totalAmount,
  });
}
