"use client";

import { useState } from "react";

export default function AgentSignupPage() {
  const [form, setForm] = useState({
    full_name: "",
    estate_name: "",
    email: "",
    phone: "",
    message: "",
  });
  const [status, setStatus] = useState("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus("submitting");
    setErrorMsg("");

    const res = await fetch("/api/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    if (res.ok) {
      setStatus("done");
    } else {
      const data = await res.json().catch(() => ({}));
      setErrorMsg(data.error || "Something went wrong. Please try again.");
      setStatus("error");
    }
  }

  if (status === "done") {
    return (
      <div
        className="signup-page"
        style={{
          minHeight: "100vh",
          background: "linear-gradient(135deg, #f8fbff 0%, #eef5ff 100%)",
          padding: "24px 16px",
        }}
      >
        <style jsx global>{`
          @media (max-width: 900px) {
            .signup-page .signup-shell {
              grid-template-columns: 1fr !important;
            }
            .signup-page .signup-visual {
              order: -1;
            }
          }
          @media (max-width: 600px) {
            .signup-page {
              padding: 16px 12px !important;
            }
            .signup-page .signup-card,
            .signup-page .signup-visual {
              padding: 18px 14px !important;
            }
            .signup-page .signup-visual img {
              height: 220px !important;
            }
            .signup-page .signup-btn {
              width: 100%;
            }
          }
        `}</style>
        <div
          style={{
            maxWidth: 760,
            margin: "0 auto",
            background: "#fff",
            borderRadius: 24,
            boxShadow: "0 18px 45px rgba(15, 23, 42, 0.12)",
            padding: "24px 20px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: "50%",
              background: "#e8f4ff",
              margin: "0 auto 16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 32,
            }}
          >
            ✓
          </div>
          <h1
            style={{
              margin: "0 0 12px",
              color: "#0f172a",
              fontSize: "clamp(1.5rem, 4vw, 2rem)",
            }}
          >
            Thanks for signing up!
          </h1>
          <p
            style={{
              margin: 0,
              color: "#475569",
              fontSize: "1rem",
              lineHeight: 1.7,
            }}
          >
            Your request has been sent to our team. We&apos;ll review it and
            email you login details once approved.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="signup-page"
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #f8fbff 0%, #eef5ff 100%)",
        padding: "40px 20px",
      }}
    >
      <style jsx global>{`
        @media (max-width: 900px) {
          .signup-page .signup-shell {
            grid-template-columns: 1fr !important;
          }
          .signup-page .signup-visual {
            order: -1;
          }
        }
        @media (max-width: 600px) {
          .signup-page {
            padding: 16px 12px !important;
          }
          .signup-page .signup-card,
          .signup-page .signup-visual {
            padding: 18px 14px !important;
          }
          .signup-page .signup-visual img {
            height: 220px !important;
          }
          .signup-page .signup-btn {
            width: 100%;
          }
        }
      `}</style>
      <div
        className="signup-shell"
        style={{
          maxWidth: 1180,
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "1.1fr 0.9fr",
          gap: 28,
          alignItems: "stretch",
        }}
      >
        <div
          className="signup-card"
          style={{
            background: "#fff",
            borderRadius: 24,
            boxShadow: "0 18px 45px rgba(15, 23, 42, 0.12)",
            padding: "24px 20px",
          }}
        >
          <div
            style={{
              display: "inline-block",
              padding: "8px 12px",
              borderRadius: 999,
              background: "#ecf6ff",
              color: "#2563eb",
              fontSize: 13,
              fontWeight: 700,
              marginBottom: 12,
            }}
          >
            Join the premium real estate network
          </div>
          <h1
            style={{
              margin: "0 0 10px",
              color: "#0f172a",
              fontSize: "clamp(1.5rem, 4vw, 2rem)",
              lineHeight: 1.2,
            }}
          >
            Become a Listed Agent
          </h1>
          <p
            style={{
              margin: "0 0 22px",
              color: "#475569",
              fontSize: "1rem",
              lineHeight: 1.7,
            }}
          >
            Showcase your estate, create your public listing page, and get
            discovered by buyers and renters looking for trusted professionals.
          </p>

          <form
            onSubmit={handleSubmit}
            style={{ display: "flex", flexDirection: "column", gap: 12 }}
          >
            <input
              required
              placeholder="Full name"
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              style={inputStyle}
            />
            <input
              required
              placeholder="Estate / Agency name"
              value={form.estate_name}
              onChange={(e) =>
                setForm({ ...form, estate_name: e.target.value })
              }
              style={inputStyle}
            />
            <small style={{ color: "#64748b", marginTop: -4, fontSize: 13 }}>
              Your public page will use a URL-safe version of this name.
            </small>
            <input
              required
              type="email"
              placeholder="Email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              style={inputStyle}
            />
            <input
              placeholder="Phone"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              style={inputStyle}
            />
            <textarea
              placeholder="Anything else we should know? (optional)"
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              rows={4}
              style={{ ...inputStyle, minHeight: 96, resize: "vertical" }}
            />
            {errorMsg && (
              <p style={{ margin: 0, color: "#dc2626", fontSize: 14 }}>
                {errorMsg}
              </p>
            )}
            <button
              type="submit"
              disabled={status === "submitting"}
              className="signup-btn"
              style={{
                border: "none",
                borderRadius: 999,
                padding: "13px 18px",
                fontSize: 15,
                fontWeight: 700,
                color: "#fff",
                cursor: status === "submitting" ? "wait" : "pointer",
                background: "linear-gradient(135deg, #2563eb 0%, #0f766e 100%)",
                boxShadow: "0 10px 24px rgba(37, 99, 235, 0.22)",
                marginTop: 4,
              }}
            >
              {status === "submitting" ? "Submitting..." : "Request Access"}
            </button>
          </form>
        </div>

        <div
          className="signup-visual"
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
            src="https://images.unsplash.com/photo-1460317442991-0ec209397118?auto=format&fit=crop&w=900&q=80"
            alt="Real estate team reviewing properties"
            style={{
              width: "100%",
              height: "clamp(220px, 38vw, 320px)",
              objectFit: "cover",
              borderRadius: 18,
            }}
          />
          <div style={{ color: "#f8fafc" }}>
            <h2 style={{ margin: "0 0 8px", fontSize: "1.3rem" }}>
              Why join us?
            </h2>
            <ul
              style={{
                margin: 0,
                paddingLeft: 18,
                lineHeight: 1.8,
                color: "#dbeafe",
              }}
            >
              <li>Professional public profile for your estate</li>
              <li>Easy visibility for buyers, sellers, and renters</li>
              <li>Fast approval and secure access for your team</li>
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
