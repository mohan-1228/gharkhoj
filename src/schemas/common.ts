import { z } from "zod";
import { normalizeNepaliMobile } from "@/lib/format";

export const uuid = z.string().uuid();
export const latitude = z.coerce.number().min(26.3).max(30.5); // Nepal bounding box
export const longitude = z.coerce.number().min(80.0).max(88.3);

export const nepaliMobile = z
  .string()
  .trim()
  .transform((v, ctx) => {
    const normalized = normalizeNepaliMobile(v);
    if (!normalized) {
      ctx.addIssue({ code: "custom", message: "Enter a valid Nepali mobile number, e.g. 98XXXXXXXX" });
      return z.NEVER;
    }
    return normalized;
  });

/** Cursor pagination: `{ items, nextCursor }` */
export const paginationQuery = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

/** Comma-separated query param → string[] */
export const csv = <T extends z.ZodTypeAny>(item: T) =>
  z.preprocess((v) => {
    if (Array.isArray(v)) return v.flatMap((x) => String(x).split(",")).filter(Boolean);
    if (typeof v === "string") return v.split(",").filter(Boolean);
    return undefined;
  }, z.array(item).optional());

export const booleanParam = z.preprocess(
  (v) =>
    v === "true" || v === "1" || v === true ? true : v === "false" || v === "0" || v === false ? false : undefined,
  z.boolean().optional(),
);
