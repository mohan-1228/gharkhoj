// @vitest-environment node
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { processImage } from "@/server/media/process-image";

async function jpegWithGps(width: number, height: number): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: { r: 200, g: 120, b: 80 } } })
    .jpeg()
    .withExif({ IFD0: { Make: "TestCam", Model: "X1" }, IFD3: { GPSLatitudeRef: "N", GPSLatitude: "27/1 42/1 0/1" } })
    .toBuffer();
}

describe("processImage", () => {
  it("emits 320/640/1280 WebP variants without upscaling", async () => {
    const out = await processImage(await jpegWithGps(2000, 1000));
    expect(out.width).toBe(2000);
    expect(out.height).toBe(1000);
    const widths = await Promise.all(out.variants.map(async (v) => (await sharp(v.buffer).metadata()).width));
    expect(widths).toEqual([320, 640, 1280]);
    const small = await processImage(await jpegWithGps(500, 400));
    expect((await sharp(small.variants[2]!.buffer).metadata()).width).toBe(500);
  });

  it("strips EXIF metadata including GPS", async () => {
    const input = await jpegWithGps(800, 600);
    expect((await sharp(input).metadata()).exif).toBeDefined();
    const out = await processImage(input);
    for (const v of out.variants) {
      const meta = await sharp(v.buffer).metadata();
      expect(meta.format).toBe("webp");
      expect(meta.exif).toBeUndefined();
    }
  });

  it("rejects non-image bytes", async () => {
    await expect(processImage(Buffer.from("definitely not an image"))).rejects.toThrow();
  });
});
