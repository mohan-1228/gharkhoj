import { z } from "zod";
import { REPORT_REASONS, UPLOAD_LIMITS } from "@/lib/constants";

export const presignSchema = z.object({
  kind: z.enum(Object.keys(UPLOAD_LIMITS) as [keyof typeof UPLOAD_LIMITS, ...(keyof typeof UPLOAD_LIMITS)[]]),
  listingId: z.string().uuid().optional(),
  contentType: z.string().max(100),
  size: z.number().int().positive(),
});
export type PresignInput = z.infer<typeof presignSchema>;

export const createReportSchema = z.object({
  listingId: z.string().uuid(),
  reason: z.enum(REPORT_REASONS),
  details: z.string().trim().max(2000).optional(),
});

export const rejectSchema = z.object({ reason: z.string().trim().min(5).max(1000) });

export const resolveReportSchema = z.object({
  status: z.enum(["resolved", "dismissed"]),
  resolution: z.string().trim().max(1000).optional(),
  pauseListing: z.boolean().default(false),
});

export const verifyLandlordSchema = z.object({
  decision: z.enum(["verified", "rejected"]),
  note: z.string().trim().max(1000).optional(),
});

export const banUserSchema = z.object({ banned: z.boolean() });
export const setRoleSchema = z.object({ role: z.enum(["renter", "landlord", "admin"]) });

export const profileSchema = z.object({
  fullName: z.string().trim().min(2).max(100),
  phone: z.string().trim().max(20).optional().nullable(),
  businessName: z.string().trim().max(120).optional().nullable(),
  bio: z.string().trim().max(1000).optional().nullable(),
});

export const savedSearchSchema = z.object({
  name: z.string().trim().min(1).max(80),
  filters: z.record(z.string(), z.unknown()),
  alertFrequency: z.enum(["none", "daily", "weekly"]).default("none"),
});

export const verificationRequestSchema = z.object({ key: z.string().min(1).max(500) });

export const lookupCitySchema = z.object({
  name: z.string().trim().min(2).max(60),
  nameNe: z.string().trim().max(60).optional(),
  province: z.string().trim().min(2).max(60),
  district: z.string().trim().min(2).max(60),
  latitude: z.number(),
  longitude: z.number(),
  isActive: z.boolean().default(true),
});
export const lookupNeighborhoodSchema = z.object({
  cityId: z.number().int().positive(),
  name: z.string().trim().min(2).max(80),
  nameNe: z.string().trim().max(80).optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});
export const lookupAmenitySchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^[a-z0-9_]+$/)
    .max(50),
  label: z.string().trim().min(2).max(60),
  labelNe: z.string().trim().max(60).optional(),
  category: z.enum(["basics", "building", "policies", "nearby"]),
  icon: z.string().max(40).optional(),
});
