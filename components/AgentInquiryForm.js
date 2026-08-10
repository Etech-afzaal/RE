"use client";

import { useEffect, useRef, useState } from "react";
import { validateInquiryInput } from "@/lib/validators/inquiryValidator";
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
  const [fieldErrors, setFieldErrors] = useState({});
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
      if (fieldErrors[field]) {
        setFieldErrors((prev) => {
          const next = { ...prev };
          delete next[field];
          return next;
        });
      }
    };
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (isSubmitting) return;

    const validated = validateInquiryInput(form);
    if (!validated.ok) {
      setFieldErrors(
        validated.field ? { [validated.field]: validated.error } : {},
      );
      return;
    }

    setIsSubmitting(true);
    clearFeedback();
    setFieldErrors({});

    const payload = {
      name: validated.data.name,
      email: validated.data.email,
      phone: validated.data.phone,
      message: validated.data.message,
      page_url:
        typeof window !== "undefined" ? window.location.pathname : null,
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

      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <label className={styles.field}>
          <span className={styles.label}>Full Name</span>
          <input
            type="text"
            name="name"
            required
            maxLength={100}
            value={form.name}
            onChange={handleChange("name")}
            placeholder="Full Name"
            className={styles.input}
            disabled={isSubmitting}
            aria-invalid={Boolean(fieldErrors.name)}
          />
          {fieldErrors.name ? (
            <span className={styles.fieldError}>{fieldErrors.name}</span>
          ) : null}
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
            aria-invalid={Boolean(fieldErrors.email)}
          />
          {fieldErrors.email ? (
            <span className={styles.fieldError}>{fieldErrors.email}</span>
          ) : null}
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Phone Number</span>
          <input
            type="tel"
            name="phone"
            maxLength={20}
            value={form.phone}
            onChange={handleChange("phone")}
            placeholder="Phone Number"
            className={styles.input}
            disabled={isSubmitting}
            aria-invalid={Boolean(fieldErrors.phone)}
          />
          {fieldErrors.phone ? (
            <span className={styles.fieldError}>{fieldErrors.phone}</span>
          ) : null}
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Message</span>
          <textarea
            name="message"
            rows={variant === "property" ? 4 : 5}
            required
            maxLength={1000}
            value={form.message}
            onChange={handleChange("message")}
            placeholder="Write your message"
            className={styles.textarea}
            disabled={isSubmitting}
            aria-invalid={Boolean(fieldErrors.message)}
          />
          {fieldErrors.message ? (
            <span className={styles.fieldError}>{fieldErrors.message}</span>
          ) : null}
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
