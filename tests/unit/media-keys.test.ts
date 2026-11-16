import { describe, expect, it } from "vitest";
import { deriveMediaKey, uploadPrefix } from "@/server/services/media-service";

describe("media keys", () => {
  it("derives public media keys from private upload keys", () => {
    expect(deriveMediaKey("uploads/listings/abc/photos/123.jpg")).toBe("media/listings/abc/photos/123");
    expect(deriveMediaKey("uploads/listings/abc/floor-plans/9.pdf", true)).toBe("media/listings/abc/floor-plans/9.pdf");
  });
  it("scopes upload prefixes to the listing or user", () => {
    expect(uploadPrefix("photo", { listingId: "L1", userId: "U1" })).toBe("uploads/listings/L1/photos/");
    expect(uploadPrefix("verification_doc", { userId: "U1" })).toBe("private/verification/U1/");
  });
});
