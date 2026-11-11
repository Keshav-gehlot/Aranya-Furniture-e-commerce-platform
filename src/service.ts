/**
 * Prisma Composer declaration of the store: one Next.js service with one PostgreSQL database.
 * This file is data only. The platform passes the database and the configuration below to the
 * running app, which reads them through `service.load()` and `service.input()` (see src/lib/platform.ts).
 */
import { compute } from "@prisma/composer-prisma-cloud";
import { postgres } from "@prisma/composer-prisma-cloud/orm";
import { secretString } from "@prisma/composer/arktype";
import { rawHttpContract } from "@prisma/composer/http";
import nextjs from "@prisma/composer/nextjs";
import { type } from "arktype";
import { storeData } from "./prisma/data.ts";

export default compute({
  name: "store",
  deps: { db: postgres(storeData) },
  input: type({
    jwtSecret: secretString(),
    mfaEncryptionKey: secretString(),
    cronSecret: secretString(),
    storageDriver: "string",
    "deploymentStage?": "string",
    "allowDemoPayments?": "string",
    "siteUrl?": "string",
    // First start only: creates the first admin account when the database has none (src/lib/bootstrap.ts).
    "adminEmail?": "string",
    "adminPassword?": secretString(),
    "seedSampleProducts?": "string",
  }),
  build: nextjs({ module: import.meta.url, appDir: ".." }),
  expose: { http: rawHttpContract },
});
