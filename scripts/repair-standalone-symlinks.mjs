import {
  existsSync,
  readlinkSync,
  readdirSync,
  statSync,
  symlinkSync,
  unlinkSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export function repairWindowsStandaloneSymlinks(rootDirectory, platform = process.platform) {
  if (platform !== "win32" || !existsSync(rootDirectory)) return 0;

  let repaired = 0;
  const pendingDirectories = [resolve(rootDirectory)];

  while (pendingDirectories.length > 0) {
    const directory = pendingDirectories.pop();
    if (!directory) continue;

    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const entryPath = resolve(directory, entry.name);

      if (entry.isSymbolicLink()) {
        const target = readlinkSync(entryPath);
        const resolvedTarget = resolve(dirname(entryPath), target);
        if (!statSync(resolvedTarget).isDirectory()) continue;

        try {
          statSync(entryPath);
        } catch (error) {
          if (!isBrokenWindowsDirectoryLink(error)) throw error;
          unlinkSync(entryPath);
          symlinkSync(target, entryPath, "dir");
          repaired += 1;
        }
        continue;
      }

      if (entry.isDirectory()) pendingDirectories.push(entryPath);
    }
  }

  return repaired;
}

function isBrokenWindowsDirectoryLink(error) {
  return error instanceof Error && "code" in error && (error.code === "EPERM" || error.code === "ENOENT");
}

const isDirectRun = process.argv[1]
  ? import.meta.url === pathToFileURL(resolve(process.argv[1])).href
  : false;

if (isDirectRun) {
  const rootDirectory = resolve(process.argv[2] ?? "apps/web/.next/standalone/node_modules");
  const repaired = repairWindowsStandaloneSymlinks(rootDirectory);
  if (repaired > 0) console.log(`Repaired ${repaired} Windows standalone directory symlinks.`);
}
