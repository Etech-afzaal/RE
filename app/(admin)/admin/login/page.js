"use client";

import { useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import LoadingSpinner from "@/components/LoadingSpinner";
import PasswordInput from "@/components/PasswordInput";
import { validateLoginInput } from "@/lib/validators/userValidator";
import styles from "./page.module.css";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    setError("");

    try {
      const validated = validateLoginInput({ email, password });
      if (!validated.ok) {
        setError(validated.error);
        setLoading(false);
        return;
      }

      const res = await signIn("credentials", {
        email: validated.data.email,
        password: validated.data.password,
        role: "superadmin",
        redirect: false,
      });

      if (res?.error === "ACCOUNT_REVOKED") {
        setError(
          "Your account access has been revoked. Contact the administrator to request access.",
        );
        setLoading(false);
        return;
      }

      if (
        res?.error === "AUTH_DATABASE_UNAVAILABLE" ||
        /EHOSTUNREACH|ECONNREFUSED|ENETUNREACH|timed out|Pool is closed/i.test(
          String(res?.error || ""),
        )
      ) {
        setError(
          "Unable to reach the database. Check that MySQL is running and DB_HOST in .env is correct.",
        );
        setLoading(false);
        return;
      }

      if (res?.error) {
        setError("Invalid email or password.");
        setLoading(false);
        return;
      }

      // Keep spinner until navigation completes.
      router.push("/admin/dashboard");
    } catch {
      setError("Unable to sign in. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className={styles.loginPage}>
      <div className={styles.loginShell}>
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
              disabled={loading}
            />
            <PasswordInput
              required
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={styles.loginInput}
              autoComplete="current-password"
              disabled={loading}
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
      </div>
      {loading ? <LoadingSpinner fullPage label="Loading" /> : null}
    </div>
  );
}
