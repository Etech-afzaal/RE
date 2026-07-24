"use client";

import { useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import styles from "./page.module.css";

export default function AgentLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await signIn("credentials", {
      email,
      password,
      role: "agent",
      redirect: false,
    });

    setLoading(false);

    if (res?.error === "ACCOUNT_REVOKED") {
      const adminEmail =
        process.env.NEXT_PUBLIC_ADMIN_EMAIL ||
        process.env.ADMIN_EMAIL ||
        "admin@example.com";
      setError(
        `Your account access has been revoked. Contact admin at ${adminEmail} to request access.`,
      );
      return;
    }

    if (res?.error) {
      setError("Invalid email or password.");
      return;
    }

    router.push("/agent/dashboard");
  }

  return (
    <div className={styles.loginPage}>
      <div className={styles.loginShell}>
        <div className={styles.loginCard}>
          <div className={styles.loginBadge}>Agent access</div>
          <h1 className={styles.loginTitle}>Welcome back</h1>
          <p className={styles.loginText}>
            Sign in to manage your listings, add new properties, and keep your
            public estate profile current.
          </p>

          <form onSubmit={handleSubmit} className={styles.loginForm}>
            <input
              required
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={styles.loginInput}
            />
            <input
              required
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={styles.loginInput}
            />
            {error ? <p className={styles.errorText}>{error}</p> : null}
            <button
              type="submit"
              disabled={loading}
              className={styles.loginBtn}
            >
              {loading ? "Logging in..." : "Agent Log In"}
            </button>
          </form>

          <p className={styles.loginFooter}>
            New agent?{" "}
            <Link href="/agent/signup" className={styles.loginLink}>
              Create an account
            </Link>
          </p>
          <p className={styles.loginFooter}>
            Are you an admin?{" "}
            <Link href="/admin/login" className={styles.loginLink}>
              Use admin login
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
            <h2 className={styles.loginVisualTitle}>Manage with confidence</h2>
            <ul className={styles.loginVisualList}>
              <li>Publish and update verified listings</li>
              <li>Keep your branded estate page current</li>
              <li>Respond to serious buyer inquiries</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
