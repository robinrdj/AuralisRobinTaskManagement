import { createApp, type App } from "../app.js";
import { createDatabase, type DatabaseHandle } from "../db/client.js";
import { runMigrations } from "../db/migrate.js";
import { loadEnv, type Env } from "../lib/env.js";
import { RealtimeHub } from "../realtime/hub.js";

/**
 * A fully wired application on a private, in-memory Postgres.
 *
 * Each test file gets its own instance, so files share no state and can run in
 * parallel. Requests go through `app.fetch` rather than a listening socket:
 * the entire middleware stack, routing, validation and error handling run for
 * real, with no port to allocate and no teardown race.
 */
export interface TestHarness {
  app: App;
  handle: DatabaseHandle;
  hub: RealtimeHub;
  env: Env;
  /** Sends a request through the app, carrying any cookies from a session. */
  request: (path: string, init?: RequestInit & { session?: Session }) => Promise<Response>;
  close: () => Promise<void>;
}

/** Cookies captured from an auth response, replayed on subsequent requests. */
export interface Session {
  cookies: Map<string, string>;
  userId: string;
  boardId: string;
}

export async function createHarness(
  overrides: Record<string, string> = {}
): Promise<TestHarness> {
  const handle = createDatabase(undefined);
  await runMigrations(handle);

  const env = loadEnv({
    NODE_ENV: "test",
    JWT_SECRET: "test-secret-that-is-long-enough-to-pass-validation",
    CORS_ORIGINS: "http://localhost:5173",
    ...overrides,
  } as NodeJS.ProcessEnv);

  const hub = new RealtimeHub();
  const app = createApp({ db: handle.db, env, hub });

  async function request(
    path: string,
    init: RequestInit & { session?: Session } = {}
  ): Promise<Response> {
    const { session, ...rest } = init;
    const headers = new Headers(rest.headers);
    if (rest.body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    if (session && session.cookies.size > 0) {
      headers.set(
        "Cookie",
        [...session.cookies].map(([name, value]) => `${name}=${value}`).join("; ")
      );
    }
    return app.fetch(new Request(`http://localhost${path}`, { ...rest, headers }));
  }

  return {
    app,
    handle,
    hub,
    env,
    request,
    close: () => handle.close(),
  };
}

/** Parses Set-Cookie headers into the map a Session replays. */
export function collectCookies(response: Response, into = new Map<string, string>()) {
  for (const header of response.headers.getSetCookie()) {
    const [pair] = header.split(";");
    const index = pair!.indexOf("=");
    if (index < 0) continue;
    const name = pair!.slice(0, index).trim();
    const value = pair!.slice(index + 1).trim();
    // An empty value is how a cookie is deleted; drop it rather than replaying it.
    if (value === "") into.delete(name);
    else into.set(name, value);
  }
  return into;
}

/** Signs up a real user and returns a session ready to make requests with. */
export async function signUp(
  harness: TestHarness,
  overrides: { email?: string; password?: string; name?: string } = {}
): Promise<Session> {
  const email = overrides.email ?? `user-${Math.random().toString(36).slice(2)}@example.com`;
  const response = await harness.request("/api/auth/signup", {
    method: "POST",
    body: JSON.stringify({
      email,
      password: overrides.password ?? "a-sufficiently-long-password",
      name: overrides.name ?? "Test User",
    }),
  });

  if (response.status !== 201) {
    throw new Error(`signUp failed: ${response.status} ${await response.text()}`);
  }
  const body = (await response.json()) as { user: { id: string }; boardId: string };
  return {
    cookies: collectCookies(response),
    userId: body.user.id,
    boardId: body.boardId,
  };
}

/** Creates a guest session with a pre-populated board. */
export async function signInAsGuest(harness: TestHarness): Promise<Session> {
  const response = await harness.request("/api/auth/guest", { method: "POST" });
  if (response.status !== 201) {
    throw new Error(`guest sign-in failed: ${response.status} ${await response.text()}`);
  }
  const body = (await response.json()) as { user: { id: string }; boardId: string };
  return {
    cookies: collectCookies(response),
    userId: body.user.id,
    boardId: body.boardId,
  };
}
