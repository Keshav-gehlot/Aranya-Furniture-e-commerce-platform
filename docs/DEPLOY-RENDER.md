# Staging on Render

The store and its PostgreSQL database on Render, described by `render.yaml` (a Render Blueprint). Both run in Singapore, Render's closest region to India.

| | |
|---|---|
| Web service | `aranya-furniture-rcas`, Node 22, free plan: https://aranya-furniture-rcas.onrender.com |
| Database | `aranya-db-rcas`, PostgreSQL 17, free plan, reachable only from the web service |
| Blueprint | `aranya-furniture` (Render adds the `-rcas` suffix to the resources it creates) |
| Source | branch `prisma-compute`; a push to it redeploys |

## How a deploy runs

1. Build: `npm ci --include=dev && npm run build`.
2. Start: `npm run start:render`, which applies any new migrations from `migrations/` (`prisma db migrate`) and then runs `next start`.
3. First start only: the database has no admin, so the app creates one from `ADMIN_EMAIL` and `ADMIN_PASSWORD`, plus the settings row and the ten sample products (`src/lib/bootstrap.ts`).

## Signing in as admin

- Address: `admin@aranya.example` (`ADMIN_EMAIL`).
- Password: Render generated it. Read it in Render → `aranya-furniture-rcas` → Environment → `ADMIN_PASSWORD`.
- The first sign-in asks you to set up two-step sign-in with an authenticator app.

Changing `ADMIN_PASSWORD` later does not change the account's password; it is only read when the database has no admin.

## Settings

Render generated `JWT_SECRET`, `MFA_ENCRYPTION_KEY`, `CRON_SECRET` and `ADMIN_PASSWORD` once, and keeps them. Never change `MFA_ENCRYPTION_KEY`: it invalidates every authenticator setup.

`DEPLOYMENT_STAGE=staging` and `ALLOW_DEMO_PAYMENTS=true` give the staging banner, `noindex`, and a **Complete test payment** button. Before real trading set `DEPLOYMENT_STAGE=production` and `ALLOW_DEMO_PAYMENTS=false`, and add the Razorpay and Stripe keys (`.env.example` lists them) in the service's Environment page.

## Limits of the free plan

- **The free database expires 30 days after it is created.** It then stops working, and Render deletes it 14 days later unless it is upgraded to a paid plan (from about $6 a month). Upgrade it in Render → the database → or change `plan:` in `render.yaml`. The free plan has no backups, and a workspace can have only one free database.
- **The free web service sleeps after 15 minutes without traffic.** The next visit takes about a minute to wake it. All free services in the workspace share 750 running hours a month.
- **Photos** are stored in the database (4 MB each): free services have no persistent disk.
- **Unpaid checkouts**: nothing calls `/api/cron/release-reservations` on a schedule (Render cron jobs are paid). Checkout releases expired holds itself before reserving stock, so nothing oversells.
- **Email**: no `RESEND_API_KEY` is set, so order, enquiry and staff-invite emails are not sent. Invite links are shown in the admin panel.
- **Rate limiting**: sign-in locks an account after repeated failures, but there is no per-IP limit.

## What was checked

The same build and start commands, with secrets in the format Render generates, on a local PostgreSQL: the 29 browser checks pass (business purchase, test payment, admin two-step setup, photo upload, every admin page).
