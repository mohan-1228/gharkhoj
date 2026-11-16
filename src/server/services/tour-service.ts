import type { Prisma, TourStatus } from "@prisma/client";
import type { AvailabilityInput, CreateTourInput, UpdateTourInput } from "@/schemas/tour";
import { assertAuthenticated, assertOwnerOrAdmin, assertRole } from "../auth/guards";
import type { SessionUser } from "../auth/types";
import { prisma } from "../lib/db";
import { env } from "../lib/env";
import { AppError, forbidden, notFound } from "../lib/errors";
import { sendEmail } from "../lib/mailer";
import { sendSms } from "../lib/sms";
import {
  tourCancelledEmail,
  tourConfirmedEmail,
  tourDeclinedEmail,
  tourReminderEmail,
  tourRequestedEmail,
  tourRescheduledEmail,
  type TourEmailContext,
} from "../emails/templates";
import { formatKathmandu } from "@/lib/format";
import { audit } from "./audit";
import { assertSlotsBookable, buildIcs, generateSlots, tourTransition, type Party } from "./tour-rules";

const MAX_OPEN_REQUESTS_PER_LISTING = 1;
const OPEN: TourStatus[] = ["requested", "confirmed", "rescheduled"];

// ───────────────────────────── Availability ─────────────────────────────

export async function getAvailability(listingId: string) {
  const [windows, exceptions] = await Promise.all([
    prisma.tourAvailability.findMany({ where: { listingId }, orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }] }),
    prisma.tourException.findMany({
      where: { listingId, date: { gte: new Date(new Date().toISOString().slice(0, 10)) } },
      orderBy: { date: "asc" },
    }),
  ]);
  return {
    windows: windows.map((w) => ({ dayOfWeek: w.dayOfWeek, startTime: w.startTime, endTime: w.endTime })),
    exceptions: exceptions.map((e) => ({ date: e.date.toISOString().slice(0, 10), note: e.note })),
  };
}

export async function setAvailability(actor: SessionUser | null, listingId: string, input: AvailabilityInput) {
  assertRole(actor, "landlord", "admin");
  const listing = await prisma.listing.findUnique({ where: { id: listingId }, select: { landlordId: true } });
  if (!listing) throw notFound("Listing");
  assertOwnerOrAdmin(actor, listing.landlordId);
  await prisma.$transaction([
    prisma.tourAvailability.deleteMany({ where: { listingId } }),
    prisma.tourAvailability.createMany({ data: input.windows.map((w) => ({ listingId, ...w })) }),
    prisma.tourException.deleteMany({ where: { listingId } }),
    prisma.tourException.createMany({
      data: input.exceptions.map((e) => ({ listingId, date: new Date(e.date), note: e.note })),
      skipDuplicates: true,
    }),
  ]);
  return getAvailability(listingId);
}

/** Public: bookable slots for the next 14 days (Kathmandu-grouped, UTC instants). */
export async function getBookableSlots(listingId: string, now = new Date()) {
  const listing = await prisma.listing.findFirst({
    where: { id: listingId, status: "published" },
    select: { id: true },
  });
  if (!listing) throw notFound("Listing");
  const [avail, taken] = await Promise.all([
    getAvailability(listingId),
    prisma.tourRequest.findMany({
      where: { listingId, status: "confirmed", confirmedSlot: { gte: now } },
      select: { confirmedSlot: true },
    }),
  ]);
  return generateSlots({
    windows: avail.windows,
    exceptions: avail.exceptions.map((e) => e.date),
    taken: taken.map((t) => t.confirmedSlot!),
    now,
  });
}

// ─────────────────────────────── Requests ───────────────────────────────

const tourInclude = {
  listing: {
    select: {
      id: true,
      slug: true,
      title: true,
      landlordId: true,
      streetAddress: true,
      landmark: true,
      locationIsApproximate: true,
      city: { select: { name: true } },
      neighborhood: { select: { name: true } },
      photos: { where: { isCover: true }, take: 1, select: { mediaKey: true } },
      landlord: { select: { id: true, email: true, fullName: true, phone: true } },
    },
  },
  renter: { select: { id: true, email: true, fullName: true, phone: true } },
} satisfies Prisma.TourRequestInclude;
type TourWithRelations = Prisma.TourRequestGetPayload<{ include: typeof tourInclude }>;

