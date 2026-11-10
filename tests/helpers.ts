import { randomUUID } from "crypto";
import { db } from "@/lib/db";

export async function makeUser(overrides: Record<string, unknown> = {}) {
  return db.user.create({
    data: { name: "Test Buyer", email: `u-${randomUUID()}@test.dev`, passwordHash: "x", ...overrides },
  });
}

export async function makeProduct(overrides: Record<string, unknown> = {}) {
  const id = randomUUID().slice(0, 8);
  return db.product.create({
    data: {
      name: `Chair ${id}`,
      slug: `chair-${id}`,
      sku: `T-${id}`,
      description: "A test chair for automated tests.",
      priceInr: 1_000_00,
      priceUsd: 20_00,
      businessPriceInr: 800_00,
      businessPriceUsd: 15_00,
      moq: 10,
      stock: 50,
      status: "ACTIVE",
      ...overrides,
    },
  });
}

export const shipping = {
  shipName: "Test Buyer",
  shipPhone: "9999999999",
  shipAddress: "1 Test Street",
  shipCity: "Jaipur",
  shipPostal: "302001",
  shipCountry: "India",
};

export async function stockOf(id: string) {
  return (await db.product.findUniqueOrThrow({ where: { id } })).stock;
}
