import { DetectModerationLabelsCommand, RekognitionClient } from "@aws-sdk/client-rekognition";

/**
 * Image moderation via Amazon Rekognition (CLAUDE.md §4.8). Pure-ish helper
 * shared by the inline path and the image-processor Lambda.
 */
const BLOCKED_TOP_LEVEL = new Set([
  "Explicit Nudity",
  "Explicit",
  "Non-Explicit Nudity of Intimate parts and Kissing",
  "Violence",
  "Visually Disturbing",
  "Hate Symbols",
  "Drugs & Tobacco",
]);
const MIN_CONFIDENCE = 80;

export interface ModerationResult {
  allowed: boolean;
  labels: string[];
}

let client: RekognitionClient | undefined;

export async function moderateImage(bytes: Buffer, region: string): Promise<ModerationResult> {
  client ??= new RekognitionClient({ region });
  // Rekognition accepts up to 5MB inline; callers pass the 1280px WebP→JPEG-safe variant if needed.
  const res = await client.send(
    new DetectModerationLabelsCommand({ Image: { Bytes: bytes }, MinConfidence: MIN_CONFIDENCE }),
  );
  const labels = (res.ModerationLabels ?? []).map((l) => l.ParentName || l.Name || "").filter(Boolean);
  const blocked = labels.filter((l) => BLOCKED_TOP_LEVEL.has(l));
  return { allowed: blocked.length === 0, labels: [...new Set(labels)] };
}
