# Codex prompt — PR M8: Hero presence boost

**Scope**: 5 thin-content hero pages feel too small after v2.1 restoration. Banner images are squashed because SceneCard sizes to content, and these pages use `Display size="h1"` instead of `size="hero"`. Fix: add optional `minHeight` to `SceneCardBackground` config + bump heading size on the affected pages.

**Effort**: ~45 minutes, 4 atomic commits.

**Pages affected**: `/privacy`, `/terms`, `/report`, `/faq`, `/status`.

**Not affected**: `/account` (avatar + stats grid already give it height), `/history` (already uses `size="hero"`), `/replay` (sections below hero), `/friends`, `/achievements`, `/leaderboard`, `/tutorial`, `/sign-in`, `/create` (review only if user explicitly reports them as thin).

---

## Operating rules (inherit from v2.1)

1. After every commit: `pnpm regression && pnpm typecheck && pnpm build`. If red → `git revert HEAD`.
2. After commits touching `packages/ui/src/**`: `pnpm --filter @werewolf/ui test && pnpm visual:ui`.
3. After page-level commits: `pnpm visual --grep "privacy|terms|report|faq|status"` → review diff PNGs manually → only then `pnpm visual:update`.
4. **Additive only** — `minHeight` is optional prop on existing object. Backwards compatible.
5. **No new dependencies.**
6. **No `prefers-reduced-motion` guards.**
7. **No new fonts.**
8. **Bulgarian copy preserved** — no text changes. `bg-copy-reviewer` agent NOT needed (no JSX text edits).
9. **Anti-pattern guard stays enforced** — no `:global()` primitive overrides anywhere.
10. **Motion file count = 3** — this PR is CSS-only, no motion changes.
11. **API health invariant** — SceneCard stays at 7 top-level props. The new `minHeight` is nested inside the `background` config object, NOT a top-level prop.

---

## Pre-flight

```bash
# v2.1 must have landed
grep -q "interface SceneCardBackground" packages/ui/src/primitives/SceneCard.tsx  && echo "✓ SceneCard.background exists"
test -f docs/hero-restoration-closing-report.md                                    && echo "✓ v2.1 closed"
pnpm regression 2>&1 | tail -3                                                     # must be green
pnpm --filter @werewolf/ui test 2>&1 | tail -3                                     # all passing

# Snapshot current thin-page hero heights for before/after comparison
# (visual baselines act as the ground truth)
```

---

## Commit 1 — Foundation: extend `SceneCardBackground` with `minHeight`

### Edit `packages/ui/src/primitives/SceneCard.tsx`

```diff
 export interface SceneCardBackground {
   image: string;
   overlay?: "scrim" | "veil" | "none";
   focalX?: number;
   focalY?: number;
+  /** Min-height of the card when background is rendered. Use a clamp() for responsive scaling. */
+  minHeight?: string;
 }
```

In the render function, propagate `minHeight` to the outer Surface style:

```diff
   return (
     <Surface
       variant="scene"
       radius="card"
       elevation="scene"
       data-ds-scene-card={density}
-      style={hasBackground ? { position: "relative", overflow: "hidden" } : undefined}
+      style={
+        hasBackground
+          ? {
+              position: "relative",
+              overflow: "hidden",
+              minHeight: background?.minHeight,
+            }
+          : undefined
+      }
     >
```

When `background.minHeight` is undefined, the inline style has `minHeight: undefined` which the browser ignores — backwards compatible with existing SceneCard consumers.

### Add story to `SceneCard.stories.tsx`

```tsx
export const WithBackgroundTallHero: Story = {
  args: {
    eyebrow: "ПОВЕРИТЕЛНОСТ",
    density: "lg",
    background: {
      image: "var(--art-privacy)",
      overlay: "scrim",
      minHeight: "clamp(320px, 36vh, 460px)",
    },
    children: (
      <>
        <Display size="hero">Открит трезор за данните ти</Display>
        <p style={{ color: "var(--ds-ink-scene-soft)", fontSize: "var(--ds-type-lede)", margin: 0 }}>
          Виж точно какво пазим, защо и как можеш да го изтриеш.
        </p>
      </>
    ),
  },
};
```

### Add test case to `SceneCard.test.tsx`

