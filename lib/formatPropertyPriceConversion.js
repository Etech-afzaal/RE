/**
 * Display-only human-readable price units (lakh/crore/million/etc.).
 * Does NOT convert between currencies or change stored price values.
 *
 * @param {unknown} price
 * @param {unknown} currency
 * @returns {string|null} Converted label, or null when nothing should be shown
 */
export function formatPropertyPriceConversion(price, currency) {
  if (price == null || price === "") return null;

  const num = Number(price);
  if (!Number.isFinite(num) || num < 0) return null;

  const code = String(currency ?? "")
    .trim()
    .toUpperCase();

  if (code === "PKR") return formatPkrConversion(num);
  if (code === "USD") return formatUsdConversion(num);
  return null;
}

/**
 * PKR thresholds:
 * < 100,000 → thousand
 * >= 100,000 and < 1,000,000 → lakh
 * >= 1,000,000 and < 10,000,000 → million
 * >= 10,000,000 → crore
 *
 * @param {number} amount
 * @returns {string|null}
 */
function formatPkrConversion(amount) {
  if (amount < 100_000) {
    return `${formatReadableNumber(amount / 1_000)} thousand`;
  }
  if (amount < 1_000_000) {
    return `${formatReadableNumber(amount / 100_000)} lakh`;
  }
  if (amount < 10_000_000) {
    return `${formatReadableNumber(amount / 1_000_000)} million`;
  }
  return `${formatReadableNumber(amount / 10_000_000)} crore`;
}

/**
 * @param {number} amount
 * @returns {string|null}
 */
function formatUsdConversion(amount) {
  if (amount < 1_000_000) {
    return `$${formatReadableNumber(amount / 1_000)} thousand`;
  }
  if (amount < 1_000_000_000) {
    return `$${formatReadableNumber(amount / 1_000_000)} million`;
  }
  return `$${formatReadableNumber(amount / 1_000_000_000)} billion`;
}

/**
 * Trim unnecessary trailing zeros / float noise.
 * Caps at 2 decimal places to match product examples (7.5, 2.5, 2.25).
 * @param {number} value
 * @returns {string}
 */
function formatReadableNumber(value) {
  if (!Number.isFinite(value)) return "0";
  return String(Number.parseFloat(value.toFixed(2)));
}
