import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import AdminShell from "@/components/admin/AdminShell";

export default async function AdminDashboardLayout({ children }) {
  const session = await getServerSession(authOptions);

  if (!session) redirect("/admin/login");
  if (session.user.role !== "admin") redirect("/agent/dashboard");

  return <AdminShell>{children}</AdminShell>;
}
