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
 * Full-size SVG overlay with company text in the bottom-right.
 * Optional logoBuffer is reserved for future logo + name watermarks.
 */
export function buildWatermarkSvg(text, width, height, { logoBuffer } = {}) {
  void logoBuffer; // future: composite company logo beside text
  const safe = escapeXml(String(text || "Verified Property").slice(0, 80));
  const fontSize = Math.max(14, Math.min(28, Math.round(width / 36)));
  const paddingX = Math.max(16, Math.round(width * 0.03));
  const paddingY = Math.max(14, Math.round(height * 0.035));
  const x = width - paddingX;
  const y = height - paddingY;

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
      <text x="${x + 1}" y="${y + 1}" text-anchor="end" class="wm-shadow">${safe}</text>
      <text x="${x}" y="${y}" text-anchor="end" class="wm">${safe}</text>
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
        gravity: "southeast",
      },
    ])
    .jpeg({ quality: 85 })
    .toBuffer();
}
