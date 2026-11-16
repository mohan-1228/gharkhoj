import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { MAX_PHOTOS_PER_LISTING, UPLOAD_LIMITS, type UploadKind } from "@/lib/constants";
import type { PresignInput } from "@/schemas/misc";
import { assertOwnerOrAdmin, assertRole } from "../auth/guards";
import type { SessionUser } from "../auth/types";
import { prisma } from "../lib/db";
import { env } from "../lib/env";
import { AppError, notFound } from "../lib/errors";
import { logger } from "../lib/logger";
import {
  deleteObjects,
  getObjectBuffer,
  headObject,
  mediaFileUrl,
  mediaUrl,
  presignUpload,
  putObject,
} from "../lib/storage";
import { moderateImage } from "../media/moderation";
import { processImage } from "../media/process-image";
import { audit } from "./audit";

/**
 * uploads/listings/<id>/photos/<uuid>.jpg → media/listings/<id>/photos/<uuid>
 * Deterministic so the Lambda (which only knows the S3 key) and the inline
 * path produce identical public paths.
 */
export function deriveMediaKey(s3Key: string, keepExtension = false): string {
  const base = s3Key.replace(/^uploads\//, "media/");
  return keepExtension ? base : base.replace(/\.[a-z0-9]+$/i, "");
}

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

/** Key prefixes are derived server-side; clients can never choose where a file lands. */
export function uploadPrefix(kind: UploadKind, ids: { listingId?: string; userId: string }): string {
  switch (kind) {
    case "photo":
      return `uploads/listings/${ids.listingId}/photos/`;
    case "floor_plan":
      return `uploads/listings/${ids.listingId}/floor-plans/`;
    case "verification_doc":
      return `private/verification/${ids.userId}/`;
  }
}

export async function createPresignedUpload(actor: SessionUser | null, input: PresignInput) {
  assertRole(actor, "landlord", "admin");
  const limits = UPLOAD_LIMITS[input.kind];
  if (!(limits.types as readonly string[]).includes(input.contentType)) {
    throw new AppError("VALIDATION_ERROR", `Unsupported file type. Allowed: ${limits.types.join(", ")}`);
  }
  if (input.size > limits.maxBytes) {
    throw new AppError("VALIDATION_ERROR", `File is too large (max ${Math.round(limits.maxBytes / 1024 / 1024)} MB)`);
  }
  if (input.kind !== "verification_doc") {
    if (!input.listingId) throw new AppError("VALIDATION_ERROR", "listingId is required");
    const listing = await prisma.listing.findUnique({ where: { id: input.listingId }, select: { landlordId: true } });
    if (!listing) throw notFound("Listing");
    assertOwnerOrAdmin(actor, listing.landlordId);
    if (input.kind === "photo") {
      const count = await prisma.listingPhoto.count({ where: { listingId: input.listingId } });
      if (count >= MAX_PHOTOS_PER_LISTING)
        throw new AppError("INVALID_STATE", `A listing can have at most ${MAX_PHOTOS_PER_LISTING} photos`);
    }
  }
  const key = `${uploadPrefix(input.kind, { listingId: input.listingId, userId: actor.id })}${randomUUID()}.${EXT[input.contentType]}`;
  const post = await presignUpload({ key, contentType: input.contentType, maxBytes: limits.maxBytes });
  return { ...post, key };
}

/** Verify a client-reported upload actually exists, is within limits, and lives under the expected prefix. */
async function verifyUploadedObject(key: string, prefix: string, kind: UploadKind) {
  if (!key.startsWith(prefix) || key.includes(".."))
    throw new AppError("FORBIDDEN", "Upload key does not belong to this listing");
  const head = await headObject(key);
  if (!head) throw new AppError("VALIDATION_ERROR", "Upload not found — please try uploading again");
  const limits = UPLOAD_LIMITS[kind];
  if (head.size > limits.maxBytes) throw new AppError("VALIDATION_ERROR", "File is too large");
  if (head.contentType && !(limits.types as readonly string[]).includes(head.contentType)) {
    throw new AppError("VALIDATION_ERROR", "Unsupported file type");
  }
  return head;
}

async function loadOwnedListing(actor: SessionUser, listingId: string) {
  const listing = await prisma.listing.findUnique({ where: { id: listingId }, select: { id: true, landlordId: true } });
  if (!listing) throw notFound("Listing");
  assertOwnerOrAdmin(actor, listing.landlordId);
  return listing;
}

export function photoDto(p: {
  id: string;
  mediaKey: string | null;
  caption: string | null;
  roomLabel: string | null;
  sortOrder: number;
  isCover: boolean;
  status: string;
  width: number | null;
  height: number | null;
}) {
  return {
    id: p.id,
    caption: p.caption,
    roomLabel: p.roomLabel,
    sortOrder: p.sortOrder,
    isCover: p.isCover,
    status: p.status,
    width: p.width,
    height: p.height,
    urls:
      p.mediaKey && p.status === "ready"
        ? { sm: mediaUrl(p.mediaKey, 320), md: mediaUrl(p.mediaKey, 640), lg: mediaUrl(p.mediaKey, 1280) }
        : null,
  };
}
export type PhotoDto = ReturnType<typeof photoDto>;

export function floorPlanDto(f: {
  id: string;
  mediaKey: string | null;
  label: string | null;
  fileType: string;
  status: string;
  sortOrder: number;
}) {
  const ready = f.mediaKey && f.status === "ready";
  return {
    id: f.id,
    label: f.label,
    fileType: f.fileType,
    status: f.status,
    sortOrder: f.sortOrder,
    url: ready ? (f.fileType === "pdf" ? mediaFileUrl(f.mediaKey!) : mediaUrl(f.mediaKey!, 1280)) : null,
    thumbUrl: ready && f.fileType === "image" ? mediaUrl(f.mediaKey!, 640) : null,
  };
}
export type FloorPlanDto = ReturnType<typeof floorPlanDto>;

export async function registerPhoto(
  actor: SessionUser | null,
  listingId: string,
  input: { key: string; caption?: string; roomLabel?: string },
) {
  assertRole(actor, "landlord", "admin");
  await loadOwnedListing(actor, listingId);
  await verifyUploadedObject(input.key, uploadPrefix("photo", { listingId, userId: actor.id }), "photo");

  const agg = await prisma.listingPhoto.aggregate({ where: { listingId }, _max: { sortOrder: true }, _count: true });
  if (agg._count >= MAX_PHOTOS_PER_LISTING)
    throw new AppError("INVALID_STATE", `A listing can have at most ${MAX_PHOTOS_PER_LISTING} photos`);
  const photo = await prisma.listingPhoto.create({
    data: {
      listingId,
      s3Key: input.key,
      caption: input.caption,
      roomLabel: input.roomLabel,
      sortOrder: (agg._max.sortOrder ?? -1) + 1,
      isCover: agg._count === 0,
      status: "processing",
    },
  });
  if (env.IMAGE_PROCESSING === "inline") return photoDto(await processPhoto(photo.id));
  return photoDto(photo);
}

/**
 * Inline processing path (local dev / IMAGE_PROCESSING=inline). On AWS the
 * image-processor Lambda does the same work and calls markMediaProcessed().
 */
export async function processPhoto(photoId: string) {
  const photo = await prisma.listingPhoto.findUniqueOrThrow({ where: { id: photoId } });
  const mediaKey = deriveMediaKey(photo.s3Key);
  try {
    const original = await getObjectBuffer(photo.s3Key);
    const processed = await processImage(original);
    if (env.MODERATION === "rekognition") {
      const lg = processed.variants.at(-1)!.buffer;
      const verdict = await moderateImage(await sharp(lg).jpeg({ quality: 85 }).toBuffer(), env.AWS_REGION);
      if (!verdict.allowed) {
        logger.warn({ photoId, labels: verdict.labels }, "photo rejected by moderation");
        await audit(null, "photo.moderation_reject", "listing_photo", photoId, { labels: verdict.labels });
        return prisma.listingPhoto.update({ where: { id: photoId }, data: { status: "rejected" } });
      }
    }
    for (const v of processed.variants) await putObject(`${mediaKey}/w${v.width}.webp`, v.buffer, "image/webp");
    return prisma.listingPhoto.update({
      where: { id: photoId },
      data: { status: "ready", mediaKey, width: processed.width, height: processed.height },
    });
  } catch (err) {
    logger.warn({ err, photoId }, "photo processing failed");
    await prisma.listingPhoto.update({ where: { id: photoId }, data: { status: "rejected" } });
    throw new AppError("VALIDATION_ERROR", "We couldn't read that image. Please upload a JPG, PNG or WebP photo.");
  }
}

export async function updatePhotos(
  actor: SessionUser | null,
  listingId: string,
  input: { photos: { id: string; caption?: string | null; roomLabel?: string | null }[]; coverId?: string },
) {
  assertRole(actor, "landlord", "admin");
  await loadOwnedListing(actor, listingId);
  const existing = await prisma.listingPhoto.findMany({ where: { listingId }, select: { id: true } });
  const ids = new Set(existing.map((p) => p.id));
  if (input.photos.length !== ids.size || input.photos.some((p) => !ids.has(p.id))) {
    throw new AppError("VALIDATION_ERROR", "Photo list is out of date — refresh and try again");
  }
  if (input.coverId && !ids.has(input.coverId)) throw new AppError("VALIDATION_ERROR", "Unknown cover photo");
  const coverId = input.coverId ?? input.photos[0]?.id;

  await prisma.$transaction(
    input.photos.map((p, index) =>
      prisma.listingPhoto.update({
        where: { id: p.id },
        data: {
          sortOrder: index,
          isCover: p.id === coverId,
          ...(p.caption !== undefined ? { caption: p.caption } : {}),
          ...(p.roomLabel !== undefined ? { roomLabel: p.roomLabel } : {}),
        },
      }),
    ),
  );
  return listPhotos(listingId);
}

export async function listPhotos(listingId: string) {
  const photos = await prisma.listingPhoto.findMany({ where: { listingId }, orderBy: { sortOrder: "asc" } });
  return photos.map(photoDto);
}

function variantKeys(mediaKey: string | null): string[] {
  return mediaKey ? [320, 640, 1280].map((w) => `${mediaKey}/w${w}.webp`) : [];
}

export async function deletePhoto(actor: SessionUser | null, listingId: string, photoId: string) {
  assertRole(actor, "landlord", "admin");
  await loadOwnedListing(actor, listingId);
  const photo = await prisma.listingPhoto.findFirst({ where: { id: photoId, listingId } });
  if (!photo) throw notFound("Photo");
  await prisma.listingPhoto.delete({ where: { id: photoId } });
  if (photo.isCover) {
    const next = await prisma.listingPhoto.findFirst({ where: { listingId }, orderBy: { sortOrder: "asc" } });
    if (next) await prisma.listingPhoto.update({ where: { id: next.id }, data: { isCover: true } });
  }
  if (!photo.s3Key.startsWith("media/seed/")) {
    await deleteObjects([photo.s3Key, ...variantKeys(photo.mediaKey)]).catch((err) =>
      logger.warn({ err }, "S3 cleanup failed"),
    );
  }
}

export async function registerFloorPlan(
  actor: SessionUser | null,
  listingId: string,
  input: { key: string; label?: string },
) {
  assertRole(actor, "landlord", "admin");
  await loadOwnedListing(actor, listingId);
  const head = await verifyUploadedObject(
    input.key,
    uploadPrefix("floor_plan", { listingId, userId: actor.id }),
    "floor_plan",
  );
  const isPdf = head.contentType === "application/pdf" || input.key.endsWith(".pdf");
  const agg = await prisma.floorPlan.aggregate({ where: { listingId }, _max: { sortOrder: true } });
  const fp = await prisma.floorPlan.create({
    data: {
      listingId,
      s3Key: input.key,
      label: input.label,
      fileType: isPdf ? "pdf" : "image",
      sortOrder: (agg._max.sortOrder ?? -1) + 1,
    },
  });
  if (env.IMAGE_PROCESSING !== "inline") return floorPlanDto(fp);

  try {
    const original = await getObjectBuffer(input.key);
    if (isPdf) {
      if (original.subarray(0, 5).toString() !== "%PDF-") throw new Error("Not a PDF");
      const mediaKey = deriveMediaKey(input.key, true);
      await putObject(mediaKey, original, "application/pdf");
      return floorPlanDto(await prisma.floorPlan.update({ where: { id: fp.id }, data: { mediaKey, status: "ready" } }));
    }
    const processed = await processImage(original);
    const mediaKey = deriveMediaKey(input.key);
    for (const v of processed.variants) await putObject(`${mediaKey}/w${v.width}.webp`, v.buffer, "image/webp");
    return floorPlanDto(await prisma.floorPlan.update({ where: { id: fp.id }, data: { mediaKey, status: "ready" } }));
  } catch (err) {
    logger.warn({ err, floorPlanId: fp.id }, "floor plan processing failed");
    await prisma.floorPlan.update({ where: { id: fp.id }, data: { status: "rejected" } });
    throw new AppError("VALIDATION_ERROR", "We couldn't read that file. Upload a JPG, PNG or PDF floor plan.");
  }
}

export async function deleteFloorPlan(actor: SessionUser | null, listingId: string, floorPlanId: string) {
  assertRole(actor, "landlord", "admin");
  await loadOwnedListing(actor, listingId);
  const fp = await prisma.floorPlan.findFirst({ where: { id: floorPlanId, listingId } });
  if (!fp) throw notFound("Floor plan");
  await prisma.floorPlan.delete({ where: { id: floorPlanId } });
  const keys = [fp.s3Key, ...(fp.fileType === "pdf" ? (fp.mediaKey ? [fp.mediaKey] : []) : variantKeys(fp.mediaKey))];
  await deleteObjects(keys).catch((err) => logger.warn({ err }, "S3 cleanup failed"));
}

/** All S3 keys belonging to a listing — used when the listing is deleted. */
export async function collectListingObjectKeys(listingId: string): Promise<string[]> {
  const [photos, plans] = await Promise.all([
    prisma.listingPhoto.findMany({ where: { listingId } }),
    prisma.floorPlan.findMany({ where: { listingId } }),
  ]);
  return [
    ...photos.filter((p) => !p.s3Key.startsWith("media/seed/")).flatMap((p) => [p.s3Key, ...variantKeys(p.mediaKey)]),
    ...plans.flatMap((f) => [
      f.s3Key,
      ...(f.fileType === "pdf" ? (f.mediaKey ? [f.mediaKey] : []) : variantKeys(f.mediaKey)),
    ]),
  ];
}

/**
 * Callback from the image-processor Lambda (IMAGE_PROCESSING=lambda):
 * the Lambda has already written variants under media/ and moderated the image.
 */
export async function markMediaProcessed(input: {
  s3Key: string;
  status: "ready" | "rejected";
  mediaKey?: string;
  width?: number;
  height?: number;
  labels?: string[];
}) {
  const photo = await prisma.listingPhoto.findFirst({ where: { s3Key: input.s3Key } });
  if (photo) {
    if (input.status === "rejected")
      await audit(null, "photo.moderation_reject", "listing_photo", photo.id, { labels: input.labels ?? [] });
    return prisma.listingPhoto.update({
      where: { id: photo.id },
      data: { status: input.status, mediaKey: input.mediaKey ?? null, width: input.width, height: input.height },
    });
  }
  const fp = await prisma.floorPlan.findFirst({ where: { s3Key: input.s3Key } });
  if (fp)
    return prisma.floorPlan.update({
      where: { id: fp.id },
      data: { status: input.status, mediaKey: input.mediaKey ?? null },
    });
  throw notFound("Media record");
}
