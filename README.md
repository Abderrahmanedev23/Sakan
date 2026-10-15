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

## Getting started

```bash
pnpm install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local

pnpm db:up          # start PostgreSQL and Redis in Docker
pnpm db:migrate     # apply Prisma migrations
pnpm build          # build shared, api and web

pnpm dev:api        # http://localhost:3001/api/v1/health
pnpm dev:web        # http://localhost:3000
```

`pnpm dev` starts the API and web app together. `pnpm --filter @sakan/api test` runs the API unit tests after a build.

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

1. When a session reaches its target it becomes `FULL`. `DrawsService.scheduleDraw` picks the next occurrence of the session's draw time (for example 18:00 Africa/Casablanca the same day, or the next day if it filled after 18:00), moves it to `SCHEDULED` and queues a delayed BullMQ job.
2. At scheduling time a random seed is generated and only its SHA-256 hash is published (commit).
3. At draw time the eligible entries are frozen in sequence order and hashed. Winners come from `HMAC-SHA256(seed, entriesHash)` with rejection sampling, so the result is unbiased and reproducible.
4. The seed is revealed after the draw, so anyone can recompute the winner from the published entry list.

Running a draw twice is safe: only one run can claim a `SCHEDULED` draw, and everything happens in one database transaction with an audit record.

## Payments

`apps/api/src/payments/payment-provider.ts` defines the provider interface (checkout, signed callback verification, refund). Only a development stub is wired in today; a real Moroccan provider such as CMI plugs in behind the same interface.

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

To create the first admin, sign up normally, then run:

```bash
pnpm --filter @sakan/api build
pnpm --filter @sakan/api admin:promote you@example.com
```

## Deploying

[`docs/DEPLOY.md`](docs/DEPLOY.md) walks through a free test deployment: web on Vercel, API on Render, PostgreSQL on Neon, Redis on Upstash and CIN scans on Backblaze B2.

## Not built yet

Payment checkout and callbacks, session management and draw screens in the admin dashboard, password reset and email or phone verification. Paid draws may require authorisation in Morocco; check the legal requirements before launch.
