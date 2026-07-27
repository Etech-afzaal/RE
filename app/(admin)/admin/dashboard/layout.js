import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import AdminShell from "@/components/admin/AdminShell";
import { isSuperAdmin } from "@/lib/roles";

export default async function AdminDashboardLayout({ children }) {
  const session = await getServerSession(authOptions);

  if (!session) redirect("/admin/login");
  if (!isSuperAdmin(session.user.role)) redirect("/agent/dashboard");

  return <AdminShell>{children}</AdminShell>;
}
