import createNextIntlPlugin from "next-intl/plugin";
import type { NextConfig } from "next";

// Points the plugin at our request-scoped i18n config.
const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // pdfjs-dist must not be bundled: Turbopack rewrites pdf.js's internal worker
  // import into a .next chunk path that has no worker file, so server-side
  // parsing throws "Cannot find module .../pdf.worker.mjs". Keeping it external
  // lets its own imports resolve against real node_modules.
  serverExternalPackages: ["pdfjs-dist"],
  /*
   * File tracing follows `import`s, so it ships pdf.js's JavaScript and none of
   * its data. The worker, the standard-14 font programs and the CJK character
   * maps are all read at runtime by path (see lib/ingestion/parsePdf.ts), which
   * tracing cannot see — so without this they are simply absent from the
   * deployed function and PARSE fails in production while working locally.
   */
  outputFileTracingIncludes: {
    "/api/worker": [
      "./node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs",
      "./node_modules/pdfjs-dist/standard_fonts/**",
      "./node_modules/pdfjs-dist/cmaps/**",
    ],
  },
};

export default withNextIntl(nextConfig);
