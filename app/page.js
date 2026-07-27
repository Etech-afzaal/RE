import {
  getApprovedAgents,
  getAgentDiscoveryAreas,
} from "@/lib/queries";
import CustomerHome from "@/components/CustomerHome";

export const revalidate = 60;

export const metadata = {
  title: "Dhalahore Properties — Find Trusted Real Estate Agents in Lahore",
  description:
    "Discover verified DHA Lahore and Lahore estate agents. Browse profiles, areas served, and connect directly.",
};

export default async function HomePage() {
  const [agents, areas] = await Promise.all([
    getApprovedAgents(),
    getAgentDiscoveryAreas(),
  ]);

  return <CustomerHome agents={agents} areas={areas} />;
}
