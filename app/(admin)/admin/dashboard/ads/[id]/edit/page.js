import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdById } from "@/lib/ads/queries";
import AdForm from "../../AdForm";
import styles from "../../ads.module.css";

export const metadata = { title: "Edit ad · Super Admin" };

export default async function EditAdPage({ params, searchParams }) {
  const ad = await getAdById(params.id);
  if (!ad) notFound();

  return (
    <div className={styles.page}>
      <div className={`${styles.shell} ${styles.narrow}`}>
        <Link href={`/admin/dashboard/ads/${ad.id}`} className={styles.backLink}>
          ← Back to ad
        </Link>
        <div className={styles.header}>
          <div>
            <p className={styles.kicker}>Ads network · #{ad.id}</p>
            <h1 className={styles.title}>Edit “{ad.title}”</h1>
            <p className={styles.subtitle}>
              {ad.status === "active"
                ? "This ad is ON. Changes go live as soon as you save."
                : "This ad is OFF. Save, or save and turn it ON."}
            </p>
          </div>
        </div>

        {ad.status === "archived" ? (
          <div className={styles.warning}>
            Archived ads are read-only. Restore it from the ads list to edit.
          </div>
        ) : (
          <AdForm ad={ad} initialError={searchParams?.error || ""} />
        )}
      </div>
    </div>
  );
}
