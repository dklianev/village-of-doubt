import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

type Rule = { selectors: string[]; body: string };

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const REDUCED_MOTION = /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{/g;
const IDENTITY_TRANSFORM = /^(none|translate[XY]?\(0(px)?\)|scale\(1\))$/;

function blockEnd(css: string, open: number) {
  let depth = 0;
  for (let index = open; index < css.length; index += 1) {
    if (css[index] === "{") depth += 1;
    else if (css[index] === "}" && --depth === 0) return index;
  }
  throw new Error("unbalanced CSS block");
}

function splitSelectors(list: string) {
  const selectors: string[] = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < list.length; index += 1) {
    if (list[index] === "(") depth += 1;
    else if (list[index] === ")") depth -= 1;
    else if (list[index] === "," && depth === 0) {
      selectors.push(list.slice(start, index).trim());
      start = index + 1;
    }
  }
  return [...selectors, list.slice(start).trim()];
}

function rulesIn(css: string): Rule[] {
  return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, selectors, body]) => ({
    selectors: splitSelectors(selectors!),
    body: body!,
  }));
}

function splitReducedMotion(css: string) {
  const guarded: Rule[] = [];
  let rest = "";
  let cursor = 0;
  for (const match of css.matchAll(REDUCED_MOTION)) {
    const open = match.index + match[0].length - 1;
    const end = blockEnd(css, open);
    guarded.push(...rulesIn(css.slice(open + 1, end)));
    rest += css.slice(cursor, match.index);
    cursor = end + 1;
  }
  return { guarded, rest: rest + css.slice(cursor) };
}

function declaration(body: string, property: string) {
  return body.match(new RegExp(`(?:^|;)\\s*${property}\\s*:\\s*([^;]+)`))?.[1]?.trim();
}

function sets(guarded: Rule[], selector: string, property: string) {
  return guarded.some((rule) => rule.selectors.includes(selector) && declaration(rule.body, property) === "none");
}

// A hover shift is gone when it no longer applies, or when the element stops transitioning into it.
function isNeutralized(guarded: Rule[], selector: string, property: "animation" | "transform") {
  if (sets(guarded, selector, property)) return true;
  return property === "transform" && sets(guarded, selector.replace(/:(hover|active)(:not\([^)]*\))*/g, ""), "transition");
}

function motionIn(rest: string) {
  return rulesIn(rest).flatMap((rule) => {
    const animation = declaration(rule.body, "animation");
    const transform = declaration(rule.body, "transform");
    return rule.selectors.flatMap((selector) => [
      ...(animation && animation !== "none" ? [{ selector, property: "animation" as const }] : []),
      ...(transform && /:(hover|active)/.test(selector) && !IDENTITY_TRANSFORM.test(transform)
        ? [{ selector, property: "transform" as const }]
        : []),
    ]);
  });
}

describe("reduced motion", () => {
  it.each([
    "components/onboarding/WelcomeModal.module.css",
    "components/feedback/FeedbackWidget.module.css",
    "components/site-chrome/SiteChrome.module.css",
  ])("%s stops every entrance animation and hover movement", (path) => {
    const { guarded, rest } = splitReducedMotion(read(path));
    const motion = motionIn(rest);

    expect(motion.length).toBeGreaterThan(0);
    expect(motion.filter(({ selector, property }) => !isNeutralized(guarded, selector, property))).toEqual([]);
  });

  it.each([
    [".toast-card", "animation"],
    [".shortcut-modal", "animation"],
    [".btn:hover:not(:disabled)", "transform"],
    [".btn:active:not(:disabled)", "transform"],
  ] as const)("globals.css %s drops its %s", (selector, property) => {
    const { guarded } = splitReducedMotion(read("app/globals.css"));

    expect(isNeutralized(guarded, selector, property)).toBe(true);
  });
});
