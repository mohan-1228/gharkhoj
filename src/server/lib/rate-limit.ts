import { AppError } from "./errors";

/**
 * In-process fixed-window rate limiter. This is a second line of defence:
 * in production AWS WAF rate-based rules throttle per IP at the edge
 * (CLAUDE.md §9b). Per-container memory is acceptable because WAF enforces
 * the global limit.
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit: number, windowMs: number): void {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    if (buckets.size > 50_000) sweep(now);
    return;
  }
  b.count++;
  if (b.count > limit) {
    throw new AppError("RATE_LIMITED", "Too many requests. Please slow down.", {
      retryAfterSeconds: Math.ceil((b.resetAt - now) / 1000),
    });
  }
}

function sweep(now: number) {
  for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
}

/** Best-effort client IP (CloudFront/ALB set x-forwarded-for). */
export function clientIp(headers: Headers): string {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip") || "unknown";
}
