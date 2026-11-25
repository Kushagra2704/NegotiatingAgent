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

  const { payment_id, customer_id } = await req.json() as {
    payment_id: string;
    customer_id: string;
  };

  const razorpay = getRazorpay();
  const payment = await razorpay.payments.fetch(payment_id);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const token_id = (payment as any).token_id as string | undefined;

  await supabaseAdmin
    .from("user_payment_methods")
    .upsert(
      {
        user_id: user.id,
        razorpay_customer_id: customer_id,
        razorpay_token_id: token_id ?? null,
        mandate_amount: 1000000, // ₹10,000 in paise
      },
      { onConflict: "user_id" }
    );

  return Response.json({ ok: true, token_id });
}
