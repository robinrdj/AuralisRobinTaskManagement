#!/usr/bin/env node
/**
 * Enforces the first-load budget.
 *
 * "First load" is what a visitor who has never signed in downloads to read the
 * landing page: the entry chunk plus the CSS. The board, the charts, the
 * drag-and-drop engine and the animation library are all behind dynamic
 * imports and are deliberately excluded — measuring the total would punish
 * code-splitting instead of rewarding it.
 *
 * Sizes are gzipped, because that is what actually crosses the network.
 */
import { readdir, readFile, stat } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const ASSETS = path.join(ROOT, "apps/web/dist/assets");

/** Gzipped kilobytes. Raise deliberately, with a reason, never to get green. */
const BUDGETS = {
  firstLoad: 160,
  anySingleLazyChunk: 130,
};

async function gzippedKb(file) {
  const contents = await readFile(file);
  return gzipSync(contents).length / 1024;
}

function isEntry(name) {
  // Vite names the entry chunk after the HTML entry point.
  return /^index-[\w-]+\.js$/.test(name);
}

async function main() {
  let files;
  try {
    files = await readdir(ASSETS);
  } catch {
    console.error(`No build output at ${ASSETS}. Run \`npm run build\` first.`);
    process.exit(1);
  }

  const measured = [];
  for (const name of files) {
    const full = path.join(ASSETS, name);
    if (!(await stat(full)).isFile()) continue;
    if (!/\.(js|css)$/.test(name) || name.endsWith(".map")) continue;
    measured.push({ name, kb: await gzippedKb(full) });
  }

  const entry = measured.filter((file) => isEntry(file.name) || file.name.endsWith(".css"));
  const lazy = measured.filter((file) => !entry.includes(file));
  const firstLoad = entry.reduce((sum, file) => sum + file.kb, 0);

  console.log("First load (what a signed-out visitor downloads):");
  for (const file of entry.sort((a, b) => b.kb - a.kb)) {
    console.log(`  ${file.name.padEnd(34)} ${file.kb.toFixed(1).padStart(7)} KB`);
  }
  console.log(`  ${"total".padEnd(34)} ${firstLoad.toFixed(1).padStart(7)} KB`);

  console.log("\nLoaded on demand:");
  for (const file of lazy.sort((a, b) => b.kb - a.kb)) {
    console.log(`  ${file.name.padEnd(34)} ${file.kb.toFixed(1).padStart(7)} KB`);
  }

  const failures = [];
  if (firstLoad > BUDGETS.firstLoad) {
    failures.push(
      `First load is ${firstLoad.toFixed(1)} KB gzipped, over the ${BUDGETS.firstLoad} KB budget.`
    );
  }
  for (const file of lazy) {
    if (file.kb > BUDGETS.anySingleLazyChunk) {
      failures.push(
        `${file.name} is ${file.kb.toFixed(1)} KB gzipped, over the ${BUDGETS.anySingleLazyChunk} KB per-chunk budget.`
      );
    }
  }

  if (failures.length > 0) {
    console.error(`\n✗ Bundle budget exceeded:\n  ${failures.join("\n  ")}`);
    process.exit(1);
  }

  console.log(
    `\n✓ First load ${firstLoad.toFixed(1)} KB gzipped, within the ${BUDGETS.firstLoad} KB budget.`
  );
}

await main();
