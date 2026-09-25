import { z } from "zod";

const optionalText = (max) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((value) => value || null);

const optionalCount = z.preprocess(
  (value) => (value === "" || value === undefined ? null : value),
  z.coerce.number().int().positive().nullable(),
);

// Internal path ("/re/estate1/12") or an absolute https:// URL only —
// never javascript:, protocol-relative "//", etc.
export function isSafeClickUrl(value) {
  if (value.startsWith("/")) return !value.startsWith("//") && !value.startsWith("/\\");
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

export const placementSchema = z
  .string()
  .trim()
  .max(50)
  .regex(/^[a-z0-9_-]*$/i, "Placement may only contain letters, numbers, - and _")
  .optional()
  .transform((value) => (value || "").toLowerCase());

export const adInputSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required.").max(255),
    tier: z.enum(["paid", "free"]),
    format_id: z.coerce.number().int().positive("Choose an ad format."),
    property_id: z.preprocess(
      (value) => (value === "" || value === undefined ? null : value),
      z.coerce.number().int().positive().nullable(),
    ),
    headline: optionalText(120),
    alt_text: optionalText(255),
    cta_text: optionalText(40),
    click_url: optionalText(500).refine((value) => !value || isSafeClickUrl(value), {
      message: "Click URL must be a site path like /re/estate1/12 or an https:// link.",
    }),
    priority: z.coerce.number().int().min(1).max(10).default(5),
    weight: z.coerce.number().int().min(1).max(1000).default(100),
    start_at: z.string().datetime({ message: "Start date is required." }),
    end_at: z.preprocess(
      (value) => (value === "" || value === undefined ? null : value),
      z.string().datetime().nullable(),
    ),
    max_impressions: optionalCount,
    max_clicks: optionalCount,
    daily_impression_cap: optionalCount,
    viewer_cap_24h: optionalCount,
    advertiser_name: optionalText(255),
    advertiser_contact: optionalText(255),
    amount_paid: z.preprocess(
      (value) => (value === "" || value === undefined ? null : value),
      z.coerce.number().min(0).max(9_999_999_999).nullable(),
    ),
    payment_ref: optionalText(100),
    notes: optionalText(2000),
  })
  .superRefine((ad, ctx) => {
    if (ad.tier === "paid" && !ad.end_at) {
      ctx.addIssue({
        path: ["end_at"],
        code: z.ZodIssueCode.custom,
        message: "Paid ads need an end date (flat fee per period).",
      });
    }
    if (ad.end_at && new Date(ad.end_at) <= new Date(ad.start_at)) {
      ctx.addIssue({
        path: ["end_at"],
        code: z.ZodIssueCode.custom,
        message: "End date must be after the start date.",
      });
    }
  });

const pixelSize = (label) =>
  z.preprocess(
    (value) => (value === "" || value === null || value === undefined ? undefined : Number(value)),
    z
      .number({ required_error: `${label} is required.`, invalid_type_error: `${label} must be a number.` })
      .int(`${label} must be a whole number.`)
      .min(10, `${label} must be at least 10 px.`)
      .max(4000, `${label} can be at most 4000 px.`),
  );

export const formatInputSchema = z.object({
  code: z
    .string({ required_error: "Code is required." })
    .trim()
    .min(1, "Code is required.")
    .min(2, "Code must be at least 2 characters.")
    .max(50, "Code can be at most 50 characters.")
    .regex(/^[a-z0-9_]+$/, "Code may only contain lowercase letters, numbers and _"),
  name: z
    .string({ required_error: "Name is required." })
    .trim()
    .min(1, "Name is required.")
    .max(100, "Name can be at most 100 characters."),
  format_type: z.enum(["banner", "native", "sidebar", "popup"], {
    errorMap: () => ({ message: "Choose a type." }),
  }),
  width: pixelSize("Width"),
  height: pixelSize("Height"),
  is_active: z.boolean().default(true),
});

// First zod error as a single readable message for the admin UI.
export function firstError(result) {
  const issue = result.error?.issues?.[0];
  if (!issue) return "Invalid input.";
  return issue.message;
}

export function fieldErrors(result) {
  const errors = {};
  for (const issue of result.error?.issues || []) {
    const key = issue.path[0];
    if (key && !errors[key]) errors[key] = issue.message;
  }
  return errors;
}
