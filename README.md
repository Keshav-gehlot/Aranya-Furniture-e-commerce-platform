# Aranya Furniture — Storefront, Admin & Payments

Production e-commerce platform for a furniture business that sells domestically (INR) and exports (USD).

| Area | What's included |
|---|---|
| Storefront | Catalogue with categories/subcategories, search, product pages, cart, checkout, customer accounts |
| Business buying | Wholesale price on every product with a per-product minimum quantity (default 10), enforced on the server |
| Payments | Razorpay (INR) and Stripe (USD): server-calculated totals, verified signatures and webhooks, idempotent processing, stock holds, refunds |
| Admin | Dashboard, products, categories, inventory with full history, orders with activity timeline, customers, enquiries with notes, settings, staff & access, audit log |
| Security | Invite-only staff, TOTP two-step sign-in for every staff account, per-module permissions, instant revocation, audit log, WAF, private database |
| AWS | Terraform for ECS Fargate + ALB + RDS PostgreSQL + S3/CloudFront + WAF + Secrets Manager + CloudWatch; GitHub Actions deploys |

**Stack:** Next.js 15 · React 19 · TypeScript · PostgreSQL 17 · Prisma (8 CLI, contract and migrations; queries still on the 7 client, see [docs/DEPLOY-PRISMA.md](docs/DEPLOY-PRISMA.md)) · Tailwind CSS · Terraform · GitHub Actions

## Run it locally (Windows, macOS, Linux)

Needs Node.js 20 or 22. No Docker or PostgreSQL install required.

```bash
copy .env.example .env        # macOS/Linux: cp .env.example .env — then fill in the three secrets
npm install
npm run db:local              # terminal 1: starts PostgreSQL on port 5433 (leave it running)
npm run setup                 # terminal 2: applies migrations, creates the admin and sample products
npm run dev                   # http://localhost:3000
```

Sign in at `/login` with `ADMIN_EMAIL` / `ADMIN_PASSWORD`. You'll be asked to set up two-step sign-in with an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password, Authy) before the admin panel opens.

Locally, without payment keys, checkout shows a **Complete demo payment** button. Production builds never show it.

## Checks

```bash
npm run typecheck
npm test                      # 44 integration tests against real PostgreSQL (TEST_DATABASE_URL)
npx next build && E2E_DATABASE_URL=postgresql://app:app@127.0.0.1:5433/furniture npm run test:e2e   # 31 browser checks
```

## Documentation

- [docs/DEPLOY-PRISMA.md](docs/DEPLOY-PRISMA.md): deploying on Prisma Compute with Prisma Composer, what is on Prisma 8 and what is not
- [docs/DEPLOY-RENDER.md](docs/DEPLOY-RENDER.md): staging on Render (`render.yaml`)
- [docs/DEPLOY-VERCEL.md](docs/DEPLOY-VERCEL.md): staging on Vercel + Supabase
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md): AWS hosting decision, first deployment, payments, DNS, rollback, backup and restore
- [docs/SECURITY.md](docs/SECURITY.md): roles and permissions, sign-in and MFA, how payments are protected, security checklist
- [docs/OPERATIONS.md](docs/OPERATIONS.md): day-to-day runbook (staff leaving, lost phone, refunds, stuck orders, alarms)
- [docs/TEST-REPORT.md](docs/TEST-REPORT.md): what was verified, and what still needs doing on real AWS and payment accounts

## Rebrand

Business name, contact details and WhatsApp number: `src/config/site.ts`. Colours: `tailwind.config.ts`. GST, shipping, default business minimum and checkout hold time: **Admin → Settings**.

## Project map

```
src/app/(store)/           storefront pages
src/app/admin/(panel)/     admin modules (every page calls requirePermission)
src/app/admin/(auth)/      MFA setup, re-confirm, no-access pages
src/app/actions/           server actions (admin.ts and admin-settings.ts are permission-checked; a test enforces it)
src/app/api/               checkout, payment verification, webhooks, uploads, health, scheduled job
src/lib/auth.ts            sessions, requireStaff / requirePermission / requireRecentMfa
src/lib/permissions.ts     roles and module permissions
src/lib/checkout.ts        order creation, stock holds, payment start
src/lib/orders.ts          payment confirmation, expiry, refunds, allowed status changes
prisma/                    schema (source of the data contract), seed
migrations/                Prisma 8 migrations, applied with `npm run db:migrate` and on every deploy
module.ts, src/service.ts  Prisma Composer declaration: database, service, public URL
src/prisma/                emitted data contract (committed)
src/generated/prisma/      Prisma 7 query client (committed; the Prisma 8 CLI cannot regenerate it)
infra/terraform/           AWS infrastructure
.github/workflows/         CI and deploy pipelines
tests/                     integration and end-to-end tests
```

## Design system

The storefront and admin panel are built on the Aranya design system: tokens and component classes in `src/app/globals.css`, mapped into Tailwind in `tailwind.config.ts`. Fonts (Anek Latin, IBM Plex Sans, IBM Plex Mono) are self-hosted from npm packages. Until the client's photography exists, every image slot is a labelled placeholder that names the crop and the shot it needs (`src/components/placeholder.tsx`); upload real photos in Admin → Products.

## Staging site

See `docs/DEPLOY-VERCEL.md` (Vercel + Supabase) and `SECURITY_AUDIT.md`.