```tsx
it("applies minHeight to Surface when background.minHeight is provided", () => {
  const { container } = render(
    <SceneCard background={{ image: 'url("/x.webp")', minHeight: "400px" }}>x</SceneCard>,
  );
  const surface = container.firstChild as HTMLElement;
  expect(surface.style.minHeight).toBe("400px");
});

it("does not set minHeight when omitted (backwards compat)", () => {
  const { container } = render(
    <SceneCard background={{ image: 'url("/x.webp")' }}>x</SceneCard>,
  );
  const surface = container.firstChild as HTMLElement;
  expect(surface.style.minHeight).toBe("");
});
```

### Append to `packages/ui/docs/tokens.md`

Under the existing "Hero banners via SceneCard background" section, add:

```md
### Tall hero presence

Thin-content hero pages (headline + short subtitle, no rich grid) may feel too
small because the SceneCard sizes to content. Use `background.minHeight` to
guarantee a minimum presence:

```tsx
<SceneCard
  eyebrow="ПОВЕРИТЕЛНОСТ"
  density="lg"
  background={{
    image: "var(--art-privacy)",
    overlay: "scrim",
    minHeight: "clamp(320px, 36vh, 460px)",  // mobile floor / desktop scale / cap
  }}
>
  <Display size="hero">…</Display>
  …
</SceneCard>
```

Use `clamp()` so the height scales gracefully across viewports. Suggested
values for thin hero pages: `clamp(320px, 36vh, 460px)`.
```

### Run gates

```bash
pnpm --filter @werewolf/ui test
pnpm --filter @werewolf/ui build
pnpm visual:ui --update-snapshots   # +1 new story × 2 themes × 2 viewports = 4 new baselines
# Inspect new SceneCard/WithBackgroundTallHero baselines manually
pnpm regression && pnpm typecheck && pnpm build
```

**Commit message**:
```
feat(ui): add minHeight to SceneCardBackground for hero presence

Thin-content hero pages (Display + paragraph only) need a minimum height
guarantee so the banner image has room to breathe. Optional, backwards
compatible — when omitted, behaviour unchanged.
```

---

## Commit 2 — Apply to legal pages (/privacy, /terms, /report)

### Edit `apps/web/components/privacy/PrivacyHero.tsx`

```diff
       <SceneCard
         eyebrow="…"
         density="lg"
         background={{
           image: "var(--art-privacy)",
           overlay: "scrim",
+          minHeight: "clamp(320px, 36vh, 460px)",
         }}
       >
-        <Display size="h1">…</Display>
+        <Display size="hero">…</Display>
```

### Edit `apps/web/components/terms/TermsHero.tsx`

Same pattern:
```diff
         background={{
           image: "var(--art-terms)",
           overlay: "scrim",
+          minHeight: "clamp(320px, 36vh, 460px)",
         }}
       >
-        <Display size="h1">…</Display>
+        <Display size="hero">…</Display>
```

### Edit `apps/web/components/report/ReportHero.tsx`

```diff
         background={{
           image: "var(--art-report)",
           overlay: "scrim",
           focalY: 40,
+          minHeight: "clamp(320px, 36vh, 460px)",
         }}
       >
-        <Display size="h1">…</Display>
+        <Display size="hero">…</Display>
```

### Verify mobile layout

The `Display size="hero"` is `var(--ds-type-display)` = 4rem = 64px on default scale. On 375px mobile viewport, ensure the heading wraps cleanly (use `textWrap: balance` if not already in Display primitive — it should be).

If a heading on any of the 3 pages overflows or wraps awkwardly on mobile, tune the heading copy OR add a small CSS module override on the page-local `heroFrame` wrapper:

```css
.heroFrame [data-ds-scene-card] :where(h1) {
  font-size: clamp(2.5rem, 6vw, 4rem);
}
```

(This is wrapper-context selector — allowed per §3.5 of v2 master.)

### Run gates

```bash
pnpm regression && pnpm typecheck && pnpm build
pnpm visual --grep "privacy|terms|report"
# Inspect each diff PNG manually
# Expect: hero card visibly taller, banner more prominent, heading larger
```

**Commit message**:
```
style(legal): enlarge privacy, terms, report hero presence

Bump Display size to hero and set background.minHeight clamp so banner
images have room to breathe. Affects only the three thin-content legal
hero pages identified in user feedback.
```

---

## Commit 3 — Apply to /faq + /status

### Edit `apps/web/components/faq/FaqHearth.tsx`

```diff
         background={{
           image: "var(--art-faq)",
           overlay: "scrim",
+          minHeight: "clamp(320px, 36vh, 460px)",
         }}
       >
-        <Display size="h1">…</Display>
+        <Display size="hero">…</Display>
```

### Edit `apps/web/components/status/StatusHero.tsx`

