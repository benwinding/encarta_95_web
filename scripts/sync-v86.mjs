import { cp, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const sourceBuildDir = path.join(rootDir, "node_modules", "v86", "build");
const targetBuildDir = path.join(rootDir, "public", "runtime");

const filesToSync = [
  "libv86.js",
  "libv86-debug.js",
  "v86.wasm",
  "v86-debug.wasm",
  "v86-fallback.wasm",
];

export async function syncV86() {
  await mkdir(targetBuildDir, { recursive: true });

  for(const fileName of filesToSync) {
    await cp(path.join(sourceBuildDir, fileName), path.join(targetBuildDir, fileName));
    console.log(`synced ${fileName}`);
  }

  // Overlay a patched v86 build. It adds `synchronous: true` disk I/O
  // (paged chunks fetched via synchronous XHR) which fixes Win95's
  // ESDI_506 crash on async CD reads. See vendor/v86-sync-xhr.patch.
  await cp(path.join(rootDir, "vendor", "libv86.sync.js"), path.join(targetBuildDir, "libv86.js"));
  console.log("overlaid patched libv86.js (synchronous paged disk I/O)");
}

if(import.meta.url === `file://${process.argv[1]}`) {
  syncV86().catch((error) => {
    console.error("Failed to sync v86 assets", error);
    process.exit(1);
  });
}
