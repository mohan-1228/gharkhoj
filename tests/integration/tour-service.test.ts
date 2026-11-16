import { beforeEach, describe, expect, it, vi } from "vitest";

const sent: { to: string; subject: string }[] = [];
vi.mock("@/server/lib/mailer", () => ({
  sendEmail: vi.fn(async (e: { to: string; subject: string }) => void sent.push({ to: e.to, subject: e.subject })),
}));

import { prisma } from "@/server/lib/db";
import * as tours from "@/server/services/tour-service";
import { ktmToUtc, utcToKtm, addDaysKtm } from "@/lib/time";
import { createListingAs, createUser, resetDb } from "../support/fixtures";

const NOW = new Date();
/** A Kathmandu-time slot `days` from today at hh:mm, as ISO. */
const slot = (days: number, time = "10:00") => ktmToUtc(addDaysKtm(utcToKtm(NOW).date, days), time).toISOString();

async function setup() {
  const landlord = await createUser("landlord", { fullName: "Sita Landlord" });
  await prisma.user.update({ where: { id: landlord.id }, data: { phone: "+9779801111111" } });
  const renter = await createUser("renter", { fullName: "Anisha Renter" });
  const listing = await createListingAs(landlord, {}, "published");
  return { landlord, renter, listing };
}

describe("tour service", () => {
  beforeEach(async () => {
    sent.length = 0;
    await resetDb();
  });

  it("creates a request, emails the landlord, and is idempotent per key", async () => {
    const { landlord, renter, listing } = await setup();
    const input = {
      listingId: listing.id,
      slots: [slot(2), slot(3, "14:00")],
      message: "Family of 3",
      contactPhone: "+9779841234567",
    };
    const a = await tours.requestTour(renter, input, "key-1");
    const b = await tours.requestTour(renter, input, "key-1");
    expect(a.created).toBe(true);
    expect(b.created).toBe(false);
    expect(b.tour.id).toBe(a.tour.id);
    expect(await prisma.tourRequest.count()).toBe(1);
    expect(sent).toEqual([{ to: landlord.email, subject: expect.stringContaining("New tour request") }]);
  });

  it("rejects own-listing requests, a second open request, and bad times", async () => {
    const { landlord, renter, listing } = await setup();
    const base = { listingId: listing.id, contactPhone: "+9779841234567" };
    await expect(tours.requestTour(landlord, { ...base, slots: [slot(2)] })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(tours.requestTour(renter, { ...base, slots: [slot(2, "22:00")] })).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
    await tours.requestTour(renter, { ...base, slots: [slot(2)] });
    await expect(tours.requestTour(renter, { ...base, slots: [slot(4)] })).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("confirm → both parties emailed; renter sees landlord phone + address only after confirmation", async () => {
    const { landlord, renter, listing } = await setup();
    const { tour } = await tours.requestTour(renter, {
      listingId: listing.id,
      slots: [slot(2), slot(3)],
      contactPhone: "+9779841234567",
    });

    const before = (await tours.listMyTours(renter))[0]!;
    expect(before.landlord?.phone).toBeNull();
    expect(before.address).toBeNull();
    expect((await tours.listLandlordTours(landlord))[0]!.renter?.phone).toBe("+9779841234567");

    await expect(tours.updateTour(renter, tour.id, { action: "confirm", slot: slot(2) })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(tours.updateTour(landlord, tour.id, { action: "confirm", slot: slot(5) })).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });

    sent.length = 0;
    const confirmed = await tours.updateTour(landlord, tour.id, { action: "confirm", slot: slot(3) });
    expect(confirmed.status).toBe("confirmed");
    expect(sent.map((s) => s.to).sort()).toEqual([landlord.email, renter.email].sort());

    const after = (await tours.listMyTours(renter))[0]!;
    expect(after.landlord?.phone).toBe("+9779801111111");
    expect(after.address).toContain("Kathmandu");

    const ics = await tours.tourIcs(renter, tour.id);
    expect(ics).toContain("BEGIN:VEVENT");
    const stranger = await createUser("renter");
    await expect(tours.tourIcs(stranger, tour.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("reschedule → renter accepts the proposed time", async () => {
    const { landlord, renter, listing } = await setup();
    const { tour } = await tours.requestTour(renter, {
      listingId: listing.id,
      slots: [slot(2)],
      contactPhone: "+9779841234567",
    });
    const proposed = slot(4, "15:30");
    expect(
      (await tours.updateTour(landlord, tour.id, { action: "reschedule", slot: proposed, note: "Busy that day" }))
        .status,
    ).toBe("rescheduled");
    await expect(tours.updateTour(landlord, tour.id, { action: "confirm", slot: proposed })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    const accepted = await tours.updateTour(renter, tour.id, { action: "confirm", slot: proposed });
    expect(accepted).toMatchObject({ status: "confirmed", confirmedSlot: proposed });
  });

  it("prevents double-booking the same slot", async () => {
    const { landlord, renter, listing } = await setup();
    const other = await createUser("renter");
    const a = await tours.requestTour(renter, {
      listingId: listing.id,
      slots: [slot(2)],
      contactPhone: "+9779841234567",
    });
    const b = await tours.requestTour(other, {
      listingId: listing.id,
      slots: [slot(2)],
      contactPhone: "+9779841234568",
    });
    await tours.updateTour(landlord, a.tour.id, { action: "confirm", slot: slot(2) });
    await expect(tours.updateTour(landlord, b.tour.id, { action: "confirm", slot: slot(2) })).rejects.toMatchObject({
      code: "CONFLICT",
    });
    // The taken slot disappears from public availability.
    const days = await tours.getBookableSlots(listing.id);
    expect(days.flatMap((d) => d.slots)).not.toContain(slot(2));
  });

  it("sends 24h and 2h reminders exactly once each", async () => {
    const { landlord, renter, listing } = await setup();
    const { tour } = await tours.requestTour(renter, {
      listingId: listing.id,
      slots: [slot(1)],
      contactPhone: "+9779841234567",
    });
    await tours.updateTour(landlord, tour.id, { action: "confirm", slot: slot(1) });
    const at = new Date(slot(1));

    sent.length = 0;
    expect((await tours.sendDueReminders(new Date(at.getTime() - 20 * 3600_000))).sent).toBe(1); // 24h window
    expect((await tours.sendDueReminders(new Date(at.getTime() - 19 * 3600_000))).sent).toBe(0); // already sent
    expect((await tours.sendDueReminders(new Date(at.getTime() - 90 * 60_000))).sent).toBe(1); // 2h window
    expect((await tours.sendDueReminders(new Date(at.getTime() - 60 * 60_000))).sent).toBe(0);
    expect(sent).toHaveLength(4); // renter + landlord, twice
  });

  it("only the owner can change availability", async () => {
    const { landlord, renter, listing } = await setup();
    await expect(tours.setAvailability(renter, listing.id, { windows: [], exceptions: [] })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    const a = await tours.setAvailability(landlord, listing.id, {
      windows: [{ dayOfWeek: 6, startTime: "10:00", endTime: "12:00" }],
      exceptions: [],
    });
    expect(a.windows).toHaveLength(1);
  });
});
