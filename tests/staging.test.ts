import { afterEach, describe, expect, it, vi } from "vitest";
import { demoAllowed, providerFor } from "@/lib/payments";
import { sslOptions } from "@/lib/db";
import { readLocalUpload, storeProductImage } from "@/lib/storage";

afterEach(() => vi.unstubAllEnvs());

describe("simulated payments", () => {
  it("are on in development unless switched off", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("ALLOW_DEMO_PAYMENTS", "");
    expect(demoAllowed()).toBe(true);
    vi.stubEnv("ALLOW_DEMO_PAYMENTS", "false");
    expect(demoAllowed()).toBe(false);
  });

  it("stay off in a production build, even when ALLOW_DEMO_PAYMENTS is set", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DEPLOYMENT_STAGE", "");
    vi.stubEnv("ALLOW_DEMO_PAYMENTS", "true");
    expect(demoAllowed()).toBe(false);
    vi.stubEnv("DEPLOYMENT_STAGE", "production");
    expect(demoAllowed()).toBe(false);
  });

  it("need both the staging stage and the explicit switch", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DEPLOYMENT_STAGE", "staging");
    vi.stubEnv("ALLOW_DEMO_PAYMENTS", "");
    expect(demoAllowed()).toBe(false);
    vi.stubEnv("ALLOW_DEMO_PAYMENTS", "true");
    expect(demoAllowed()).toBe(true);
  });

  it("are only a fallback: a configured gateway always wins", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DEPLOYMENT_STAGE", "staging");
    vi.stubEnv("ALLOW_DEMO_PAYMENTS", "true");
    vi.stubEnv("RAZORPAY_KEY_ID", "");
    vi.stubEnv("RAZORPAY_KEY_SECRET", "");
    expect(providerFor("INR")).toBe("DEMO");
    vi.stubEnv("RAZORPAY_KEY_ID", "rzp_test_x");
    vi.stubEnv("RAZORPAY_KEY_SECRET", "secret");
    expect(providerFor("INR")).toBe("RAZORPAY");
    expect(providerFor("USD")).toBe("STRIPE"); // tests/setup.ts sets a Stripe key
  });
});

describe("database TLS", () => {
  it("verifies certificates unless a mode says otherwise", () => {
    vi.stubEnv("DATABASE_SSL", "");
    expect(sslOptions()).toBeUndefined();
    vi.stubEnv("DATABASE_SSL", "true");
    expect(sslOptions()).toEqual({ rejectUnauthorized: true });
    vi.stubEnv("DATABASE_CA_CERT", "-----BEGIN CERTIFICATE-----\\nabc\\n-----END CERTIFICATE-----");
    expect(sslOptions()).toEqual({ rejectUnauthorized: true, ca: "-----BEGIN CERTIFICATE-----\nabc\n-----END CERTIFICATE-----" });
    vi.stubEnv("DATABASE_SSL", "require");
    expect(sslOptions()).toEqual({ rejectUnauthorized: false });
  });
});

describe("image storage in the database", () => {
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64, 1)]);

  it("stores a validated image and reads the same bytes back", async () => {
    vi.stubEnv("STORAGE_DRIVER", "db");
    const url = await storeProductImage(png);
    expect(url).toMatch(/^\/api\/uploads\/[a-f0-9-]+\.png$/);
    const back = await readLocalUpload(url.split("/").pop()!);
    expect(back?.equals(png)).toBe(true);
  });

  it("refuses files that are not images, oversized images and unsafe names", async () => {
    vi.stubEnv("STORAGE_DRIVER", "db");
    await expect(storeProductImage(Buffer.from("<svg onload=alert(1)>".padEnd(40)))).rejects.toThrow(/Only JPG/);
    await expect(storeProductImage(Buffer.concat([png, Buffer.alloc(4 * 1024 * 1024)]))).rejects.toThrow(/larger than 4 MB/);
    expect(await readLocalUpload("../../etc/passwd")).toBeNull();
    expect(await readLocalUpload("00000000-0000-0000-0000-000000000000.png")).toBeNull();
  });
});
