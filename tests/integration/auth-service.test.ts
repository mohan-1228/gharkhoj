import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/server/lib/db";
import {
  becomeLandlord,
  deleteAccount,
  devLogin,
  updateProfile,
  upsertFromCognito,
} from "@/server/services/auth-service";
import { addFavorite, favoriteIds, listFavorites, removeFavorite } from "@/server/services/favorite-service";
import { createListingAs, createUser, resetDb } from "../support/fixtures";

const identity = (over: Partial<Parameters<typeof upsertFromCognito>[0]> = {}) => ({
  sub: "cognito-sub-1",
  email: "maya@example.com",
  emailVerified: true,
  name: "Maya Tamang",
  phone: null,
  nonce: "n",
  ...over,
});

describe("auth service", () => {
  beforeEach(resetDb);

  it("creates a new user with the chosen sign-up role (never admin)", async () => {
    const u = await upsertFromCognito(identity(), "landlord");
    expect(u).toMatchObject({
      email: "maya@example.com",
      role: "landlord",
      cognitoSub: "cognito-sub-1",
      fullName: "Maya Tamang",
    });
    expect(await prisma.landlordProfile.findUnique({ where: { userId: u.id } })).not.toBeNull();
  });

  it("returns the same user on subsequent sign-ins", async () => {
    const a = await upsertFromCognito(identity(), "renter");
    const b = await upsertFromCognito(identity(), "landlord");
    expect(b.id).toBe(a.id);
    expect(b.role).toBe("renter"); // sign-up role is ignored for existing users
  });

  it("links to an existing email only if Cognito verified it", async () => {
    const existing = await devLogin({ email: "maya@example.com" });
    await expect(upsertFromCognito(identity({ emailVerified: false }), "renter")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    const linked = await upsertFromCognito(identity(), "renter");
    expect(linked.id).toBe(existing.id);
  });

  it("refuses banned users", async () => {
    const u = await upsertFromCognito(identity(), "renter");
    await prisma.user.update({ where: { id: u.id }, data: { isBanned: true } });
    await expect(upsertFromCognito(identity(), "renter")).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("lets a renter become a landlord", async () => {
    const r = await createUser("renter");
    expect((await becomeLandlord(r)).role).toBe("landlord");
  });

  it("validates and normalises the phone number on profile update", async () => {
    const r = await createUser("renter");
    expect((await updateProfile(r, { fullName: "Anisha K", phone: "984-1234567" })).phone).toBe("+9779841234567");
    await expect(updateProfile(r, { fullName: "Anisha K", phone: "12345" })).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
  });

  it("deletes an account with its data, but never the last admin", async () => {
    const admin = await createUser("admin");
    await expect(deleteAccount(admin)).rejects.toMatchObject({ code: "INVALID_STATE" });
    const landlord = await createUser("landlord");
    const l = await createListingAs(landlord);
    await deleteAccount(landlord);
    expect(await prisma.user.findUnique({ where: { id: landlord.id } })).toBeNull();
    expect(await prisma.listing.findUnique({ where: { id: l.id } })).toBeNull();
  });
});

describe("favorites", () => {
  beforeEach(resetDb);

  it("adds, lists and removes favourites idempotently; only published listings", async () => {
    const landlord = await createUser("landlord");
    const renter = await createUser("renter");
    const pub = await createListingAs(landlord, {}, "published");
    const draft = await createListingAs(landlord);
    await addFavorite(renter, pub.id);
    await addFavorite(renter, pub.id);
    await expect(addFavorite(renter, draft.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect([...(await favoriteIds(renter))]).toEqual([pub.id]);
    expect((await listFavorites(renter)).map((c) => c.id)).toEqual([pub.id]);
    await removeFavorite(renter, pub.id);
    expect((await favoriteIds(renter)).size).toBe(0);
  });

  it("requires sign-in", async () => {
    await expect(addFavorite(null, crypto.randomUUID())).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
  });
});
