import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { isAgentRole } from "@/lib/roles";

// Old bookmarks use the portal's current form and resubmission flow.
export default async function AgentEditPropertyPage({ params }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !isAgentRole(session.user.role)) redirect("/agent/login");
  const username = session.user.username || session.user.estate_name;
  if (!username) redirect("/agent/dashboard");
  redirect(`/re/${encodeURIComponent(username)}/dashboard/properties/${encodeURIComponent(params.id)}/edit`);
}
