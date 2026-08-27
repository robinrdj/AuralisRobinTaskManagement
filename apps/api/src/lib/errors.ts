import { HTTPException } from "hono/http-exception";
import type { Context } from "hono";
import { ZodError } from "zod";

/** Shape every error response shares, so the client has one thing to parse. */
export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
}

export function apiError(
  status: 400 | 401 | 403 | 404 | 409 | 422 | 429,
  code: string,
  message: string,
  details?: unknown
): HTTPException {
  const body: ApiErrorBody = { error: { code, message, ...(details ? { details } : {}) } };
  return new HTTPException(status, { res: Response.json(body, { status }) });
}

export const unauthorized = (message = "Sign in to continue") =>
  apiError(401, "unauthorized", message);
export const forbidden = (message = "You do not have access to this board") =>
  apiError(403, "forbidden", message);
export const notFound = (message = "Not found") => apiError(404, "not_found", message);
export const conflict = (message: string, details?: unknown) =>
  apiError(409, "conflict", message, details);
export const badRequest = (message: string, details?: unknown) =>
  apiError(400, "bad_request", message, details);

/**
 * Central error handler. Anything that is not a deliberate HTTPException is
 * logged with its stack and reported as a generic 500 — internal messages and
 * SQL text never reach the client.
 */
export function onError(err: Error, c: Context): Response {
  if (err instanceof HTTPException) {
    return err.getResponse();
  }

  if (err instanceof ZodError) {
    const body: ApiErrorBody = {
      error: {
        code: "validation_failed",
        message: "Check the highlighted fields",
        details: err.issues,
      },
    };
    return c.json(body, 422);
  }

  console.error("[api] unhandled error", { path: c.req.path, method: c.req.method, err });
  const body: ApiErrorBody = {
    error: { code: "internal_error", message: "Something went wrong on our end" },
  };
  return c.json(body, 500);
}
