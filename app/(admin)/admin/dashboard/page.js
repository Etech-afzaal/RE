import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getPropertiesByAgentId } from "@/lib/queries";
import Link from "next/link";
import { redirect } from "next/navigation";
import LogoutButton from "@/components/LogoutButton";
import styles from "./page.module.css";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/admin/login");

  // Admin sees the requests queue instead of a property list
  if (session.user.role === "admin") {
    redirect("/admin/dashboard/requests");
  }

  const agentId = Number(session.user.id);
  const estateName = session.user.estate_name;
  const properties = await getPropertiesByAgentId(agentId);

  return (
    <div className={styles.dashboardWrapper}>
      <div className={styles.dashboardHeader}>
        <h1 className={styles.dashboardHeading}>My Properties</h1>
        <LogoutButton
          callbackUrl="/admin/login"
          label="Logout"
          className={styles.logoutButton}
        />
      </div>
      <p>
        Your public page:{" "}
        <a href={`/re/${estateName}`} className={styles.dashboardLinkUrl}>
          dhalahoreproperties.com/re/{estateName}
        </a>
      </p>
      <Link href="/admin/properties/new" className={styles.dashboardLink}>
        <button className={styles.dashboardButton}>+ Add Property</button>
      </Link>

      <ul className={styles.dashboardList}>
        {properties.map((p) => (
          <li key={p.id} className={styles.dashboardItem}>
            <strong>{p.title}</strong> — {p.size_value} {p.size_unit}
          </li>
        ))}
      </ul>
      {properties.length === 0 && (
        <p>You haven&apos;t added any properties yet.</p>
      )}
    </div>
  );
}
