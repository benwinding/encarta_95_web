import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { constants, zstdCompressSync } from "node:zlib";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = path.join(rootDir, "public", "state", "encarta95.bin");
const dst = src + ".zst";
const keep = process.argv.includes("--keep");

if (!existsSync(src)) {
  console.error(`Missing raw snapshot: ${src}`);
  console.error("Save a state to this path first, then rerun this script.");
  process.exit(1);
}

// Prefer the zstd CLI (level 19, all cores). Fall back to Node's native zstd
// when the CLI is unavailable (Node 22.15+).
try {
  execFileSync("zstd", ["-19", "-T0", "-f", src, "-o", dst], { stdio: "inherit" });
} catch {
  const compressed = zstdCompressSync(readFileSync(src), {
    params: { [constants.ZSTD_c_compressionLevel]: 19 },
  });
  writeFileSync(dst, compressed);
}

const compressed = readFileSync(dst);
if (compressed.subarray(0, 4).toString("hex") !== "28b52ffd") {
  console.error("Compression failed: output is not a zstd frame");
  process.exit(1);
}

const rawSize = statSync(src).size;
const zstSize = compressed.length;
console.log(
  `wrote ${path.relative(rootDir, dst)} (${zstSize} bytes, ` +
  `${((1 - zstSize / rawSize) * 100).toFixed(1)}% smaller than ${rawSize} bytes)`
);

if (keep) {
  console.log("kept raw snapshot (--keep)");
} else {
  unlinkSync(src);
  console.log("removed raw snapshot");
}
