/**
 * The app as Prisma Composer deploys it: database → store service → public URL.
 * `prisma dev` runs this on your machine; `prisma deploy` (or the GitHub workflow) deploys it to Prisma Compute.
 */
import { appRoot } from "@prisma/composer";
import { envParam, envSecret, publicUrl } from "@prisma/composer-prisma-cloud";
import { postgres } from "@prisma/composer-prisma-cloud/orm";
import { storeData } from "./src/prisma/data.ts";
import store from "./src/service.ts";

export default appRoot("aranya-furniture", ({ provision }) => {
  // Prisma Postgres database. Deploys apply the committed migrations in migrations/ before the app starts.
  const db = provision(postgres({ name: "db", contract: storeData, config: "./prisma.config.ts" }));

  const site = provision(store, {
    deps: { db },
    input: {
      // Secrets live on the platform (prisma project env …). The deploy stops early if one is missing.
      jwtSecret: envSecret("JWT_SECRET"),
      mfaEncryptionKey: envSecret("MFA_ENCRYPTION_KEY"),
      cronSecret: envSecret("CRON_SECRET"),
      // Product photos are stored in the database: Compute has no persistent disk.
      storageDriver: "db",
      // Optional. DEPLOYMENT_STAGE=staging shows the staging banner and, with ALLOW_DEMO_PAYMENTS=true, allows test payments.
      deploymentStage: envParam("DEPLOYMENT_STAGE"),
      allowDemoPayments: envParam("ALLOW_DEMO_PAYMENTS"),
      siteUrl: envParam("NEXT_PUBLIC_SITE_URL"),
      // First start only: the app creates the first admin from these when the database has none.
      adminEmail: envParam("ADMIN_EMAIL"),
      adminPassword: envSecret("ADMIN_PASSWORD"),
      seedSampleProducts: envParam("SEED_SAMPLE_PRODUCTS"),
    },
  });

  // Reachable on the service's prisma.build hostname. Swap for publicUrl.hostname("shop.example.com") with a custom domain.
  provision(publicUrl({ id: "site", url: publicUrl.prismaBuild(), target: site.http }));
});
