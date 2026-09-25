import Link from "next/link";
import AdForm from "../AdForm";
import styles from "../ads.module.css";

export const metadata = { title: "New ad · Super Admin" };

export default function NewAdPage() {
  return (
    <div className={styles.page}>
      <div className={`${styles.shell} ${styles.narrow}`}>
        <Link href="/admin/dashboard/ads" className={styles.backLink}>
          ← All ads
        </Link>
        <div className={styles.header}>
          <div>
            <p className={styles.kicker}>Ads network</p>
            <h1 className={styles.title}>Create an ad</h1>
            <p className={styles.subtitle}>
              Save it as a draft to finish later, or turn it ON straight away.
            </p>
          </div>
        </div>
        <AdForm />
      </div>
    </div>
  );
}
