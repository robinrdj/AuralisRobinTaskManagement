# Auralis

A real-time task board. Drag work across columns and everyone watching sees it
move; every change is undoable; every date sorts correctly in every timezone.

**[Live demo](https://auralis-robin-task-management.vercel.app/)** — one click,
no signup. You land on a board that already has work on it.

```
git clone https://github.com/robinrdj/AuralisRobinTaskManagement
cd AuralisRobinTaskManagement
npm install
npm run dev
```

That's the whole setup. There is no database to install — see
[Running without a database](#running-without-a-database).

---

## What it does

|                               |                                                                                                                                                 |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **Real-time**                 | Moves, edits and deletions stream to every client on the board over server-sent events, with presence avatars. No polling, no refresh.          |
| **Optimistic with real undo** | Changes apply instantly and roll back if the server rejects them. Every action raises a toast carrying a genuine compensating write.            |
| **Keyboard-first**            | `Ctrl/Cmd-K` opens a command palette that searches tasks and runs commands. Cards lift and reorder from the keyboard alone.                     |
| **Task detail**               | A side panel with inline editing, subtasks, and a readable history of every change, built from the append-only activity log.                    |
| **Analytics**                 | Status, priority, 14-day throughput and work-ageing, each with a table view. All derived from the board — there is no separate reporting store. |
| **Guided first run**          | Auri, a small ambient guide, watches the board and speaks only when it helps. Always dismissible.                                               |
| **Scales past the demo**      | Columns virtualise above 40 cards; ordering uses fractional indices so a drag writes one row.                                                   |

## Stack

**Frontend** — React 19, TypeScript, Vite, Redux Toolkit + RTK Query, Tailwind
v4, dnd-kit, Recharts, Motion
**Backend** — Node, Hono, Drizzle ORM, PostgreSQL, `jose` for JWTs, scrypt for
password hashing
**Tooling** — Vitest, Testing Library, Playwright, ESLint, Prettier, GitHub Actions

```
apps/
  api/         Hono server, Drizzle schema, migrations
  web/         React app
packages/
  shared/      Domain types, Zod schemas, date and ordering logic
```

The shared package is the point: the task schema, the status and priority
enums, and the date helpers are defined once and consumed by both sides. The
Postgres enum types are generated from the same constants the UI renders, so
adding a status is one edit plus a migration, and the type system points at
every site that needs updating.

---

## Engineering notes

Six things in here were interesting to build.

### Dates that sort

The first version stored due dates as `"dd-MM-yyyy"` strings. Those don't sort
chronologically — `"01-01-2027"` sorts before `"26-08-2026"` — so date sorting,
range filtering and overdue detection were all quietly wrong.

Now every date is an ISO calendar day in storage and in transit, formatted only
at render, in the viewer's locale. Due dates are `date` columns read back as
text, because a timestamp-backed due date lands on the wrong day for anyone west
of UTC. [`dates.test.ts`](packages/shared/src/dates.test.ts) pins the old bug
explicitly so it cannot come back.

### Ordering without renumbering

Cards carry a string `position` and sort lexicographically. Moving a card
computes a key between its new neighbours — one row written, no renumbering, and
two clients dragging different cards produce different keys, so concurrent drags
merge instead of clobbering each other.

The interesting part is proving it holds up: the tests subdivide the same gap
300 times and run 500 randomised inserts, asserting total order and uniqueness
throughout. See [`ordering.ts`](packages/shared/src/ordering.ts).

### Virtualised columns _and_ drag-and-drop

The first version documented this as "considered for large lists but omitted due
to integration issues with drag-and-drop" — the old library needed every
draggable mounted, which is exactly what virtualisation prevents.

dnd-kit tracks items by id rather than by mounted node, so only the visible
window needs to exist. Columns switch to `@tanstack/react-virtual` above 40
cards and stay on a plain list below it, where the list is cheaper and
drag-scrolling is smoother.

### Session security

Access tokens are short-lived JWTs in httpOnly cookies, so an XSS bug cannot
reach them. Refresh tokens are opaque, stored as SHA-256 digests, and rotated on
every use.

Rotation is what makes theft _detectable_: if a token is presented twice, the
second presentation finds it already rotated, and the entire token family is
revoked — logging out the attacker and the real user together. That path is
covered by a test that plays out the whole scenario.

Passwords use scrypt from Node's standard library: memory-hard, no native module
to compile, and the parameters live inside the hash string so they can be raised
later while old hashes still verify. Login verifies against a dummy hash when the
email doesn't exist, so a wrong email and a wrong password take the same time.

### Undo that actually undoes

The first version implemented undo by _delaying_ deletes for five seconds, which
left the board showing a task that was neither present nor gone — and a refresh
in that window resurrected it.

Here the change is applied immediately and undo issues a compensating write.
Deleting and restoring reuses the original task id, so the card returns to its
original position rather than the end of the column. Undo handlers live in a
registry outside Redux, because reducers have to stay serialisable.

### An onboarding engine, not a scripted tour

Auri is a state machine over live board state. Each step declares a predicate;
the engine shows the highest-priority step whose predicate currently holds and
which hasn't been seen or dismissed.

That means guidance tracks what you're actually doing. Create a task and the
"create a task" step stops applying on its own — nothing advances a cursor.
Steps can also recur: the overdue warning speaks up whenever work slips, while
first-run tips appear once. Every dismissal is permanent and persisted.

Replay it any time with `?tour=reset`.

---

## Testing

**260 tests.** 192 unit and integration, 68 end-to-end across desktop and mobile
viewports.

```
npm test          # unit + integration
npm run test:e2e  # Playwright, against the real stack
npm run check     # typecheck, lint, test
```

API tests run against **PGlite** — real PostgreSQL compiled to WebAssembly,
in-process. Every test file gets its own throwaway database with no service
container and nothing to install, and the schema tests assert against
`select version()` to prove it really is Postgres. The usual shortcut,
SQLite-in-tests and Postgres-in-production, hides exactly the bugs that matter:
enum rejection, `on conflict`, transaction semantics, timezone handling.

The end-to-end tests run against the actual Hono server and Vite dev server with
nothing mocked. They caught two real bugs during development: Escape not closing
the command palette, and the sample-data seeder firing twelve sequential
requests and twelve toasts instead of one batch.

CI runs typecheck, lint, tests, a production build and a
[bundle budget](scripts/check-bundle-size.mjs) on every push.

## Performance

First load is **117 KB gzipped** — what a signed-out visitor downloads for the
landing page. The board, charts, drag-and-drop engine and animation library are
all behind dynamic imports:

| Chunk               | Gzipped | When it loads     |
| ------------------- | ------- | ----------------- |
| Entry + CSS         | 117 KB  | Always            |
| Authenticated shell | 71 KB   | After sign-in     |
| Board               | 35 KB   | Opening the board |
| Analytics           | 102 KB  | Opening analytics |

The budget is enforced in CI, so a careless import fails the build rather than
quietly costing every visitor. Auri's idle animations and the landing page
reveals are CSS rather than JavaScript, which keeps the 114 KB animation library
off the first-load path entirely.

## Accessibility

Colour is never the only signal — priority and status always carry a word as
well as a hue. The chart palette was stepped until every adjacent pair clears
colour-vision-deficiency separation, a chroma floor, the mode's lightness band
and 3:1 contrast against the chart surface, verified with a validator rather
than by eye. Every chart has a table view.

The board is fully keyboard-operable, there's a skip link as the first tab stop,
dialogs trap focus and close on Escape, and `prefers-reduced-motion` stops Auri
bobbing.

---

## Running without a database

With `DATABASE_URL` unset the API runs on PGlite, an in-process PostgreSQL, and
prints a warning that data won't survive a restart. That's what makes
`git clone && npm install && npm run dev` work with no setup.

For persistence locally, point `DATABASE_URL` at any Postgres and run
`npm run db:migrate`. The same migrations run against both, because it's the
same engine.

## Deployment

The API needs a `DATABASE_URL` and a `JWT_SECRET`; the web app is static files.

```bash
npm run build
npm run db:migrate --workspace @auralis/api   # or let the server do it on boot
npm start --workspace @auralis/api
```

Migrations also run automatically at startup, so a deploy can't serve traffic
against a schema it wasn't built for. See [`.env.example`](.env.example) for
every variable and what it does.

## Scripts

|                       |                                              |
| --------------------- | -------------------------------------------- |
| `npm run dev`         | API and web app together                     |
| `npm run build`       | Production build of all three packages       |
| `npm test`            | Unit and integration tests                   |
| `npm run test:e2e`    | Playwright                                   |
| `npm run check`       | Typecheck, lint and test                     |
| `npm run db:generate` | Generate a migration from schema changes     |
| `npm run db:migrate`  | Apply pending migrations                     |
| `npm run db:seed`     | Create a demo account with a populated board |

## Known limitations

- **Realtime is single-instance.** The hub fans out in-process, so horizontal
  scaling needs Postgres `LISTEN`/`NOTIFY` or Redis behind the same interface.
  It's deliberately narrow enough that this is a change to one file.
- **One board per user.** The schema supports many, including membership roles;
  the UI only surfaces the first.
- **Dependencies** are modelled and enforced in the API — including cycle
  rejection — but not yet exposed in the interface. Subtasks are.
