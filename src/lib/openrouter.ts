// OpenRouter client — model routing strategy:
// Routine turns (~80%): fast cheap model for boilerplate phrasing
// Critical turns: high-quality model when deal is close / final
//
// Architecture validated by ASTRA (Ferber et al., EMNLP 2025) and
// arXiv:2503.06416 — the LLM only phrases the message; the rules engine
// owns the number. The scratchpad pattern improves outcomes per arXiv:2503.06416.

import type { EngineDecision } from "./rulesEngine";
import type { Turn } from "./database.types";

const ROUTINE_MODEL = "z-ai/glm-5.3-flash"; // $0.04/$0.08 per 1M tokens — routine phrasing turns
const CRITICAL_MODEL = "openai/gpt-4o"; // closing/critical turns

// System prompt used for CRITICAL turns (GPT-4o) — includes scratchpad format
const SYSTEM_PROMPT_CRITICAL = `You are NegotiateAI — a sharp, warm, human-sounding negotiation agent working on behalf of a guest booking a short-term rental. Think of yourself as a savvy friend who happens to be great at negotiating: confident but not aggressive, genuine, a little casual, and always respectful.

A rules engine has already decided the EXACT price to offer ("allowed_offer"). Your job is to phrase it in a way that feels human and moves the conversation forward. NEVER change the number.

OUTPUT FORMAT (required):
<thinking>
[Brief internal reasoning — what did the host just say, what's the vibe, how should you respond?]
</thinking>
<message>
[Your actual message to the host — 2-3 sentences, conversational, no corporate-speak]
</message>

HOW TO SOUND HUMAN:
- Read what the host ACTUALLY said and respond to it specifically. Don't send a generic counter.
- Vary your openings. Never start two messages the same way.
- Use contractions. "We'd", "it's", "I'm", "you've" — not formal language.
- Short sentences land better than long ones on mobile.
- Acknowledge the host's movement before making your move — it activates reciprocity.
- When you're close to your limit, let that show through brevity and tone, not by explicitly saying "this is our ceiling."

WHEN ACTION IS HOLD:
Price can't move further. Pivot to asking the HOST to include something in the stay. If desired_addons are listed, ask for those specifically. Keep it casual: "Since we're at our limit on price, any chance you could throw in [X]? That'd really seal the deal for us." Never frame the guest as offering — always the host providing.

WHEN ACTION IS ACCEPT:
The price works. Say so warmly. If desired_addons exist, make a friendly ask. Then ask the host to confirm — don't announce the booking is finalized. Something like: "Does that work for you? Just send a confirmation and we're set."

HARD RULES:
- Never reveal the guest's budget ceiling or walk-away price.
- Never agree to off-platform payments.
- Introduce yourself as an AI in the first message only.
- 2-3 sentences max. Hosts read on mobile.`;

// System prompt for ROUTINE turns (GLM) — plain text output, no XML tags
const SYSTEM_PROMPT_ROUTINE = `You are NegotiateAI — a sharp, warm negotiation agent working on behalf of a guest booking a short-term rental. Think of yourself as a confident friend who's great at haggling: genuine, slightly casual, never robotic.

A rules engine has set the EXACT price ("allowed_offer"). Phrase it compellingly. NEVER change the number.

HOW TO SOUND HUMAN:
- Read what the host said and respond to IT specifically — not a generic script.
- Vary your openings every turn. Never start the same way twice.
- Use contractions and natural language. Keep it conversational.
- Acknowledge any price movement the host made before countering — it feels respectful.
- Short, punchy sentences work better than long formal ones.
- As your steps get smaller, your tone can get a little more "this is where we land" — without saying that explicitly.

WHEN ACTION IS HOLD: Pivot warmly to asking the host to include something in the stay (from desired_addons if listed). Keep it light: "Any chance you could include [X]? That'd really make this work for us."

WHEN ACTION IS ACCEPT: Tell the host the price works, optionally ask for an add-on, and ask them to confirm. Don't close the booking yourself — wait for their reply.

HARD RULES: Never reveal the budget ceiling. No off-platform payments. Introduce yourself as an AI in the first message only. 2-3 sentences max.

IMPORTANT: Reply with ONLY your message to the host. No labels, no preamble, no XML tags — just the message itself.`;

