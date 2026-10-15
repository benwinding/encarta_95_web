import { mkdir, open, stat, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Split a file into v86 part-file chunks named `<start>-<end><ext>`
 * (the format v86's partfile buffer expects, e.g. `0-262144.iso`).
 */
export async function splitParts(inputPath, outDir, { chunkSize = 256 * 1024, ext } = {}) {
  const suffix = ext !== undefined ? ext : path.extname(inputPath);
  await mkdir(outDir, { recursive: true });

  const { size } = await stat(inputPath);
  const fh = await open(inputPath, "r");
  const buf = Buffer.alloc(chunkSize);

  try {
    let offset = 0;
    let parts = 0;

    while(offset < size) {
      const len = Math.min(chunkSize, size - offset);
      const { bytesRead } = await fh.read(buf, 0, len, offset);
      const end = offset + bytesRead;
      await writeFile(path.join(outDir, `${offset}-${end}${suffix}`), buf.subarray(0, bytesRead));
      offset = end;
      parts++;
    }

    return { size, parts, outDir };
  }
  finally {
    await fh.close();
  }
}

if(import.meta.url === `file://${process.argv[1]}`) {
  const [, , input, out, ext] = process.argv;

  if(!input || !out) {
    console.error("usage: node scripts/split-parts.mjs <input> <outDir> [ext]");
    process.exit(1);
  }

  splitParts(input, out, { ext })
    .then((r) => console.log(JSON.stringify(r)))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
