/**
 * Shared field validators used by frontend forms and API routes.
 * Each helper returns { ok, error?, value? } where value is a normalized input.
 */

export const MESSAGES = {
  required: "This field is required",
  email: "Please enter a valid email address",
  phone: "Please enter a valid phone number",
  url: "Please enter a valid URL (https://...)",
  passwordWeak:
    "Password must be at least 8 characters and include uppercase, lowercase, and a number",
  passwordRequired: "This field is required",
  unsafeContent: "Please remove HTML or script tags from this field",
};

export function trim(value) {
  return String(value ?? "").trim();
}

export function normalizeWhitespace(value) {
  return String(value ?? "")
    .replace(/[\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Collapse whitespace; keep internal newlines for longer messages. */
export function normalizeMultiline(value) {
  return String(value ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function hasHtmlOrScript(value) {
  const text = String(value ?? "");
  return /<\s*\/?\s*(script|iframe|object|embed|style|link|meta)\b/i.test(text) ||
    /javascript\s*:/i.test(text) ||
    /on\w+\s*=/i.test(text) ||
    /<\s*[a-z]/i.test(text);
}

export function validateRequired(value, label = "This field") {
  const normalized = typeof value === "string" ? trim(value) : value;
  if (
    normalized == null ||
    normalized === "" ||
    (typeof normalized === "string" && normalized.length === 0)
  ) {
    return { ok: false, error: MESSAGES.required };
  }
  return { ok: true, value: normalized };
}

/**
 * @param {unknown} value
 * @param {{ min?: number, max?: number, label?: string, required?: boolean, multiline?: boolean }} opts
 */
export function validateLength(value, opts = {}) {
  const {
    min,
    max,
    required = false,
    multiline = false,
  } = opts;
  const normalized = multiline
    ? normalizeMultiline(value)
    : normalizeWhitespace(value);

  if (!normalized) {
    if (required) return { ok: false, error: MESSAGES.required };
    return { ok: true, value: "" };
  }

  if (min != null && normalized.length < min) {
    return {
      ok: false,
      error: `Minimum ${min} characters required`,
    };
  }

  if (max != null && normalized.length > max) {
    return {
      ok: false,
      error: `Maximum ${max} characters allowed`,
    };
  }

  return { ok: true, value: normalized };
}

/**
 * Full name: letters and spaces (hyphen/apostrophe allowed for real names).
 * @param {unknown} value
 * @param {{ required?: boolean, min?: number, max?: number }} opts
 */
export function validatePersonName(value, opts = {}) {
  const { required = true, min = 2, max = 100 } = opts;
  const lengthResult = validateLength(value, { required, min, max });
  if (!lengthResult.ok) return lengthResult;
  if (!lengthResult.value) return { ok: true, value: "" };

  // Letters (incl. unicode), spaces, hyphen, apostrophe only.
  if (!/^[\p{L}][\p{L}\s'-]*$/u.test(lengthResult.value)) {
    return {
      ok: false,
      error: "Please enter a valid name (letters and spaces only)",
    };
  }

  return lengthResult;
}

/**
 * @param {unknown} value
 * @param {{ required?: boolean }} opts
 */
export function validateEmail(value, opts = {}) {
  const { required = true } = opts;
  const normalized = normalizeWhitespace(value).toLowerCase();

  if (!normalized) {
    if (required) return { ok: false, error: MESSAGES.required };
    return { ok: true, value: "" };
  }

  // Practical email check — rejects abc, abc@, abc.com
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(normalized) || normalized.length > 254) {
    return { ok: false, error: MESSAGES.email };
  }

  return { ok: true, value: normalized };
}

/**
 * Digits only after stripping spaces/dashes; optional leading +.
 * Returns normalized digit string (keeps leading + when present).
 * @param {unknown} value
 * @param {{ required?: boolean, minDigits?: number, maxDigits?: number }} opts
 */
export function validatePhone(value, opts = {}) {
  const { required = false, minDigits = 10, maxDigits = 15 } = opts;
  const raw = normalizeWhitespace(value);

  if (!raw) {
    if (required) return { ok: false, error: MESSAGES.required };
    return { ok: true, value: "" };
  }

  // Reject letters and other symbols up front.
  if (/[a-zA-Z]/.test(raw)) {
    return { ok: false, error: MESSAGES.phone };
  }

  const hasPlus = raw.startsWith("+");
  const digits = raw.replace(/[\s\-().]/g, "").replace(/^\+/, "");

  if (!/^\d+$/.test(digits)) {
    return { ok: false, error: MESSAGES.phone };
  }

  if (digits.length < minDigits || digits.length > maxDigits) {
    return {
      ok: false,
      error: `Phone number must be ${minDigits}–${maxDigits} digits`,
    };
  }

  return { ok: true, value: hasPlus ? `+${digits}` : digits };
}

/**
 * Licence / registration number: letters, digits, and hyphens only.
 * @param {unknown} value
 * @param {{ required?: boolean, min?: number, max?: number }} opts
 */
export function validateLicenceNumber(value, opts = {}) {
  const { required = false, min = 1, max = 25 } = opts;
  const normalized = normalizeWhitespace(value);

  if (!normalized) {
    if (required) return { ok: false, error: MESSAGES.required };
    return { ok: true, value: "" };
  }

  if (normalized.length < min) {
    return {
      ok: false,
      error: `Minimum ${min} characters required`,
    };
  }

  if (normalized.length > max) {
    return {
      ok: false,
      error: `Maximum ${max} characters allowed`,
    };
  }

  if (!/^[A-Za-z0-9-]+$/.test(normalized)) {
    return {
      ok: false,
      error: "Licence number may only contain letters, numbers, and hyphens",
    };
  }

  return { ok: true, value: normalized };
}

/**
 * Estate / agency name: letters, digits, and spaces (no symbols).
 * Slug/URL conversion (spaces → hyphens) happens at signup storage time.
 * @param {unknown} value
 * @param {{ required?: boolean, min?: number, max?: number }} opts
 */
export function validateEstateName(value, opts = {}) {
  const { required = true, min = 3, max = 30 } = opts;
  const normalized = trim(value);

  if (!normalized) {
    if (required) return { ok: false, error: MESSAGES.required };
    return { ok: true, value: "" };
  }

  if (normalized.length < min) {
    return {
      ok: false,
      error: `Minimum ${min} characters required`,
    };
  }

  if (normalized.length > max) {
    return {
      ok: false,
      error: `Maximum ${max} characters allowed`,
    };
  }

  if (!/^[a-zA-Z0-9 ]+$/.test(normalized)) {
    return {
      ok: false,
      error: "Estate name may only contain letters, numbers, and spaces",
    };
  }

  return { ok: true, value: normalized };
}

/**
 * Whole / decimal numbers within digit length caps.
 * @param {unknown} value
 * @param {{ required?: boolean, maxDigits?: number, min?: number, allowDecimal?: boolean, label?: string }} opts
 */
export function validateNumberRange(value, opts = {}) {
  const {
    required = false,
    maxDigits = 12,
    min = 0,
    allowDecimal = true,
    label = "Value",
  } = opts;
  const raw = normalizeWhitespace(value);

  if (!raw) {
    if (required) return { ok: false, error: MESSAGES.required };
    return { ok: true, value: null };
  }

  if (allowDecimal) {
    if (!/^\d+(\.\d+)?$/.test(raw)) {
      return { ok: false, error: `Invalid ${label.toLowerCase()} format` };
    }
  } else if (!/^\d+$/.test(raw)) {
    return { ok: false, error: `Invalid ${label.toLowerCase()} format` };
  }

  const digitCount = raw.replace(/\D/g, "").length;
  if (digitCount > maxDigits) {
    return {
      ok: false,
      error: `Maximum ${maxDigits} digits allowed`,
    };
  }

  const num = Number(raw);
  if (!Number.isFinite(num)) {
    return { ok: false, error: `Invalid ${label.toLowerCase()} format` };
  }
  if (num < min) {
    return {
      ok: false,
      error: `${label} must be greater than ${min === 0 ? "or equal to zero" : min - 1}`,
    };
  }

  return { ok: true, value: num };
}

/**
 * Integer with at most maxDigits digits (e.g. bedrooms).
 */
export function validateDigitCount(value, opts = {}) {
  const { required = false, maxDigits = 2, min = 0, label = "Value" } = opts;
  return validateNumberRange(value, {
    required,
    maxDigits,
    min,
    allowDecimal: false,
    label,
  });
}

/**
 * @param {unknown} value
 * @param {{ required?: boolean }} opts
 */
export function validateURL(value, opts = {}) {
  const { required = false } = opts;
  const normalized = normalizeWhitespace(value);

  if (!normalized) {
    if (required) return { ok: false, error: MESSAGES.required };
    return { ok: true, value: "" };
  }

  let parsed;
  try {
    parsed = new URL(normalized);
  } catch {
    return { ok: false, error: MESSAGES.url };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, error: MESSAGES.url };
  }

  return { ok: true, value: parsed.toString() };
}

/**
 * Validate one or more URLs separated by newlines or commas.
 */
export function validateSocialLinks(value, opts = {}) {
  const { required = false, max = 1000 } = opts;
  const raw = String(value ?? "").trim();

  if (!raw) {
    if (required) return { ok: false, error: MESSAGES.required };
    return { ok: true, value: "" };
  }

  if (raw.length > max) {
    return { ok: false, error: `Maximum ${max} characters allowed` };
  }

  const parts = raw
    .split(/[\n,]+/)
    .map((part) => part.trim())
    .filter(Boolean);

  const normalized = [];
  for (const part of parts) {
    const result = validateURL(part, { required: true });
    if (!result.ok) return result;
    normalized.push(result.value);
  }

  return { ok: true, value: normalized.join("\n") };
}

/**
 * @param {unknown} value
 * @param {{ mode?: "create" | "login" }} opts
 */
export function validatePassword(value, opts = {}) {
  const { mode = "create" } = opts;
  const password = String(value ?? "");

  if (!password) {
    return { ok: false, error: MESSAGES.passwordRequired };
  }

  if (mode === "login") {
    // Do not expose password rules on login — only require non-empty.
    return { ok: true, value: password };
  }

  if (password.length < 8) {
    return { ok: false, error: MESSAGES.passwordWeak };
  }
  if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
    return { ok: false, error: MESSAGES.passwordWeak };
  }

  return { ok: true, value: password };
}

/**
 * Message / free-text body with HTML injection guard.
 */
export function validateMessage(value, opts = {}) {
  const { required = true, min = 10, max = 1000 } = opts;
  const lengthResult = validateLength(value, {
    required,
    min,
    max,
    multiline: true,
  });
  if (!lengthResult.ok) return lengthResult;
  if (!lengthResult.value) return { ok: true, value: "" };

  if (hasHtmlOrScript(lengthResult.value)) {
    return { ok: false, error: MESSAGES.unsafeContent };
  }

  return lengthResult;
}

/**
 * Search boxes: cap length and strip dangerous fragments (keep usable text).
 */
export function sanitizeSearchInput(value, opts = {}) {
  const { max = 100 } = opts;
  let text = String(value ?? "");

  text = text.replace(/<\s*\/?\s*script\b[^>]*>/gi, "");
  text = text.replace(/[;'"\\]/g, "");
  text = text.replace(/\s+/g, " ").trim();

  if (text.length > max) {
    text = text.slice(0, max);
  }

  return { ok: true, value: text };
}

/**
 * Collect the first error from a list of field results.
 * @param {Record<string, { ok: boolean, error?: string, value?: unknown }>} fields
 */
export function firstError(fields) {
  for (const [field, result] of Object.entries(fields)) {
    if (result && result.ok === false) {
      return { field, error: result.error || MESSAGES.required };
    }
  }
  return null;
}

/**
 * Map field results into a values object (only ok fields).
 */
export function collectValues(fields) {
  const values = {};
  for (const [field, result] of Object.entries(fields)) {
    if (result?.ok) values[field] = result.value;
  }
  return values;
}
