# Sakan

Community-based draw platform: identity-verified participants, configurable draw sessions, payments and auditable random winner selection.

## Layout

```
apps/
  api/        NestJS REST API (/api/v1), Prisma + PostgreSQL, BullMQ + Redis for scheduled draws
  web/        Next.js public site and admin dashboard
packages/
  shared/     TypeScript types and enums shared by the API, web and (later) mobile apps
docker-compose.yml   PostgreSQL 16 and Redis 7 for local development
```

The API is the single source of business rules. The web app (and the future React Native app) only talk to it over HTTP, and routes are versioned under `/api/v1` so mobile clients can pin a version.

## Requirements

- Node.js 22.12+ (`.nvmrc`)
- pnpm 10 (`corepack enable`)
- Docker, or a local PostgreSQL 16 and Redis 7

## Run it locally

```bash
corepack enable                 # once, gives you pnpm 10
pnpm install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local

pnpm db:up          # PostgreSQL and Redis in Docker (docker compose)
pnpm db:migrate     # apply the Prisma migrations
pnpm build          # build shared, api and web (also generates the Prisma client)
pnpm db:seed        # demo accounts and sessions (pnpm db:reset wipes and seeds again)

pnpm dev            # API on http://localhost:3001/api/v1, web on http://localhost:3000
```

The seed prints the demo accounts:

| Account | Password | What it is |
| --- | --- | --- |
| `admin@sakan.ma` | `SakanAdmin2026!` | Admin: sessions, identity reviews, payments, audit log. |
| `demo@sakan.ma` | `SakanDemo2026!` | Approved participant with no entries yet. |
| `pending@sakan.ma` | `SakanDemo2026!` | Identity waiting for review (placeholder CIN images). |
| `new@sakan.ma` | `SakanDemo2026!` | New account that has not sent its CIN yet. |
| `participant01@sakan.ma` … `participant40@sakan.ma` | `SakanDemo2026!` | Approved participants who own the seeded entries. |

and five sessions: a completed draw you can verify, a scheduled draw with its countdown, the 3,000 × 100 MAD example from the spec, a draft, and **Session démo rapide**, which misses a single entry. Sign in as `demo@sakan.ma`, buy that last entry, confirm the simulated payment, and the session fills, its draw is scheduled two minutes later and runs on its own.

`pnpm dev:api` and `pnpm dev:web` start each app alone. `pnpm --filter @sakan/api test` runs the API unit tests after a build. `docker compose down` stops the databases.

## Data model

The schema lives in [`apps/api/prisma/schema.prisma`](apps/api/prisma/schema.prisma):

| Model | Purpose |
| --- | --- |
| `User` | Account, role, account status (`ACTIVE` / `SUSPENDED`), CIN details and verification status (`UNSUBMITTED → PENDING → APPROVED / REJECTED`, and `REJECTED → PENDING` on resubmission). |
| `AuthSession` | One signed-in device: hashed bearer token, expiry, revocation. |
| `IdentityDocument` | CIN scans. Only the private storage key is stored, never the file. |
| `VerificationReview` | Append-only history of admin approve / reject decisions. |
| `DrawSession` | Price, target entries, draw time of day and timezone, status `DRAFT → OPEN ⇄ PAUSED → FULL → SCHEDULED → COMPLETED`, or `CANCELLED`. |
| `Payment` | Unique reference, idempotency key, and a unique `(provider, providerTransactionId)` so a callback is never processed twice. |
| `Entry` | One participation, created from exactly one succeeded payment, with a per-session sequence number. |
| `Draw` / `DrawWinner` | The single official draw of a session and its winners. |
| `AuditLog` | Append-only record of important operations. |

Money is stored in centimes (`100 MAD = 10000`).

## How a draw works

1. When a session reaches its target it becomes `FULL`. `DrawsService.scheduleDraw` picks the next occurrence of the session's draw time (for example 18:00 Africa/Casablanca the same day, or the next day if it filled after 18:00), or the fixed delay if the session has one, moves it to `SCHEDULED` and queues a delayed BullMQ job.
2. At scheduling time a random seed is generated and only its SHA-256 hash is published (commit).
3. At draw time the eligible entries are frozen in sequence order and hashed. Winners come from `HMAC-SHA256(seed, entriesHash)` with rejection sampling, so the result is unbiased and reproducible.
4. The seed is revealed after the draw, so anyone can recompute the winner from the published entry list. The session page does it in the browser with Web Crypto (`apps/web/src/lib/verify-draw.ts`).

Running a draw twice is safe: only one run can claim a `SCHEDULED` draw, and everything happens in one database transaction with an audit record.

## Sessions, entries and payments

An admin creates a session as a `DRAFT` (price, target, number of winners, optional per-person limit, draw time of day and time zone, or a fixed delay in minutes, optional opening and closing times, and whether the target may be exceeded), then opens it. Price, target and draw rules are frozen once it is open; only the name, description and closing time can change.

Buying an entry:

1. `POST /sessions/:id/checkout` with an `Idempotency-Key` header (a UUID made when the user taps "Buy"). Only approved users can buy. The payment holds a place for 15 minutes, so the target can't be oversold while people are paying; a retry with the same key returns the same payment.
2. The response's `redirectUrl` sends the user to the payment provider. The provider confirms by signed webhook (`POST /payments/callback/:provider`).
3. On success, in one transaction that locks the session row: the payment becomes `SUCCEEDED`, an entry with a public reference (`SKN-0004-000010`) is created, and the counter goes up. The entry that reaches the target makes the session `FULL` and schedules the draw. A success for a session that can no longer take it (cancelled, already full) is refunded automatically.
4. A callback received twice is ignored the second time. Unfinished payments expire and free their place.

