import "server-only";
import { z } from "zod";

/**
 * Validated server environment. Importing this module fails fast at boot if a
 * required variable is missing or malformed, instead of failing mid-request.
 */
const bool = z.enum(["true", "false", "1", "0"]).transform((v) => v === "true" || v === "1");

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    APP_URL: z.string().url().default("http://localhost:3000"),
    LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),

    DATABASE_URL: z.string().min(1),

    // Auth
    AUTH_MODE: z.enum(["dev", "cognito"]).default("dev"),
    SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 characters"),
    COGNITO_USER_POOL_ID: z.string().optional(),
    COGNITO_CLIENT_ID: z.string().optional(),
    COGNITO_CLIENT_SECRET: z.string().optional(),
    COGNITO_DOMAIN: z.string().url().optional(),

    // AWS / storage
    AWS_REGION: z.string().default("ap-south-1"),
    S3_BUCKET: z.string().default("gharkhoj-media"),
    S3_ENDPOINT: z.string().url().optional(), // set for MinIO locally; unset on AWS
    S3_PUBLIC_ENDPOINT: z.string().url().optional(), // browser-reachable endpoint for presigned POSTs
    S3_FORCE_PATH_STYLE: bool.default(false),
    S3_ACCESS_KEY_ID: z.string().optional(), // local only; AWS uses the task role
    S3_SECRET_ACCESS_KEY: z.string().optional(),
    MEDIA_BASE_URL: z.string().url(),
    IMAGE_PROCESSING: z.enum(["inline", "lambda"]).default("inline"),
    MODERATION: z.enum(["off", "rekognition"]).default("off"),

    // Email
    MAIL_TRANSPORT: z.enum(["smtp", "ses", "log"]).default("smtp"),
    MAIL_FROM: z.string().default("GharKhoj <no-reply@gharkhoj.local>"),
    SMTP_HOST: z.string().default("localhost"),
    SMTP_PORT: z.coerce.number().int().default(1025),

    // Geocoding
    GEOCODER_URL: z.string().url().default("https://nominatim.openstreetmap.org"),
    GEOCODER_USER_AGENT: z.string().default("GharKhoj/1.0 (self-hosted rental marketplace)"),

    // Shared secret used by Lambdas (image processor, tour reminders) to call internal APIs.
    INTERNAL_API_SECRET: z.string().min(32),
  })
  .superRefine((env, ctx) => {
    if (env.AUTH_MODE === "cognito") {
      for (const key of ["COGNITO_USER_POOL_ID", "COGNITO_CLIENT_ID", "COGNITO_DOMAIN"] as const) {
        if (!env[key])
          ctx.addIssue({ code: "custom", path: [key], message: `${key} is required when AUTH_MODE=cognito` });
      }
    }
    if (env.NODE_ENV === "production" && env.AUTH_MODE === "dev" && process.env.ALLOW_DEV_AUTH !== "true") {
      ctx.addIssue({ code: "custom", path: ["AUTH_MODE"], message: "AUTH_MODE=dev is not allowed in production" });
    }
  });

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  // Treat empty strings (e.g. `COGNITO_DOMAIN=`) as unset.
  const raw = Object.fromEntries(Object.entries(process.env).filter(([, v]) => v !== ""));
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  • ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data;
}

export const env: Env = loadEnv();
