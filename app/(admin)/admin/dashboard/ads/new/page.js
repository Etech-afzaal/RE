import AdForm from "../AdForm";
import styles from "../ads.module.css";

export const metadata = { title: "New ad · Super Admin" };

export default function NewAdPage() {
  return (
    <div className={styles.page}>
      <AdForm
        header={{
          backHref: "/admin/dashboard/ads",
          backLabel: "All ads",
          title: "Create an ad",
          subtitle: "Save it as a draft to finish later, or turn it ON straight away.",
        }}
      />
    </div>
  );
}
