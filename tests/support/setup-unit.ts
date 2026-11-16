import "@testing-library/jest-dom/vitest";

// Minimal env so modules that validate env at import time can load in unit tests.
process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5433/unused";
process.env.SESSION_SECRET ??= "unit-test-session-secret-that-is-long-enough";
process.env.INTERNAL_API_SECRET ??= "unit-test-internal-secret-that-is-long-enough";
process.env.MEDIA_BASE_URL ??= "http://localhost:9000/gharkhoj-media";
process.env.MAIL_TRANSPORT ??= "log";
