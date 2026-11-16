import { describe, expect, it, vi } from "vitest";
import { rateLimit, clientIp } from "@/server/lib/rate-limit";

describe("rateLimit", () => {
  it("allows up to the limit then throws RATE_LIMITED until the window resets", () => {
    vi.useFakeTimers();
    const key = `t-${Math.random()}`;
    for (let i = 0; i < 3; i++) rateLimit(key, 3, 1000);
    expect(() => rateLimit(key, 3, 1000)).toThrow(expect.objectContaining({ code: "RATE_LIMITED" }));
    vi.advanceTimersByTime(1001);
    expect(() => rateLimit(key, 3, 1000)).not.toThrow();
    vi.useRealTimers();
  });
  it("reads the first x-forwarded-for hop", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "1.2.3.4, 10.0.0.1" }))).toBe("1.2.3.4");
    expect(clientIp(new Headers())).toBe("unknown");
  });
});
