import "server-only";
import {
  CreateBucketCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutBucketCorsCommand,
  PutBucketPolicyCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { createPresignedPost, type PresignedPost } from "@aws-sdk/s3-presigned-post";
import { env } from "./env";

/**
 * Object storage. Locally this talks to MinIO; on AWS it uses the ECS task
 * role (no static keys). Key layout:
 *   uploads/...  originals, private, never served publicly
 *   media/...    processed variants, served via CloudFront (OAC)
 *   private/...  verification documents, admin-only via short-lived GET URLs
 */
function makeClient(endpoint?: string): S3Client {
  return new S3Client({
    region: env.AWS_REGION,
    endpoint,
    forcePathStyle: env.S3_FORCE_PATH_STYLE,
    credentials:
      env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY
        ? { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY }
        : undefined,
  });
}

export const s3 = makeClient(env.S3_ENDPOINT);
/** Presigned URLs must be signed for the host the *browser* will call. */
const s3Public = env.S3_PUBLIC_ENDPOINT ? makeClient(env.S3_PUBLIC_ENDPOINT) : s3;

export async function presignUpload(params: {
  key: string;
  contentType: string;
  maxBytes: number;
}): Promise<PresignedPost> {
  return createPresignedPost(s3Public, {
    Bucket: env.S3_BUCKET,
    Key: params.key,
    Conditions: [
      ["content-length-range", 1, params.maxBytes],
      ["eq", "$Content-Type", params.contentType],
    ],
    Fields: { "Content-Type": params.contentType },
    Expires: 300, // 5 minutes
  });
}

export async function headObject(key: string): Promise<{ size: number; contentType?: string } | null> {
  try {
    const res = await s3.send(new HeadObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
    return { size: res.ContentLength ?? 0, contentType: res.ContentType };
  } catch (err) {
    if ((err as { name?: string }).name === "NotFound") return null;
    throw err;
  }
}

export async function getObjectBuffer(key: string): Promise<Buffer> {
  const res = await s3.send(new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
  const bytes = await res.Body!.transformToByteArray();
  return Buffer.from(bytes);
}

export async function putObject(key: string, body: Buffer, contentType: string, cacheControl?: string): Promise<void> {
  await s3.send(
    new PutObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: cacheControl ?? "public, max-age=31536000, immutable",
    }),
  );
}

export async function deleteObjects(keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  await s3.send(
    new DeleteObjectsCommand({ Bucket: env.S3_BUCKET, Delete: { Objects: keys.map((Key) => ({ Key })), Quiet: true } }),
  );
}

/** Short-lived GET URL for private objects (admin viewing verification docs). */
export async function presignGet(key: string, expiresIn = 300): Promise<string> {
  const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
  return getSignedUrl(s3Public, new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key }), { expiresIn });
}

/** Public URL for a processed image variant. Never exposes bucket URLs on AWS (CloudFront only). */
export function mediaUrl(mediaKey: string, width: 320 | 640 | 1280 = 640): string {
  return `${env.MEDIA_BASE_URL}/${mediaKey}/w${width}.webp`;
}
export function mediaFileUrl(mediaKey: string): string {
  return `${env.MEDIA_BASE_URL}/${mediaKey}`;
}

/** Local-only: create bucket, CORS for browser uploads, and public-read on media/. */
export async function ensureLocalBucket(): Promise<void> {
  const Bucket = env.S3_BUCKET;
  try {
    await s3.send(new HeadBucketCommand({ Bucket }));
  } catch {
    await s3.send(new CreateBucketCommand({ Bucket }));
  }
  // MinIO allows all origins by default and returns NotImplemented for bucket CORS.
  await s3
    .send(
      new PutBucketCorsCommand({
        Bucket,
        CORSConfiguration: {
          CORSRules: [
            {
              AllowedOrigins: [env.APP_URL],
              AllowedMethods: ["POST", "GET", "HEAD"],
              AllowedHeaders: ["*"],
              MaxAgeSeconds: 3000,
            },
          ],
        },
      }),
    )
    .catch((err: { name?: string }) => {
      if (err.name !== "NotImplemented") throw err;
    });
  await s3.send(
    new PutBucketPolicyCommand({
      Bucket,
      Policy: JSON.stringify({
        Version: "2012-10-17",
        Statement: [
          {
            Effect: "Allow",
            Principal: { AWS: ["*"] },
            Action: ["s3:GetObject"],
            Resource: [`arn:aws:s3:::${Bucket}/media/*`],
          },
        ],
      }),
    }),
  );
}
