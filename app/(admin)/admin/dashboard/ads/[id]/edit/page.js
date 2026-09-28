import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdById } from "@/lib/ads/queries";
import AdForm from "../../AdForm";
import styles from "../../ads.module.css";

export const metadata = { title: "Edit ad · Super Admin" };

export default async function EditAdPage({ params, searchParams }) {
  const ad = await getAdById(params.id);
  if (!ad) notFound();

  if (ad.status === "archived") {
    return (
      <div className={styles.page}>
        <div className={`${styles.shell} ${styles.narrow}`}>
          <Link href={`/admin/dashboard/ads/${ad.id}`} className={styles.backLink}>
            ← Back to ad
          </Link>
          <h1 className={styles.title}>Edit “{ad.title}”</h1>
          <div className={styles.warning}>
            Archived ads are read-only. Restore it from the ads list to edit.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <AdForm
        ad={ad}
        initialError={searchParams?.error || ""}
        header={{
          backHref: `/admin/dashboard/ads/${ad.id}`,
          backLabel: "Back to ad",
          title: `Edit “${ad.title}”`,
          subtitle:
            ad.status === "active"
              ? "This ad is ON. Changes go live as soon as you save."
              : "This ad is OFF. Save it, or save and turn it ON.",
        }}
      />
    </div>
  );
}
