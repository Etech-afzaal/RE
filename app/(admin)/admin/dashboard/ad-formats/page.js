import { Suspense } from "react";
import FormatsClient from "./FormatsClient";
import styles from "@/components/admin/adminUi.module.css";

// FormatsClient reads ?new=1 (from the top-bar "New format" button), and
// useSearchParams needs a Suspense boundary.
export default function AdFormatsPage() {
  return (
    <Suspense fallback={<div className={styles.loading}>Loading formats…</div>}>
      <FormatsClient />
    </Suspense>
  );
}
