/**
 * Hybrid RAG retrieval for comparable listing prices.
 *
 * Strategy: SQL + vector search → Reciprocal Rank Fusion → p50 price
 *
 * SQL retrieval   — structured filter: same area + price band + bedroom count.
 *                   Ranks by price proximity to query (closest = rank 1).
 *
 * Vector retrieval — semantic cosine similarity via pgvector match_listings RPC.
 *                    Embeddings: openai/text-embedding-3-small (384-dim) via OpenRouter.
 *                    Ranks by cosine similarity (most similar = rank 1).
 *
 * Reciprocal Rank Fusion (RRF, Cormack et al. 2009):
 *   score(doc) = Σ  1 / (k + rank_i)   where k=60
 *
 *   A listing appearing in BOTH SQL and vector results gets double-boosted —
 *   that's the strongest signal it's a genuine comparable.
 *   k=60 smooths the effect so rank-1 doesn't dominate entirely.
 *
 * Final price: p50 of the top-15 RRF-ranked listings.
 * Called once at session start; result stored in negotiations.comparable_price.
 */

import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Embed via OpenRouter's embeddings endpoint using the same key already in use.
// Model: text-embedding-3-small with dimensions=384 matches the existing pgvector
// column (all-MiniLM-L6-v2 384-dim) so no re-seeding is needed.
async function embed(text: string): Promise<number[]> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not set");

  const res = await fetch("https://openrouter.ai/api/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://negotiateai.vercel.app",
      "X-Title": "NegotiateAI",
    },
    body: JSON.stringify({
      model: "openai/text-embedding-3-small",
      input: text,
      dimensions: 384,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenRouter embeddings error ${res.status}: ${err}`);
  }

  const json = await res.json();
  return json.data?.[0]?.embedding ?? [];
}

// ── Shared result type ────────────────────────────────────────────────────────

interface RetrievedListing {
  id: string;
  nightly_price: number;
  area: string;
  bedrooms: number;
}

// ── SQL retrieval ─────────────────────────────────────────────────────────────

async function sqlRetrieve(params: {
  area: string;
  nightly_price: number;
  bedrooms?: number;
  bandFactor?: number;
}): Promise<RetrievedListing[]> {
  const { area, nightly_price, bedrooms, bandFactor = 0.4 } = params;
  const low = Math.round(nightly_price * (1 - bandFactor));
  const high = Math.round(nightly_price * (1 + bandFactor));

  let query = supabaseAdmin
    .from("listings")
    .select("id, nightly_price, area, bedrooms")
    .eq("area", area)
    .eq("is_active", true)
    .gte("nightly_price", low)
    .lte("nightly_price", high);

  if (bedrooms && bedrooms > 0) {
    query = query
      .gte("bedrooms", Math.max(1, bedrooms - 1))
      .lte("bedrooms", bedrooms + 1);
  }

  const { data } = await query.limit(50);
  return (data ?? []) as RetrievedListing[];
}

// ── Vector retrieval via pgvector ─────────────────────────────────────────────

async function vectorRetrieve(params: {
  area: string;
  nightly_price: number;
  bedrooms?: number;
  property_type?: string;
}): Promise<RetrievedListing[]> {
  const { area, nightly_price, bedrooms, property_type } = params;

  const band = nightly_price < 2000 ? "budget" : nightly_price < 5000 ? "mid-range" : "luxury";
  const queryText = [
    property_type ?? "Villa",
    `in ${area}.`,
    bedrooms ? `${bedrooms} bedrooms.` : "",
    `₹${nightly_price}/night (${band}).`,
  ]
    .filter(Boolean)
    .join(" ");

  let embedding: number[];
  try {
    embedding = await embed(queryText);
  } catch {
    return []; // graceful degradation if model fails to load
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabaseAdmin as any).rpc("match_listings", {
      query_embedding: embedding,
      filter_area: area,
      match_count: 20,
    });
    // Post-filter: vector search is not price-aware, so listings at wildly
    // different price points can rank highly via semantic similarity alone.
    // Drop anything outside ±60% of the query price before RRF merges them in.
    const priceLow = nightly_price * 0.4;
    const priceHigh = nightly_price * 1.6;
    return ((data ?? []) as RetrievedListing[]).filter(
      (r) => r.nightly_price >= priceLow && r.nightly_price <= priceHigh
    );
  } catch {
    return [];
  }
}

// ── Reciprocal Rank Fusion ────────────────────────────────────────────────────

function rrfMerge(
  sqlResults: RetrievedListing[],
  vectorResults: RetrievedListing[],
  k = 60,
  topN = 15
): RetrievedListing[] {
  // SQL: rank by price proximity (rank 1 = closest to query price)
  const sqlById = new Map(sqlResults.map((r, i) => [r.id, i + 1]));
  // Vector: rank by cosine similarity (already ordered, rank 1 = most similar)
  const vecById = new Map(vectorResults.map((r, i) => [r.id, i + 1]));

  // Collect all unique listing IDs
  const allIds = new Set([...sqlById.keys(), ...vecById.keys()]);
  const allListings = new Map<string, RetrievedListing>();
  [...sqlResults, ...vectorResults].forEach((r) => allListings.set(r.id, r));

  // Compute RRF score for each listing
  const scored: Array<{ listing: RetrievedListing; score: number }> = [];
  for (const id of allIds) {
    const listing = allListings.get(id)!;
    const sqlRank = sqlById.get(id);
    const vecRank = vecById.get(id);
    const score =
      (sqlRank ? 1 / (k + sqlRank) : 0) +
      (vecRank ? 1 / (k + vecRank) : 0);
    scored.push({ listing, score });
  }

  // Sort by RRF score descending, take top N
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topN).map((s) => s.listing);
}

// ── Percentile helper ─────────────────────────────────────────────────────────

function p50(prices: number[]): number {
  if (prices.length === 0) return 0;
  const sorted = [...prices].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid];
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface ComparableResult {
  comparable_price: number;
  /** How many listings fed the p50 calculation */
  sample_count: number;
  /** Which path produced the result */
  source: "rrf_hybrid" | "sql_only" | "vector_only" | "fallback";
  /** Debug: how many SQL vs vector results before fusion */
  debug: { sql_count: number; vector_count: number };
}

export async function getComparablePrice(params: {
  area: string;
  nightly_price: number;
  bedrooms?: number;
  property_type?: string;
}): Promise<ComparableResult> {
  const { area, nightly_price, bedrooms, property_type } = params;

  // Run SQL and vector in parallel — total latency = max(sql, vector), not sum
  const [sqlResults, vectorResults] = await Promise.all([
    sqlRetrieve({ area, nightly_price, bedrooms }),
    vectorRetrieve({ area, nightly_price, bedrooms, property_type }),
  ]);

  const hasSql = sqlResults.length > 0;
  const hasVec = vectorResults.length > 0;

  // Apply RRF fusion when both paths returned results
  if (hasSql && hasVec) {
    const fused = rrfMerge(sqlResults, vectorResults);
    const prices = fused.map((r) => r.nightly_price);
    return {
      comparable_price: p50(prices) || Math.round(nightly_price * 0.88),
      sample_count: fused.length,
      source: "rrf_hybrid",
      debug: { sql_count: sqlResults.length, vector_count: vectorResults.length },
    };
  }

  // SQL-only fallback (vector model unavailable or no vec results)
  if (hasSql) {
    const prices = sqlResults.map((r) => r.nightly_price);
    return {
      comparable_price: p50(prices),
      sample_count: sqlResults.length,
      source: "sql_only",
      debug: { sql_count: sqlResults.length, vector_count: 0 },
    };
  }

  // Vector-only fallback
  if (hasVec) {
    const prices = vectorResults.map((r) => r.nightly_price);
    return {
      comparable_price: p50(prices),
      sample_count: vectorResults.length,
      source: "vector_only",
      debug: { sql_count: 0, vector_count: vectorResults.length },
    };
  }

  // Last resort — classic anchor heuristic
  return {
    comparable_price: Math.round(nightly_price * 0.88),
    sample_count: 0,
    source: "fallback",
    debug: { sql_count: 0, vector_count: 0 },
  };
}
