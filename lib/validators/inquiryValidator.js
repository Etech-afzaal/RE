/**
 * Customer contact + agent inquiry validators.
 */

import {
  collectValues,
  firstError,
  validateEmail,
  validateLength,
  validateMessage,
  validatePersonName,
  validatePhone,
} from "./common";

/**
 * Homepage / estate contact form.
 * Subject is required for admin (homepage) contact; optional when routing to an estate agent.
 */
export function validateContactInput(input = {}) {
  const estateName = String(input.estate_name ?? "").trim();
  const requireSubject = !estateName;

  const fields = {
    full_name: validatePersonName(input.full_name ?? input.name, {
      required: true,
      min: 2,
      max: 100,
    }),
    email: validateEmail(input.email, { required: true }),
    // Keep phone optional so existing forms without phone still submit;
    // when provided it must be a valid phone number.
    phone: validatePhone(input.phone, { required: false }),
    subject: validateLength(input.subject, {
      required: requireSubject,
      min: requireSubject ? 2 : 0,
      max: 150,
    }),
    message: validateMessage(input.message, {
      required: true,
      min: 10,
      max: 1000,
    }),
  };

  const error = firstError(fields);
  if (error) {
    return { ok: false, error: error.error, field: error.field };
  }

  const data = collectValues(fields);
  if (estateName) data.estate_name = estateName;
  return { ok: true, data };
}

/**
 * Optional tracking path for where an inquiry was submitted.
 * Never fails validation — invalid values become null.
 */
export function normalizeInquiryPageUrl(value) {
  if (value == null) return null;
  let raw = String(value).trim();
  if (!raw) return null;

  // Prefer pathname if a full URL was sent.
  try {
    if (/^https?:\/\//i.test(raw)) {
      raw = new URL(raw).pathname || raw;
    }
  } catch {
    // Keep raw string; length check below still applies.
  }

  // Reject control characters / obvious junk; keep relative paths.
  if (/[\u0000-\u001f\u007f]/.test(raw)) return null;
  if (raw.length > 500) raw = raw.slice(0, 500);

  return raw;
}

/**
 * Customer → agent inquiry (website or property detail).
 */
export function validateInquiryInput(input = {}) {
  const fields = {
    name: validatePersonName(input.name ?? input.full_name, {
      required: true,
      min: 2,
      max: 100,
    }),
    email: validateEmail(input.email, { required: true }),
    phone: validatePhone(input.phone, { required: false }),
    message: validateMessage(input.message, {
      required: true,
      min: 10,
      max: 1000,
    }),
  };

  const error = firstError(fields);
  if (error) {
    return { ok: false, error: error.error, field: error.field };
  }

  const data = collectValues(fields);
  data.page_url = normalizeInquiryPageUrl(input.page_url);
  return { ok: true, data };
}
