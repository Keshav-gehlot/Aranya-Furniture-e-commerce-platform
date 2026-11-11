import "dotenv/config";
import { defineConfig as composer } from "@prisma/composer/config";
import { nextjsBuild } from "@prisma/composer/nextjs/control";
import { nodeBuild } from "@prisma/composer/node/control";
import { prismaCloud, prismaState } from "@prisma/composer-prisma-cloud/control";
import { defineConfig, prisma7Schema } from "@prisma/orm-postgres/config";
import { definePrismaConfig } from "prisma/config";

export default definePrismaConfig({
  // Data model: prisma/schema.prisma stays the source; Prisma 8 reads it as its contract.
  // After a schema change: `prisma contract emit`, then `prisma migration plan --name <change>`, and commit migrations/.
  orm: defineConfig({
    contract: prisma7Schema("prisma/schema.prisma"),
    output: "src/prisma",
    db: { connection: process.env["DATABASE_URL"] },
  }),
  // Deploy: `prisma dev` (local) and `prisma deploy` (Prisma Compute) read the app from module.ts.
  composer: composer({
    entry: "./module.ts",
    // Singapore is the closest Compute region to India.
    extensions: [prismaCloud({ region: "ap-southeast-1" }), nodeBuild(), nextjsBuild()],
    state: prismaState(),
  }),
});
