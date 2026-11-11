# Deploying on Prisma Compute (Prisma Composer)

This is the second hosting route for the store, next to Vercel + Supabase (`DEPLOY-VERCEL.md`). Prisma Composer reads `module.ts`, creates a Prisma Postgres database, applies the migrations in `migrations/`, and runs the Next.js app on Prisma Compute.

Prisma ORM 8 is a release candidate and Prisma Composer is in early access. Treat this route as staging until both are stable.

## What is on Prisma 8, and what is not

| Part | State |
|---|---|
| Prisma CLI | `prisma@8.0.0-rc.33`. `prisma generate`, `prisma migrate …` and `prisma db seed` no longer exist. |
| Data contract | `src/prisma/contract.json` and `contract.d.ts`, emitted from `prisma/schema.prisma` (`npm run contract:emit`). Committed. |
| Migrations | `migrations/app/20261111T0227_init`: the whole schema plus the seven integrity checks (stock never negative, refund bounds, and so on). The old SQL migrations in `prisma/migrations/` are removed on this branch. |
| Deploy declaration | `module.ts` (database → service → public URL) and `src/service.ts` (the service's database and settings). |
| Queries | **Still the Prisma 7 client** (`src/generated/prisma`, now committed, with `@prisma/adapter-pg`). It connects with the database URL that Composer hands the service (`src/lib/platform.ts`). The rewrite to the Prisma 8 query API is not done. Prisma's upgrade guide allows this order: replace the CLI first, keep the old client working, rewrite queries afterwards. |

Because the Prisma 7 client is frozen, a schema change needs both a new Prisma 8 migration and matching client code. Finish the query rewrite before the schema changes again.

## One-time setup

1. **Secrets.** In GitHub → the repository → Settings → Secrets and variables → Actions → *Secrets*, add:

   | Secret | Value |
   |---|---|
   | `JWT_SECRET` | 32+ random characters |
   | `MFA_ENCRYPTION_KEY` | exactly 32 random bytes, base64. Never change it: it invalidates every authenticator setup. |
   | `CRON_SECRET` | a random string |
   | `ADMIN_PASSWORD` | 12+ characters. Used once, to create the first admin. |

   The first deploy copies them to Prisma, which keeps its own copy per environment from then on. To change one later use `npx prisma project env update NAME=value --role production`.
   The same thing from the command line, without GitHub secrets: `npx prisma auth login`, then `npx prisma project env add --file <file> --role production` (and `--role preview` for branch previews).

2. **Connect the repository.** Prisma Console → import `Keshav-gehlot/Aranya-Furniture-e-commerce-platform` (this installs the Prisma GitHub App), or run `npx prisma git connect`. The deploy workflow is already in the repository (`.github/workflows/prisma-deploy.yml`), so a setup pull request from Prisma that only adds that file is not needed.

3. **Push.** A push to `main` deploys production. A push to any other branch deploys a preview with its own empty database, which is deleted with the branch.

On its first start the app sees a database with no admin and creates one from `ADMIN_EMAIL` (workflow variable, default `admin@aranya.example`) and `ADMIN_PASSWORD`, plus the settings row and the ten sample products (`src/lib/bootstrap.ts`). Set the variable `SEED_SAMPLE_PRODUCTS` to `false` to skip the samples. After that first start these settings are ignored.

To deploy from a computer instead: `npx prisma auth login`, then `npm run deploy` with the same variables in the shell.

## Settings

Secrets live on Prisma. Everything else is a GitHub Actions *variable*, read on every deploy:

| Variable | Default in the workflow | Meaning |
|---|---|---|
| `DEPLOYMENT_STAGE` | `staging` | Staging banner, `noindex`, and permission for simulated payments. Set to `production` before real trading. |
| `ALLOW_DEMO_PAYMENTS` | `true` | With staging: a **Complete test payment** button when a gateway has no keys. Set to `false` before real trading. |
| `ADMIN_EMAIL` | `admin@aranya.example` | First admin's sign-in address. |
| `SEED_SAMPLE_PRODUCTS` | unset | `false` skips the sample catalogue. |
| `NEXT_PUBLIC_SITE_URL` | unset | The public address, once a custom domain is attached. |

Razorpay, Stripe and Resend keys are not wired into `src/service.ts` yet. Add each as a `secretString()` field there, bind it in `module.ts`, and copy it to `process.env` in `src/lib/platform.ts`.

## Run it locally the way Prisma runs it

```bash
npm run build
npx prisma dev            # no Prisma account needed; prints http://localhost:3000
npx prisma dev stop
```

`prisma dev` reads `JWT_SECRET`, `MFA_ENCRYPTION_KEY`, `CRON_SECRET` and `ADMIN_PASSWORD` from the shell or `.env`. Its stand-in database is a single-session emulator, so the app uses one connection there (`src/lib/platform.ts`); with more, statements from different connections get mixed up. Real Prisma Postgres uses the normal pool.

## Changing the schema

```bash
# edit prisma/schema.prisma
npm run contract:emit
npx prisma migration plan --name <change>     # writes migrations/app/<timestamp>_<change>/
npm run db:migrate                            # applies to DATABASE_URL
```

Commit `src/prisma/` and `migrations/`. Deploys only replay committed migrations.

To put an existing database (for example the Supabase one, built from the old SQL migrations) under Prisma 8: check it with `npx prisma db verify`, then record it as up to date with `npx prisma db sign`.

## What was checked, and what was not

Checked on this branch, on a development machine:

- `npm run typecheck`, and 44 integration tests on a PostgreSQL 16 database built by `prisma db migrate`.
- `next build` with no environment variables set, as GitHub Actions runs it.
- `prisma dev`: database created, migration applied, first-start bootstrap, pages served.
- The production build under **Bun** (what Compute runs), given only the settings Composer provides: 29 browser checks (business purchase, test payment, admin two-step setup, photo upload, every admin page) pass on the emulator and on real PostgreSQL with a pool of 10.

Not checked: an actual deploy to Prisma Compute, the GitHub workflow run, and the app against real Prisma Postgres. Those need a Prisma account.

## Limits to know about

- **Region**: Compute has no India region. `prisma.config.ts` uses `ap-southeast-1` (Singapore).
- **Cold starts**: services sleep when idle; the first request after a quiet period is slower.
- **Unpaid checkouts**: nothing calls `/api/cron/release-reservations` on a schedule here. Checkout releases expired holds itself before reserving stock, so nothing oversells, but stock shown on product pages can lag until the next checkout. Point any external scheduler at that URL with `Authorization: Bearer $CRON_SECRET`, or add Composer's `cron` module (it keeps a service awake permanently).
- **Photos** are stored in the database (`STORAGE_DRIVER=db`, 4 MB each): Compute has no persistent disk.
- **Email, rate limiting**: same as staging on Vercel (`DEPLOY-VERCEL.md`).
- **Docker / AWS**: the `Dockerfile` was updated for the Prisma 8 commands but not rebuilt or run.
