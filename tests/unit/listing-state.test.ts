import { describe, expect, it } from "vitest";
import { canTransition, nextStatus, ownerActions } from "@/server/services/listing-state";
import { AppError } from "@/server/lib/errors";

describe("listing lifecycle", () => {
  it("follows the happy path draft → pending → published → rented → archived", () => {
    let s = nextStatus("draft", "submit");
    expect(s).toBe("pending_review");
    s = nextStatus(s, "approve");
    expect(s).toBe("published");
    s = nextStatus(s, "mark_rented");
    expect(s).toBe("rented");
    expect(nextStatus(s, "archive")).toBe("archived");
  });

  it("allows resubmitting a rejected listing", () => {
    expect(nextStatus("rejected", "submit")).toBe("pending_review");
  });

  it("rejects illegal transitions with INVALID_STATE", () => {
    expect(() => nextStatus("draft", "approve")).toThrow(AppError);
    expect(() => nextStatus("published", "submit")).toThrow(/Cannot submit/);
    expect(canTransition("archived", "pause")).toBe(false);
  });

  it("lists owner actions per status", () => {
    expect(ownerActions("draft")).toEqual(["submit", "archive"]);
    expect(ownerActions("published")).toEqual(["pause", "mark_rented", "archive"]);
    expect(ownerActions("archived")).toEqual(["relist"]);
  });
});
