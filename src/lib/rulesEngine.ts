// Negotiation rules engine — grounded in:
// Galinsky & Mussweiler (2001) JPSP 81(4) — first-offer anchoring
// Pruitt (1981) Negotiation Behavior — decreasing concession schedule
// Fisher & Ury (1981) Getting to Yes — BATNA / walk-away logic
// Raiffa (1982) The Art and Science of Negotiation — responsive concession
// Baarslag et al. (2016) JAAMAS — adaptive agent concession strategies

export interface NegotiationState {
  listed_price: number;
  target_price: number;
  walk_away_price: number; // NEVER passed to LLM
  current_offer: number;
  host_last_offer: number;
  host_prev_offer: number; // host's offer from the turn before — needed for responsiveness
  turn_number: number;
  max_turns: number;
  comparable_price?: number; // RAG-sourced market median; falls back to 0.88 × listed_price
  consecutive_holds?: number; // how many hold turns the agent has taken in a row
}

export interface EngineDecision {
  action: "open" | "counter" | "hold" | "accept" | "walk_away";
  allowed_offer: number;
  concession_step: number;
  is_critical: boolean;
  comparable_price: number;
}

export function runRulesEngine(state: NegotiationState): EngineDecision {
  const {
    listed_price,
    target_price,
    walk_away_price,
    current_offer,
    host_last_offer,
    host_prev_offer,
    turn_number,
    max_turns,
    consecutive_holds = 0,
  } = state;

  // Market comparable — RAG-sourced p50 if available, else 0.88 × listed_price
  const comparable_price = state.comparable_price ?? Math.round(listed_price * 0.88);

  // WALK-AWAY CHECK — Fisher & Ury BATNA principle
  // If host won't go below walk_away, we leave
  if (host_last_offer > 0 && host_last_offer > walk_away_price) {
    return {
      action: "walk_away",
      allowed_offer: 0,
      concession_step: 0,
      is_critical: true,
      comparable_price,
    };
  }

  // ACCEPT CHECK — if host has met or beaten our target, take it
  if (host_last_offer > 0 && host_last_offer <= target_price) {
    return {
      action: "accept",
      allowed_offer: host_last_offer,
      concession_step: 0,
      is_critical: true,
      comparable_price,
    };
  }

  // HOST BEAT OUR OFFER — accept immediately.
  // If the host's ask dropped BELOW our current offer, we're in an irrational
  // state: a buyer should never counter above the seller's current price.
  // Accepting here locks in the savings without any further concession needed.
  if (host_last_offer > 0 && host_last_offer < current_offer) {
    return {
      action: "accept",
      allowed_offer: host_last_offer,
      concession_step: 0,
      is_critical: true,
      comparable_price,
    };
  }

  // No late-game accept based on turn count — that's exploitable.
  // If a host knows the agent folds at turn N, they just wait until turn N-1
  // and name their price. Instead, the only ways to close are:
  //   • Host hits the target price → immediate accept (above)
  //   • HOLD fires (price genuinely stalls) → ask for add-ons → walk away
  //   • Host exceeds walk-away → walk away (above)
  // This aligns the host's incentive: moving price is rewarded, stalling is punished.

  // OPENING TURN — Galinsky & Mussweiler anchoring
  // Anchor at 82% of listed, but cap at 95% of target so we always open
  // below the target price — leaving room to concede UP toward target.
  // Without this cap, a low target (e.g. ₹2,100 vs listed ₹3,200) would
  // produce an opening of ₹2,624 which is already above target.
  if (turn_number === 1) {
    const anchor = Math.min(
      Math.round(listed_price * 0.82),
      Math.round(target_price * 0.95)
    );
    return {
      action: "open",
      allowed_offer: anchor,
      concession_step: 0,
      is_critical: false,
      comparable_price,
    };
  }

  // ADAPTIVE CONCESSION SCHEDULE — Raiffa (1982), Baarslag et al. (2016)
  // step = gap × (R + T) × J
  //
  // R — Host responsiveness (mirror but always concede less than the host did)
  //   host_moved = how much host dropped from their previous offer to this one
  //   We concede 60% of whatever ratio the host conceded. Cap at 35% of gap.
  //   RAG hook: when comparable_price comes from real market data, we can also
  //   weight R by how far listed_price is from market — more room = more generous.
  //
  // T — Urgency ramp (quadratic, 0 → 10% extra at final turn)
  //   Creates natural closing pressure without a detectable linear pattern.
  //
  // J — Jitter ±15% random noise to prevent pattern recognition.

  const gap = host_last_offer > 0 ? host_last_offer - current_offer : 0;

  const host_moved = host_prev_offer > 0 ? host_prev_offer - host_last_offer : gap * 0.5;
  const host_moved_ratio = gap > 0 ? host_moved / gap : 0.3;
  const base_R = Math.min(host_moved_ratio * 0.6, 0.35);

  // Market-aware responsiveness adjustment (Galinsky & Mussweiler 2001 — anchor strength)
  // If listed_price >> comparable_price: host is above market → agent holds firmer (R × <1).
  // If listed_price ≈ comparable_price: neutral (R × 1).
  // If listed_price < comparable_price: listing is a deal → concede more readily (R × >1).
  // Clamped to [0.65, 1.30] so a single outlier comparable can't collapse or spike concessions.
  const market_adj =
    comparable_price > 0
      ? Math.min(Math.max(comparable_price / listed_price, 0.65), 1.30)
      : 1;
  const R = base_R * market_adj;

  const T = Math.pow(turn_number / max_turns, 2) * 0.10;

  const J = 0.85 + Math.random() * 0.30; // 0.85–1.15

  const raw_step = Math.round(gap * (R + T) * J);

  // HOLD — pivot to add-ons only when BOTH conditions are true:
  //
  // 1. raw_step is trivial (< ₹50): host's responsiveness + urgency leaves
  //    mathematically little room to move.
  //
  // 2. The remaining gap is genuinely narrow: gap < 25% of the guest's full
  //    negotiating range (walk_away - target). This prevents premature HOLD
  //    when the gap is still large and the host just made one small move.
  //    Without this, a host replying "k" every turn to burn through turns
  //    would trigger HOLD (and later late-game accept) at a high price.
  //
  // Turn guard (>= 4): give the negotiation at least 2 host interactions
  // before pivoting to add-ons.
  const negotiating_range = walk_away_price - target_price;
  const gap_is_narrow =
    negotiating_range > 0 && gap < negotiating_range * 0.25;

  if (raw_step < 50 && gap_is_narrow && turn_number >= 4) {
    // After 2 consecutive holds the host is clearly not moving — walk away
    if (consecutive_holds >= 2) {
      return {
        action: "walk_away",
        allowed_offer: 0,
        concession_step: 0,
        is_critical: true,
        comparable_price,
      };
    }
    return {
      action: "hold",
      allowed_offer: current_offer,
      concession_step: 0,
      is_critical: turn_number >= max_turns - 1,
      comparable_price,
    };
  }

  const step = Math.max(raw_step, 50);
  // Cap at host_last_offer: a buyer should never counter ABOVE the seller's ask.
  // Without this, a large step could push new_offer past the host's price, which
  // is irrational (we'd be volunteering to pay more than they demanded).
  const new_offer = Math.min(
    current_offer + step,
    host_last_offer > 0 ? host_last_offer : Infinity,
    walk_away_price - 1,
    listed_price
  );

  // CRITICAL TURN FLAGS — routes to higher-quality model
  // Gap < 15% of range: offers are genuinely close, quality matters more here.
  // Gap between host and new_offer < ₹200: very near convergence.
  const is_critical =
    (host_last_offer > 0 && host_last_offer - new_offer < 200) ||
    gap < (walk_away_price - target_price) * 0.15;

  return {
    action: "counter",
    allowed_offer: new_offer,
    concession_step: step,
    is_critical,
    comparable_price,
  };
}
