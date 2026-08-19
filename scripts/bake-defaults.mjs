// CLI fallback for baking a downloaded JSON snapshot into src/core/defaults.js.
// The editor's "Bake" button normally writes defaults.js directly via the
// vite dev server's /__bake endpoint (see vite.config.js) — this script is
// only needed if you have a ledge-bake.json saved from elsewhere.
//
// Usage: node scripts/bake-defaults.mjs [path-to-ledge-bake.json]
// (defaults to ./ledge-bake.json in the current directory)

import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mergeBaked, formatDefaults, parseDefaultsSource } from "./bake-merge.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultsPath = path.join(__dirname, "..", "src", "core", "defaults.js");

const inputPath = path.resolve(process.argv[2] || "ledge-bake.json");

async function loadExistingBaked() {
  if (!existsSync(defaultsPath)) return null;
  return parseDefaultsSource(await readFile(defaultsPath, "utf8"));
}

async function main() {
  if (!existsSync(inputPath)) {
    console.error(`Bake input not found: ${inputPath}`);
    console.error("Download it from the editor's Bake button first.");
    process.exitCode = 1;
    return;
  }
  const dump = JSON.parse(await readFile(inputPath, "utf8"));
  const existing = await loadExistingBaked();
  const merged = mergeBaked(existing, dump);

  await writeFile(defaultsPath, formatDefaults(merged), "utf8");
  console.log(`Baked defaults written to ${path.relative(process.cwd(), defaultsPath)}`);
  console.log(`Levels: ${merged.levels ? Object.keys(merged.levels).filter(k => k !== "_gone").length : 0}`);
}

main();
