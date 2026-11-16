import { beforeEach, describe, expect, it, vi } from "vitest";

const sent: { to: string; subject: string }[] = [];
vi.mock("@/server/lib/mailer", () => ({
  sendEmail: vi.fn(async (e: { to: string; subject: string }) => void sent.push({ to: e.to, subject: e.subject })),
}));

import { prisma } from "@/server/lib/db";
import { putObject, ensureLocalBucket } from "@/server/lib/storage";
import * as admin from "@/server/services/admin-service";
import { search } from "@/server/services/search-service";
import { createListingAs, createUser, resetDb } from "../support/fixtures";

describe("admin service", () => {
  beforeEach(async () => {
    sent.length = 0;
    await resetDb();
  });

  it("is admin-only", async () => {
    const landlord = await createUser("landlord");
    await expect(admin.reviewQueue(landlord)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(admin.adminMetrics(null)).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
  });

  it("approves a pending listing → searchable, landlord emailed, audited", async () => {
    const a = await createUser("admin");
    const landlord = await createUser("landlord");
    const l = await createListingAs(
      landlord,
      { description: "Lovely flat. Call 9841234567 and pay deposit first via eSewa to reserve." },
      "pending_review",
    );

    const [item] = await admin.reviewQueue(a);
    expect(item?.flags.contact.phones).toHaveLength(1);
    expect(item?.flags.contact.keywords).toContain("esewa");

    await admin.approveListing(a, l.id);
    expect((await search({ sort: "newest", page: 1, limit: 10 })).items.map((i) => i.id)).toContain(l.id);
    expect(sent).toEqual([{ to: landlord.email, subject: expect.stringContaining("live") }]);
    expect(await prisma.auditLog.count({ where: { action: "listing.approve", entityId: l.id, actorId: a.id } })).toBe(
      1,
    );
    await expect(admin.approveListing(a, l.id)).rejects.toMatchObject({ code: "INVALID_STATE" });
  });

  it("rejects with a reason the landlord can see", async () => {
    const a = await createUser("admin");
    const landlord = await createUser("landlord");
    const l = await createListingAs(landlord, {}, "pending_review");
    await admin.rejectListing(a, l.id, "Photos are not of the property");
    expect(await prisma.listing.findUnique({ where: { id: l.id } })).toMatchObject({
      status: "rejected",
      rejectionReason: "Photos are not of the property",
    });
    expect(sent[0]?.subject).toContain("Changes needed");
  });

  it("flags possible duplicates", async () => {
    const a = await createUser("admin");
    const landlord = await createUser("landlord");
    await createListingAs(landlord, { title: "Same flat posted twice here" }, "published");
    await createListingAs(landlord, { title: "Same flat posted twice here" }, "pending_review");
    const [item] = await admin.reviewQueue(a);
    expect(item?.flags.duplicates[0]?.reason).toBeDefined();
  });

  it("report → takedown removes the listing from search", async () => {
    const a = await createUser("admin");
    const landlord = await createUser("landlord");
    const renter = await createUser("renter");
    const l = await createListingAs(landlord, {}, "published");
    const report = await admin.createReport(renter, {
      listingId: l.id,
      reason: "scam",
      details: "Asked for advance deposit",
    });
    await expect(admin.createReport(renter, { listingId: l.id, reason: "scam" })).rejects.toMatchObject({
      code: "CONFLICT",
    });
    expect(await admin.listReports(a)).toHaveLength(1);
    await admin.resolveReport(a, report.id, { status: "resolved", resolution: "Confirmed scam", pauseListing: true });
    expect((await prisma.listing.findUnique({ where: { id: l.id } }))?.status).toBe("rejected");
    expect((await search({ sort: "newest", page: 1, limit: 10 })).total).toBe(0);
    await expect(admin.resolveReport(a, report.id, { status: "dismissed", pauseListing: false })).rejects.toMatchObject(
      { code: "INVALID_STATE" },
    );
  });

  it("landlord verification: upload → pending → verified badge", async () => {
    await ensureLocalBucket();
    const a = await createUser("admin");
    const landlord = await createUser("landlord");
    await expect(
      admin.requestVerification(landlord, `private/verification/someone-else/doc.pdf`),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    const key = `private/verification/${landlord.id}/${crypto.randomUUID()}.pdf`;
    await putObject(key, Buffer.from("%PDF-1.4 test"), "application/pdf");
    await admin.requestVerification(landlord, key);
    expect((await admin.pendingVerifications(a)).map((v) => v.userId)).toEqual([landlord.id]);
    expect(await admin.verificationDocumentUrl(a, landlord.id)).toMatch(/X-Amz-Signature=/);
    await admin.decideVerification(a, landlord.id, { decision: "verified" });
    expect((await prisma.landlordProfile.findUnique({ where: { userId: landlord.id } }))?.verificationStatus).toBe(
      "verified",
    );
    expect(sent.at(-1)?.subject).toContain("verified");
  });

  it("banning a landlord pauses their live listings; admins can't ban themselves or other admins", async () => {
    const a = await createUser("admin");
    const a2 = await createUser("admin");
    const landlord = await createUser("landlord");
    const l = await createListingAs(landlord, {}, "published");
    await admin.setBanned(a, landlord.id, true);
    expect((await prisma.listing.findUnique({ where: { id: l.id } }))?.status).toBe("paused");
    await expect(admin.setBanned(a, a.id, true)).rejects.toMatchObject({ code: "INVALID_STATE" });
    await expect(admin.setBanned(a, a2.id, true)).rejects.toMatchObject({ code: "INVALID_STATE" });
  });

  it("changes roles (creating a landlord profile) and reports metrics", async () => {
    const a = await createUser("admin");
    const r = await createUser("renter");
    await admin.changeRole(a, r.id, "landlord");
    expect(await prisma.landlordProfile.findUnique({ where: { userId: r.id } })).not.toBeNull();
    const m = await admin.adminMetrics(a);
    expect(m.usersByRole).toMatchObject({ admin: 1, landlord: 1 });
  });
});
