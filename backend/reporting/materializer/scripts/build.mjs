import {build} from "esbuild";
import path from "node:path";
import {fileURLToPath} from "node:url";
const root = fileURLToPath(new URL("../../../../", import.meta.url));
await build({absWorkingDir: root, entryPoints: ["backend/reporting/materializer/js/entry.js"], outfile: "backend/reporting/materializer/lowerer.bundle.js", bundle: true, preserveSymlinks: true, platform: "neutral", mainFields: ["module", "main"], format: "iife", globalName: "ForgeAuthoredLowerer", target: "es2018", conditions: ["import", "default"], alias: {
 "@preact/signals-react": path.join(root, "node_modules/@preact/signals-core/dist/signals-core.mjs"),
 "@blueprintjs/icons": path.join(root, "node_modules/@blueprintjs/icons/lib/esm/allPaths.js"),
}, logLevel: "info"});
