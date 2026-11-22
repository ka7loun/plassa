// MapLibre 6 loads its tile worker from a separate module file. Bundlers do not
// emit it, so we serve the package's own worker from /public (runs on install).
import { copyFileSync, mkdirSync } from "node:fs";

mkdirSync("public/maplibre", { recursive: true });
copyFileSync("node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs", "public/maplibre/maplibre-gl-worker.mjs");
console.log("copied maplibre worker to public/maplibre/");