function ctx(t: TourWithRelations): TourEmailContext {
  return {
    appUrl: env.APP_URL,
    listingTitle: t.listing.title,
    listingSlug: t.listing.slug,
    renterName: t.renter.fullName,
    landlordName: t.listing.landlord.fullName,
  };
}

function addressOf(t: TourWithRelations): string {
  return [t.listing.streetAddress, t.listing.landmark, t.listing.neighborhood?.name, t.listing.city.name]
    .filter(Boolean)
    .join(", ");
}

/**
 * Renter requests a tour. Idempotent per (renter, Idempotency-Key): retrying a
 * flaky mobile submit returns the original request instead of creating a duplicate.
 */
export async function requestTour(
  actor: SessionUser | null,
  input: CreateTourInput,
  idempotencyKey?: string,
  now = new Date(),
) {
  assertAuthenticated(actor);
  if (idempotencyKey) {
    const existing = await prisma.tourRequest.findUnique({
      where: { renterId_idempotencyKey: { renterId: actor.id, idempotencyKey } },
      include: tourInclude,
    });
    if (existing) return { tour: existing, created: false };
  }
  const listing = await prisma.listing.findFirst({
    where: { id: input.listingId, status: "published" },
    select: { id: true, landlordId: true },
  });
  if (!listing) throw notFound("Listing");
  if (listing.landlordId === actor.id) throw forbidden("You can't request a tour of your own listing");

  const open = await prisma.tourRequest.count({
    where: { listingId: listing.id, renterId: actor.id, status: { in: OPEN } },
  });
  if (open >= MAX_OPEN_REQUESTS_PER_LISTING)
    throw new AppError("CONFLICT", "You already have an open tour request for this listing");

  const slots = input.slots.map((s) => new Date(s)).sort((a, b) => a.getTime() - b.getTime());
  const avail = await getAvailability(listing.id);
  assertSlotsBookable(slots, { windows: avail.windows, exceptions: avail.exceptions.map((e) => e.date), now });

  let tour;
  try {
    tour = await prisma.tourRequest.create({
      data: {
        listingId: listing.id,
        renterId: actor.id,
        requestedSlots: slots.map((s) => s.toISOString()),
        renterMessage: input.message || null,
        contactPhone: input.contactPhone,
        idempotencyKey: idempotencyKey ?? null,
      },
      include: tourInclude,
    });
  } catch (err) {
    // Concurrent duplicate with the same idempotency key.
    if ((err as { code?: string }).code === "P2002" && idempotencyKey) {
      const existing = await prisma.tourRequest.findUniqueOrThrow({
        where: { renterId_idempotencyKey: { renterId: actor.id, idempotencyKey } },
        include: tourInclude,
      });
      return { tour: existing, created: false };
    }
    throw err;
  }
  await audit(actor.id, "tour.request", "tour_request", tour.id);
  await sendEmail(
    tourRequestedEmail(tour.listing.landlord.email, { ...ctx(tour), slots, message: tour.renterMessage }),
  );
  return { tour, created: true };
}

function partyOf(actor: SessionUser, t: TourWithRelations): Party {
  if (t.listing.landlordId === actor.id || actor.role === "admin") return "landlord";
  if (t.renterId === actor.id) return "renter";
  throw notFound("Tour");
}

