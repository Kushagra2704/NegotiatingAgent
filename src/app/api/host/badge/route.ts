// GET /api/host/badge
// Returns how many of the host's active negotiations need a reply
// (last turn is from the agent). Used to drive the nav badge count.

import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(request: Request) {
  const authHeader = request.headers.get("Authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");

  const { data: { user } } = await supabaseAdmin.auth.getUser(token);
  if (!user) return Response.json({ needs_reply: 0 });

  const SEED_HOST_ID = process.env.SEED_HOST_ID ?? "";
  if (!SEED_HOST_ID) return Response.json({ needs_reply: 0 });

  // Active negotiations for this host
  const { data: negs } = await supabaseAdmin
    .from("negotiations")
    .select("id, listings!inner(host_id)")
    .eq("listings.host_id", SEED_HOST_ID)
    .eq("status", "active");

  if (!negs || negs.length === 0) return Response.json({ needs_reply: 0 });

  const negIds = (negs as unknown as { id: string }[]).map((n) => n.id);

  // Last turn per negotiation (highest turn_number)
  const { data: turns } = await supabaseAdmin
    .from("turns")
    .select("negotiation_id, role, turn_number")
    .in("negotiation_id", negIds)
    .order("turn_number", { ascending: false });

  const lastRoleMap = new Map<string, string>();
  for (const t of (turns ?? []) as { negotiation_id: string; role: string; turn_number: number }[]) {
    if (!lastRoleMap.has(t.negotiation_id)) lastRoleMap.set(t.negotiation_id, t.role);
  }

  const needs_reply = [...lastRoleMap.values()].filter((r) => r === "agent").length;
  return Response.json({ needs_reply });
}
