# Deploying a free test version

This puts Sakan online for testing at no cost:

| Part | Service | Free plan (checked October 2026) |
| --- | --- | --- |
| Website (`apps/web`) | Vercel Hobby | Non-commercial use only. |
| API (`apps/api`) | Render free web service | 512 MB RAM, 750 hours a month, sleeps after 15 minutes without traffic, disk wiped on restart. |
| Database | Neon free | 0.5 GB storage, 100 compute hours a month, pauses after 5 idle minutes. |
| Redis (draw scheduling) | Upstash free | 256 MB, 500,000 commands a month. |
| CIN scans | Backblaze B2 | 10 GB free, no card needed. |

Free plans change often. Check each pricing page when you sign up.

## Before you start: what to expect

- **The first visit is slow.** The API sleeps after 15 minutes without visitors and takes about a minute to wake up. The website shows "server not reachable" until it is awake; reload after a minute.
- **Draws run late if the API is asleep.** A draw scheduled for 18:00 runs as soon as the API wakes up, not at 18:00. For tests, open the site a few minutes before draw time. To keep it awake, a free pinger such as cron-job.org can call `https://<your-api>.onrender.com/api/v1/health` every 10 minutes; one service running all month (about 744 hours) fits in the 750 free hours.
- **Not for real users or real money.** Vercel's free plan forbids commercial use, and the free database is small. Move to paid plans before launch.

## 1. Database: Neon

1. Sign up at [neon.com](https://neon.com) and create a project named `sakan`. Pick the region **AWS Europe Central (Frankfurt)**.
2. On the project dashboard click **Connect**. Turn **Connection pooling off**, then copy the connection string. It looks like `postgresql://neondb_owner:...@ep-....eu-central-1.aws.neon.tech/neondb?sslmode=require`.
3. Keep it for step 4 as `DATABASE_URL`.

## 2. Redis: Upstash

1. Sign up at [upstash.com](https://upstash.com) and create a **Redis** database named `sakan`, region **eu-central-1 (Frankfurt)**, plan **Free**.
2. On the database page, find the connection URL that starts with `rediss://` (the **TCP** / ioredis one, not the REST URL). It looks like `rediss://default:...@....upstash.io:6379`.
3. Keep it for step 4 as `REDIS_URL`.

## 3. CIN scans: Backblaze B2

Render's free plan wipes its disk on every restart, so CIN scans are kept in a private bucket instead.

1. Sign up at [backblaze.com](https://www.backblaze.com/sign-up/cloud-storage). Choose the **EU Central** region if it asks.
2. **Buckets → Create a Bucket.** Name it something unique, like `sakan-cin-yourname`. Set **Files in Bucket** to **Private**. Leave encryption on if offered.
3. Copy the bucket's **Endpoint**, for example `s3.eu-central-003.backblazeb2.com`. The region is the part after `s3.`, here `eu-central-003`.
4. **Application Keys → Add a New Application Key.** Allow access to that bucket only, with **Read and Write**. Copy the **keyID** and **applicationKey** right away; the second one is shown only once.
5. Keep for step 4:
   - `S3_ENDPOINT` = `https://` + the endpoint, e.g. `https://s3.eu-central-003.backblazeb2.com`
   - `S3_REGION` = the region, e.g. `eu-central-003`
   - `S3_BUCKET` = the bucket name
   - `S3_ACCESS_KEY_ID` = keyID
   - `S3_SECRET_ACCESS_KEY` = applicationKey

Cloudflare R2 works the same way if you prefer it (endpoint `https://<account-id>.r2.cloudflarestorage.com`, region `auto`), but it asks for a payment card.

## 4. API: Render

1. Sign up at [render.com](https://render.com) with your GitHub account.
2. Click **New → Blueprint** and pick the `Sakan` repository. Render reads [`render.yaml`](../render.yaml) and proposes one free web service, `sakan-api`.
3. It asks for the values marked secret. Paste:
   - `DATABASE_URL` from step 1
   - `REDIS_URL` from step 2
   - `CORS_ORIGINS`: `https://sakan.vercel.app` for now. You fix it in step 6 if Vercel gives you another address.
   - the five `S3_...` values from step 3
4. Click **Apply**. The first build takes a few minutes. Each start applies any new database migrations before the server starts.
5. When it shows **Live**, open `https://sakan-api.onrender.com/api/v1/health` (Render shows the real address at the top of the service page). You should see `{"status":"ok",...}`.

Every push to `main` redeploys the API.

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
2. In Neon, open **SQL Editor** and run, with your email:

   ```sql
   UPDATE "User" SET role = 'ADMIN' WHERE email = 'you@example.com';
   ```

3. Sign out and back in. The admin menu appears.

## If something goes wrong

- **The site says the server is not reachable.** The API is waking up; wait a minute. If it persists, open the API's **Logs** on Render.
- **"blocked by CORS" in the browser console.** `CORS_ORIGINS` on Render must match the site address exactly, with `https://` and no trailing slash.
- **The Render build fails on the database.** Check that `DATABASE_URL` is the Neon string with pooling **off**.
- **CIN upload fails.** Check the five `S3_...` values and that the B2 key can read and write that bucket.
- **Upstash says the command limit is reached.** The API polls Redis gently (about every 5 minutes while idle) to stay under the free limit, but a pinger keeping the API awake all month uses part of it. Check usage on the Upstash dashboard.