```diff
         background={{
           image: "var(--art-status)",
           overlay: "veil",
+          minHeight: "clamp(320px, 36vh, 460px)",
         }}
       >
-        <Display size="h1">…</Display>
+        <Display size="hero">…</Display>
```

`overlay: "veil"` stays — status is reassuring, not cinematic. The veil + taller card + larger heading combination should feel like a calm watchtower banner rather than a billboard.

### Verify mobile layout

Same check as Commit 2.

### Run gates

```bash
pnpm regression && pnpm typecheck && pnpm build
pnpm visual --grep "faq|status"
# Inspect each diff PNG
```

**Commit message**:
```
style(faq, status): enlarge hearth and watchtower hero presence

Same minHeight + hero heading treatment as legal pages. Status keeps
veil overlay (reassuring), FAQ keeps scrim (cinematic warmth).
```

---

## Commit 4 — Visual baselines

After Commits 2 and 3, baselines have shifted on 5 pages × 2 themes × 2 viewports = ~20 baselines.

```bash
# Final inspection
pnpm visual --grep "privacy|terms|report|faq|status"

# If all diffs look correct (taller hero, larger heading, more banner presence),
# update baselines:
pnpm visual --grep "privacy|terms|report|faq|status" --update-snapshots
```

**Commit message**:
```
test(visual): refresh hero baselines for enlarged legal, faq, status banners

Hero cards now have clamp(320px, 36vh, 460px) minimum height and use
Display size="hero". Baselines updated to reflect the intentional
visual change.
```

---

## Acceptance criteria

| Metric | Target |
|---|---|
| `SceneCardBackground.minHeight` prop exists | ✅ |
| SceneCard top-level props count | **still 7** (no growth) |
| Pages with new minHeight consumer | **5** (privacy, terms, report, faq, status) |
| Pages with Display size="hero" hero | **6** (history + the 5 above) |
| Visual baselines updated | **~20** new diffs accepted |
| Motion file count | **3** (unchanged) |
| `:global()` primitive overrides | **0** (unchanged) |
| New dependencies | **0** |
| `pnpm regression` | green |
| `pnpm typecheck` | green |
| `pnpm verify` | green at PR boundary |

Qualitative:
- `/privacy`, `/terms`, `/report`, `/faq`, `/status` hero feels intentional, not squashed
- Banner image has visible room (no longer compressed into ~250px strip)
- Heading carries gravitas matching /history's hero
- Mobile (375px) still readable, heading wraps cleanly
- Dark + light theme both look right

---

## Failure modes

| Symptom | Fix |
|---|---|
| Heading overflows on mobile 375px | Tune copy OR add wrapper-context `font-size: clamp(...)` override on `heroFrame` class |
| Hero feels TOO tall on mobile | Lower min-height floor (e.g. `clamp(280px, 36vh, 460px)`) |
| Banner image looks zoomed-in too far | Tune `focalY` (e.g. `focalY: 30` to show more of upper portion) |
| `pnpm visual` flags unexpected diff on non-target pages | Inspect; if the prop change affected other consumers, that's a bug — revert and re-check |
| `pnpm --filter @werewolf/ui test` fails | New test selector wrong; check `surface.style.minHeight` instead of `getComputedStyle` (jsdom limitations) |
| API health audit warns SceneCard exceeds 7 props | Should NOT happen — minHeight is nested in background, not top-level. Verify by recounting |

---

## Operator notes

- **This is a micro-PR.** 4 commits, ~45 min. Don't fold them into 1 — atomic commit history matters even for small changes.
- **Visual baselines WILL change** on 5 pages. That's intentional. Inspect each diff before updating.
- **`background.minHeight` is the ONLY public API addition.** Don't add `background.maxHeight` or other size props in this PR — YAGNI.
- **Skip `bg-copy-reviewer` agent** — no Bulgarian text changes in this PR.
- **`frontend-design` skill optional** at PR close-out — ask only if user wants visual review of the 5 polished pages.
- **No new tokens.** The `clamp(320px, 36vh, 460px)` lives in consumer code; if 3+ pages converge on identical clamp later, promote to `--ds-hero-min-height` token in a follow-up.
- **Sacred files unchanged.**

---

## After this PR lands

Run `pnpm visual --update-snapshots` if not already done. Then deploy + visual check on production.

If after deploy other pages feel similarly thin, open a PR M8.1 with the same treatment for those specific pages. Don't speculatively apply minHeight to all 14 v2.1 hero pages — only those that demonstrably need it.

Done. v2.1 hero restoration is now complete with proper hero presence.