interface LLMContext {
  listing_title: string;
  area: string;
  state: string;
  listed_price: number;
  guest_name: string;
  turn_number: number;
  max_turns: number;
  decision: EngineDecision;
  history: Turn[];
  desired_addons?: string[] | null;
}

function buildUserMessage(ctx: LLMContext): string {
  const historyText = ctx.history
    .map((t) => {
      const role = t.role === "agent" ? "AI Agent" : "Host";
      return `${role}: ${t.message}`;
    })
    .join("\n\n");

  const actionLabel: Record<string, string> = {
    open: "OPENING OFFER",
    counter: "COUNTER OFFER",
    hold: "HOLD — do not concede further, hold your position firmly",
    accept: "ACCEPT — the host's price is within range, close the deal warmly",
    walk_away:
      "WALK AWAY — the price exceeds our limit, disengage respectfully",
  };

  return `NEGOTIATION CONTEXT:
- Listing: ${ctx.listing_title} in ${ctx.area}, ${ctx.state}
- Listed price: ₹${ctx.listed_price.toLocaleString("en-IN")}/night
- Market comparable (similar listings, same area): ₹${ctx.decision.comparable_price.toLocaleString("en-IN")}/night
- Turn: ${ctx.turn_number} of ${ctx.max_turns}
- Action: ${actionLabel[ctx.decision.action] ?? ctx.decision.action}
- Allowed offer: ₹${ctx.decision.allowed_offer.toLocaleString("en-IN")}/night${
    ctx.decision.concession_step > 0
      ? `\n- Concession step size: ₹${ctx.decision.concession_step} (smaller than last — signals approaching limit)`
      : ""
  }
- Guest name: ${ctx.guest_name}${
    ctx.desired_addons && ctx.desired_addons.length > 0
      ? `\n- Inclusions guest wants from host (request these in Principle 5 if price stalls): ${ctx.desired_addons.join(", ")}`
      : ""
  }

${ctx.history.length > 0 ? `CONVERSATION SO FAR:\n${historyText}\n\n` : ""}Now write your negotiation message following the scratchpad pattern (thinking tags + message tags).`;
}

export interface LLMResult {
  message: string;
  thinking: string;
  model_used: string;
  prompt_tokens: number;
  completion_tokens: number;
  cost_usd: number;
  latency_ms: number;
}

// Minimal safety net — only fires when LLM returns empty content.
// It is intentionally short and plain: the LLM should be doing the real phrasing.
function minimalFallback(ctx: LLMContext): string {
  const offer = `₹${ctx.decision.allowed_offer.toLocaleString("en-IN")}`;
  const addons = ctx.desired_addons ?? [];
  switch (ctx.decision.action) {
    case "open":
      return `Hi! I'm an AI negotiating on behalf of ${ctx.guest_name}. I'd like to open with ${offer}/night for the ${ctx.listing_title} — happy to discuss.`;
    case "counter":
      return `We'd like to move to ${offer}/night. Please let us know if that works.`;
    case "hold": {
      const addonsText = addons.length
        ? ` Could you include ${addons.slice(0, 2).join(" and ")} in the stay to sweeten the deal?`
        : "";
      return `Our best offer is ${offer}/night.${addonsText} Let us know.`;
    }
    case "accept": {
      const addonsText = addons.length
        ? ` We'd also love if you could include ${addons.slice(0, 2).join(" and ")}.`
        : "";
      return `${offer}/night works for us!${addonsText} Please confirm and we'll proceed to booking.`;
    }
    case "walk_away":
      return `Thank you for your time — unfortunately we weren't able to agree on a price that works for us. Hope to connect on a future trip!`;
    default:
      return `We'd like to offer ${offer}/night. Please let us know.`;
  }
}

