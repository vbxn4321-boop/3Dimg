// ============================================================
// Sketchfab Search Utility
// Searches Sketchfab's public API for matching 3D models
// No API key required for basic search (rate-limited)
// ============================================================

export interface SketchfabModel {
  uid: string;
  name: string;
  embedUrl: string;
  thumbnailUrl?: string;
  likeCount: number;
  viewerUrl: string;
}

/**
 * Computes a relevance score between a query and a candidate model name.
 * Returns 0.0–1.0.
 * Prioritizes exact matches: "iPhone 12" gets 1.0, while "iPhone 12 Pro" gets ~0.94
 * so exact model names are chosen over variants with extra modifier words.
 */
function relevanceScore(query: string, candidateName: string): number {
  const normalize = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

  const queryNorm = normalize(query);
  const nameNorm  = normalize(candidateName);

  const queryWords = queryNorm.split(" ").filter(Boolean);
  const nameWords  = nameNorm.split(" ").filter(Boolean);
  if (queryWords.length === 0 || nameWords.length === 0) return 0;

  // 1. Absolute exact match (e.g. "iphone 12" === "iphone 12")
  if (queryNorm === nameNorm) return 1.0;

  // 2. Full query phrase is substring (e.g. "iphone 12" inside "iphone 12 pro")
  // Deduct 0.05 for each extra word in the candidate title (so exact titles beat variants)
  if (nameNorm.includes(queryNorm)) {
    const extraWords = Math.abs(nameWords.length - queryWords.length);
    return Math.max(0.7, 0.99 - extraWords * 0.05);
  }

  // 3. All query words present as whole words (\b)
  const esc = (w: string) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const wholeWordMatches = queryWords.filter((w) =>
    new RegExp(`\\b${esc(w)}\\b`).test(nameNorm)
  );
  if (wholeWordMatches.length === queryWords.length) {
    const extraWords = Math.abs(nameWords.length - queryWords.length);
    return Math.max(0.6, 0.90 - extraWords * 0.05);
  }

  // 4. Compound-word match (e.g. "iphone 12" → "iphone12" in "appleiphone12")
  const queryCompact = queryWords.join("");
  const nameCompact  = nameNorm.replace(/\s/g, "");
  if (nameCompact.includes(queryCompact)) {
    return 0.8;
  }

  // 5. Partial fallback (scale down)
  const substrMatches = queryWords.filter((w) => nameNorm.includes(w));
  return (substrMatches.length / queryWords.length) * 0.4;
}


/**
 * Search Sketchfab for a 3D model matching the given query.
 * Returns the best relevant match, or null if nothing relevant is found.
 *
 * Strategy:
 *  1. Fetch top 20 results sorted by relevance (default Sketchfab sort)
 *  2. Score each result against the query keywords
 *  3. Return the highest-scoring result if score >= MIN_SCORE
 *  4. Among equally-scored results, prefer the one with more likes
 */
export async function searchSketchfabModel(
  query: string
): Promise<SketchfabModel | null> {
  if (!query?.trim()) return null;

  const MIN_SCORE = 0.4; // At least 40% of query words must appear in model name
  const encodedQuery = encodeURIComponent(query.trim());

  // Use Sketchfab's real search API endpoint (v3/search)
  const url = `https://api.sketchfab.com/v3/search?q=${encodedQuery}&downloadable=true`;

  try {
    const res = await fetch(url, {
      headers: {
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      console.warn(`[Sketchfab] Search failed: ${res.status}`);
      return null;
    }

    const data = await res.json();
    // v3/search returns results.models array
    const results: any[] = data?.results?.models ?? (Array.isArray(data?.results) ? data.results : []);

    if (results.length === 0) {
      console.log(`[Sketchfab] No results for query: "${query}"`);
      return null;
    }

    // Score and filter results
    const scored = results
      .map((r: any) => ({
        uid:       r.uid as string,
        name:      (r.name ?? "") as string,
        likeCount: (r.likeCount ?? 0) as number,
        thumbnail: r.thumbnails?.images?.[0]?.url as string | undefined,
        score:     relevanceScore(query, r.name ?? ""),
      }))
      .filter((r) => r.score >= MIN_SCORE)
      // Sort: highest score first; within same score, prefer more likes
      .sort((a, b) => b.score - a.score || b.likeCount - a.likeCount);

    if (scored.length === 0) {
      console.log(
        `[Sketchfab] No relevant results for "${query}" ` +
        `(best was "${results[0]?.name ?? "?"}", score ${relevanceScore(query, results[0]?.name ?? "").toFixed(2)})`
      );
      return null;
    }

    const best = scored[0];
    const model: SketchfabModel = {
      uid: best.uid,
      name: best.name,
      embedUrl:
        `https://sketchfab.com/models/${best.uid}/embed` +
        `?autostart=1&autospin=0.5&ui_theme=dark&ui_infos=0&ui_controls=0&ui_watermark=0`,
      thumbnailUrl: best.thumbnail,
      likeCount: best.likeCount,
      viewerUrl: `https://sketchfab.com/3d-models/${best.uid}`,
    };

    console.log(
      `[Sketchfab] Found: "${model.name}" ` +
      `(uid: ${model.uid}, likes: ${model.likeCount}, score: ${best.score.toFixed(2)})`
    );
    return model;
  } catch (err: any) {
    console.warn("[Sketchfab] Search error:", err?.message || err);
    return null;
  }
}
