# Security audit – Aranya Furniture store

**Score: 17/20 closed** (FIXED + OK + N/A) · 11 November 2026
Stack: Next.js 15 (App Router, server actions), Prisma 7 + PostgreSQL (Supabase on staging, RDS planned), own session auth (JWT cookie + TOTP), Razorpay + Stripe, Vercel staging.

How each line was checked is stated. "Run" means a test or request was executed in this audit; "read" means the code was read only. The October hardening notes in `docs/SECURITY.md` still apply and were not re-audited line by line.

## Fix these first

1. **No per-IP rate limit on the staging host (#4).** Someone could flood the enquiry form or try many sign-ins across accounts. Sign-in locks an account after repeated failures, and the enquiry form has a honeypot, but nothing limits requests per IP on Vercel. Next step: add a Vercel Firewall rate rule for `/login`, `/register`, `/contact`, `/api/checkout`, or keep the WAF rules in `infra/` when moving to AWS.
2. **No CAPTCHA on public forms (#11).** Registration and enquiries rely on the honeypot only. Next step: add Cloudflare Turnstile and verify the token in `src/app/actions/enquiry.ts` and `registerAction`.
3. **Two dependency advisories need major upgrades (#15).** `zod` 3 (memory use on oversized collections; inputs here are length-capped) and the `postcss` copy bundled inside Next 15 (build-time only, processes our own CSS). Next step: plan the zod 4 and Next 16 upgrades.

## Scoreboard

| # | Check | Status | Evidence / change |
|---|-------|--------|-------------------|
| 1 | Row level security | FIXED | Supabase: RLS enabled on all 15 tables, no policies, no grants for `anon`/`authenticated`; the app's own role `aranya_app` owns the tables. Run: Supabase security advisor reports only the informational "RLS enabled, no policy"; query shows 15/15 tables locked and 0 API grants. |
| 2 | Auth on every route | OK | Run: `tests/authz-coverage.test.ts` (every admin action, page and API route checks permission first). Run: signed-out request to `/admin` and to another user's order redirects to sign-in. |
| 3 | Never trust the frontend | OK | Run: `tests/payments.test.ts` (totals recomputed on the server, minimum quantity and stock enforced in `src/lib/checkout.ts`). Public registration can only create `CUSTOMER` accounts (authz-coverage test). |
| 4 | Rate limiting | OPEN | Account lockout after repeated failed sign-ins (`src/app/actions/auth.ts:44-52`, read). No per-IP limit on Vercel. See "Fix these first". |
| 5 | Sanitize input | OK | One `dangerouslySetInnerHTML`, for product JSON-LD, with `<` escaped (`products/[slug]/page.tsx`). No shell calls. Zod schemas on actions (read). |
| 6 | Parameterized queries | OK | All raw SQL uses Prisma tagged templates, including the new image storage (`src/lib/storage.ts`). No `queryRawUnsafe` (scan). |
| 7 | CORS | OK | No CORS headers are set anywhere (scan), so browsers allow same-origin only. State-changing API routes also check `isSameOrigin` (8 uses). |
| 8 | HTTPS | OK | HSTS header in `next.config.mjs`; session cookie `httpOnly`, `sameSite=lax`, `secure` in production (`src/lib/session.ts:58-60`). Vercel serves HTTPS only. Database connection is TLS; on staging the certificate is not verified (`DATABASE_SSL=require`), see "Needs you". |
| 9 | IDOR | OK | Order page returns 404 unless `order.userId === user.id` (`orders/[id]/page.tsx:23`, read). Run: a signed-out visitor cannot open an order URL. |
| 10 | Debug off in prod | OK | No stack traces returned; health route returns `{ok:false}` only (read). `poweredByHeader` off. |
| 11 | CAPTCHA on public forms | OPEN | Honeypot only. See "Fix these first". |
| 12 | Log admin actions | OK | `AuditLog` table written by admin actions and uploads (`src/lib/audit.ts`), visible in Admin → Audit log. Run: page renders with entries after the browser walk-through. |
| 13 | Private storage | N/A | The only stored files are public product photos. No private user files. |
| 14 | Admin pages protected | OK | Server-side role and permission checks on every admin page and action (authz-coverage test); role lives in the `User` table, not in anything a user can edit. |
| 15 | Vulnerable packages | OPEN | `npm audit fix` applied (fast-uri), Next updated to 15.5.29. Remaining: zod 3 and bundled postcss need major upgrades. |
| 16 | File upload types | OK | Magic-byte allowlist (JPG, PNG, WebP, AVIF, GIF; no SVG), size cap, random server-side names, `nosniff`. Run: `tests/staging.test.ts` (non-image and oversized files refused, path traversal names return nothing). |
| 17 | Security headers | FIXED | CSP no longer allows Google Fonts hosts (fonts are self-hosted now). CSP, `frame-ancestors 'none'`, HSTS, `nosniff`, Referrer-Policy, Permissions-Policy in `next.config.mjs`. |
| 18 | Webhook signatures | OK | Stripe `constructEvent` on the raw body; Razorpay HMAC with `timingSafeEqual`; events stored for idempotency. Run: `tests/payments.test.ts` (bad signatures rejected, replays ignored). |
| 19 | Default accounts | OK | The seed refuses to create an admin without `ADMIN_PASSWORD` in production (`prisma/seed.ts:41`). Staging admin has a generated password and must set up two-step sign-in at first login. Run: walk-through forces TOTP setup before the admin panel opens. |
| 20 | Final review | FIXED | Simulated payments were possible only in development; they are now also possible on staging, so the switch needs two settings and is unit-tested to stay off in real production (`tests/staging.test.ts`). `.env` is git-ignored; no secrets in the repository (scan). |

## Needs you (outside the code)

- **Sign in to the admin once, soon, and set up two-step sign-in.** Until you do, the admin password alone is enough to enrol an authenticator.
- **Verify the database certificate.** Download the CA certificate from Supabase (Dashboard → Database → Settings → SSL), put it in the `DATABASE_CA_CERT` variable on Vercel, and change `DATABASE_SSL` to `true`.
- **Before real customers**: set real contact details and company name in `src/config/site.ts`, add gateway keys, remove `DEPLOYMENT_STAGE` and `ALLOW_DEMO_PAYMENTS`, and delete test orders.
- **Monitoring**: no error tracking, uptime monitor or alerting is set up on staging. Supabase backups on the free plan are limited; do not keep real orders here.
