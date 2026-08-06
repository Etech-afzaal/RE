import { agentPublicUsername } from "@/lib/propertySlug";

function titleCaseWords(value) {
  return String(value || "")
    .replace(/[-_]+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Resolve the public company/estate display name for an agent.
 * Prefer company_name; otherwise derive from username/estate_name.
 */
export function companyNameFromAgent(agent) {
  if (!agent) return "Verified Property";
  if (agent.company_name && String(agent.company_name).trim()) {
    return String(agent.company_name).trim();
  }
  const base = titleCaseWords(agentPublicUsername(agent) || agent.estate_name);
  if (!base) return "Verified Property";
  if (/propert/i.test(base)) return base;
  return `${base} Properties`;
}
