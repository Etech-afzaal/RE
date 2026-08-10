import sharp from "sharp";

function escapeXml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Shared visual metrics for baked (image) and overlay (video) watermarks.
 * Keep opacity/colors in sync with PropertyWatermark CSS.
 */
export function watermarkMetrics(width, height) {
  const w = Math.max(1, Number(width) || 1200);
  const h = Math.max(1, Number(height) || 800);
  // Keep text bottom-center but inset enough to survive common object-fit:cover crops.
  const paddingY = Math.max(28, Math.round(h * 0.07));
  return {
    fontSize: Math.max(22, Math.min(52, Math.round(w / 20))),
    paddingY,
    x: Math.round(w / 2),
    y: h - paddingY,
  };
}

/**
 * Full-size SVG overlay with company text in the bottom-center.
 * Optional logoBuffer is reserved for future logo + name watermarks.
 */
export function buildWatermarkSvg(text, width, height, { logoBuffer } = {}) {
  void logoBuffer; // future: composite company logo beside text
  const safe = escapeXml(String(text || "Verified Property").slice(0, 80));
  const { fontSize, x, y } = watermarkMetrics(width, height);

  return Buffer.from(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <style>
        .wm-shadow {
          fill: rgba(0,0,0,0.45);
          font-size: ${fontSize}px;
          font-family: Arial, Helvetica, sans-serif;
          font-weight: 700;
        }
        .wm {
          fill: rgba(255,255,255,0.78);
          font-size: ${fontSize}px;
          font-family: Arial, Helvetica, sans-serif;
          font-weight: 700;
        }
      </style>
      <text x="${x + 1}" y="${y + 1}" text-anchor="middle" class="wm-shadow">${safe}</text>
      <text x="${x}" y="${y}" text-anchor="middle" class="wm">${safe}</text>
    </svg>
  `);
}

/**
 * Apply a one-time branding watermark to an uploaded property image.
 * Call only on fresh uploads — never on already-watermarked stored files.
 *
 * @param {Buffer} inputBuffer
 * @param {{ text: string, logoBuffer?: Buffer|null }} options
 * @returns {Promise<Buffer>} JPEG buffer
 */
export async function applyWatermark(inputBuffer, { text, logoBuffer = null } = {}) {
  const image = sharp(inputBuffer, { failOn: "none" });
  const metadata = await image.metadata();
  const width = metadata.width || 1200;
  const height = metadata.height || 800;

  return image
    .rotate()
    .composite([
      {
        input: buildWatermarkSvg(text, width, height, { logoBuffer }),
        gravity: "south",
      },
    ])
    .jpeg({ quality: 85 })
    .toBuffer();
}
