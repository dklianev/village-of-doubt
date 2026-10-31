import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EvidenceWallEmpty } from "@/components/history/EvidenceWallEmpty";

const appRoot = join(__dirname, "..", "..");

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return entry.name === "__tests__" ? [] : sourceFiles(path);
    return entry.name.endsWith(".tsx") ? [path] : [];
  });
}

describe("next/image props", () => {
  it("uses preload instead of the deprecated priority prop", () => {
    const offenders = ["app", "components"].flatMap((directory) => sourceFiles(join(appRoot, directory)))
      .filter((file) => [...readFileSync(file, "utf8").matchAll(/<Image\b[^>]*>/g)].some(([tag]) => /\spriority\b/.test(tag)))
      .map((file) => relative(appRoot, file));
    expect(offenders).toEqual([]);
  });

  it("loads the empty archive hero eagerly because it is the largest paint", () => {
    const { container } = render(<EvidenceWallEmpty />);
    expect(container.querySelector("img")).toHaveAttribute("loading", "eager");
  });
});
