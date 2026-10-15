import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { syncV86 } from "./sync-v86.mjs";
import { splitParts } from "./split-parts.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// The user-supplied Encarta 95 CD. Override with ENCARTA_ISO=<path>.
const INPUT_ISO = process.env.ENCARTA_ISO || path.join(rootDir, "input", "encarta-95.iso");
const CD_PARTS_DIR = path.join(rootDir, "public", "disks", "encarta95");
const CD_MD5 = "02f8dc508c4abaf0202af51c66ee2cb0";

function md5(file) {
  return new Promise((resolve, reject) => {
    const hash = createHash("md5");
    createReadStream(file)
      .on("data", (d) => hash.update(d))
      .on("end", () => resolve(hash.digest("hex")))
      .on("error", reject);
  });
}

async function main() {
  // 1) emulator runtime (libv86 + wasm, with the sync-XHR patch overlaid)
  await syncV86();

  // 2) Encarta CD parts (generated from the user-supplied ISO)
  try {
    await stat(INPUT_ISO);
  }
  catch {
    console.error(
      `\nEncarta 95 CD not found: ${INPUT_ISO}\n` +
      `Place it there (or set ENCARTA_ISO=<path>). See README.md.\n`
    );
    process.exit(1);
  }

  const hash = await md5(INPUT_ISO);
  if(hash !== CD_MD5) {
    console.warn(
      `\nWARNING: md5 mismatch for ${INPUT_ISO}\n` +
      `  expected ${CD_MD5}\n  got      ${hash}\n` +
      `Continuing anyway, but the bundled Windows 95 state expects this exact CD.\n`
    );
  }
  else {
    console.log(`md5 ok (${hash})`);
  }

  const { parts } = await splitParts(INPUT_ISO, CD_PARTS_DIR, { ext: ".iso" });
  console.log(`split ${INPUT_ISO} -> ${parts} parts in public/disks/encarta95/`);

  console.log("\nBuild complete. Start it with:  npm run run");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
