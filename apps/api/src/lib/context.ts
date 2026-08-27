import type { PublicUser } from "@auralis/shared";
import type { Database } from "../db/client.js";
import type { Env } from "./env.js";
import type { RealtimeHub } from "../realtime/hub.js";

/** Values Hono carries through the request pipeline, typed end to end. */
export interface AppContext {
  Variables: {
    db: Database;
    env: Env;
    hub: RealtimeHub;
    /** Present only after `requireAuth` has run. */
    user: PublicUser;
    /** Client-supplied id used to suppress the echo of a client's own write. */
    originId: string | null;
  };
}
