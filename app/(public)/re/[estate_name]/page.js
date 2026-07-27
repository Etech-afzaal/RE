import { notFound } from "next/navigation";
import {
  getAgentByUsername,
  getApprovedPropertiesByAgent,
  getHeroSlidesForAgent,
  getPopularLocationsForAgent,
  getPublicStatsForAgent,
} from "@/lib/queries";
import { agentPublicUsername } from "@/lib/propertySlug";
import PublicPropertyWebsite from "@/components/PublicPropertyWebsite";

export const revalidate = 60;

export async function generateMetadata({ params }) {
  const agent = await getAgentByUsername(params.estate_name);
  if (!agent) return {};
  const handle = agentPublicUsername(agent);
  return {
    title: `${agent.full_name} — Property Listings | Dhalahore Properties`,
    description: `Browse verified Lahore properties listed by ${agent.full_name} on Dhalahore Properties (/re/${handle}).`,
  };
}

/**
 * Agent public website — same homepage design, data scoped to this agent.
 * Route param remains `estate_name` in the filesystem; lookup uses username
 * (with estate_name fallback) so /re/[agent_username] works.
 */
export default async function AgentPublicWebsitePage({ params }) {
  const agent = await getAgentByUsername(params.estate_name);
  if (!agent) return notFound();

  const [properties, heroSlides, stats, locations] = await Promise.all([
    getApprovedPropertiesByAgent(agent.id),
    getHeroSlidesForAgent(agent.id, 5),
    getPublicStatsForAgent(agent.id),
    getPopularLocationsForAgent(agent.id, 24),
  ]);

  return (
    <PublicPropertyWebsite
      agent={agent}
      properties={properties}
      heroSlides={heroSlides}
      stats={stats}
      locations={locations}
    />
  );
}
