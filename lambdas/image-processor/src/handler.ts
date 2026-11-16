/**
 * image-processor Lambda (CLAUDE.md §3 Storage and Media)
 *
 * Trigger: S3 ObjectCreated on prefix `uploads/listings/`.
 * For each object:
 *   photos       → decode, auto-rotate, strip EXIF/GPS, WebP 320/640/1280, Rekognition moderation
 *   floor plans  → images as above (no moderation); PDFs validated by magic bytes and copied
 * Writes variants under `media/…` (served by CloudFront), then reports the result to
 * POST {APP_URL}/api/v1/internal/media-processed with a shared secret.
 *
 * Shares the exact image pipeline used in local dev (src/server/media/process-image.ts).
 */
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import type { S3Event } from "aws-lambda";
import sharp from "sharp";
import { processImage } from "../../../src/server/media/process-image";
import { moderateImage } from "../../../src/server/media/moderation";

const s3 = new S3Client({});
const secrets = new SecretsManagerClient({});
const REGION = process.env.AWS_REGION ?? "ap-south-1";
const APP_URL = process.env.APP_URL!;
const MODERATION = process.env.MODERATION ?? "rekognition";
let internalSecret: string | undefined;

async function getSecret(): Promise<string> {
  if (internalSecret) return internalSecret;
  const res = await secrets.send(new GetSecretValueCommand({ SecretId: process.env.INTERNAL_SECRET_ARN! }));
  internalSecret = res.SecretString!;
  return internalSecret;
}

function deriveMediaKey(s3Key: string, keepExtension = false): string {
  const base = s3Key.replace(/^uploads\//, "media/");
  return keepExtension ? base : base.replace(/\.[a-z0-9]+$/i, "");
}

async function report(body: Record<string, unknown>): Promise<void> {
  const res = await fetch(`${APP_URL}/api/v1/internal/media-processed`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-internal-secret": await getSecret() },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Callback failed: ${res.status} ${await res.text()}`);
}

async function handleObject(bucket: string, key: string): Promise<void> {
  const obj = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const bytes = Buffer.from(await obj.Body!.transformToByteArray());
  const isFloorPlan = key.includes("/floor-plans/");
  const put = (k: string, body: Buffer, type: string) =>
    s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: k,
        Body: body,
        ContentType: type,
        CacheControl: "public, max-age=31536000, immutable",
      }),
    );

  if (isFloorPlan && key.endsWith(".pdf")) {
    if (bytes.subarray(0, 5).toString() !== "%PDF-") return report({ s3Key: key, status: "rejected" });
    const mediaKey = deriveMediaKey(key, true);
    await put(mediaKey, bytes, "application/pdf");
    return report({ s3Key: key, status: "ready", mediaKey });
  }

  let processed;
  try {
    processed = await processImage(bytes);
  } catch (err) {
    console.warn(JSON.stringify({ msg: "undecodable image", key, err: String(err) }));
    return report({ s3Key: key, status: "rejected" });
  }

  if (!isFloorPlan && MODERATION === "rekognition") {
    const largest = processed.variants.at(-1)!.buffer;
    const verdict = await moderateImage(await sharp(largest).jpeg({ quality: 85 }).toBuffer(), REGION);
    if (!verdict.allowed) return report({ s3Key: key, status: "rejected", labels: verdict.labels });
  }

  const mediaKey = deriveMediaKey(key);
  await Promise.all(processed.variants.map((v) => put(`${mediaKey}/w${v.width}.webp`, v.buffer, "image/webp")));
  await report({ s3Key: key, status: "ready", mediaKey, width: processed.width, height: processed.height });
}

export async function handler(event: S3Event): Promise<void> {
  for (const record of event.Records) {
    const bucket = record.s3.bucket.name;
    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));
    if (!key.startsWith("uploads/listings/")) continue;
    console.log(JSON.stringify({ msg: "processing", key, size: record.s3.object.size }));
    await handleObject(bucket, key); // throw → Lambda retries, then DLQ
  }
}
