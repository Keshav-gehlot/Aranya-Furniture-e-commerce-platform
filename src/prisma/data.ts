import { dataContract } from "@prisma/composer-prisma-cloud/orm";
import type { Contract } from "./contract.d.ts";
import contractJson from "./contract.json" with { type: "json" };

/** The store's data contract (emitted from prisma/schema.prisma by `prisma contract emit`). */
export const storeData = dataContract<Contract>(contractJson);
