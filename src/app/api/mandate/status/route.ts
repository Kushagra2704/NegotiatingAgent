import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.replace("Bearer ", "");
  if (!token) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const anonClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { data: { user } } = await anonClient.auth.getUser(token);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { data: pm } = await supabaseAdmin
    .from("user_payment_methods")
    .select("razorpay_token_id, mandate_amount")
    .eq("user_id", user.id)
    .single();

  return Response.json({
    has_mandate: !!(pm?.razorpay_token_id),
    mandate_amount: pm?.mandate_amount ?? 0,
  });
}
