import { Suspense } from "react";
import AdminPropertiesPage from "./PropertiesClient";
import styles from "@/components/admin/adminUi.module.css";

export default function PropertiesPage() {
  return (
    <Suspense fallback={<div className={styles.loading}>Loading properties…</div>}>
      <AdminPropertiesPage />
    </Suspense>
  );
}
