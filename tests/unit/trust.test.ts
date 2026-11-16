import { describe, expect, it } from "vitest";
import { detectContactInfo, hasContactInfo } from "@/server/services/trust";

describe("detectContactInfo", () => {
  it("finds Nepali mobile numbers in various formats", () => {
    const f = detectContactInfo("Call 9841234567 or +977-980-123-4567 today");
    expect(f.phones).toHaveLength(2);
  });
  it("finds emails, links and off-platform payment cues", () => {
    const f = detectContactInfo(
      "Email me at ram@example.com, see www.example.com. Pay deposit first via eSewa or WhatsApp me",
    );
    expect(f.emails).toEqual(["ram@example.com"]);
    expect(f.urls).toHaveLength(1);
    expect(f.keywords).toEqual(expect.arrayContaining(["esewa", "whatsapp", "pay deposit first"]));
  });
  it("does not flag ordinary descriptions", () => {
    const f = detectContactInfo(
      "Sunny 2BHK, 24 hour water, 5 minutes from Baneshwor chowk. Rent 25000 per month, ward 10.",
    );
    expect(hasContactInfo(f)).toBe(false);
  });
});