export async function updateTour(actor: SessionUser | null, id: string, input: UpdateTourInput, now = new Date()) {
  assertAuthenticated(actor);
  const t = await prisma.tourRequest.findUnique({ where: { id }, include: tourInclude });
  if (!t) throw notFound("Tour");
  const party = partyOf(actor, t);
  const status = tourTransition(t.status, input.action, party);
  const data: Prisma.TourRequestUpdateInput = { status };

  if (input.action === "confirm") {
    const slot = new Date(input.slot);
    if (party === "landlord") {
      const requested = (t.requestedSlots as string[]).map((s) => new Date(s).getTime());
      if (!requested.includes(slot.getTime()))
        throw new AppError("VALIDATION_ERROR", "Confirm one of the renter's requested times, or propose a new time");
    } else if (t.confirmedSlot?.getTime() !== slot.getTime()) {
      throw new AppError("CONFLICT", "The proposed time has changed — please refresh");
    }
    if (slot.getTime() < now.getTime()) throw new AppError("VALIDATION_ERROR", "That time has already passed");
    const clash = await prisma.tourRequest.count({
      where: { listingId: t.listingId, status: "confirmed", confirmedSlot: slot, id: { not: t.id } },
    });
    if (clash) throw new AppError("CONFLICT", "Another tour is already confirmed at that time");
    data.confirmedSlot = slot;
    data.reminder24hSent = false;
    data.reminder2hSent = false;
    if ("note" in input && input.note) data.landlordNote = input.note;
  }
  if (input.action === "reschedule") {
    const slot = new Date(input.slot);
    if (slot.getTime() < now.getTime() + 60 * 60_000)
      throw new AppError("VALIDATION_ERROR", "Propose a time at least 1 hour from now");
    data.confirmedSlot = slot;
    if (input.note) data.landlordNote = input.note;
  }
  if ((input.action === "decline" || input.action === "cancel") && input.note) {
    if (party === "landlord") data.landlordNote = input.note;
  }
  if (
    (input.action === "complete" || input.action === "no_show") &&
    t.confirmedSlot &&
    t.confirmedSlot.getTime() > now.getTime()
  ) {
    throw new AppError("INVALID_STATE", "You can mark the outcome after the tour time");
  }

  const updated = await prisma.tourRequest.update({ where: { id }, data, include: tourInclude });
  await audit(actor.id, `tour.${input.action}`, "tour_request", id, { from: t.status, to: status });
  await notify(updated, input.action, party);
  return toTourDto(updated, actor);
}

async function notify(t: TourWithRelations, action: UpdateTourInput["action"], by: Party) {
  const c = ctx(t);
  const renter = t.renter;
  const landlord = t.listing.landlord;
  switch (action) {
    case "confirm": {
      const slot = t.confirmedSlot!;
      await Promise.all([
        sendEmail(
          tourConfirmedEmail(renter.email, {
            ...c,
            slot,
            tourId: t.id,
            forLandlord: false,
            address: addressOf(t),
            landlordPhone: landlord.phone,
            note: t.landlordNote,
          }),
        ),
        sendEmail(tourConfirmedEmail(landlord.email, { ...c, slot, tourId: t.id, forLandlord: true })),
        sendSms(t.contactPhone, `GharKhoj: tour of "${t.listing.title}" confirmed for ${formatKathmandu(slot)}.`),
      ]);
      break;
    }
    case "decline":
      await sendEmail(tourDeclinedEmail(renter.email, { ...c, note: t.landlordNote }));
      break;
    case "reschedule":
      await sendEmail(tourRescheduledEmail(renter.email, { ...c, slot: t.confirmedSlot!, note: t.landlordNote }));
      break;
    case "cancel":
      await sendEmail(
        tourCancelledEmail(by === "renter" ? landlord.email : renter.email, {
          ...c,
          by: by === "renter" ? renter.fullName : landlord.fullName,
          slot: t.confirmedSlot,
        }),
      );
      break;
    default:
      break;
  }
}

/**
 * Shape a tour for a given viewer. Phone numbers are revealed progressively:
 * the landlord sees the renter's contact phone (given for this tour); the renter
 * sees the landlord's phone and exact address only once the tour is confirmed.
 */
export function toTourDto(t: TourWithRelations, viewer: SessionUser) {
  const isLandlord = t.listing.landlordId === viewer.id || viewer.role === "admin";
  const confirmed = t.status === "confirmed" || t.status === "completed";
  return {
    id: t.id,
    status: t.status,
    requestedSlots: t.requestedSlots as string[],
    confirmedSlot: t.confirmedSlot?.toISOString() ?? null,
    renterMessage: t.renterMessage,
    landlordNote: t.landlordNote,
    createdAt: t.createdAt.toISOString(),
    listing: {
      id: t.listing.id,
      slug: t.listing.slug,
      title: t.listing.title,
      place: [t.listing.neighborhood?.name, t.listing.city.name].filter(Boolean).join(", "),
    },
    renter: isLandlord ? { name: t.renter.fullName, phone: t.contactPhone } : null,
    landlord: !isLandlord
      ? { name: t.listing.landlord.fullName, phone: confirmed ? t.listing.landlord.phone : null }
      : null,
    address: !isLandlord && confirmed ? addressOf(t) : null,
  };
}
export type TourDto = ReturnType<typeof toTourDto>;

