"use client";

import { useState } from "react";
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
          <div className={styles.loginBadge}>Secure access for admins</div>
          <h1 className={styles.loginTitle}>Welcome back</h1>
          <p className={styles.loginText}>
            Sign in to review agent requests, manage approvals, and oversee the
            admin dashboard.
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
            {error && <p className={styles.errorText}>{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className={styles.loginBtn}
            >
              {loading ? "Logging in..." : "Admin Log In"}
            </button>
          </form>

          <p className={styles.loginText}>
            Are you an agent?{" "}
            <a href="/agent/login" className={styles.loginLink}>
              Use agent login
            </a>
          </p>
        </div>

        <div className={styles.loginVisual}>
          <img
            src="https://images.unsplash.com/photo-1512918728675-ed5a9ecdebfd?auto=format&fit=crop&w=900&q=80"
            alt="Professional real estate dashboard"
            className={styles.loginVisualImg}
          />
          <div className={styles.loginVisualText}>
            <h2 className={styles.loginVisualTitle}>Manage with confidence</h2>
            <ul className={styles.loginVisualList}>
              <li>loreum ipsum .....</li>
              <li>Review and approve new requests</li>
              <li>loreum ipsum .....</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

const inputStyle = {
  width: "100%",
  border: "1px solid #dbe4f0",
  borderRadius: 14,
  padding: "12px 14px",
  fontSize: 15,
  outline: "none",
  boxSizing: "border-box",
  background: "#f8fbff",
  color: "#0f172a",
};
