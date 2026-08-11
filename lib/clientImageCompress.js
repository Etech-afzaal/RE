/**
 * Client-side image compression via compress.js.
 * Call only from client event handlers — uses the Canvas API.
 *
 * Dynamic import keeps compress.js out of the SSR graph (its build uses
 * top-level await / Modernizr, which Next cannot evaluate on the server).
 */

import { imageProcessErrorMessage } from "@/lib/imageUpload";

/**
 * Compress a selected image while preserving aspect ratio and visual quality.
 * Call after format/size validation and before the existing upload flow.
 *
 * @param {File} file
 * @param {{ quality?: number, maxWidth?: number, maxHeight?: number }} [options]
 * @returns {Promise<File>}
 */
export async function compressImageForUpload(file, options = {}) {
  try {
    const { default: Compress } = await import(
      /* webpackChunkName: "compress-js" */ "compress.js/build/compress.min.js"
    );
    const compressor = new Compress();
    const compressed = await compressor.compress(file, {
      quality: options.quality ?? 0.85,
      crop: false,
      maxWidth: options.maxWidth ?? 2560,
      maxHeight: options.maxHeight ?? 2560,
    });

    if (compressed instanceof File) {
      return compressed;
    }

    const blob = compressed instanceof Blob ? compressed : new Blob([compressed]);
    const type = blob.type || file.type || "image/jpeg";
    const baseName = String(file.name || "image").replace(/\.[^.]+$/, "") || "image";
    const extension =
      type === "image/png" ? "png" : type === "image/webp" ? "webp" : "jpg";

    return new File([blob], `${baseName}.${extension}`, {
      type,
      lastModified: Date.now(),
    });
  } catch {
    throw new Error(imageProcessErrorMessage());
  }
}
