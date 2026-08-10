import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { isAgentRole } from "@/lib/roles";

export default async function AgentAdminAreaLayout({ children, params }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !isAgentRole(session.user.role)) {
    redirect("/agent/login");
  }

  const pathUsername = decodeURIComponent(params.estate_name || "").toLowerCase();
  const tokenUsername = String(
    session.user.username || session.user.estate_name || "",
  ).toLowerCase();

  if (tokenUsername && pathUsername !== tokenUsername) {
    redirect(`/re/${encodeURIComponent(tokenUsername)}/dashboard`);
  }

  return children;
}
