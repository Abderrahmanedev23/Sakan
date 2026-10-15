# Deploying a free test version

This puts Sakan online for testing at no cost:

| Part | Service | Free plan (checked October 2026) |
| --- | --- | --- |
| Website (`apps/web`) | Vercel Hobby | Non-commercial use only. |
| API (`apps/api`) | Render free web service | 512 MB RAM, 750 hours a month, sleeps after 15 minutes without traffic, disk wiped on restart. |
| Database (MySQL 8) | Aiven free | 1 GB storage, 1 CPU, 1 GB RAM, no card needed; one free MySQL per account; may be powered off after a long time unused (you get an email first and can power it back on). |
| Redis (draw scheduling) | Upstash free | 256 MB, 500,000 commands a month. |
| CIN scans | Supabase Storage | 1 GB free, no card needed; the project pauses after 7 days without activity. |

Free plans change often. Check each pricing page when you sign up.

## Before you start: what to expect

- **The first visit is slow.** The API sleeps after 15 minutes without visitors and takes about a minute to wake up. The website shows "server not reachable" until it is awake; reload after a minute.
- **Draws run late if the API is asleep.** A draw scheduled for 18:00 runs as soon as the API wakes up, not at 18:00. For tests, open the site a few minutes before draw time. To keep it awake, a free pinger such as cron-job.org can call `https://<your-api>.onrender.com/api/v1/health` every 10 minutes; one service running all month (about 744 hours) fits in the 750 free hours.
- **Not for real users or real money.** Vercel's free plan forbids commercial use, and the free database is small. Move to paid plans before launch.

## 1. Database: Aiven for MySQL

