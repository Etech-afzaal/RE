"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./AgentInquiryForm.module.css";

const EMPTY_FORM = {
  name: "",
  email: "",
  phone: "",
  message: "",
};

/**
 * Shared customer → agent inquiry form.
 * Send either agentId (agent website) or propertyId (property detail).
 */
export default function AgentInquiryForm({
  agentId = null,
  propertyId = null,
  variant = "website",
  heading = null,
  kicker = "Send a message",
}) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState(false);
  const [errorMessage, setErrorMessage] = useState(false);
  const feedbackTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    };
  }, []);

  function clearFeedback() {
    setSuccessMessage(false);
    setErrorMessage(false);
  }

  function showFeedback(type) {
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);

    if (type === "success") {
      setSuccessMessage(true);
      setErrorMessage(false);
    } else {
      setErrorMessage(true);
      setSuccessMessage(false);
    }

    feedbackTimerRef.current = setTimeout(() => {
      clearFeedback();
      feedbackTimerRef.current = null;
    }, 2500);
  }

  function handleChange(field) {
    return (event) => {
      const value = event.target.value;
      setForm((prev) => ({ ...prev, [field]: value }));
    };
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    clearFeedback();

    const payload = {
      name: form.name,
      email: form.email,
      phone: form.phone,
      message: form.message,
    };

    if (propertyId != null) payload.property_id = Number(propertyId);
    else if (agentId != null) payload.agent_id = Number(agentId);

    try {
      const response = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "Unable to send message.");
      }

      setForm(EMPTY_FORM);
      showFeedback("success");
    } catch {
      showFeedback("error");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      className={`${styles.panel} ${
        variant === "property" ? styles.panelProperty : styles.panelWebsite
      }`}
    >
      {kicker ? <p className={styles.kicker}>{kicker}</p> : null}
      {heading ? <h3 className={styles.heading}>{heading}</h3> : null}

      <form className={styles.form} onSubmit={handleSubmit}>
        <label className={styles.field}>
          <span className={styles.label}>Full Name</span>
          <input
            type="text"
            name="name"
            required
            maxLength={150}
            value={form.name}
            onChange={handleChange("name")}
            placeholder="Full Name"
            className={styles.input}
            disabled={isSubmitting}
          />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Email Address</span>
          <input
            type="email"
            name="email"
            required
            value={form.email}
            onChange={handleChange("email")}
            placeholder="Email Address"
            className={styles.input}
            disabled={isSubmitting}
          />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Phone Number</span>
          <input
            type="tel"
            name="phone"
            value={form.phone}
            onChange={handleChange("phone")}
            placeholder="Phone Number"
            className={styles.input}
            disabled={isSubmitting}
          />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Message</span>
          <textarea
            name="message"
            rows={variant === "property" ? 4 : 5}
            required
            maxLength={2000}
            value={form.message}
            onChange={handleChange("message")}
            placeholder="Write your message"
            className={styles.textarea}
            disabled={isSubmitting}
          />
        </label>

        <button
          type="submit"
          className={styles.submit}
          disabled={isSubmitting}
        >
          {isSubmitting ? "Sending..." : "Send Message"}
        </button>
      </form>

      {successMessage || errorMessage ? (
        <div
          className={`${styles.popup} ${
            successMessage ? styles.popupSuccess : styles.popupError
          }`}
          role={successMessage ? "status" : "alert"}
          aria-live={successMessage ? "polite" : "assertive"}
        >
          {successMessage ? (
            <>
              <p className={styles.popupTitle}>✓ Message sent successfully</p>
              <p className={styles.popupText}>
                The agent will contact you shortly.
              </p>
            </>
          ) : (
            <>
              <p className={styles.popupTitle}>Unable to send message.</p>
              <p className={styles.popupText}>Please try again.</p>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
