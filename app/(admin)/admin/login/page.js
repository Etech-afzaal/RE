"use client";

import { useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import styles from "./page.module.css";

export default function LoginPage() {
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
      role: "admin",
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

    router.push("/admin/dashboard");
  }

  return (
    <div className={styles.loginPage}>
      <div className={styles.loginShell}>
        <div className={styles.loginCard}>
          <div className={styles.loginBadge}>Admin access</div>
          <h1 className={styles.loginTitle}>Welcome back</h1>
          <p className={styles.loginText}>
            Sign in to review agent requests, manage agents, and oversee listings
            across the marketplace.
          </p>

          <form onSubmit={handleSubmit} className={styles.loginForm}>
            <input
              required
              type="email"
              autoComplete="email"
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
              {loading ? "Logging in..." : "Admin Log In"}
            </button>
          </form>

          <p className={styles.loginFooter}>
            Are you an agent?{" "}
            <Link href="/agent/login" className={styles.loginLink}>
              Use agent login
            </Link>
          </p>
        </div>

        <div className={styles.loginVisual}>
          <img
            src="/hero/2.jpg"
            alt="Premium real estate"
            className={styles.loginVisualImg}
          />
          <div className={styles.loginVisualOverlay} aria-hidden="true" />
          <div className={styles.loginVisualText}>
            <h2 className={styles.loginVisualTitle}>Manage with confidence</h2>
            <ul className={styles.loginVisualList}>
              <li>Approve and manage agent requests</li>
              <li>Oversee marketplace quality</li>
              <li>Keep buyer trust signals strong</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
