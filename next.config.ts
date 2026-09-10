import withSerwistInit from "@serwist/next";
import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Pin the workspace root — a stray lockfile in a parent folder otherwise confuses inference.
  outputFileTracingRoot: fileURLToPath(new URL(".", import.meta.url)),
  // `@serwist/next` attaches a webpack config; an explicit (empty) turbopack
  // config tells `next dev` (Turbopack) that's intentional. Production builds
  // run `next build --webpack` so Serwist can emit the service worker.
  turbopack: {},
  // The app is fully client-persisted (IndexedDB); no server data layer yet.
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
};

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  // Service worker only in production builds; keeps dev fast and debuggable.
  disable: process.env.NODE_ENV === "development",
  reloadOnOnline: true,
});

export default withSerwist(nextConfig);
