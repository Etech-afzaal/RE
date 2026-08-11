/**
 * Server-side image integrity checks and Sharp compression.
 * Used after MIME/extension validation on upload routes.
 */

import sharp from "sharp";
import {
  ALLOWED_SHARP_FORMATS,
  imageFormatErrorMessage,
  imageProcessErrorMessage,
} from "@/lib/imageUpload";

/** Default WebP quality (80–85% range). */
export const WEBP_QUALITY = 82;

/**
 * Validate that a buffer is a real, supported raster image.
 * Rejects corrupted files, SVG, and unsupported formats.
 *
 * @param {Buffer} buffer
 * @returns {Promise<{ ok: true, metadata: sharp.Metadata } | { ok: false, error: string }>}
 */
export async function validateImageBuffer(buffer) {
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
    return { ok: false, error: imageFormatErrorMessage() };
  }

  try {
    const metadata = await sharp(buffer, {
      animated: true,
      failOn: "error",
    }).metadata();

    if (!metadata.format || metadata.format === "svg") {
      return { ok: false, error: imageFormatErrorMessage() };
    }

    if (!ALLOWED_SHARP_FORMATS.has(metadata.format)) {
      return { ok: false, error: imageFormatErrorMessage() };
    }

    if (!metadata.width || !metadata.height) {
      return { ok: false, error: imageProcessErrorMessage() };
    }

    return { ok: true, metadata };
  } catch {
    return { ok: false, error: imageProcessErrorMessage() };
  }
}

/**
 * Compress an image buffer to WebP while preserving aspect ratio.
 *
 * @param {Buffer} buffer
 * @param {{ maxWidth?: number, maxHeight?: number, quality?: number }} [options]
 * @returns {Promise<Buffer>}
 */
export async function compressImageBuffer(buffer, options = {}) {
  const quality = options.quality ?? WEBP_QUALITY;
  let pipeline = sharp(buffer, { failOn: "none" }).rotate();

  if (options.maxWidth || options.maxHeight) {
    pipeline = pipeline.resize(options.maxWidth || null, options.maxHeight || null, {
      fit: "inside",
      withoutEnlargement: true,
    });
  }

  return pipeline.webp({ quality }).toBuffer();
}

/**
 * Validate then compress. Throws nothing — returns a result object.
 *
 * @param {Buffer} buffer
 * @param {{ maxWidth?: number, maxHeight?: number, quality?: number }} [options]
 */
export async function validateAndCompressImageBuffer(buffer, options = {}) {
  const validated = await validateImageBuffer(buffer);
  if (!validated.ok) {
    return validated;
  }

  try {
    const compressed = await compressImageBuffer(buffer, options);
    return { ok: true, buffer: compressed, metadata: validated.metadata };
  } catch {
    return { ok: false, error: imageProcessErrorMessage() };
  }
}
