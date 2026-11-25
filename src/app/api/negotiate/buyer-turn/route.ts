import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  // Auth — buyer must be logged in
  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.replace("Bearer ", "");
  if (!token) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const anonClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { data: { user }, error: authError } = await anonClient.auth.getUser(token);
  if (authError || !user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { negotiation_id, message } = body as {
    negotiation_id: string;
    message: string;
  };

  if (!negotiation_id || !message?.trim()) {
    return Response.json({ error: "negotiation_id and message are required" }, { status: 400 });
  }

  // Verify this negotiation belongs to the authenticated buyer
  const { data: neg, error: negError } = await supabaseAdmin
    .from("negotiations")
    .select("id, status, guest_id")
    .eq("id", negotiation_id)
    .single();

  if (negError || !neg) {
    return Response.json({ error: "Negotiation not found" }, { status: 404 });
  }
  if (neg.guest_id !== user.id) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  if (neg.status !== "active") {
    return Response.json({ error: "Negotiation is not active" }, { status: 409 });
  }

  // Determine next turn number
  const { data: lastTurn } = await supabaseAdmin
    .from("turns")
    .select("turn_number")
    .eq("negotiation_id", negotiation_id)
    .order("turn_number", { ascending: false })
    .limit(1)
    .single();

  const nextTurnNumber = (lastTurn?.turn_number ?? 0) + 1;

  // Mark negotiation as buyer-override so the agent stays out until resumed
  await supabaseAdmin
    .from("negotiations")
    .update({ buyer_override: true })
    .eq("id", negotiation_id);

  // Save the buyer's direct message
  const { data: turn, error: insertError } = await supabaseAdmin
    .from("turns")
    .insert({
      negotiation_id,
      turn_number: nextTurnNumber,
      role: "buyer",
      message: message.trim(),
      action: null,
      allowed_offer: null,
      model_used: null,
      is_critical: false,
      latency_ms: 0,
      prompt_tokens: 0,
      completion_tokens: 0,
      cost_usd: 0,
      guardrail_passed: true,
    })
    .select()
    .single();

  if (insertError || !turn) {
    return Response.json({ error: "Failed to save message" }, { status: 500 });
  }

  return Response.json({ turn });
}
