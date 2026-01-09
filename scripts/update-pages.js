import { join } from "node:path";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { fs, git, bun, read, write, exists } from "./utils.js";

const TEMPLATE_REPO = "https://github.com/chobbledotcom/chobble-template.git";
const TEMPLATE_RAW_URL =
  "https://raw.githubusercontent.com/chobbledotcom/chobble-template/refs/heads/main/.pages.yml";

const fetchPages = async () => {
  console.log("Fetching .pages.yml from chobble-template...");

  const res = await fetch(TEMPLATE_RAW_URL);
  if (!res.ok) throw new Error(`Failed to fetch .pages.yml: ${res.status}`);

  await write(".pages.yml", (await res.text()).replace(/src\//g, ""));
  console.log("Updated .pages.yml from chobble-template (with src/ removed)");
};

const customisePages = async () => {
  const tempDir = mkdtempSync(join(tmpdir(), "chobble-template-"));

  console.log("Cloning chobble-template...");
  const clone = git.clone(TEMPLATE_REPO, tempDir);
  if (clone.exitCode !== 0) throw new Error("Failed to clone chobble-template");

  console.log("Installing dependencies...");
  const install = bun.install(tempDir);
  if (install.exitCode !== 0) {
    fs.rm(tempDir);
    throw new Error("Failed to install dependencies");
  }

  console.log("\nStarting CMS customisation TUI...\n");

  const proc = bun.spawn("customise-cms", tempDir);
  const code = await proc.exited;

  if (code !== 0) {
    fs.rm(tempDir);
    throw new Error(`customise-cms exited with code ${code}`);
  }

  const pagesPath = join(tempDir, "src", ".pages.yml");
  if (!(await exists(pagesPath))) {
    fs.rm(tempDir);
    throw new Error("No .pages.yml found after customisation");
  }

  await write(".pages.yml", (await read(pagesPath)).replace(/src\//g, ""));

  console.log("\nCleaning up...");
  fs.rm(tempDir);
  console.log("Updated .pages.yml with your customisations (with src/ removed)");
};

const updatePages = async ({ customise = false } = {}) =>
  customise ? customisePages() : fetchPages();

if (import.meta.main) {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`Usage: bun run update-pages [options]

Options:
  --customise, -c  Run the interactive CMS customisation TUI
  --help, -h       Show this help message

Without options, fetches the latest .pages.yml from chobble-template.
With --customise, clones chobble-template and runs the customise-cms TUI
to let you select which collections to include.`);
    process.exit(0);
  }

  const customise = args.includes("--customise") || args.includes("-c");

  updatePages({ customise }).catch((err) => {
    console.error("Error:", err.message);
    process.exit(1);
  });
}

export { updatePages, fetchPages, customisePages };
