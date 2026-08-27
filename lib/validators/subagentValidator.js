/**
 * Subagent profile validation for add/edit marketing representatives.
 */

import {
  collectValues,
  firstError,
  MESSAGES,
  normalizeWhitespace,
  validateEmail,
  validateLength,
  validatePersonName,
} from "./common";

/** Primary phone: required, + and digits only, 10–15 digits. */
function validateSubagentPrimaryPhone(value) {
  const raw = normalizeWhitespace(value);

  if (!raw) {
    return { ok: false, error: MESSAGES.required };
  }

  if (!/^\+?[0-9]+$/.test(raw)) {
    return {
      ok: false,
      error: "Phone number can only include + and digits.",
    };
  }

  const digits = raw.replace(/^\+/, "");
  if (digits.length < 10 || digits.length > 15) {
    return {
      ok: false,
      error: "Phone number must be 10–15 digits.",
    };
  }

  return { ok: true, value: raw.startsWith("+") ? `+${digits}` : digits };
}

/** Optional phone fields: same character rules when provided. */
function validateSubagentOptionalPhone(value) {
  const raw = normalizeWhitespace(value);
  if (!raw) return { ok: true, value: "" };

  if (!/^\+?[0-9]+$/.test(raw)) {
    return {
      ok: false,
      error: "Phone number can only include + and digits.",
    };
  }

  const digits = raw.replace(/^\+/, "");
  if (digits.length < 10 || digits.length > 15) {
    return {
      ok: false,
      error: "Phone number must be 10–15 digits.",
    };
  }

  return { ok: true, value: raw.startsWith("+") ? `+${digits}` : digits };
}

function validateSubagentEmail(value) {
  const emailResult = validateEmail(value, { required: true });
  if (!emailResult.ok) return emailResult;

  if (emailResult.value.length > 50) {
    return { ok: false, error: "Email must be 50 characters or less." };
  }

  return emailResult;
}

export function validateSubagentInput(input) {
  const fields = {
    name: validatePersonName(input?.name, {
      required: true,
      min: 1,
      max: 30,
    }),
    phone: validateSubagentPrimaryPhone(input?.phone),
    secondary_phone: validateSubagentOptionalPhone(input?.secondary_phone),
    whatsapp_number: validateSubagentOptionalPhone(input?.whatsapp_number),
    email: validateSubagentEmail(input?.email),
    description: validateLength(input?.description, {
      required: false,
      max: 500,
      multiline: true,
    }),
  };

  const error = firstError(fields);
  if (error) {
    return { ok: false, error: error.error, field: error.field };
  }

  const data = collectValues(fields);
  return {
    ok: true,
    data: {
      name: data.name,
      phone: data.phone,
      secondary_phone: data.secondary_phone || null,
      whatsapp_number: data.whatsapp_number || null,
      email: data.email,
      description: data.description || null,
    },
  };
}

/** Client-side input normalizers — block invalid characters while typing. */
export function normalizeSubagentNameInput(value) {
  return String(value ?? "")
    .replace(/[^\p{L}\s]/gu, "")
    .slice(0, 30);
}

export function normalizeSubagentPhoneInput(value) {
  const raw = String(value ?? "");
  const hasPlus = raw.trimStart().startsWith("+");
  const digits = raw.replace(/\D/g, "").slice(0, 15);
  return hasPlus ? `+${digits}` : digits;
}

export function normalizeSubagentEmailInput(value) {
  return String(value ?? "").slice(0, 50);
}

export function normalizeSubagentDescriptionInput(value) {
  return String(value ?? "").slice(0, 500);
}
