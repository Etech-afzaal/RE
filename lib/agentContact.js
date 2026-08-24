/**
 * Agent phone numbers shown on public pages (primary + optional secondary).
 */

function telHref(number) {
  const value = String(number || "").trim();
  if (!value) return null;
  return `tel:${value.replace(/\s/g, "")}`;
}

/** @returns {{ number: string, href: string }[]} */
export function agentPhoneEntries(agent) {
  const entries = [];
  const primary = String(agent?.phone || "").trim();
  const secondary = String(agent?.secondary_phone || "").trim();

  if (primary) {
    entries.push({ number: primary, href: telHref(primary) });
  }
  if (secondary) {
    entries.push({ number: secondary, href: telHref(secondary) });
  }

  return entries;
}

export function agentHasPhone(agent) {
  return agentPhoneEntries(agent).length > 0;
}
