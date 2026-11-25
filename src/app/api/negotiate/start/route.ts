// POST /api/negotiate/start
// Creates a negotiations row, runs the rules engine for turn 1,
// calls the LLM to phrase the opening offer, saves it to turns.
//
// Body: { listing_id, target_price, walk_away_price, close_mode, nights?, check_in?, check_out? }
// Auth: Bearer token in Authorization header (Supabase JWT)

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { runRulesEngine } from "@/lib/rulesEngine";
import { callNegotiationLLM } from "@/lib/openrouter";
import { getComparablePrice } from "@/lib/ragRetrieval";

export async function POST(request: Request) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const authHeader = request.headers.get("Authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");
  const {
    data: { user },
  } = await supabaseAdmin.auth.getUser(token);

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  const body = await request.json();
  const {
    listing_id,
    target_price,
    walk_away_price,
    close_mode = "auto",
    desired_addons,
    nights = 2,
    check_in,
    check_out,
  } = body as {
    listing_id: string;
    target_price: number;
    walk_away_price: number;
    close_mode?: "auto" | "approval";
    desired_addons?: string[];
    nights?: number;
    check_in?: string;
    check_out?: string;
  };

  if (!listing_id || !target_price || !walk_away_price) {
    return Response.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (walk_away_price <= target_price) {
    return Response.json(
      { error: "walk_away_price must be greater than target_price" },
      { status: 400 }
    );
  }

  // ── Fetch listing ─────────────────────────────────────────────────────────
  const { data: listing, error: listingError } = await supabaseAdmin
    .from("listings")
    .select("id, title, nightly_price, area, state, host_id, bedrooms")
    .eq("id", listing_id)
    .single();

  if (listingError || !listing) {
    return Response.json({ error: "Listing not found" }, { status: 404 });
  }

  // ── Fetch guest profile for name ──────────────────────────────────────────
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .single();

  const guest_name = profile?.full_name ?? user.email?.split("@")[0] ?? "Guest";

  // ── RAG: fetch market comparable price ───────────────────────────────────
  const ragResult = await getComparablePrice({
    area: listing.area,
    nightly_price: listing.nightly_price,
    bedrooms: listing.bedrooms ?? undefined,
  });

  console.log(
    `[RAG] comparable=${ragResult.comparable_price} source=${ragResult.source} ` +
    `sql=${ragResult.debug.sql_count} vec=${ragResult.debug.vector_count} ` +
    `(listing ₹${listing.nightly_price} in ${listing.area})`
  );

  const comparable_price = ragResult.comparable_price;

  // ── Create negotiation row ────────────────────────────────────────────────
  const { data: negotiation, error: negError } = await supabaseAdmin
    .from("negotiations")
    .insert({
      listing_id,
      guest_id: user.id,
      target_price,
      walk_away_price,
      comparable_price,
      close_mode,
      current_offer: null,
      status: "active",
      max_turns: 8,
      desired_addons: desired_addons && desired_addons.length > 0 ? desired_addons : null,
      ended_at: null,
      outcome_note: JSON.stringify({ nights }),
      booking_id: null,
    })
    .select()
    .single();

  if (negError || !negotiation) {
    return Response.json(
      { error: "Failed to create negotiation", detail: negError?.message },
      { status: 500 }
    );
  }

  // ── Run rules engine for turn 1 ───────────────────────────────────────────
  const decision = runRulesEngine({
    listed_price: listing.nightly_price,
    target_price,
    walk_away_price,
    current_offer: 0,
    host_last_offer: 0,
    host_prev_offer: 0,
    turn_number: 1,
    max_turns: negotiation.max_turns,
    comparable_price,
  });

  // ── Call LLM ──────────────────────────────────────────────────────────────
  let llmResult;
  try {
    llmResult = await callNegotiationLLM({
      listing_title: listing.title,
      area: listing.area,
      state: listing.state,
      listed_price: listing.nightly_price,
      guest_name,
      turn_number: 1,
      max_turns: negotiation.max_turns,
      decision,
      history: [],
      desired_addons: negotiation.desired_addons,
    });
  } catch (err) {
    // Clean up the negotiation row so the user can retry
    await supabaseAdmin.from("negotiations").delete().eq("id", negotiation.id);
    return Response.json(
      { error: "LLM call failed", detail: String(err) },
      { status: 502 }
    );
  }

  // ── Save agent turn ───────────────────────────────────────────────────────
  const { data: turn, error: turnError } = await supabaseAdmin
    .from("turns")
    .insert({
      negotiation_id: negotiation.id,
      turn_number: 1,
      role: "agent",
      message: llmResult.message,
      action: decision.action,
      allowed_offer: decision.allowed_offer,
      model_used: llmResult.model_used,
      is_critical: decision.is_critical,
      latency_ms: llmResult.latency_ms,
      prompt_tokens: llmResult.prompt_tokens,
      completion_tokens: llmResult.completion_tokens,
      cost_usd: llmResult.cost_usd,
      guardrail_passed: true, // guardrail phase comes later
    })
    .select()
    .single();

  if (turnError) {
    return Response.json(
      { error: "Failed to save turn", detail: turnError.message },
      { status: 500 }
    );
  }

  // ── Update negotiation with current_offer ─────────────────────────────────
  await supabaseAdmin
    .from("negotiations")
    .update({ current_offer: decision.allowed_offer, turn_count: 1 })
    .eq("id", negotiation.id);

  return Response.json({
    negotiation_id: negotiation.id,
    turn,
    message: llmResult.message,
  });
}
