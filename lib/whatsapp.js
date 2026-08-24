/**
 * Normalize a phone number for WhatsApp wa.me links.
 * Strips +, spaces, brackets, hyphens; maps local 0… to 92…
 */
export function normalizeWhatsAppPhone(phone) {
  if (!phone) return null;
  let digits = String(phone).replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("0")) digits = `92${digits.slice(1)}`;
  return digits;
}

/**
 * Resolve the number used for WhatsApp links.
 * Prefers whatsapp_number; falls back to phone for existing agents.
 */
export function resolveAgentWhatsAppNumber(agent) {
  const whatsapp = String(agent?.whatsapp_number || "").trim();
  if (whatsapp) return whatsapp;
  const phone = String(agent?.phone || "").trim();
  return phone || null;
}

/**
 * Build a WhatsApp deep link from an agent phone number.
 * @param {string} phone
 * @param {string} [message] optional pre-filled text
 */
export function buildWhatsAppUrl(phone, message) {
  const digits = normalizeWhatsAppPhone(phone);
  if (!digits) return null;

  const base = `https://wa.me/${digits}`;
  if (!message) return base;

  return `${base}?text=${encodeURIComponent(message)}`;
}

/**
 * Build a WhatsApp deep link for an agent record.
 * @param {{ whatsapp_number?: string, phone?: string }} agent
 * @param {string} [message] optional pre-filled text
 */
export function buildAgentWhatsAppUrl(agent, message) {
  return buildWhatsAppUrl(resolveAgentWhatsAppNumber(agent), message);
}

export function agentWebsiteWhatsAppMessage(agentName) {
  const name = String(agentName || "").trim();
  const first = name.split(/\s+/).filter(Boolean)[0];
  if (first) {
    return `Hello ${first}, I found your profile on DhaLahore.com and would like to know more.`;
  }
  return "Hello, I found your profile on DhaLahore.com and would like more information.";
}

export function propertyWhatsAppMessage(agentName, propertyTitle, location) {
  const name = String(agentName || "").trim();
  const first = name.split(/\s+/).filter(Boolean)[0];
  const title = String(propertyTitle || "").trim() || "this property";
  const place = String(location || "").trim();
  const placePart = place ? ` in ${place}` : "";
  const greeting = first ? `Hello ${first}` : "Hello";
  return `${greeting}, I am interested in your property:\n${title}${placePart}.`;
}
