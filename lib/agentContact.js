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

/** Single phone entry for subagent marketing contact. */
export function subagentPhoneEntries(subagent) {
  return agentPhoneEntries({
    phone: subagent?.phone,
    secondary_phone: subagent?.secondary_phone,
  });
}

/** Subagent contact record for referral property pages. */
export function subagentContactFromMarketingLink(link) {
  if (!link) return null;
  return {
    name: link.subagent_name,
    image: link.subagent_image,
    phone: link.subagent_phone,
    secondary_phone: link.subagent_secondary_phone,
    whatsapp_number: link.subagent_whatsapp_number,
    email: link.subagent_email,
    description: link.subagent_description,
  };
}
