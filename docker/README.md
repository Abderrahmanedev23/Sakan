# Run Sakan with Docker only

You only need Docker (Docker Desktop on Windows and macOS) and the file [`docker-compose.yml`](docker-compose.yml) from this folder. No source code, no Node.js, no build.

```bash
mkdir sakan && cd sakan
curl -O https://raw.githubusercontent.com/Abderrahmanedev23/Sakan/main/docker/docker-compose.yml
docker compose up -d
```

Open http://localhost:3000. The first start downloads the images, creates the MySQL database, applies the migrations and loads the demo data, which takes a minute; `docker compose logs -f api` shows the progress.

| Account | Password | What it is |
| --- | --- | --- |
| `admin@sakan.ma` | `SakanAdmin2026!` | Admin: sessions, identity reviews, payments, audit log (`/admin`). |
| `demo@sakan.ma` | `SakanDemo2026!` | Approved participant with no entries yet. |
| `pending@sakan.ma` | `SakanDemo2026!` | Identity waiting for review. |
| `new@sakan.ma` | `SakanDemo2026!` | Has not sent a CIN yet. |
| `participant01@sakan.ma` … `participant40@sakan.ma` | `SakanDemo2026!` | Approved participants who own the seeded entries. |

To see a draw happen: sign in as `demo@sakan.ma`, open **Session démo rapide**, buy the last entry and confirm the simulated payment. The draw runs two minutes later.

## Everyday commands

| Command | What it does |
| --- | --- |
| `docker compose up -d` | Start (data is kept between starts). |
| `docker compose down` | Stop. |
| `docker compose pull && docker compose up -d` | Update to the latest images. |
| `docker compose down -v` | Stop and delete everything: database, Redis and uploaded CIN scans. The next start seeds the demo data again. |
| `docker compose logs -f api` | Follow the API logs. |

What runs: `web` (the site, the only open port), `api`, `mysql` and `redis`. The database, Redis and the uploaded CIN scans live in Docker volumes.

## Settings

Put any of these in a `.env` file next to `docker-compose.yml`:

| Variable | Default | Use |
| --- | --- | --- |
| `SAKAN_PORT` | `3000` | Port of the site on your machine. |
| `SAKAN_WEB_URL` | `http://localhost:3000` | Address the payment page returns to. Set it if you change the port or open the site from another device, e.g. `http://192.168.1.20:3000`. |
| `SAKAN_SEED_DEMO_DATA` | `true` | `false` starts with an empty database (create an admin with the command below). |

To make an account an admin: `docker compose exec api node dist/scripts/promote-admin.js you@example.com`.

## If `docker compose up` says "denied" or "unauthorized"

The images are published to GitHub Container Registry by the [Docker images workflow](../.github/workflows/docker-images.yml) on every push to `main`. GitHub makes new packages private. Either:

- **Make them public (once):** on GitHub, open your profile, **Packages**, then `sakan-api`, **Package settings**, **Change visibility**, **Public**. Do the same for `sakan-web`.
- **Or sign in:** create a token at GitHub, **Settings**, **Developer settings**, **Personal access tokens (classic)**, with the `read:packages` scope, then run `docker login ghcr.io -u Abderrahmanedev23` and paste the token as the password.

This setup is for trying Sakan locally. Its passwords are fixed in the compose file and payments are simulated, so do not expose it to the internet as is.
