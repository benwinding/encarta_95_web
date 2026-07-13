import { cp, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const sourceBuildDir = path.join(rootDir, "node_modules", "v86", "build");
const targetBuildDir = path.join(rootDir, "copysh", "build");

const filesToSync = [
  "libv86.js",
  "libv86-debug.js",
  "v86.wasm",
  "v86-debug.wasm",
  "v86-fallback.wasm",
];

async function main() {
  await mkdir(targetBuildDir, { recursive: true });

  for(const fileName of filesToSync) {
    const from = path.join(sourceBuildDir, fileName);
    const to = path.join(targetBuildDir, fileName);
    await cp(from, to);
    console.log(`synced ${fileName}`);
  }
}

main().catch((error) => {
  console.error("Failed to sync v86 assets", error);
  process.exit(1);
});
