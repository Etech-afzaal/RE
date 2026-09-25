import { DISPLAY_STATES } from "@/lib/ads/pick";
import { formatPropertyPrice } from "@/lib/formatPrice";

// Badge tones map to the .tone* classes in ads.module.css.
export const STATE_TONES = {
  live: "success",
  scheduled: "info",
  paused: "neutral",
  draft: "neutral",
  expired: "muted",
  completed: "muted",
  capped_today: "warning",
  blocked: "danger",
  archived: "muted",
};

export function stateLabel(state) {
  return DISPLAY_STATES[state] || state;
}

const numberFormat = new Intl.NumberFormat("en-PK");

export function formatNumber(value) {
  return numberFormat.format(Number(value) || 0);
}

export function formatCtr(impressions, clicks) {
  if (!impressions) return "—";
  return `${((clicks / impressions) * 100).toFixed(2)}%`;
}

export function formatDateTime(iso) {
  if (!iso) return "No end date";
  // Fixed zone so server-rendered and browser-rendered pages agree.
  return new Date(iso).toLocaleString("en-PK", {
    timeZone: "Asia/Karachi",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// Compact variant for tables: the year is dropped when it's the current one.
export function formatShortDateTime(iso) {
  if (!iso) return "No end date";
  const date = new Date(iso);
  const zone = "Asia/Karachi";
  const year = (value) => new Intl.DateTimeFormat("en-PK", { timeZone: zone, year: "numeric" }).format(value);
  return date.toLocaleString("en-PK", {
    timeZone: zone,
    day: "numeric",
    month: "short",
    ...(year(date) === year(new Date()) ? {} : { year: "numeric" }),
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatPrice(value, currency = "PKR") {
  return formatPropertyPrice(value, currency, { fallback: "Price on request", variant: "admin" });
}

// <input type="datetime-local"> works in local time; the API speaks UTC ISO.
export function toLocalInput(iso) {
  if (!iso) return "";
  const date = new Date(iso);
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

export function fromLocalInput(value) {
  if (!value) return null;
  return new Date(value).toISOString();
}
