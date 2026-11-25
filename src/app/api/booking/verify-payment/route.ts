import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createClient } from "@supabase/supabase-js";
import { verifyPaymentSignature } from "@/lib/razorpay";

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

  const { booking_id, razorpay_order_id, razorpay_payment_id, razorpay_signature } =
    await req.json() as {
      booking_id: string;
      razorpay_order_id: string;
      razorpay_payment_id: string;
      razorpay_signature: string;
    };

  // Verify signature
  const valid = verifyPaymentSignature({
    order_id: razorpay_order_id,
    payment_id: razorpay_payment_id,
    signature: razorpay_signature,
  });

  if (!valid) {
    return Response.json({ error: "Invalid payment signature" }, { status: 400 });
  }

  // Confirm booking
  const { data: booking } = await supabaseAdmin
    .from("bookings")
    .update({
      status: "confirmed",
      razorpay_payment_id,
      payment_status: "paid",
    })
    .eq("id", booking_id)
    .select()
    .single();

  return Response.json({ ok: true, booking });
}
