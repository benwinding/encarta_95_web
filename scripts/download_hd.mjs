import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { comparePngAsync } from "png-visual-compare";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const outputDir = path.join(rootDir, "playwright-output");
const DEFAULT_TIMEOUT_MS = 60_000;
const referencePath = path.join(rootDir, "scripts", "encarta_loaded.png");

async function readPngSize(filePath) {
  const buffer = await readFile(filePath);

  if(buffer.length < 24) {
    throw new Error(`Not a valid PNG (too small): ${filePath}`);
  }

  const signature = buffer.subarray(0, 8);
  const expected = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if(!signature.equals(expected)) {
    throw new Error(`Not a valid PNG signature: ${filePath}`);
  }

  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

function withTimeout(promise, timeoutMs, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
    }),
  ]);
}

function makeLogger(startedAt, timeoutMs) {
  return (message) => {
    const elapsed = Date.now() - startedAt;
    const remaining = Math.max(0, timeoutMs - elapsed);
    console.log(`[download_hd +${elapsed}ms rem=${remaining}ms] ${message}`);
  };
}

async function main() {
  const argv = await yargs(hideBin(process.argv))
    .scriptName("download_hd")
    .command("$0 <url>", "Download HD from page", (cmd) =>
      cmd.positional("url", {
        describe: "URL with #downloadHd button",
        type: "string",
      })
    )
    .option("timeout-ms", {
      type: "number",
      default: DEFAULT_TIMEOUT_MS,
      describe: "Global script timeout",
    })
    .option("min-similarity", {
      type: "number",
      default: 0.9,
      describe: "Required visual similarity before clicking Download HD",
    })
    .check((args) => {
      if(!args.url) {
        throw new Error("Missing required <url> argument");
      }
      if(args["timeout-ms"] <= 0) {
        throw new Error("--timeout-ms must be > 0");
      }
      if(args["min-similarity"] < 0 || args["min-similarity"] > 1) {
        throw new Error("--min-similarity must be between 0 and 1");
      }
      return true;
    })
    .help()
    .strict()
    .parse();

  const url = String(argv.url);
  const timeoutMs = argv["timeout-ms"];
  const minSimilarity = argv["min-similarity"];
  const startedAt = Date.now();
  const log = makeLogger(startedAt, timeoutMs);

  const remainingMs = () => {
    const left = timeoutMs - (Date.now() - startedAt);
    if(left <= 0) {
      throw new Error(`Global timeout exceeded (${timeoutMs}ms)`);
    }
    return left;
  };

  await mkdir(outputDir, { recursive: true });
  log(`Starting run for ${url}`);

  await withTimeout((async () => {
    log("Launching Chromium");
    const browser = await chromium.launch({ headless: true });
    log("Creating browser context with downloads enabled");
    const context = await browser.newContext({ acceptDownloads: true });
    const page = await context.newPage();

    try {
      log("Navigating to page");
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: remainingMs() });
      log("Waiting for #downloadHd button");
      await page.waitForSelector("#downloadHd", { timeout: remainingMs() });

      const probePath = path.join(outputDir, "download_hd_probe.png");
      const referenceSize = await readPngSize(referencePath);
      let similarity = 0;

      log(`Waiting for visual match >= ${minSimilarity}`);
      while(similarity < minSimilarity) {
        await page.screenshot({ path: probePath, fullPage: true });

        const mismatchedPixels = await comparePngAsync(referencePath, probePath);
        const probeSize = await readPngSize(probePath);
        const totalPixels = Math.max(referenceSize.width, probeSize.width) * Math.max(referenceSize.height, probeSize.height);
        similarity = totalPixels === 0 ? 0 : 1 - (mismatchedPixels / totalPixels);

        log(`Visual similarity=${similarity.toFixed(4)}`);

        if(similarity >= minSimilarity) {
          log("Reference visual match reached, proceeding to click Download HD");
          break;
        }

        await page.waitForTimeout(Math.min(2_000, remainingMs()));
      }

      log("Arming download listener");
      const downloadPromise = page.waitForEvent("download", { timeout: remainingMs() });
      log("Clicking #downloadHd");
      await page.click("#downloadHd", { timeout: remainingMs() });
      log("Waiting for browser download event");
      const download = await downloadPromise;

      const filename = `win95_hda-${Date.now()}.img`;
      const filePath = path.join(outputDir, filename);
      log(`Saving download to ${filePath}`);
      await download.saveAs(filePath);
      log("Download saved successfully");

      console.log(JSON.stringify({
        ok: true,
        url,
        minSimilarity,
        filename,
        savedTo: filePath,
        timeoutMs,
      }, null, 2));
    }
    finally {
      log("Closing browser context");
      await context.close();
      await browser.close();
      log("Browser closed");
    }
  })(), timeoutMs, "download_hd script");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
