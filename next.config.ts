import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output is for the Docker image; Vercel builds its own bundle.
  output: process.env.VERCEL ? undefined : "standalone",
  redirects: async () => [{ source: "/", destination: "/discover", permanent: false }],
  // chdb ships a native addon; it must stay external and keep its own file layout.
  serverExternalPackages: ["chdb"],
  // The demo engine reads this fixture at runtime, so it has to travel with the function.
  outputFileTracingIncludes: {
    // The fixture and chdb's native library are reached dynamically, so tracing
    // cannot infer them; name them explicitly or the demo function ships without them.
    "/api/query/**": [
      "./demo/logs.parquet",
      // chdb_node.node links libchdb at load time. Tracing follows the .node file
      // but not its shared-library dependency, so name it. Matches files only:
      // a glob that can land on the package directory makes Turbopack read it as a file.
      "./node_modules/@chdb/*/libchdb.so",
      "./node_modules/@chdb/*/libchdb.dylib",
    ],
  },
};

export default nextConfig;