export async function callNegotiationLLM(ctx: LLMContext): Promise<LLMResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not set");

  const isCritical = ctx.decision.is_critical;
  const model = isCritical ? CRITICAL_MODEL : ROUTINE_MODEL;
  const systemPrompt = isCritical ? SYSTEM_PROMPT_CRITICAL : SYSTEM_PROMPT_ROUTINE;
  const start = Date.now();

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://negotiateai.vercel.app",
      "X-Title": "NegotiateAI",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: buildUserMessage(ctx) },
      ],
      temperature: 0.7,
      max_tokens: 1000,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenRouter error ${response.status}: ${err}`);
  }

  const latency_ms = Date.now() - start;
  const json = await response.json();
  const raw: string = json.choices?.[0]?.message?.content ?? "";

  let thinking = "";
  let message = "";

  if (isCritical) {
    // GPT-4o uses <thinking>/<message> scratchpad format.
    // (?:<\/thinking>|$) handles unclosed tags — strips everything to end-of-string
    // so a half-generated thinking block never leaks into the visible message.
    const thinkingMatch = raw.match(/<(?:thinking|thought)>([\s\S]*?)(?:<\/(?:thinking|thought)>|$)/i);
    thinking = thinkingMatch?.[1]?.trim() ?? "";

    const stripped = raw
      .replace(/<(?:thinking|thought)>[\s\S]*?(?:<\/(?:thinking|thought)>|$)/i, "")
      .trim();

    const messageMatch = stripped.match(/<message>([\s\S]*?)(?:<\/message>|$)/i);
    message =
      messageMatch?.[1]?.trim() ||
      stripped.replace(/<\/?message>/gi, "").trim() ||
      minimalFallback(ctx);
  } else {
    // GLM is asked for plain text but sometimes emits <thinking> tags anyway.
    // Four cases, handled in order:
    //
    // A: <thinking>reasoning</thinking>actual message
    //    → strip the closed block; "actual message" is what remains → use it
    //
    // B: actual message<thinking>reasoning</thinking>
    //    → strip the closed block; "actual message" is what remains → use it
    //
    // C: actual message<thinking>reasoning... (unclosed — GLM cut off mid-generation)
    //    → stripping removes to end-of-string; "actual message" is what remains → use it
    //    → BUT if it ends mid-sentence the text before the unclosed tag is "actual message"
    //
    // D: <thinking>reasoning</thinking>  with nothing outside
    //    OR <thinking>reasoning...        with nothing before the tag
    //    → GLM generated only reasoning, no message → use minimalFallback
    //       (the thinking content is planning, NOT the message itself)

    // Step 1: strip ALL closed <thinking>/<thought> blocks
    const withClosedStripped = raw
      .replace(/<(?:thinking|thought)>[\s\S]*?<\/(?:thinking|thought)>/gi, "")
      .replace(/<\/?(?:thinking|thought|message)>/gi, "")
      .trim();

    if (withClosedStripped) {
      // Cases A and B: text outside closed thinking blocks → that IS the message
      message = withClosedStripped;
    } else {
      // No text outside closed blocks. Check for an unclosed <thinking> tag.
      // Text BEFORE an unclosed <thinking> is the real message (Case C).
      // Text inside an unclosed <thinking> is reasoning (Case D).
      const beforeUnclosed = raw
        .split(/<(?:thinking|thought)>/i)[0]
        .replace(/<\/?(?:thinking|thought|message)>/gi, "")
        .trim();

      message = beforeUnclosed || minimalFallback(ctx);
    }
  }

  const usage = json.usage ?? {};
  const prompt_tokens: number = usage.prompt_tokens ?? 0;
  const completion_tokens: number = usage.completion_tokens ?? 0;
  const cost_usd: number = usage.cost ?? 0;

  // Final safety strip — removes any tag variant that slipped through above
  const cleanMessage = message
    .replace(/<(?:thinking|thought|message)>[\s\S]*?<\/(?:thinking|thought|message)>/gi, "")
    .replace(/<\/?(?:thinking|thought|message)>/gi, "")
    .trim() || minimalFallback(ctx);

  return { message: cleanMessage, thinking, model_used: model, prompt_tokens, completion_tokens, cost_usd, latency_ms };
}
