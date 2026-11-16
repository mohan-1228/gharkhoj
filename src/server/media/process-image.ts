import sharp from "sharp";
import { IMAGE_WIDTHS } from "../../lib/constants"; // relative: also bundled into the Lambda

/**
 * Pure image pipeline shared by the in-process path (local dev) and the
 * image-processor Lambda (AWS). No I/O here — callers fetch and store bytes.
 *
 * - auto-rotates using EXIF orientation, then strips ALL metadata (incl. GPS)
 * - emits WebP variants at 320/640/1280px wide (never upscales)
 * - rejects anything sharp cannot decode or that is absurdly large
 */
export interface ImageVariant {
  width: (typeof IMAGE_WIDTHS)[number];
  buffer: Buffer;
}
export interface ProcessedImage {
  width: number;
  height: number;
  variants: ImageVariant[];
}

const MAX_PIXELS = 60_000_000; // ~60MP guards against decompression bombs

export async function processImage(input: Buffer): Promise<ProcessedImage> {
  const base = sharp(input, { failOn: "error", limitInputPixels: MAX_PIXELS }).rotate();
  const meta = await base.metadata();
  if (!meta.width || !meta.height) throw new Error("Unreadable image");
  if (!["jpeg", "png", "webp", "heif", "avif"].includes(meta.format ?? "")) {
    throw new Error(`Unsupported image format: ${meta.format}`);
  }
  // After .rotate(), orientations 5–8 swap width/height.
  const swap = (meta.orientation ?? 1) >= 5;
  const width = swap ? meta.height : meta.width;
  const height = swap ? meta.width : meta.height;

  const variants = await Promise.all(
    IMAGE_WIDTHS.map(async (w) => ({
      width: w,
      // sharp drops metadata by default (no .withMetadata()), which strips EXIF GPS.
      buffer: await base
        .clone()
        .resize({ width: w, withoutEnlargement: true })
        .webp({ quality: 78, effort: 4 })
        .toBuffer(),
    })),
  );
  return { width, height, variants };
}
