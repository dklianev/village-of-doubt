import { readFile, writeFile } from "node:fs/promises";

const CLIENT_ENTRY_FILES = ["dist/index.js", "dist/index.cjs"];
const DIRECTIVE = '"use client";';

for (const file of CLIENT_ENTRY_FILES) {
  const source = await readFile(new URL(`../${file}`, import.meta.url), "utf8");
  if (!source.startsWith(DIRECTIVE)) {
    await writeFile(new URL(`../${file}`, import.meta.url), `${DIRECTIVE}\n${source}`);
  }
}
