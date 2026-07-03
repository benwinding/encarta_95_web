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
const referencePath = path.join(rootDir, "scripts", "encarta_loaded.png");
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const RESET = "\x1b[0m";

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

  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);

  return { width, height };
}

async function main() {
  const argv = await yargs(hideBin(process.argv))
    .scriptName("validate_encarta_loads")
    .command("$0 <url>", "Validate Encarta load state", (cmd) =>
      cmd.positional("url", {
        describe: "URL to validate",
        type: "string",
      })
    )
    .option("timeout-ms", {
      type: "number",
      default: 60_000,
      describe: "Validation timeout in milliseconds",
    })
    .option("min-similarity", {
      type: "number",
      default: 0.9,
      describe: "Required visual similarity in [0,1]",
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

  await mkdir(outputDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const pageErrors = [];
  const requestFailures = [];
  const consoleErrors = [];

  page.on("pageerror", (error) => pageErrors.push(String(error)));
  page.on("requestfailed", (request) => {
    requestFailures.push(`${request.method()} ${request.url()} :: ${request.failure()?.errorText || "unknown"}`);
  });
  page.on("console", (message) => {
    if(message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });

  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForSelector("#screen_container", { timeout: 30_000 });

    await page.waitForTimeout(timeoutMs);

    const screenshotPath = path.join(outputDir, `validate-encarta-loads-${Date.now()}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });

    const visualSignal = {
      referencePath,
      minSimilarity,
      matched: false,
      similarity: 0,
      mismatchedPixels: 0,
      totalPixels: 0,
      diffPath: null,
      error: null,
    };

    try {
      const diffPath = path.join(outputDir, `validate-encarta-diff-${Date.now()}.png`);
      const mismatchedPixels = await comparePngAsync(referencePath, screenshotPath, {
        diffFilePath: diffPath,
      });
      const [referenceSize, screenshotSize] = await Promise.all([
        readPngSize(referencePath),
        readPngSize(screenshotPath),
      ]);

      visualSignal.totalPixels = Math.max(referenceSize.width, screenshotSize.width) * Math.max(referenceSize.height, screenshotSize.height);
      visualSignal.mismatchedPixels = mismatchedPixels;
      visualSignal.similarity = visualSignal.totalPixels === 0 ? 0 : 1 - (mismatchedPixels / visualSignal.totalPixels);
      visualSignal.matched = visualSignal.similarity >= minSimilarity;
      visualSignal.diffPath = mismatchedPixels > 0 ? diffPath : null;
    }
    catch(error) {
      visualSignal.error = String(error);
    }

    const ok = visualSignal.matched;

    const report = {
      ok,
      url,
      timeoutMs,
      detail: visualSignal.error || `similarity=${visualSignal.similarity}`,
      screenshotPath,
      visualSignal,
      pageErrors,
      requestFailures,
      consoleErrors,
    };

    console.log(JSON.stringify(report, null, 2));

    if(ok) {
      console.log(`${GREEN}SUCCESS: Encarta visual validation passed${RESET}`);
    }
    else {
      console.log(`${RED}FAILED: Encarta visual validation did not meet threshold${RESET}`);
    }

    if(!ok) {
      process.exitCode = 1;
    }
  }
  finally {
    await context.close();
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
