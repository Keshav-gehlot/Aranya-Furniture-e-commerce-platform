# Staging on Vercel + Supabase

A public staging copy of the store. Production is still planned for AWS (see `DEPLOYMENT.md`).

| | |
|---|---|
| App | Vercel project `aranya-furniture` (team `keshav-gehlots-projects`), functions in `bom1` (Mumbai) |
| Database | Supabase project `aranya-furniture`, PostgreSQL 17, `ap-south-1` |
| Source | GitHub `Keshav-gehlot/Aranya-Furniture-e-commerce-platform`, branch `main`. A push to `main` deploys. |

## What makes it "staging"

`DEPLOYMENT_STAGE=staging` does three things:

1. A banner on every page says products, prices and contact details are samples and payments are simulated.
2. `robots.txt` blocks all crawlers and every page is `noindex`.
3. With `ALLOW_DEMO_PAYMENTS=true` as well, checkout offers a **Complete test payment** button when a gateway has no keys. No money moves. As soon as Razorpay or Stripe keys are set, that gateway is used instead.

A real production environment must not set `DEPLOYMENT_STAGE=staging`. Without it, simulated payments cannot be switched on (`src/lib/payments.ts`, covered by `tests/staging.test.ts`).

## Environment variables (Vercel → Project → Settings → Environment Variables)

| Name | Value on staging |
|---|---|
| `DATABASE_URL` | Supabase transaction pooler, port 6543, user `aranya_app.<project-ref>` |
| `DATABASE_SSL` | `require` (encrypted, certificate not verified). To verify, set `true` and put Supabase's CA certificate (Dashboard → Database → Settings → SSL) in `DATABASE_CA_CERT`. |
| `DATABASE_POOL_MAX` | `3` |
| `JWT_SECRET`, `MFA_ENCRYPTION_KEY`, `CRON_SECRET` | random, generated at setup. Never change `MFA_ENCRYPTION_KEY`: it invalidates every authenticator setup. |
| `DEPLOYMENT_STAGE` | `staging` |
| `ALLOW_DEMO_PAYMENTS` | `true` |
| `STORAGE_DRIVER` | `db` (product photos are stored in the `StoredImage` table; Vercel has no writable disk) |
| `NEXT_PUBLIC_SITE_URL` | optional. Defaults to the project's production domain. Set it when a custom domain is added. |

To take real test payments, add `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` (test-mode keys), point the gateways' webhooks at `/api/payments/razorpay/webhook` and `/api/payments/stripe/webhook`, then redeploy.

## Database

- The schema in `prisma/migrations/` was applied through the Supabase SQL tools, not `prisma migrate deploy`. Before the first `prisma migrate deploy` against this database, mark both migrations as applied:
  `npx prisma migrate resolve --applied 20261017000000_init` and `--applied 20261110000000_stored_images`.
- The app connects as its own role, `aranya_app`, which owns the tables. It does not use the Supabase Data API.
- Every table has row level security on with no policies, and `anon` / `authenticated` have no grants. So the project's public API key cannot read or write anything.
- The free plan pauses a project after about a week without traffic. Restore it from the Supabase dashboard.

## Limits to know about

- **Photos**: 4 MB per image on staging (Vercel caps request bodies at 4.5 MB). Move to S3 or Supabase Storage when the catalogue grows.
- **Unpaid checkouts**: the clean-up job runs once a day on Vercel's free plan (`vercel.json`). Checkout also releases expired holds itself before reserving stock.
- **Email**: no `RESEND_API_KEY` is set, so order, enquiry and staff-invite emails are not sent. Invite links are shown in the admin panel.
- **Rate limiting**: sign-in locks an account after repeated failures, but there is no per-IP limit on staging. AWS production uses WAF rate rules.
- **Vercel Hobby** is for non-commercial use. Move to a paid plan or AWS before the client trades on it.