Only a development stub provider exists (`apps/api/src/payments/stub-payment.provider.ts`): it sends the user to the web app's payment page, which shows "Confirm" and "Decline" buttons and goes through the same signed-callback path. A real Moroccan provider such as CMI plugs in behind the `PaymentProvider` interface in `payment-provider.ts`.

Admins can pause and resume a session, close it early (draw with the entries so far), cancel it (every paid entry is refunded and voided), refund a single entry while the session is still open, and retry a draw that failed. Every one of these is written to the audit log. Once a minute the API also releases expired payment holds, pauses sessions whose closing time passed without filling, and re-queues draws a restart left behind.

| Endpoint | Who | What |
| --- | --- | --- |
| `GET /sessions?status=active\|completed\|all` | anyone | Public sessions with progress, draw time and, once drawn, the winners (masked names), seed and hashes. |
| `GET /sessions/:id`, `GET /sessions/:id/draw/entries` | anyone | One session; the ordered entry references used by its completed draw. |
| `POST /sessions/:id/checkout` | approved user | Start buying one entry. Needs `Idempotency-Key`. |
| `GET /payments/:reference` | owner | Payment status and entry reference. |
| `POST /payments/:reference/stub-complete` | owner | Stub provider only: `{ succeeded: true\|false }`. |
| `POST /payments/callback/:provider` | provider | Signed webhook. |
| `GET /me/participations` | signed in | Own entries (with wins) and payment history. |
| `GET /admin/stats` | admin | Dashboard counters. |
| `GET/POST /admin/sessions`, `GET/PATCH /admin/sessions/:id` | admin | List, create, read, edit. |
| `POST /admin/sessions/:id/open\|pause\|resume\|close\|draw/retry` | admin | Status changes. |
| `POST /admin/sessions/:id/cancel` | admin | `{ reason }`. Cancels and refunds. |
| `GET /admin/sessions/:id/entries` | admin | Entries with their owners. |
| `GET /admin/payments`, `POST /admin/payments/:id/refund` | admin | Payments by status, session or reference; refund with `{ reason }`. |
| `GET /admin/audit-logs` | admin | Audit log filtered by `entityType`, `entityId` or `action` prefix. |

## Web app

Arabic (right to left, default) and French, switched from the top bar. Public pages: home with live sessions, session page with progress refreshing every 10 seconds, countdown to the draw, buy button and the draw proof with a "verify it yourself" button that recomputes the winner in the browser; results history; payment page; "My entries" with entry and payment history. Admin pages under `/admin`: sessions dashboard with counters, session creation and editing, session actions and entry list, identity reviews, payments with refunds, and the audit log.

## Accounts and identity verification

Clients send `Authorization: Bearer <token>`, which works the same for the web app and a mobile app. Tokens are random, only their SHA-256 is stored (`AuthSession`), and they are checked on every request, so logout and suspension take effect immediately. Every route is private unless marked `@Public()`; admin routes use `@Roles('ADMIN')`.

| Endpoint | Who | What |
| --- | --- | --- |
| `POST /auth/register`, `POST /auth/login` | anyone | Returns `{ token, expiresAt, user }`. Rate limited per IP. |
| `POST /auth/logout` | signed in | Revokes the current token. |
| `GET /me` | signed in | Own profile, verification status and rejection reason. |
| `PUT /me/identity` | signed in | `multipart/form-data`: `firstName`, `lastName`, `dateOfBirth`, `cinNumber`, `cinExpiresAt` (dates as `YYYY-MM-DD`) and image files `front` and `back`. Moves the account to `PENDING`. |
| `GET /admin/users?verificationStatus=PENDING` | admin | Review queue, oldest first. Also filters by `accountStatus`, searches with `q`, pages with `cursor`. |
| `GET /admin/users/:id` | admin | Details, current CIN scans, review history and audit log. |
| `POST /admin/users/:id/verification/approve` / `reject` | admin | `reject` needs `{ reason }`, which the user sees. |
| `POST /admin/users/:id/suspend` / `reactivate` | admin | Suspension needs `{ reason }` and signs the user out everywhere. |
| `GET /admin/identity-documents/:id/file` | admin | Streams a CIN scan. Every view is audit logged. |

CIN scans are checked by their content (JPEG, PNG or WebP, 5 MB max) and stored privately and never served statically: in `PRIVATE_STORAGE_DIR` by default, or in a private S3-compatible bucket with `STORAGE_DRIVER=s3` (see `apps/api/.env.example`). A resubmission after a rejection keeps the old scans, marked superseded. The validation rules (CIN format, age 18+, unexpired card, Moroccan phone numbers) live in `packages/shared` so the web and mobile forms match the API.

The seed creates an admin. To make another account an admin, sign up normally, then run:

```bash
pnpm --filter @sakan/api build
pnpm --filter @sakan/api admin:promote you@example.com
```

## Deploying

[`docs/DEPLOY.md`](docs/DEPLOY.md) walks through a free test deployment: web on Vercel, API on Render, PostgreSQL on Neon, Redis on Upstash and CIN scans on Supabase Storage.

## Not built yet

A real payment provider (CMI or similar), password reset, email or phone verification, and notifications to winners. Paid draws may require authorisation in Morocco; check the legal requirements before launch.
