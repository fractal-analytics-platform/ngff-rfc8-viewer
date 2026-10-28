import { createReadStream, existsSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Serves `examples/data` as plain static files during `npm run dev`.
 * Zarr chunk files have no extension (e.g. `s0/c/0/0`), so without this Vite tries to transform
 * them as JavaScript modules and answers 500.
 */
function serveExampleData() {
  return {
    name: "serve-example-data",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = (req.url || "").split("?")[0];
        if (!url.startsWith("/examples/data/")) {
          return next();
        }
        const file = join(server.config.root, decodeURIComponent(url));
        if (!existsSync(file) || !statSync(file).isFile()) {
          return next();
        }
        res.setHeader(
          "Content-Type",
          file.endsWith(".json")
            ? "application/json"
            : "application/octet-stream",
        );
        res.setHeader("Access-Control-Allow-Origin", "*");
        createReadStream(file).pipe(res);
      });
    },
  };
}

export default {
  plugins: [serveExampleData()],
  build: {
    outDir: "dist",
    assetsDir: "assets",
  },
  base: "./",
};