export async function listMyTours(actor: SessionUser | null) {
  assertAuthenticated(actor);
  const tours = await prisma.tourRequest.findMany({
    where: { renterId: actor.id },
    include: tourInclude,
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return tours.map((t) => toTourDto(t, actor));
}

export async function listLandlordTours(actor: SessionUser | null, status?: TourStatus) {
  assertRole(actor, "landlord", "admin");
  const tours = await prisma.tourRequest.findMany({
    where: { listing: { landlordId: actor.id }, ...(status ? { status } : {}) },
    include: tourInclude,
    orderBy: [{ createdAt: "desc" }],
    take: 200,
  });
  // Requests needing action first.
  const rank: Record<string, number> = { requested: 0, rescheduled: 1, confirmed: 2 };
  return tours.map((t) => toTourDto(t, actor)).sort((a, b) => (rank[a.status] ?? 9) - (rank[b.status] ?? 9));
}

export async function tourIcs(actor: SessionUser | null, id: string): Promise<string> {
  assertAuthenticated(actor);
  const t = await prisma.tourRequest.findUnique({ where: { id }, include: tourInclude });
  if (!t) throw notFound("Tour");
  partyOf(actor, t);
  if (t.status !== "confirmed" || !t.confirmedSlot)
    throw new AppError("INVALID_STATE", "Only confirmed tours can be added to a calendar");
  return buildIcs({
    uid: t.id,
    start: t.confirmedSlot,
    minutes: 30,
    title: `Rental tour: ${t.listing.title}`,
    description: `GharKhoj tour of "${t.listing.title}". ${env.APP_URL}/listing/${t.listing.slug}`,
    location: addressOf(t),
    url: `${env.APP_URL}/listing/${t.listing.slug}`,
  });
}

// ─────────────────────────────── Reminders ──────────────────────────────

/**
 * Send 24h and 2h reminders for confirmed tours. Invoked every 15 minutes by
 * EventBridge Scheduler → tour-reminders Lambda → POST /api/v1/internal/tour-reminders.
 * Safe to run repeatedly: flags are flipped atomically so each reminder goes out once.
 */
export async function sendDueReminders(now = new Date()) {
  const in24h = new Date(now.getTime() + 24 * 3600_000);
  const in2h = new Date(now.getTime() + 2 * 3600_000);
  let sent = 0;

  for (const [window, flag, hours] of [
    [in2h, "reminder2hSent", 2],
    [in24h, "reminder24hSent", 24],
  ] as const) {
    const due = await prisma.tourRequest.findMany({
      where: { status: "confirmed", confirmedSlot: { gt: now, lte: window }, [flag]: false },
      include: tourInclude,
      take: 500,
    });
    for (const t of due) {
      // Claim atomically (guards against two concurrent invocations).
      const claimed = await prisma.tourRequest.updateMany({
        where: { id: t.id, [flag]: false },
        data: hours === 2 ? { reminder2hSent: true, reminder24hSent: true } : { reminder24hSent: true },
      });
      if (claimed.count === 0) continue;
      const c = ctx(t);
      await Promise.all([
        sendEmail(tourReminderEmail(t.renter.email, { ...c, slot: t.confirmedSlot!, hours, forLandlord: false })),
        sendEmail(
          tourReminderEmail(t.listing.landlord.email, { ...c, slot: t.confirmedSlot!, hours, forLandlord: true }),
        ),
        sendSms(
          t.contactPhone,
          `GharKhoj reminder: tour of "${t.listing.title}" at ${formatKathmandu(t.confirmedSlot!)}.`,
        ),
      ]);
      sent++;
    }
  }
  return { sent };
}
