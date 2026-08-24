/**
 * User / auth / profile / admin-reason validators.
 */

import {
  collectValues,
  firstError,
  validateDigitCount,
  validateEmail,
  validateEstateName,
  validateLength,
  validateLicenceNumber,
  validateMessage,
  validatePassword,
  validatePersonName,
  validatePhone,
  validateSocialLinks,
  validateURL,
} from "./common";

/**
 * Agent signup request (no password — credentials are issued after approval).
 */
export function validateSignupInput(input = {}) {
  const fields = {
    full_name: validatePersonName(input.full_name ?? input.name, {
      required: true,
      min: 2,
      max: 30,
    }),
    estate_name: validateEstateName(input.estate_name, {
      required: true,
      min: 3,
      max: 30,
    }),
    email: validateEmail(input.email, { required: true }),
    phone: validatePhone(input.phone, {
      required: true,
      minDigits: 10,
      maxDigits: 15,
    }),
    licence_number: validateLicenceNumber(input.licence_number, {
      required: true,
      min: 1,
      max: 25,
    }),
    message: validateMessage(input.message, {
      required: false,
      min: 0,
      max: 1000,
    }),
  };

  const error = firstError(fields);
  if (error) {
    return { ok: false, error: error.error, field: error.field };
  }

  return { ok: true, data: collectValues(fields) };
}

/**
 * Login credentials — do not expose password complexity rules.
 */
export function validateLoginInput(input = {}) {
  const fields = {
    email: validateEmail(input.email, { required: true }),
    password: validatePassword(input.password, { mode: "login" }),
  };

  const error = firstError(fields);
  if (error) {
    return { ok: false, error: error.error, field: error.field };
  }

  return { ok: true, data: collectValues(fields) };
}

/**
 * Password create / reset (agent settings + forced reset).
 */
export function validateNewPassword(password) {
  return validatePassword(password, { mode: "create" });
}

/**
 * Agent profile update.
 */
export function validateAgentProfileInput(input = {}) {
  const fields = {
    full_name: validatePersonName(input.full_name, {
      required: true,
      min: 2,
      max: 100,
    }),
    phone: validatePhone(input.phone, { required: false }),
    secondary_phone: validatePhone(input.secondary_phone, { required: false }),
    whatsapp_number: validatePhone(input.whatsapp_number, { required: false }),
    description: validateLength(input.description, {
      required: false,
      max: 1000,
      multiline: true,
    }),
    areas_served: validateLength(input.areas_served, {
      required: false,
      max: 500,
    }),
  };

  const error = firstError(fields);
  if (error) {
    return { ok: false, error: error.error, field: error.field };
  }

  return { ok: true, data: collectValues(fields) };
}

/**
 * Company branding update.
 */
export function validateCompanyBrandingInput(input = {}) {
  const fields = {
    company_name: validateLength(input.company_name, {
      required: false,
      max: 100,
    }),
    description: validateLength(input.description, {
      required: false,
      max: 1000,
      multiline: true,
    }),
    office_address: validateLength(input.office_address, {
      required: false,
      max: 300,
    }),
    social_links: validateSocialLinks(input.social_links, {
      required: false,
      max: 1000,
    }),
    areas_served: validateLength(input.areas_served, {
      required: false,
      max: 500,
    }),
  };

  const error = firstError(fields);
  if (error) {
    return { ok: false, error: error.error, field: error.field };
  }

  return { ok: true, data: collectValues(fields) };
}

/**
 * Admin rejection reason for a property listing.
 */
export function validateRejectionReason(reason) {
  return validateLength(reason, {
    required: true,
    min: 10,
    max: 500,
    multiline: true,
  });
}

/**
 * Admin permanent block reason (shown on agent login).
 */
export function validateBlockReason(reason) {
  return validateLength(reason, {
    required: true,
    min: 10,
    max: 500,
    multiline: true,
  });
}

export {
  validateEmail,
  validatePassword,
  validatePersonName,
  validatePhone,
  validateURL,
  validateDigitCount,
};
