// GET /api/negotiate/poll?negotiation_id=<uuid>
// Returns the latest turns + negotiation status for a negotiation.
// Uses the admin client so it bypasses RLS — safe because we verify the
// caller is authenticated (any signed-in user can read a specific negotiation).

import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(request: Request) {
  const authHeader = request.headers.get("Authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");

  const { data: { user } } = await supabaseAdmin.auth.getUser(token);
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const negotiationId = url.searchParams.get("negotiation_id");
  if (!negotiationId) {
    return Response.json({ error: "Missing negotiation_id" }, { status: 400 });
  }

  const [{ data: turns }, { data: negotiation }] = await Promise.all([
    supabaseAdmin
      .from("turns")
      .select("*")
      .eq("negotiation_id", negotiationId)
      .order("turn_number", { ascending: true }),
    supabaseAdmin
      .from("negotiations")
      .select("status, current_offer, buyer_override, close_mode")
      .eq("id", negotiationId)
      .single(),
  ]);

  return Response.json({
    turns: turns ?? [],
    status: negotiation?.status ?? "active",
    current_offer: negotiation?.current_offer ?? null,
    buyer_override: negotiation?.buyer_override ?? false,
    close_mode: negotiation?.close_mode ?? "auto",
  });
}
