import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { ZodError, type z } from "zod";
import { Prisma } from "@prisma/client";
import { AppError } from "./errors";
import { logger } from "./logger";

/** Standard error envelope: `{ error: { code, message, details } }` (CLAUDE.md §6). */
export function errorResponse(code: string, message: string, status: number, details?: unknown) {
  return NextResponse.json({ error: { code, message, ...(details !== undefined ? { details } : {}) } }, { status });
}

export function json<T>(data: T, init?: number | ResponseInit) {
  return NextResponse.json(data, typeof init === "number" ? { status: init } : init);
}

/** Map any thrown value to the standard error shape. Unknown errors are logged, never leaked. */
export function toErrorResponse(err: unknown, requestId: string) {
  if (err instanceof AppError) return errorResponse(err.code, err.message, err.status, err.details);
  if (err instanceof ZodError) {
    return errorResponse("VALIDATION_ERROR", "Some fields are invalid", 422, {
      fields: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    });
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") return errorResponse("CONFLICT", "That record already exists", 409);
    if (err.code === "P2025") return errorResponse("NOT_FOUND", "Resource not found", 404);
  }
  logger.error({ err, requestId }, "Unhandled API error");
  return errorResponse("INTERNAL", "Something went wrong. Please try again.", 500, { requestId });
}

type Handler<P> = (req: NextRequest, ctx: { params: P; requestId: string }) => Promise<Response>;

/**
 * Wrap a route handler: assigns a request id, awaits Next 15 async params,
 * maps errors, and logs latency. Handlers stay thin: parse → service → respond.
 */
export function route<P = Record<string, never>>(handler: Handler<P>) {
  return async (req: NextRequest, ctx: { params: Promise<P> }) => {
    const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();
    const started = performance.now();
    let res: Response;
    try {
      res = await handler(req, { params: ctx?.params ? await ctx.params : ({} as P), requestId });
    } catch (err) {
      res = toErrorResponse(err, requestId);
    }
    res.headers.set("x-request-id", requestId);
    logger.info(
      {
        requestId,
        method: req.method,
        path: req.nextUrl.pathname,
        status: res.status,
        ms: Math.round(performance.now() - started),
      },
      "api",
    );
    return res;
  };
}

export async function parseBody<S extends z.ZodTypeAny>(req: NextRequest, schema: S): Promise<z.infer<S>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new AppError("BAD_REQUEST", "Request body must be valid JSON");
  }
  return schema.parse(body);
}

/** Parse query params; repeated keys become arrays. */
export function parseQuery<S extends z.ZodTypeAny>(req: NextRequest, schema: S): z.infer<S> {
  const obj: Record<string, string | string[]> = {};
  for (const key of new Set(req.nextUrl.searchParams.keys())) {
    const all = req.nextUrl.searchParams.getAll(key);
    obj[key] = all.length > 1 ? all : all[0]!;
  }
  return schema.parse(obj);
}
