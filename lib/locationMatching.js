/**
 * Location labels originate with the database. This module deliberately has
 * no geographic names or coordinates so newly added listing locations can be
 * matched without a deployment.
 */
const NUMBER_WORDS = { one: "1", two: "2", three: "3", four: "4", five: "5", six: "6", seven: "7", eight: "8", nine: "9", ten: "10" };
const ROMAN_NUMERALS = { i: "1", ii: "2", iii: "3", iv: "4", v: "5", vi: "6", vii: "7", viii: "8", ix: "9", x: "10" };

export function normalizeLocationText(value) {
  return String(value || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, " ").trim().split(/\s+/).filter(Boolean)
    .map((token) => NUMBER_WORDS[token] || ROMAN_NUMERALS[token] || token).join(" ");
}

function tokenSet(value) { return new Set(normalizeLocationText(value).split(" ").filter(Boolean)); }
function sortedTokenKey(value) { return [...tokenSet(value)].sort().join(" "); }
function isSubset(a, b) { return [...a].every((token) => b.has(token)); }

function editDistance(a, b) {
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let row = 1; row <= a.length; row += 1) {
    let diagonal = previous[0]; previous[0] = row;
    for (let column = 1; column <= b.length; column += 1) {
      const beforeUpdate = previous[column];
      previous[column] = Math.min(previous[column] + 1, previous[column - 1] + 1, diagonal + (a[row - 1] === b[column - 1] ? 0 : 1));
      diagonal = beforeUpdate;
    }
  }
  return previous[b.length];
}

function similarity(a, b) { return a === b ? 1 : 1 - editDistance(a, b) / Math.max(a.length, b.length); }

export function reverseGeocodeLocationValues(result) {
  const address = result?.address || {};
  const components = [address.neighbourhood, address.neighborhood, address.suburb, address.locality, address.quarter, address.city_district, address.district, address.town, address.village, address.city, address.municipality, address.county, address.state_district, address.state]
    .filter(Boolean).map((value) => String(value).trim()).filter(Boolean);
  const displayParts = String(result?.display_name || "").split(",").map((part) => part.trim()).filter(Boolean);
  return [...new Set([...components, ...displayParts, components.join(" ")])].filter(Boolean);
}

function scoreCandidate(candidate, detectedValues) {
  const candidateNormalized = normalizeLocationText(candidate);
  const candidateTokens = tokenSet(candidate);
  if (!candidateNormalized || !candidateTokens.size) return null;
  let best = null;
  for (const detected of detectedValues) {
    const detectedNormalized = normalizeLocationText(detected);
    const detectedTokens = tokenSet(detected);
    if (!detectedNormalized || !detectedTokens.size) continue;
    if (candidateNormalized === detectedNormalized) { best = Math.max(best || 0, 1000 + candidateTokens.size); continue; }
    if (sortedTokenKey(candidate) === sortedTokenKey(detected)) { best = Math.max(best || 0, 990 + candidateTokens.size); continue; }
    if (isSubset(candidateTokens, detectedTokens)) { best = Math.max(best || 0, 900 + candidateTokens.size); continue; }
    const candidateTokenList = [...candidateTokens];
    const detectedTokenList = [...detectedTokens];
    const fuzzyMatches = candidateTokenList.map((candidateToken) =>
      detectedTokenList.some((detectedToken) => candidateToken.length >= 5 && detectedToken.length >= 5 && similarity(candidateToken, detectedToken) >= 0.82),
    );
    if (fuzzyMatches.every(Boolean)) best = Math.max(best || 0, 820 + candidateTokens.size);
  }
  return best;
}

/** Returns the original database location label, or null when confidence is insufficient. */
export function matchDatabaseLocation(locations = [], reverseGeocodeResult) {
  const detectedValues = reverseGeocodeLocationValues(reverseGeocodeResult);
  if (!detectedValues.length) return null;
  const ranked = locations.map((location) => typeof location === "string" ? location : location?.name).filter(Boolean)
    .map((name) => ({ name, score: scoreCandidate(name, detectedValues) })).filter((candidate) => candidate.score !== null)
    .sort((a, b) => b.score - a.score || b.name.length - a.name.length);
  const best = ranked[0];
  if (!best || best.score < 820) return null;
  const runnerUp = ranked[1];
  if (!runnerUp || best.score - runnerUp.score >= 25) return best.name;
  const bestTokens = tokenSet(best.name); const runnerUpTokens = tokenSet(runnerUp.name);
  return bestTokens.size > runnerUpTokens.size && isSubset(runnerUpTokens, bestTokens) ? best.name : null;
}
