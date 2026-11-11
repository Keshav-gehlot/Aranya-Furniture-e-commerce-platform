/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV !== "production";
const assetOrigin = process.env.ASSET_BASE_URL ? new URL(process.env.ASSET_BASE_URL).origin : "";

const csp = [
  "default-src 'self'",
  // Razorpay Checkout is loaded from checkout.razorpay.com. Next.js needs inline scripts for hydration.
  `script-src 'self' 'unsafe-inline' https://checkout.razorpay.com${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  `img-src 'self' data: blob: ${assetOrigin} https://*.razorpay.com`.trim(),
  "connect-src 'self' https://api.razorpay.com https://lumberjack.razorpay.com",
  "frame-src https://api.razorpay.com https://checkout.razorpay.com",
  "form-action 'self' https://checkout.stripe.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
].join("; ");

const nextConfig = {
  // Standalone output is what Prisma Compute and the Docker image run. Vercel builds its own output,
  // and Render runs `next start` on the normal build.
  output: process.env.VERCEL || process.env.RENDER ? undefined : "standalone",
  poweredByHeader: false,
  serverExternalPackages: ["pg", "@prisma/adapter-pg"],
  images: { unoptimized: true },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(self \"https://checkout.razorpay.com\")" },
        ],
      },
    ];
  },
};
export default nextConfig;
