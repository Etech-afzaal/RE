"use client";

import { useState } from "react";
import Link from "next/link";
import LoadingSpinner from "@/components/LoadingSpinner";
import { validateSignupInput } from "@/lib/validators/userValidator";
import styles from "./page.module.css";

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

    const validated = validateSignupInput(form);
    if (!validated.ok) {
      setErrorMsg(validated.error || "Please fill in all required fields correctly.");
      setStatus("error");
      return;
    }

    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated.data),
      });

      if (res.ok) {
        setStatus("done");
      } else {
        const data = await res.json().catch(() => ({}));
        setErrorMsg(data.error || "Something went wrong. Please try again.");
        setStatus("error");
      }
    } catch {
      setErrorMsg("Network error. Please check your connection and try again.");
      setStatus("error");
    }
  }

  if (status === "done") {
    return (
      <div className={styles.signupPage}>
        <div className={styles.signupSuccessCard}>
          <div className={styles.signupSuccessIcon}>✓</div>
          <h1 className={styles.signupTitle}>Thanks for signing up!</h1>
          <p className={styles.signupText} style={{ marginBottom: 0 }}>
            Your request has been sent to our team. We&apos;ll review it and
            email you login details once approved.
          </p>
          <div className={styles.signupSuccessActions}>
            <Link href="/agent/login" className={styles.signupSuccessPrimary}>
              Go to agent login
            </Link>
            <Link href="/" className={styles.signupSuccessSecondary}>
              Back to home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.signupPage}>
      <div className={styles.signupShell}>
        <div className={styles.signupCard}>
          <div className={styles.signupBadge}>Join as an agent</div>
          <h1 className={styles.signupTitle}>Create an account</h1>
          <p className={styles.signupText}>
            Showcase your estate, create your public listing page, and get
            discovered by buyers looking for trusted professionals.
          </p>

          <form onSubmit={handleSubmit} className={styles.signupForm} noValidate>
            <input
              required
              maxLength={100}
              placeholder="Full name"
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              className={styles.signupInput}
            />
            <input
              required
              maxLength={100}
              placeholder="Estate / Agency name"
              value={form.estate_name}
              onChange={(e) =>
                setForm({ ...form, estate_name: e.target.value })
              }
              className={styles.signupInput}
            />
            <p className={styles.signupNote}>
              Your public page address will be created from this name.
            </p>
            <input
              required
              type="email"
              placeholder="Email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className={styles.signupInput}
            />
            <input
              placeholder="Phone"
              maxLength={20}
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className={styles.signupInput}
            />
            <textarea
              placeholder="Anything else we should know? (optional)"
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              rows={4}
              maxLength={1000}
              className={styles.signupTextarea}
            />
            {errorMsg ? <p className={styles.errorText}>{errorMsg}</p> : null}
            <button
              type="submit"
              disabled={status === "submitting"}
              className={styles.signupBtn}
            >
              {status === "submitting" ? "Submitting..." : "Request Access"}
            </button>
          </form>

          <p className={styles.signupFooter}>
            Already approved?{" "}
            <Link href="/agent/login" className={styles.signupLink}>
              Agent login
            </Link>
          </p>
        </div>

        <div className={styles.signupVisual}>
          <img
            src="/hero/3.jpg"
            alt="Premium real estate"
            className={styles.signupVisualImg}
          />
          <div className={styles.signupVisualOverlay} aria-hidden="true" />
          <div className={styles.signupVisualText}>
            <h2 className={styles.signupVisualTitle}>Why join us?</h2>
            <ul className={styles.signupVisualList}>
              <li>Professional public profile for your estate</li>
              <li>Clear visibility for serious buyers</li>
              <li>Fast approval and secure agent access</li>
            </ul>
          </div>
        </div>
      </div>
      {status === "submitting" ? (
        <LoadingSpinner fullPage label="Loading" />
      ) : null}
    </div>
  );
}