1. Sign up at [aiven.io](https://aiven.io) (no card needed) and create a service: **MySQL**, plan **Free**. If it offers a choice of region, take the one closest to Frankfurt, where the API runs. Name it `sakan`.
2. Wait until the service shows **Running**, then copy the **Service URI** from its **Overview** page. It looks like `mysql://avnadmin:...@sakan-yourname.d.aivencloud.com:12345/defaultdb?ssl-mode=REQUIRED`.
3. Replace the end, `?ssl-mode=REQUIRED`, with `?sslaccept=accept_invalid_certs`. That is the spelling Prisma understands; the connection is still encrypted, but Aiven signs it with its own certificate authority, which this setting does not check. Fine for a test; for launch, pin Aiven's CA certificate.

   ```
   mysql://avnadmin:...@sakan-yourname.d.aivencloud.com:12345/defaultdb?sslaccept=accept_invalid_certs
   ```

4. Keep it for step 4 as `DATABASE_URL`. Sakan's tables go in `defaultdb`; nothing else is needed.

## 2. Redis: Upstash

1. Sign up at [upstash.com](https://upstash.com) and create a **Redis** database named `sakan`, region **eu-central-1 (Frankfurt)**, plan **Free**.
2. On the database page, find the connection URL that starts with `rediss://` (the **TCP** / ioredis one, not the REST URL). It looks like `rediss://default:...@....upstash.io:6379`.
3. Keep it for step 4 as `REDIS_URL`.

## 3. CIN scans: Supabase Storage

Render's free plan wipes its disk on every restart, so CIN scans are kept in a private bucket instead. Only Supabase's file storage is used here; the database stays on Aiven.

1. Sign up at [supabase.com](https://supabase.com) and create a project named `sakan`. Pick the region **Central EU (Frankfurt)**. It asks for a database password; save it somewhere, Sakan does not use it.
2. Open **Storage** and click **New bucket**. Name it `cin-scans` and leave **Public bucket** turned **off**.
3. Still in **Storage**, open its **Settings** (the S3 section, called **S3 Connection** or **S3 Configuration**). Make sure the S3 connection is enabled, then copy the **Endpoint** and **Region** shown there.
4. In the same place, under **Access keys**, click **New access key**. Copy the **Access key ID** and **Secret access key** right away; the secret is shown only once.
5. Keep for step 4:
   - `S3_ENDPOINT` = the endpoint, like `https://abcdefgh.storage.supabase.co/storage/v1/s3`
   - `S3_REGION` = the region, like `eu-central-1`
   - `S3_BUCKET` = `cin-scans`
   - `S3_ACCESS_KEY_ID` = Access key ID
   - `S3_SECRET_ACCESS_KEY` = Secret access key

These keys can read and write every bucket in that Supabase project, so only paste them into Render.

Supabase pauses a free project after 7 days without activity. If that happens, CIN uploads and admin views fail until you click **Restore** on the project in the Supabase dashboard; nothing is deleted.

## 4. API: Render

Create the service by hand. Render's **Blueprint** button can ask for a payment card; a single free web service usually does not.

1. Sign up at [render.com](https://render.com) with your GitHub account.
2. Click **New → Web Service**, connect GitHub if asked, and pick the `Sakan` repository.
3. Fill in the form:

   | Field | Value |
   | --- | --- |
   | Name | `sakan-api` |
   | Language | `Node` |
   | Branch | `main` |
   | Region | `Frankfurt (EU Central)` |
   | Root Directory | leave empty |
   | Build Command | `corepack pnpm install --frozen-lockfile --prod=false && corepack pnpm --filter "@sakan/api..." build` |
   | Start Command | `corepack pnpm --filter @sakan/api start:prod` |
   | Instance Type | **Free** |

4. Under **Environment Variables**, click **Add from .env** and paste this, replacing each `...` with your value from steps 1 to 3:

   ```
   NODE_VERSION=22
   COREPACK_ENABLE_DOWNLOAD_PROMPT=0
   NODE_ENV=production
   TRUST_PROXY=1
   PAYMENT_PROVIDER=stub
   AUTH_SESSION_TTL_DAYS=30
   CORS_ORIGINS=https://sakan.vercel.app
   DATABASE_URL=...
   REDIS_URL=...
   STORAGE_DRIVER=s3
   S3_FORCE_PATH_STYLE=true
   S3_ENDPOINT=...
   S3_REGION=...
   S3_BUCKET=cin-scans
   S3_ACCESS_KEY_ID=...
   S3_SECRET_ACCESS_KEY=...
   ```

   Keep `CORS_ORIGINS` as it is for now; you fix it in step 6 if Vercel gives you another address.
5. Open **Advanced** and set **Health Check Path** to `/api/v1/health`.
6. Click **Deploy Web Service**. The first build takes a few minutes. Each start applies any new database migrations before the server starts.
7. When it shows **Live**, open `https://sakan-api.onrender.com/api/v1/health` (Render shows the real address at the top of the service page). You should see `{"status":"ok",...}`.

Every push to `main` redeploys the API.

If Render still asks for a card even here, stop and tell Claude in the project, and it will switch the API to another free host.

## 5. Website: Vercel

1. Sign up at [vercel.com](https://vercel.com) with your GitHub account.
2. **Add New → Project**, import the `Sakan` repository.
3. Set **Root Directory** to `apps/web`. Leave the build settings as they are; [`apps/web/vercel.json`](../apps/web/vercel.json) sets them.
4. Under **Environment Variables** add `NEXT_PUBLIC_API_URL` = your Render address plus `/api/v1`, e.g. `https://sakan-api.onrender.com/api/v1`.
5. Click **Deploy**. Vercel shows your site address, e.g. `https://sakan.vercel.app`.

Every push to `main` redeploys the website. If you change `NEXT_PUBLIC_API_URL` later, redeploy so the site picks it up.

## 6. Connect the two

If your Vercel address is not exactly `https://sakan.vercel.app`, open the `sakan-api` service on Render, go to **Environment**, set `CORS_ORIGINS` to your Vercel address (no trailing slash) and save. Render restarts the API.

Vercel preview links (one per branch) have other addresses and are blocked by CORS. To try one, add it to `CORS_ORIGINS`, separated by a comma.

## 7. Make yourself admin

1. Sign up on your site.
2. On your computer, in your copy of the repository (after `pnpm install` and `pnpm build`), run the promote script against the Aiven database, with your Aiven URL and your email:

   ```bash
   DATABASE_URL='mysql://avnadmin:...@...aivencloud.com:12345/defaultdb?sslaccept=accept_invalid_certs' \
     pnpm --filter @sakan/api admin:promote you@example.com
   ```

   Or, from any MySQL client connected to Aiven (MySQL Workbench, DBeaver, `mysql`):

   ```sql
   UPDATE `User` SET role = 'ADMIN' WHERE email = 'you@example.com';
   ```

3. Sign out and back in. The admin menu appears.

## If something goes wrong

- **The site says the server is not reachable.** The API is waking up; wait a minute. If it persists, open the API's **Logs** on Render.
- **"blocked by CORS" in the browser console.** `CORS_ORIGINS` on Render must match the site address exactly, with `https://` and no trailing slash.
- **The API fails to start with a database error.** Check that `DATABASE_URL` starts with `mysql://`, ends with `?sslaccept=accept_invalid_certs`, and that the Aiven service is **Running** (power it on from the Aiven console if it was switched off).
- **CIN upload fails.** Check the five `S3_...` values, that the bucket name matches, and that the Supabase project is not paused.
- **Upstash says the command limit is reached.** The API polls Redis gently (about every 5 minutes while idle) to stay under the free limit, but a pinger keeping the API awake all month uses part of it. Check usage on the Upstash dashboard.
