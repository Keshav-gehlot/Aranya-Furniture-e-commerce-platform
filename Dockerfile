# syntax=docker/dockerfile:1.7
# Multi-stage build. Targets:
#   runtime  (default) — the web app, Next.js standalone output, runs as a non-root user
#   migrator           — runs `prisma migrate deploy` as a one-off ECS task before each release

FROM node:22-bookworm-slim AS deps
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npm ci && npx prisma generate

FROM deps AS build
COPY . .
RUN npx prisma generate && npx next build

# AWS RDS certificate bundle, so the app can verify the database's TLS certificate.
FROM debian:bookworm-slim AS certs
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl \
 && curl -fsSL https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem -o /rds-ca.pem \
 && rm -rf /var/lib/apt/lists/*

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0 \
    NODE_EXTRA_CA_CERTS=/etc/ssl/certs/rds-ca.pem
COPY --from=certs /rds-ca.pem /etc/ssl/certs/rds-ca.pem
RUN groupadd --system --gid 1001 app && useradd --system --uid 1001 --gid app app
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
COPY --from=build --chown=app:app /app/public ./public
USER app
EXPOSE 3000
CMD ["node", "server.js"]

FROM deps AS migrator
ENV NODE_ENV=production NODE_EXTRA_CA_CERTS=/etc/ssl/certs/rds-ca.pem
COPY --from=certs /rds-ca.pem /etc/ssl/certs/rds-ca.pem
RUN groupadd --system --gid 1001 app && useradd --system --uid 1001 --gid app app && chown -R app:app /app
USER app
CMD ["npx", "prisma", "migrate", "deploy"]
