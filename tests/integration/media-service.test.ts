import sharp from "sharp";
import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/server/lib/db";
import { headObject, putObject, ensureLocalBucket } from "@/server/lib/storage";
import * as media from "@/server/services/media-service";
import { submitForReview } from "@/server/services/listing-service";
import { createListingAs, createUser, resetDb } from "../support/fixtures";

async function uploadTestImage(listingId: string): Promise<string> {
  const key = `uploads/listings/${listingId}/photos/${crypto.randomUUID()}.jpg`;
  const img = await sharp({ create: { width: 1600, height: 1000, channels: 3, background: "#c33" } })
    .jpeg()
    .toBuffer();
  await putObject(key, img, "image/jpeg");
  return key;
}

describe("media service (MinIO)", () => {
  beforeEach(async () => {
    await resetDb();
    await ensureLocalBucket();
  });

  it("presigns only allowed types and sizes for the owner", async () => {
    const owner = await createUser("landlord");
    const other = await createUser("landlord");
    const l = await createListingAs(owner);
    const ok = await media.createPresignedUpload(owner, {
      kind: "photo",
      listingId: l.id,
      contentType: "image/jpeg",
      size: 1000,
    });
    expect(ok.key).toMatch(new RegExp(`^uploads/listings/${l.id}/photos/[0-9a-f-]+\\.jpg$`));
    expect(ok.fields["Content-Type"]).toBe("image/jpeg");
    await expect(
      media.createPresignedUpload(owner, { kind: "photo", listingId: l.id, contentType: "image/gif", size: 1000 }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(
      media.createPresignedUpload(owner, {
        kind: "photo",
        listingId: l.id,
        contentType: "image/jpeg",
        size: 50 * 1024 * 1024,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(
      media.createPresignedUpload(other, { kind: "photo", listingId: l.id, contentType: "image/jpeg", size: 1000 }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("processes an uploaded photo into public variants, then allows submission", async () => {
    const owner = await createUser("landlord");
    const l = await createListingAs(owner);
    await expect(submitForReview(owner, l.id)).rejects.toMatchObject({ code: "INVALID_STATE" });

    const key = await uploadTestImage(l.id);
    const photo = await media.registerPhoto(owner, l.id, { key, roomLabel: "Bedroom" });
    expect(photo.status).toBe("ready");
    expect(photo.isCover).toBe(true);
    expect(photo.width).toBe(1600);
    expect(photo.urls?.md).toMatch(/\/media\/listings\/.+\/w640\.webp$/);
    expect(await headObject(`${key.replace("uploads/", "media/").replace(".jpg", "")}/w1280.webp`)).not.toBeNull();

    const submitted = await submitForReview(owner, l.id);
    expect(submitted.status).toBe("pending_review");
  });

  it("refuses keys outside the listing's prefix", async () => {
    const owner = await createUser("landlord");
    const a = await createListingAs(owner);
    const b = await createListingAs(owner);
    const keyForB = await uploadTestImage(b.id);
    await expect(media.registerPhoto(owner, a.id, { key: keyForB })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("reorders photos and moves the cover", async () => {
    const owner = await createUser("landlord");
    const l = await createListingAs(owner);
    const p1 = await media.registerPhoto(owner, l.id, { key: await uploadTestImage(l.id) });
    const p2 = await media.registerPhoto(owner, l.id, { key: await uploadTestImage(l.id) });
    const items = await media.updatePhotos(owner, l.id, {
      photos: [{ id: p2.id, caption: "Lovely view" }, { id: p1.id }],
      coverId: p2.id,
    });
    expect(items.map((p) => p.id)).toEqual([p2.id, p1.id]);
    expect(items[0]).toMatchObject({ isCover: true, caption: "Lovely view" });
    expect(items[1]?.isCover).toBe(false);
  });

  it("promotes a new cover when the cover photo is deleted", async () => {
    const owner = await createUser("landlord");
    const l = await createListingAs(owner);
    const p1 = await media.registerPhoto(owner, l.id, { key: await uploadTestImage(l.id) });
    const p2 = await media.registerPhoto(owner, l.id, { key: await uploadTestImage(l.id) });
    await media.deletePhoto(owner, l.id, p1.id);
    expect((await prisma.listingPhoto.findUnique({ where: { id: p2.id } }))?.isCover).toBe(true);
  });

  it("stores PDF floor plans and rejects fake PDFs", async () => {
    const owner = await createUser("landlord");
    const l = await createListingAs(owner);
    const good = `uploads/listings/${l.id}/floor-plans/${crypto.randomUUID()}.pdf`;
    await putObject(good, Buffer.from("%PDF-1.4\n%fake but valid header\n"), "application/pdf");
    const fp = await media.registerFloorPlan(owner, l.id, { key: good, label: "Ground floor" });
    expect(fp).toMatchObject({ fileType: "pdf", status: "ready" });
    expect(fp.url).toMatch(/floor-plans\/.+\.pdf$/);

    const bad = `uploads/listings/${l.id}/floor-plans/${crypto.randomUUID()}.pdf`;
    await putObject(bad, Buffer.from("<html>not a pdf</html>"), "application/pdf");
    await expect(media.registerFloorPlan(owner, l.id, { key: bad })).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
  });
});
