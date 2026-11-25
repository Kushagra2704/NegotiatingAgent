import { NextRequest } from "next/server";
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

  const razorpay = getRazorpay();

  try {
    // Create or reuse Razorpay customer
    // contact is optional — omit it if empty to avoid validation errors
    const phone: string = user.user_metadata?.phone ?? "";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const customerPayload: Record<string, any> = {
      name: user.user_metadata?.full_name ?? user.email ?? "Guest",
      email: user.email ?? "",
      fail_existing: "0",
    };
    if (phone) customerPayload.contact = phone;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const customer = await (razorpay as any).customers.create(customerPayload);

    // Create a minimal recurring order (₹1 for mandate authorisation)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const order = await (razorpay as any).orders.create({
      amount: 100,
      currency: "INR",
      payment_capture: 1,
      receipt: `mandate_${user.id.slice(0, 8)}`,
      notes: { type: "mandate_setup", user_id: user.id },
    });

    return Response.json({
      razorpay_key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      order_id: order.id,
      customer_id: customer.id,
      amount: 100,
      currency: "INR",
      name: "NegotiAgent",
      description: "One-time mandate — auto-pay up to ₹10,000",
      prefill: {
        name: user.user_metadata?.full_name ?? "",
        email: user.email ?? "",
        contact: phone,
      },
      recurring: 1,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : JSON.stringify(err);
    console.error("[mandate/setup] Razorpay error:", message);
    return Response.json({ error: "Razorpay error", detail: message }, { status: 500 });
  }
}
