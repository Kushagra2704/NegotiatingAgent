import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createClient } from "@supabase/supabase-js";
import { callNegotiationLLM } from "@/lib/openrouter";
import { runRulesEngine } from "@/lib/rulesEngine";

// Acceptance-phrase detector — covers direct buyer-override resumption
const ACCEPT_PHRASES = [
  "sounds good", "ok deal", "deal", "agreed", "confirmed", "sure",
  "yes", "okay", "accept", "book it", "let's do it", "done", "perfect",
  "that works", "fine", "alright", "works for me", "works for us",
  "seals the deal", "close the deal", "let's go ahead", "happy with that",
  "good to go", "great", "can do", "no problem", "absolutely",
];
function looksLikeAcceptance(msg: string): boolean {
  const lower = msg.toLowerCase().replace(/[^a-z0-9 ]/g, " ");
  return ACCEPT_PHRASES.some((p) => lower.includes(p));
}

// If the host message contains the same price the buyer offered, treat it as acceptance
// regardless of phrasing — covers "8200 works for me as well", "8200 is fine", etc.
function hostConfirmedBuyerPrice(hostMsg: string, buyerPrice: number): boolean {
  if (buyerPrice <= 0) return false;
  const hostNum = hostMsg.match(/[\d,]+/g)
    ?.map((n) => parseInt(n.replace(/,/g, ""), 10))
    .find((n) => n > 0);
  return hostNum === buyerPrice;
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.replace("Bearer ", "");
  if (!token) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const anonClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { data: { user }, error: authError } = await anonClient.auth.getUser(token);
  if (authError || !user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { negotiation_id } = await req.json() as { negotiation_id: string };
  if (!negotiation_id) return Response.json({ error: "negotiation_id required" }, { status: 400 });

  const { data: neg } = await supabaseAdmin
    .from("negotiations")
    .select("*")
    .eq("id", negotiation_id)
    .single();

  if (!neg) return Response.json({ error: "Not found" }, { status: 404 });
  if (neg.guest_id !== user.id) return Response.json({ error: "Forbidden" }, { status: 403 });
  if (neg.status !== "active") return Response.json({ error: "Not active" }, { status: 409 });

  // Clear the override flag
  await supabaseAdmin
    .from("negotiations")
    .update({ buyer_override: false })
    .eq("id", negotiation_id);

  // Fetch all turns to understand current state
  const { data: priorTurns } = await supabaseAdmin
    .from("turns")
    .select("*")
    .eq("negotiation_id", negotiation_id)
    .order("turn_number", { ascending: true });

  const turns = priorTurns ?? [];
  const nextTurnNumber = (turns.at(-1)?.turn_number ?? 0) + 1;

  // Find last host turn
  const lastHostTurn = [...turns].reverse().find((t) => t.role === "host");
  const lastHostMsg = lastHostTurn?.message ?? "";

  // Find last buyer offer (from buyer direct turns)
  const lastBuyerTurn = [...turns].reverse().find((t) => t.role === "buyer");
  const extractPrice = (msg: string) => {
    const m = msg.match(/[\d,]+/);
    return m ? parseInt(m[0].replace(/,/g, ""), 10) : 0;
  };
  const buyerDirectOffer = lastBuyerTurn ? extractPrice(lastBuyerTurn.message) : 0;
  const agreedPrice = buyerDirectOffer || (neg.current_offer ?? 0);

  // If the host's last message looks like an acceptance of the buyer's direct offer, close the deal.
  // Also close if the host simply echoes back the buyer's price (e.g. "8200 works for me as well").
  const hostAccepted =
    (looksLikeAcceptance(lastHostMsg) && agreedPrice > 0) ||
    hostConfirmedBuyerPrice(lastHostMsg, buyerDirectOffer);
  if (hostAccepted && agreedPrice > 0) {
    const closingMsg = `Great — it's settled at ₹${agreedPrice.toLocaleString("en-IN")}/night. Looking forward to your stay!`;

    const { data: agentTurn } = await supabaseAdmin
      .from("turns")
      .insert({
        negotiation_id,
        turn_number: nextTurnNumber,
        role: "agent",
        message: closingMsg,
        action: "accept",
        allowed_offer: agreedPrice,
        model_used: "resume:auto-close",
        is_critical: true,
        latency_ms: 0,
        prompt_tokens: 0,
        completion_tokens: 0,
        cost_usd: 0,
        guardrail_passed: true,
      })
      .select()
      .single();

    await supabaseAdmin
      .from("negotiations")
      .update({
        status: "accepted",
        current_offer: agreedPrice,
        ended_at: new Date().toISOString(),
      })
      .eq("id", negotiation_id);

    return Response.json({ ok: true, agent_turn: agentTurn, deal_closed: true, final_price: agreedPrice, close_mode: neg.close_mode ?? "auto" });
  }

  // Otherwise — run the rules engine and generate a fresh agent message
  const { data: listingData } = await supabaseAdmin
    .from("listings")
    .select("nightly_price")
    .eq("id", neg.listing_id)
    .single();

  const agentTurns = turns.filter((t) => t.role === "agent");
  let consecutive_holds = 0;
  for (const t of [...agentTurns].reverse()) {
    if (t.action === "hold") consecutive_holds++;
    else break;
  }

  const hostLastOffer = lastBuyerTurn ? extractPrice(lastBuyerTurn.message) : (neg.current_offer ?? 0);
  const decision = runRulesEngine({
    listed_price: listingData?.nightly_price ?? 0,
    target_price: neg.target_price,
    walk_away_price: neg.walk_away_price,
    current_offer: neg.current_offer ?? 0,
    host_last_offer: hostLastOffer,
    host_prev_offer: 0,
    turn_number: nextTurnNumber,
    max_turns: neg.max_turns,
    comparable_price: neg.comparable_price ?? undefined,
    consecutive_holds,
  });

  let agentMessage = "";
  try {
    const llmResult = await callNegotiationLLM({
      listing_title: "",
      area: "",
      state: "",
      listed_price: listingData?.nightly_price ?? 0,
      guest_name: "Guest",
      turn_number: nextTurnNumber,
      max_turns: neg.max_turns,
      decision,
      history: turns,
      desired_addons: neg.desired_addons,
    });
    agentMessage = llmResult.message;
  } catch {
    agentMessage = `I've taken back the negotiation. My current offer stands at ₹${(neg.current_offer ?? 0).toLocaleString("en-IN")}/night — happy to continue from here.`;
  }

  const { data: agentTurn } = await supabaseAdmin
    .from("turns")
    .insert({
      negotiation_id,
      turn_number: nextTurnNumber,
      role: "agent",
      message: agentMessage,
      action: decision.action,
      allowed_offer: decision.allowed_offer || neg.current_offer,
      model_used: "resume",
      is_critical: false,
      latency_ms: 0,
      prompt_tokens: 0,
      completion_tokens: 0,
      cost_usd: 0,
      guardrail_passed: true,
    })
    .select()
    .single();

  return Response.json({ ok: true, agent_turn: agentTurn, deal_closed: false });
}
