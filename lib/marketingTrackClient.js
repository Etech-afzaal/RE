/**
 * Fire marketing link insight events (fire-and-forget).
 */
export function trackMarketingEvent(ref, eventType, propertyId = null) {
  if (!ref || !eventType) return;

  const payload = { ref, event_type: eventType };
  if (propertyId != null) payload.property_id = propertyId;

  fetch("/api/marketing-links/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => {});
}
