import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const outputDir = path.join(rootDir, "playwright-output");
const CRASH_TEXT = "Your Windows configuration is invalid.";
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const RESET = "\x1b[0m";

async function main() {
  const argv = await yargs(hideBin(process.argv))
    .scriptName("validate_no_crash")
    .command("$0 <url>", "Validate that VM does not crash", (cmd) =>
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
    .check((args) => {
      if(!args.url) {
        throw new Error("Missing required <url> argument");
      }
      if(args["timeout-ms"] <= 0) {
        throw new Error("--timeout-ms must be > 0");
      }
      return true;
    })
    .help()
    .strict()
    .parse();

  const url = String(argv.url);
  const timeoutMs = argv["timeout-ms"];

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

    const startedAt = Date.now();
    let crashDetected = false;
    let lastTextSample = "";

    while(Date.now() - startedAt < timeoutMs) {
      const state = await page.evaluate((needle) => {
        try {
          if(typeof emulator === "undefined" || !emulator || !emulator.screen_adapter) {
            return { ready: false, found: false, sample: "" };
          }

          const adapter = emulator.screen_adapter;
          if(typeof adapter.get_text_screen !== "function") {
            return { ready: false, found: false, sample: "" };
          }

          const rows = adapter.get_text_screen();
          const text = Array.isArray(rows)
            ? rows.map((row) => Array.isArray(row) ? row.join("") : String(row)).join("\n")
            : String(rows || "");

          return {
            ready: true,
            found: text.toLowerCase().includes(String(needle).toLowerCase()),
            sample: text.slice(0, 1200),
          };
        }
        catch(err) {
          return { ready: false, found: false, sample: `error: ${String(err)}` };
        }
      }, CRASH_TEXT);

      lastTextSample = state.sample || "";

      if(state.found) {
        crashDetected = true;
        break;
      }

      await page.waitForTimeout(1000);
    }

    const screenshotPath = path.join(outputDir, `validate-no-crash-${Date.now()}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });

    const hasConsoleErrors = consoleErrors.length > 0;
    const ok = !crashDetected && !hasConsoleErrors;

    const report = {
      ok,
      url,
      timeoutMs,
      forbiddenText: CRASH_TEXT,
      detail: crashDetected
        ? `Detected forbidden VGA text: ${CRASH_TEXT}`
        : hasConsoleErrors
          ? `Forbidden VGA text not detected, but consoleErrors were present (${consoleErrors.length})`
          : `Forbidden VGA text not detected within ${timeoutMs}ms and no consoleErrors found`,
      screenshotPath,
      lastTextSample,
      pageErrors,
      requestFailures,
      consoleErrors,
    };

    console.log(JSON.stringify(report, null, 2));

    if(!ok) {
      if(crashDetected) {
        console.log(`${RED}FAILED: Crash text was detected${RESET}`);
      }
      else {
        console.log(`${RED}FAILED: consoleErrors were detected${RESET}`);
      }
      process.exitCode = 1;
    }
    else {
      console.log(`${GREEN}SUCCESS: Crash text was not detected and no consoleErrors found${RESET}`);
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
