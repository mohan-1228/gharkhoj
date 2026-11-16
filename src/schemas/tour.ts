import { z } from "zod";
import { nepaliMobile } from "./common";

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:mm");

export const createTourSchema = z.object({
  listingId: z.string().uuid(),
  // Up to 3 preferred slots, ISO-8601 with offset (client sends UTC).
  slots: z
    .array(z.string().datetime({ offset: true }))
    .min(1, "Pick at least one time")
    .max(3, "Pick up to three times"),
  message: z.string().trim().max(1000).optional(),
  contactPhone: nepaliMobile,
});
export type CreateTourInput = z.infer<typeof createTourSchema>;

export const updateTourSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("confirm"),
    slot: z.string().datetime({ offset: true }),
    note: z.string().trim().max(1000).optional(),
  }),
  z.object({ action: z.literal("decline"), note: z.string().trim().max(1000).optional() }),
  z.object({
    action: z.literal("reschedule"),
    slot: z.string().datetime({ offset: true }),
    note: z.string().trim().max(1000).optional(),
  }),
  z.object({ action: z.literal("cancel"), note: z.string().trim().max(1000).optional() }),
  z.object({ action: z.literal("complete") }),
  z.object({ action: z.literal("no_show") }),
]);
export type UpdateTourInput = z.infer<typeof updateTourSchema>;

export const availabilitySchema = z.object({
  windows: z
    .array(
      z
        .object({ dayOfWeek: z.number().int().min(0).max(6), startTime: hhmm, endTime: hhmm })
        .refine((w) => w.startTime < w.endTime, { message: "End time must be after start time", path: ["endTime"] }),
    )
    .max(28),
  exceptions: z
    .array(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), note: z.string().max(200).optional() }))
    .max(60)
    .default([]),
});
export type AvailabilityInput = z.infer<typeof availabilitySchema>;
