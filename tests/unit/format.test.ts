import { describe, expect, it } from "vitest";
import {
  formatNpr,
  formatNprCompact,
  formatRent,
  normalizeNepaliMobile,
  slugify,
  sqftToRopani,
  formatKathmandu,
} from "@/lib/format";

describe("formatNpr", () => {
  it("uses lakh/crore digit grouping", () => {
    expect(formatNpr(25000)).toBe("Rs. 25,000");
    expect(formatNpr(150000)).toBe("Rs. 1,50,000");
    expect(formatNpr(12500000)).toBe("Rs. 1,25,00,000");
  });
  it("formats monthly rent", () => {
    expect(formatRent(18000)).toBe("Rs. 18,000 / month");
  });
  it("compacts for map pins", () => {
    expect(formatNprCompact(800)).toBe("800");
    expect(formatNprCompact(25000)).toBe("25K");
    expect(formatNprCompact(12500)).toBe("12.5K");
    expect(formatNprCompact(150000)).toBe("1.5L");
  });
});

describe("sqftToRopani", () => {
  it("converts exact units", () => {
    expect(sqftToRopani(5476)).toBe("1-0-0-0");
    expect(sqftToRopani(342.25)).toBe("0-1-0-0");
    expect(sqftToRopani(5476 * 2 + 342.25 * 4)).toBe("2-4-0-0");
  });
});

describe("normalizeNepaliMobile", () => {
  it.each([
    ["9841234567", "+9779841234567"],
    ["+977 984-1234567", "+9779841234567"],
    ["9779801234567", "+9779801234567"],
    ["9761234567", "+9779761234567"],
  ])("accepts %s", (input, expected) => {
    expect(normalizeNepaliMobile(input)).toBe(expected);
  });
  it.each(["01-4412345", "984123456", "98412345678", "+919841234567", "abc"])("rejects %s", (input) => {
    expect(normalizeNepaliMobile(input)).toBeNull();
  });
});

describe("slugify", () => {
  it("creates URL-safe slugs", () => {
    expect(slugify("2BHK Apartment in Baneshwor!")).toBe("2bhk-apartment-in-baneshwor");
    expect(slugify("  Café — Lakeside  ")).toBe("cafe-lakeside");
  });
});

describe("formatKathmandu", () => {
  it("displays UTC instants in Nepal time (UTC+5:45)", () => {
    expect(formatKathmandu("2026-11-16T08:45:00Z", { weekday: undefined, year: undefined })).toBe("16 Nov, 2:30 pm");
  });
});
