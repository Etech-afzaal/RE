/**
 * Format a property price for display.
 * Amount is stored as-entered; currency is never converted.
 */

export const DEFAULT_PRICE_CURRENCY = "PKR";
export const PRICE_CURRENCY_VALUES = Object.freeze(["PKR", "USD"]);

/**
 * @param {unknown} value
 * @returns {"PKR"|"USD"}
 */
export function normalizePriceCurrency(value) {
  const currency = String(value || DEFAULT_PRICE_CURRENCY)
    .trim()
    .toUpperCase();
  return PRICE_CURRENCY_VALUES.includes(currency)
    ? currency
    : DEFAULT_PRICE_CURRENCY;
}

/**
 * @param {unknown} price
 * @param {unknown} currency
 * @param {{ fallback?: string, variant?: "public" | "admin" }} [opts]
 * @returns {string}
 */
export function formatPropertyPrice(
  price,
  currency,
  { fallback = "On request", variant = "public" } = {},
) {
  if (price == null || price === "") return fallback;
  const num = Number(price);
  if (!Number.isFinite(num)) return fallback;

  const code = normalizePriceCurrency(currency);
  const amount = num.toLocaleString(code === "USD" ? "en-US" : "en-PK");

  if (code === "USD") {
    return variant === "admin" ? `$${amount} USD` : `$${amount}`;
  }

  return `PKR ${amount}`;
}
