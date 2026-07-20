"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

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
    <div
      className="login-page"
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #f8fbff 0%, #eef5ff 100%)",
        padding: "24px 16px",
      }}
    >
      <style jsx global>{`
        @media (max-width: 900px) {
          .login-page .login-shell {
            grid-template-columns: 1fr !important;
          }
          .login-page .login-visual {
            order: -1;
          }
        }
        @media (max-width: 600px) {
          .login-page {
            padding: 16px 12px !important;
          }
          .login-page .login-card,
          .login-page .login-visual {
            padding: 18px 14px !important;
          }
          .login-page .login-btn {
            width: 100%;
          }
        }
      `}</style>

      <div
        className="login-shell"
        style={{
          maxWidth: 1120,
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "0.95fr 1.05fr",
          gap: 28,
          alignItems: "stretch",
        }}
      >
        <div
          className="login-card"
          style={{
            background: "#fff",
            borderRadius: 24,
            boxShadow: "0 18px 45px rgba(15, 23, 42, 0.12)",
            padding: "28px 24px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              display: "inline-block",
              width: "fit-content",
              padding: "8px 12px",
              borderRadius: 999,
              background: "#ecf6ff",
              color: "#2563eb",
              fontSize: 13,
              fontWeight: 700,
              marginBottom: 12,
            }}
          >
            Secure access for agents
          </div>
          <h1
            style={{
              margin: "0 0 10px",
              color: "#0f172a",
              fontSize: "clamp(1.6rem, 4vw, 2rem)",
              lineHeight: 1.2,
            }}
          >
            Welcome back
          </h1>
          <p
            style={{
              margin: "0 0 22px",
              color: "#475569",
              fontSize: "1rem",
              lineHeight: 1.7,
            }}
          >
            Sign in to manage your listings, add new properties, and keep your
            public estate profile current.
          </p>

          <form
            onSubmit={handleSubmit}
            style={{ display: "flex", flexDirection: "column", gap: 12 }}
          >
            <input
              required
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={inputStyle}
            />
            <input
              required
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={inputStyle}
            />
            {error && (
              <p style={{ margin: 0, color: "#dc2626", fontSize: 14 }}>
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="login-btn"
              style={{
                border: "none",
                borderRadius: 999,
                padding: "13px 18px",
                fontSize: 15,
                fontWeight: 700,
                color: "#fff",
                cursor: loading ? "wait" : "pointer",
                background: "linear-gradient(135deg, #2563eb 0%, #0f766e 100%)",
                boxShadow: "0 10px 24px rgba(37, 99, 235, 0.22)",
                marginTop: 4,
              }}
            >
              {loading ? "Logging in..." : "Agent Log In"}
            </button>
          </form>

          <p style={{ margin: "14px 0 0", color: "#64748b", fontSize: 14 }}>
            New agent?{" "}
            <a
              href="/agent/signup"
              style={{
                color: "#2563eb",
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              Create an account
            </a>
          </p>
          <p style={{ margin: "8px 0 0", color: "#64748b", fontSize: 14 }}>
            Are you an admin?{" "}
            <a
              href="/admin/login"
              style={{
                color: "#2563eb",
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              Use admin login
            </a>
          </p>
        </div>

        <div
          className="login-visual"
          style={{
            background: "linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)",
            borderRadius: 24,
            boxShadow: "0 18px 45px rgba(15, 23, 42, 0.16)",
            padding: "20px 18px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: 18,
          }}
        >
          <img
            src="https://images.unsplash.com/photo-1512918728675-ed5a9ecdebfd?auto=format&fit=crop&w=900&q=80"
            alt="Professional real estate dashboard"
            style={{
              width: "100%",
              height: "clamp(220px, 38vw, 320px)",
              objectFit: "cover",
              borderRadius: 18,
            }}
          />
          <div style={{ color: "#f8fafc" }}>
            <h2 style={{ margin: "0 0 8px", fontSize: "1.25rem" }}>
              Manage with confidence
            </h2>
            <ul
              style={{
                margin: 0,
                paddingLeft: 18,
                lineHeight: 1.8,
                color: "#dbeafe",
              }}
            >
              <li>Track listings and property updates</li>
              <li>Review and approve new requests</li>
              <li>Keep your client-facing profile current</li>
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
