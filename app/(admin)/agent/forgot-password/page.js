import Link from "next/link";
import styles from "../login/page.module.css";

export const metadata = {
  title: "Forgot password — Dhalahore Properties",
};

/**
 * There is no self-service reset yet, so this points agents at the
 * configured admin contact who can issue a new temporary password.
 * Uses ADMIN_EMAIL from env — never exposes the live superadmin DB row.
 */
export default function AgentForgotPasswordPage() {
  const contactEmail =
    String(process.env.ADMIN_EMAIL || "").trim() || "admin@example.com";
  const mailtoHref = `mailto:${contactEmail}?subject=${encodeURIComponent(
    "Agent password reset request",
  )}&body=${encodeURIComponent(
    "Hello,\n\nI can't sign in to my agent account and would like my password reset.\n\nAccount email: \n\nThank you.",
  )}`;

  return (
    <div className={styles.loginPage}>
      <div className={styles.loginShell}>
        <div className={styles.loginCard}>
          <div className={styles.loginBadge}>Password help</div>
          <h1 className={styles.loginTitle}>Forgot your password?</h1>
          <p className={styles.loginText}>
            Password resets are handled by the Dhalahore admin team. Email us
            from the address linked to your agent account and we&apos;ll send
            you a temporary password to sign in with.
          </p>

          <a href={mailtoHref} className={styles.loginBtn}>
            Email {contactEmail}
          </a>

          <p className={styles.loginFooter}>
            Remembered it?{" "}
            <Link href="/agent/login" className={styles.loginLink}>
              Back to agent login
            </Link>
          </p>
          <p className={styles.loginFooter}>
            New agent?{" "}
            <Link href="/become-an-agent" className={styles.loginLink}>
              Create an account
            </Link>
          </p>
        </div>

        <div className={styles.loginVisual}>
          <img
            src="/hero/1.jpg"
            alt="Luxury property"
            className={styles.loginVisualImg}
          />
          <div className={styles.loginVisualOverlay} aria-hidden="true" />
          <div className={styles.loginVisualText}>
            <h2 className={styles.loginVisualTitle}>We&apos;ll get you back in</h2>
            <ul className={styles.loginVisualList}>
              <li>Verified agents only</li>
              <li>Temporary password sent by email</li>
              <li>Change it as soon as you sign in</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
