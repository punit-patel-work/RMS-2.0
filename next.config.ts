import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // P-M11 / P-C6: React Compiler is enabled, so much of the manual
  // useMemo/useCallback in client components is now redundant. We don't
  // strip those by hand (low-risk noise); the compiler emits them as
  // necessary at build time.
  reactCompiler: true,

  // P-H4: allow remote menu-item images. Restrictive by default — listing
  // specific hosts here is what next/image needs to optimize them.
  // Wide-open `**` is intentional during early development; tighten to
  // your CDN host before going to prod.
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
    ],
  },

  // P-C6: enable gzip compression on the standalone server.
  compress: true,

  // P-C6: don't expose the Next version header to clients.
  poweredByHeader: false,
};

export default nextConfig;
