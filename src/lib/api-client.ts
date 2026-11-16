/** Typed fetch wrapper for /api/v1 that surfaces the standard error envelope. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: { fields?: { path: string; message: string }[]; problems?: string[] } & Record<
      string,
      unknown
    >,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function api<T = unknown>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, headers, ...rest } = init ?? {};
  const res = await fetch(`/api/v1${path}`, {
    ...rest,
    headers: { ...(json !== undefined ? { "Content-Type": "application/json" } : {}), ...headers },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
    credentials: "same-origin",
  });
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = body?.error ?? {};
    throw new ApiError(res.status, err.code ?? "UNKNOWN", err.message ?? "Request failed", err.details);
  }
  return body as T;
}

/** Human message for toasts, including validation problems. */
export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    const extra = err.details?.problems?.join(", ") ?? err.details?.fields?.map((f) => f.message).join(", ");
    return extra ? `${err.message}: ${extra}` : err.message;
  }
  return "Something went wrong. Please try again.";
}
