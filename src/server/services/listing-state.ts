import type { ListingStatusValue } from "@/lib/constants";
import { invalidState } from "../lib/errors";

/**
 * Listing lifecycle (CLAUDE.md §4.1):
 *   draft → pending_review → published → paused → rented → archived
 *                         ↘ rejected (with reason) → (edit) → pending_review
 * Pure functions so the rules are unit-testable without a database.
 */
export type ListingTransition =
  "submit" | "approve" | "reject" | "pause" | "resume" | "mark_rented" | "archive" | "relist";

const TRANSITIONS: Record<ListingTransition, { from: ListingStatusValue[]; to: ListingStatusValue }> = {
  submit: { from: ["draft", "rejected"], to: "pending_review" },
  approve: { from: ["pending_review"], to: "published" },
  reject: { from: ["pending_review"], to: "rejected" },
  pause: { from: ["published"], to: "paused" },
  resume: { from: ["paused"], to: "published" },
  mark_rented: { from: ["published", "paused"], to: "rented" },
  archive: { from: ["draft", "pending_review", "published", "paused", "rented", "rejected"], to: "archived" },
  relist: { from: ["rented", "archived"], to: "draft" },
};

export function canTransition(from: ListingStatusValue, action: ListingTransition): boolean {
  return TRANSITIONS[action].from.includes(from);
}

export function nextStatus(from: ListingStatusValue, action: ListingTransition): ListingStatusValue {
  if (!canTransition(from, action)) {
    throw invalidState(`Cannot ${action.replace("_", " ")} a listing that is ${from.replace("_", " ")}`);
  }
  return TRANSITIONS[action].to;
}

/** Actions an owner may take from the current status (drives dashboard buttons). */
export function ownerActions(status: ListingStatusValue): ListingTransition[] {
  return (["submit", "pause", "resume", "mark_rented", "archive", "relist"] as const).filter((a) =>
    canTransition(status, a),
  );
}

/** Only published listings are visible to the public. */
export const isPubliclyVisible = (status: ListingStatusValue) => status === "published";

/** Fields whose change on a live listing requires re-moderation (trust & safety). */
export const REVIEW_SENSITIVE_FIELDS = ["title", "description"] as const;
