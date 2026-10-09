import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll } from "vitest";

// Vitest does not apply imported CSS; exercise the actual document-cover rules.
const style = document.createElement("style");
style.textContent = readFileSync(resolve("lib/auth-session-end.css"), "utf8");
beforeAll(() => { document.head.append(style); });
afterAll(() => { style.remove(); });
