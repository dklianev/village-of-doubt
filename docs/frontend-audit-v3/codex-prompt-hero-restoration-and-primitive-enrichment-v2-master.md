# Codex master prompt v2 — Hero restoration + primitive enrichment (master)

**Status**: authoritative. Supersedes `codex-prompt-hero-restoration-and-page-polish-v1.md` (kept as historical reference).

**What this prompt is**: a single, self-contained playbook for restoring per-page identity AND enriching primitives so they feel premium. Covers ~18 hours of Codex work at high reasoning, ~42 atomic commits, **11 PRs** in two interleaved streams.

**Update log (2026-05-25 — v2.1)**:
- §M1.0 added: prep commits for missing `--art-*` tokens + `data-faction` separation from `data-theme`
- §M2–§M5 hero restorations now use `var(--art-page)` tokens uniformly (not raw image-set strings)
- §N1.4 expanded with a11y tests for shimmer + tracked + faction variants
- §M7.1 adds primitive API health check (prop count audit, warn-only)
- §3.2 adds "API health" requirement before any primitive extension

**TL;DR for handoff** (paste this when starting a Codex session):

> Execute the v2 master prompt at `docs/frontend-audit-v3/codex-prompt-hero-restoration-and-primitive-enrichment-v2-master.md`. Start with §M0 (visual audit). Stop after each PR for review. Two streams: M = page restoration, N = primitive enrichment. Execution order is in §2. Operating rules in §0 are non-negotiable.

---

# §0 — Operating rules (non-negotiable)

> Cumulative with previous prompts. New rules marked **(v2)**.

1. After every commit: `pnpm regression && pnpm typecheck && pnpm build`. If red → `git revert HEAD`.
2. At each PR boundary: full `pnpm verify`.
3. Visual regression: `pnpm visual` and `pnpm visual:ui` MUST be reviewed manually before `pnpm visual:update`. Hero restoration WILL change snapshots — that's intentional, inspect each diff.
4. **NO `prefers-reduced-motion` guards anywhere.** Project convention.
5. **NO new fonts.** Stack stays: Noto Serif Display + Noto Serif + Iowan Old Style.
6. **NO new dependencies.** SceneCard extension is pure CSS/React. Pill shimmer is CSS-only. Motion stays in 3 existing files.
7. Sacred preservation list (§1) — DO NOT TOUCH.
8. After every commit touching JSX text or `.md` → invoke `bg-copy-reviewer` agent.
9. PRs ship in the order defined in §2. Don't open the next PR until the previous one merges + visual baselines settled.
10. Atomic commits, no folding. Each commit owns ≤ 1 conceptual change.
11. **(v2)** **NO `:global()` selectors in CSS modules that override primitive identity.** Enforced by regression guard in §M1. The `:global(.history-shell .paper-card)` anti-pattern that broke `/history` is the bug this rule prevents. See §3 for the precise pattern.
12. **(v2)** **Motion discipline strictly tiered.** See §0.1 below. Motion stays in 3 primitive files only.
13. **(v2)** **No page-name props on primitives.** Forbidden: `historyMode`, `accountDossierTone`. Required: semantic props like `accent="archive" | "dossier"`. See §3.
14. **(v2)** **Per-page identity is encouraged** through page-local CSS modules + new tokens + wrapper-context selectors. What's forbidden is overriding shared primitive identity globally.
15. **(v2)** **Token-first preference.** Before extending a primitive, check if a new `--ds-*` token solves it. New colour → token. New shadow → token. Only when token-first proves insufficient → extend primitive.

## §0.1 — Motion discipline (Tier 1/2/3)

| Tier | Use Motion? | Where | Examples |
|---|---|---|---|
| **Tier 1** | NO — CSS only | All button/card hover/press states, shimmer, focus rings, skeleton shimmer, colour transitions | Pill shimmer (N1), PaperCard hover lift (N2) |
| **Tier 2** | YES — but only in existing 3 files | `Dialog.tsx`, `Sheet.tsx`, `Toast.tsx` — entrance/exit animations | Spring open/close (N3), drag-to-dismiss (N3), Toast stagger (N3) |
| **Tier 3** | YES — page-local components only | Achievement unlock celebration, phase transition cinematic, narrative moments | Existing `DeathRevealCinematic.tsx`, `PhaseTransitionOverlay.tsx` |

**Forbidden**:
- Motion in `Pill`, `PaperCard`, `SceneCard`, `Display`, `Eyebrow`, `Medallion`, `EmptyState`, `Surface`
- Motion for things CSS `transition` can do
- New Tier 3 usages without bundle-budget check
- `prefers-reduced-motion` guards (project convention)

## §0.2 — Atomic commit gates

After EVERY commit:

```bash
pnpm regression && pnpm typecheck && pnpm build
```

After commits touching `packages/ui/src/**`:

```bash
pnpm --filter @werewolf/ui test
pnpm visual:ui
```

After commits touching page chrome (hero / cards / buttons):

```bash
pnpm visual
# Inspect each diff PNG manually before pnpm visual:update
```

At each PR boundary:

```bash
pnpm verify
```

---

# §1 — Sacred preservation list

DO NOT TOUCH unless a specific PR section authorises:

- `apps/web/hooks/use-timer-countdown.ts`
- `apps/web/lib/use-modal.ts`, `auth-errors.ts`, `clipboard.ts`
- `apps/web/components/account/AccountDangerZone.tsx` — body frozen; outer wrapper may change in M2 only
- `apps/web/components/play-room-client.tsx` — frozen for entire v2; play UI not affected
- `apps/web/components/play/*.tsx` — frozen; only M3 may touch play-adjacent items if explicit
- `apps/game-server/src/**` — out of scope, frontend-only work
- `packages/shared/src/{role-assignment,win-conditions,protocol}.ts` — frozen
- `apps/game-server/src/game-logic/night-resolver.ts` — frozen
- All `--art-*` tokens in `globals.css:50-80` — kept; just consume them via new SceneCard prop
- All 11 existing primitives' EXISTING props — only N1, N2, M1 add NEW optional props
- Bulgarian production copy — only intentional polish text changes; `bg-copy-reviewer` agent reviews

---

# §2 — Execution order (single source of truth)

Two parallel streams interleaved to maximise primitive richness before page consumption:

```
PR  │ Stream │ Effort │ Cumulative │ Gate before next
────┼────────┼────────┼────────────┼─────────────────
M0  │ M      │ ~30min │ 0.5h       │ Audit report committed
M1  │ M      │ ~1.5h  │ 2.0h       │ §M1.0 prep + SceneCard.background tested + anti-pattern guard live (WARN)
N1  │ N      │ ~2h    │ 4.0h       │ Pill enrichment tested (incl. a11y)
N2  │ N      │ ~1h    │ 5.0h       │ Card interactive tested
M2  │ M      │ ~2h    │ 7.0h       │ /account + /status look intentional
M3  │ M      │ ~3h    │ 10.0h      │ /history identity restored, no overrides, guard flipped to FAIL
M4  │ M      │ ~2h    │ 12.0h      │ /privacy + /terms feel distinct
N3  │ N      │ ~1h    │ 13.0h      │ Motion polish tested
M5  │ M      │ ~2h    │ 15.0h      │ /report + /faq feel right
M6  │ M      │ ~3h    │ 18.0h      │ 6 pages restored
N4  │ N      │ ~2-3h  │ ~21h       │ Conditional — only if triggered
M7  │ M      │ ~1h    │ ~22h       │ Final sweep + measure + API health audit
```

**Why this order**:
- M0 audit grounds everything in reality (not speculation)
- M1 + N1 + N2 build the foundation BEFORE consumption
- M2 pilot proves the pattern on 2 distinct moods (`scrim` + `veil` overlays)
- M3 is the hardest — done early while energy is high, benefits from enriched primitives
- N3 motion polish happens mid-stream — refines what's already shipping
- M6 batches the remaining pages once the pattern is well-rehearsed
- N4 is conditional — only if M3-M6 reveal concrete duplication triggers
- M7 closes with measurement + hardening

**Strict rule**: don't open M3 until N1 + N2 merged. Don't open M5 until N3 merged. Codex enforces this by checking `git log --oneline | grep -E "(feat\(ui\): add shimmer|feat\(ui\): add interactive)"` before starting M3 etc.

---

# §3 — Primitive extension policy

## §3.1 — Threshold for extension

- **2+ pages benefit** from same new prop/variant → extend primitive
- **1 page only** → page-local CSS module wrapper-context selector
- **5+ pages share same composition** → consider new composite primitive

## §3.2 — Required for every extension

1. **Additive only** — no breaking changes to existing API
2. **Unit test + story** for new prop/variant
3. **Updated `packages/ui/docs/tokens.md`**
4. **Pass `pnpm visual:ui`** — no regression on existing baselines
5. **Pass anti-pattern regression guard** — no `:global()` override
6. **API health check** — if the primitive will exceed **7 props** after this addition, STOP and consider composition (e.g. `HeroBanner = SceneCard + Display + Eyebrow`) instead of adding a 8th prop. Audit current count via:
   ```bash
   grep -oE "^\s+\w+\??:" packages/ui/src/primitives/<Name>.tsx | wc -l
   ```
   Threshold rationale: 7 props ≈ the upper bound where a primitive stays mentally manageable. Beyond that, consumers can't infer the API without docs every time, and the primitive becomes a god component.
7. **A11y verification** — new visual states (shimmer, lift, glow, animation) must preserve:
   - Focus ring visibility (test with `:focus-visible` story variant)
   - Contrast AA (4.5:1 small text, 3:1 large) on every intent × theme combination
   - Screen reader semantics unchanged (text content, ARIA roles)

## §3.3 — Forbidden naming

- **Page-name props**: `historyMode`, `accountDossierTone`, `terms-style` — banned
- **Boolean feature flags**: `isHero`, `useBackground` — prefer object props
- **Generic dump props**: `customStyle`, `extraClassName`, `override` — banned

**Required pattern**: semantic, intent-revealing prop names. `intent="primary"`, `accent="archive"`, `tone="warning"`, `density="lg"`.

## §3.4 — Token-first preference

Before adding a primitive prop, check if a new `--ds-*` token solves it:

- New colour need → add to `tokens.css`
- New shadow → add to `tokens.css`
- New spacing rhythm → reuse existing `--ds-space-*`
- New duration → add to `tokens.css`
- New gradient → add to `tokens.css`

Tokens are zero-risk (no API change), zero-cost (no test), and propagate instantly across all consumers.

## §3.5 — Anti-pattern: `:global()` overrides

```css
/* ❌ FORBIDDEN — overrides primitive identity, regression guard catches */
:global(.paper-card) { background: dark }
:global([data-ds-scene-card]) { color: white }
:global(.history-shell .paper-card) { ... }
:global(.history-shell [data-ds-scene-card]) { background: gradient }

/* ✓ ALLOWED — wrapper-context accent, primitive identity intact */
.caseFileShell[data-outcome="win"] [data-ds-scene-card] {
  border-left: 2px solid var(--ds-accent-green);  /* accent on wrapper's child, not redefining what SceneCard means */
}
.heroFrame [data-ds-scene-card] {
  margin-bottom: 24px;  /* layout positioning, not visual identity */
}
```

Distinguishing rule: if the selector inside `:global()` matches a primitive's class/data-attribute **directly**, it's an override (forbidden). If the selector reaches a primitive **through a wrapper class context**, it's an accent (allowed).

---

# §4 — Per-page identity guide (creative direction)

Each page has a distinct atmosphere. When polishing, lean into these moods. Use existing motifs in the asset bank — don't invent new ones.

| Page | Mood | Existing motifs | Polish direction |
|---|---|---|---|
| `/account` | **Dignified dossier** | Gold-bordered avatar, monospace stats, account-hero-banner | Strengthen gold accents, warm brown undertone, stats feel like a tally not a metrics dashboard |
| `/history` | **Detective archive** | Red thread, evidence cards, sepia bg-history-archive | Cinematic dark; carded entries with subtle outcome accents (NO tilt or pushpin) |
| `/privacy` | **Open vault** | Brass keys, transparent panes, privacy-banner | Warm, trustworthy; hero feels reassuring, not intimidating |
| `/terms` | **Sealed handshake** | Wax seal, formal documents, terms-banner | Restrained, formal, slightly cooler than /privacy |
| `/report` | **Lighthouse beacon** | Light beam over dark water, report-banner | Hero feels like beacon; bright accent against deep background; helpful, not alarming |
| `/faq` | **Hearth glow** | Fire embers, gathered chairs, faq-hearth-banner + motif | Warm orange/amber glow; conversational; hero feels like sitting near a fire |
| `/status` | **Operational watchtower** | Lighthouse harbor, monitoring lights, status-banner | Clean, calm; banner reassuring presence; tiles are the focus |
| `/friends` | **Social table** | Empty chairs, sealed invitations, friends-banner | Warmth of "places at the table"; pending invites feel like letters |
| `/achievements` | **Legends shelf** | Medallions, unlocked stories | Shelf hierarchy; locked vs unlocked feels mythical, not gamified |
| `/leaderboard` | **Evening newspaper** | Masthead, editorial typography | Newspaper rhythm; rankings as bylines, not scoreboards |
| `/tutorial` | **First steps at the table** | Slide flipbook, welcome | Instructional clarity; gentle decorations, never noisy |
| `/sign-in` | **Threshold / invitation** | Door, tavern entry | Warm entry stage; OAuth buttons clean; form feels like a welcome |
| `/create` (3 versions) | **Tavern preparation** | Tavern background, candle light | Tavern bg visible in default theme; faction accent drives colour (werewolves green / mafia red) |

Use this table when invoking `frontend-design` skill — paste the relevant row as creative context.

---

# §M0 — Visual audit before code (~30 min, 1 commit)

**Goal**: ground all work in reality. No speculation about what's broken.

## §M0.1 — Inventory commands

```bash
# Audit primitive consumption
rg "SceneCard" apps/web --type tsx > /tmp/scenecard-consumers.txt
rg "PaperCard" apps/web --type tsx > /tmp/papercard-consumers.txt
rg "Pill" apps/web --type tsx > /tmp/pill-consumers.txt

# Audit anti-pattern presence (will be fixed in M1 regression guard)
rg ":global\([^)]*\.(paper-card|scene-card|pill|medallion|surface)" apps/web > /tmp/primitive-overrides.txt
rg ":global\([^)]*\[data-ds-" apps/web > /tmp/primitive-data-overrides.txt

# Audit hero banner assets actually used
rg "Image\b" apps/web/components --type tsx > /tmp/image-usages.txt
rg "art-(account|history|privacy|terms|report|faq|status|lobby|landing)" apps/web > /tmp/art-token-usages.txt

# Audit inline styles (potential CSS module extraction targets)
rg "style=\{\{" apps/web/components apps/web/app --type tsx | wc -l > /tmp/inline-style-count.txt

# Baseline metrics
wc -l apps/web/app/globals.css
find apps/web -name "*.module.css" | wc -l
pnpm visual 2>&1 | tail -3
pnpm visual:ui 2>&1 | tail -3
pnpm perf:budget 2>&1 | tail -5
pnpm regression 2>&1 | tail -3
```

## §M0.2 — Audit deliverable

Create `docs/hero-restoration-audit.md` with this table:

```md
# Hero restoration audit — 2026-XX-XX

## Per-page inventory

| Page | Hero state | Asset available | `:global()` overrides | Polish needed | Risk | PR |
|---|---|---|---|---|---|---|
| /account | flat SceneCard | account-hero-banner.{avif,webp,png} | 0 | medium | low | M2 |
| /history | flat + override-fight | bg-history-archive.{avif,webp,png} | 5 | HIGH | HIGH | M3 |
| /privacy | flat SceneCard | privacy-banner.{avif,webp,png} | 0 | medium | low | M4 |
| /terms | flat SceneCard | terms-banner.{avif,webp,png} | 0 | medium | low | M4 |
| /report | flat SceneCard | report-banner.{avif,webp,png} | 0 | medium | low | M5 |
| /faq | flat SceneCard | faq-hearth-banner.{avif,webp,png} | 0 | medium | low | M5 |
| /status | flat SceneCard | status-banner.{avif,webp,png} | 0 | small | low | M6 |
| /friends | unknown | friends-banner.{avif,webp,png} | ? | TBD | low | M6 |
| /achievements | unknown | ? | ? | TBD | low | M6 |
| /leaderboard | unknown | ? | ? | TBD | low | M6 |
| /tutorial | unknown | ? | ? | TBD | low | M6 |
| /sign-in | unknown | ? | ? | TBD | low | M6 |
| /create (×3) | tavern bg gated to dark | bg-lobby-tavern.{avif,webp,png} | 0 | theme check | low | M6 |

## Primitive override count by file

(Output of `rg ":global\(.*paper-card" apps/web --count-matches`)

## Notes per page

[Codex fills in: what looks specifically wrong, ideas, asset gaps]

## Imagegen needed?

| Page | Existing assets cover it? | If no, proposed imagegen |
|---|---|---|
| /achievements | check after audit | possible: legends-shelf.webp |
| /sign-in | check | possible: tavern-threshold.webp |
| /tutorial | check | possible: first-table-setup.webp |

(Imagegen runs ONLY if audit proves the asset bank is insufficient. Default OFF.)
```

**Commit**: `docs(audit): inventory flat hero pages and primitive override risks`

**M0 close-out**:
- Audit doc committed
- All metrics baseline captured
- Codex can reference real numbers (not estimates) in subsequent PRs

---

# §M1 — SceneCard.background foundation + theme separation (~1.5h, 6 commits)

**Goal**: add `background` prop to `SceneCard`, lock the anti-pattern as a regression guard, AND fix two architectural prep issues before any consumer touches the new APIs.

**Why prep first**: §M1.0 fixes two latent issues (missing tokens + theme/faction attribute collision) that would otherwise create technical debt as consumers adopt the new APIs. ~30 min of prep saves weeks of future cleanup.

## §M1.0 — Architectural prep (2 commits, ~30 min)

### §M1.0.a — Add missing `--art-*` tokens

Audit existing tokens:

```bash
grep -nE "^\s+--art-" apps/web/app/globals.css | head -20
```

Expected to be present already: `--art-landing`, `--art-history`, `--art-lobby`. Verify and add any missing for v2 work:

```css
/* Append to apps/web/app/globals.css :root block (NEAR existing --art-* tokens, not in a new section) */
--art-account: image-set(
  url("/game-art/account/account-hero-banner.webp") type("image/webp"),
  url("/game-art/account/account-hero-banner.png") type("image/png")
);
--art-privacy: image-set(
  url("/game-art/legal/privacy-banner.webp") type("image/webp"),
  url("/game-art/legal/privacy-banner.png") type("image/png")
);
--art-terms: image-set(
  url("/game-art/legal/terms-banner.webp") type("image/webp"),
  url("/game-art/legal/terms-banner.png") type("image/png")
);
--art-report: image-set(
  url("/game-art/legal/report-banner.webp") type("image/webp"),
  url("/game-art/legal/report-banner.png") type("image/png")
);
--art-faq: image-set(
  url("/game-art/legal/faq-hearth-banner.webp") type("image/webp"),
  url("/game-art/legal/faq-hearth-banner.png") type("image/png")
);
--art-status: image-set(
  url("/game-art/legal/status-banner.webp") type("image/webp"),
  url("/game-art/legal/status-banner.png") type("image/png")
);
--art-replay: image-set(
  url("/game-art/legal/replay-banner.webp") type("image/webp"),
  url("/game-art/legal/replay-banner.png") type("image/png")
);
--art-friends: image-set(
  url("/game-art/legal/friends-banner.webp") type("image/webp"),
  url("/game-art/legal/friends-banner.png") type("image/png")
);
```

For tokens that ALREADY exist, leave them. For mobile variants (inside `@media (max-width: 720px)` block), check if a mobile-optimized webp exists in `apps/web/public/game-art/mobile/legal/` — if yes, add the override; if no, the desktop token is reused (acceptable).

**Why this matters**: every subsequent §M2-§M5 hero restoration uses `var(--art-page)` instead of inline `image-set(url(...)...)` strings. Single point of change if assets move; responsive variants resolved centrally; consistent with existing `--art-history`/`--art-lobby` conventions.

**Commit M1.0.a**: `chore(tokens): add --art-* tokens for account, legal, friends, replay pages`

### §M1.0.b — Separate `data-faction` from `data-theme`

Currently `<main data-theme="werewolves">` and `<main data-theme="mafia">` overload the `data-theme` attribute (which also serves light/dark theme switching at the `<html>` level). This is a latent cascade collision: future light/dark toggle work will break faction styling.

**Migration**: rename faction `data-theme` to `data-faction` everywhere.

Search:

```bash
rg 'data-theme="(werewolves|mafia)"' apps/web --type tsx --type ts
rg 'data-theme="(werewolves|mafia)"' apps/web --type css
rg '\[data-theme="(werewolves|mafia)"\]' apps/web
```

Replace pattern:

```diff
- <main data-theme="werewolves" data-family="werewolves">
+ <main data-faction="werewolves" data-family="werewolves">
```

And in CSS:

```diff
- :global(html[data-theme="dark"] .lobby-shell::before) { display: block; }
+ /* keep dark theme rule unchanged — only faction-coloured rules change */
- [data-theme="werewolves"] .accent { ... }
+ [data-faction="werewolves"] .accent { ... }
```

**CRITICAL**: do NOT rename `data-theme="dark"` / `data-theme="light"` — those remain the canonical light/dark switch on `<html>`. Only rename `data-theme="werewolves"` / `data-theme="mafia"` to `data-faction="..."`.

After migration, `data-theme` is exclusively light/dark, `data-faction` is exclusively werewolves/mafia. Two orthogonal axes.

Update `AGENTS.md` to document the separation:

```md
### Theme + faction attributes

- `data-theme="light" | "dark"` lives on `<html>`. Drives surface/ink inversion.
- `data-faction="werewolves" | "mafia"` lives on page-level `<main>` (or any context container). Drives faction-coloured accents. Orthogonal to theme — a page can be light theme + werewolves faction simultaneously.

Primitives like `Pill intent="faction"` read `data-faction` from ancestor. They DO NOT read `data-theme`. This keeps light/dark and game-faction concerns independent.
```

**Commit M1.0.b**: `refactor(theme): separate data-faction from data-theme to prevent cascade collision`

## §M1.1 — Extend SceneCard

Edit `packages/ui/src/primitives/SceneCard.tsx`:

```diff
 import type { ReactNode } from "react";
 import { Eyebrow } from "./Eyebrow";
 import { Surface } from "./Surface";

+export interface SceneCardBackground {
+  /** CSS image source — URL or CSS image-set token (e.g. "var(--art-history)") */
+  image: string;
+  /** Overlay strength. Default: "scrim". */
+  overlay?: "scrim" | "veil" | "none";
+  /** Horizontal focal point in % (0 = left, 50 = center, 100 = right). */
+  focalX?: number;
+  /** Vertical focal point in %. */
+  focalY?: number;
+}
+
 export interface SceneCardProps {
   eyebrow?: string;
   density?: "sm" | "md" | "lg";
   meta?: ReactNode;
+  background?: SceneCardBackground;
   children: ReactNode;
 }

 const DENSITY_PAD = { sm: "16px", md: "28px", lg: "48px" } as const;

+const OVERLAY_GRADIENT = {
+  scrim: "linear-gradient(115deg, oklch(0.13 0.014 50 / 0.92) 0%, oklch(0.18 0.012 60 / 0.7) 44%, oklch(0.13 0.014 50 / 0.95) 100%)",
+  veil: "linear-gradient(180deg, oklch(0.13 0.014 50 / 0.78) 0%, oklch(0.18 0.012 60 / 0.5) 100%)",
+  none: "linear-gradient(180deg, oklch(0.13 0.014 50 / 0.3) 0%, oklch(0.18 0.012 60 / 0.2) 100%)",
+} as const;
+
-export function SceneCard({ eyebrow, density = "md", meta, children }: SceneCardProps) {
+export function SceneCard({ eyebrow, density = "md", meta, background, children }: SceneCardProps) {
+  const hasBackground = Boolean(background?.image);
+  const overlay = background?.overlay ?? "scrim";
+  const focalX = background?.focalX ?? 50;
+  const focalY = background?.focalY ?? 50;
+
   return (
-    <Surface variant="scene" radius="card" elevation="scene" data-ds-scene-card={density}>
-      <div style={{ padding: DENSITY_PAD[density], display: "grid", gap: "16px", color: "var(--ds-ink-scene)" }}>
+    <Surface
+      variant="scene"
+      radius="card"
+      elevation="scene"
+      data-ds-scene-card={density}
+      style={hasBackground ? { position: "relative", overflow: "hidden" } : undefined}
+    >
+      {hasBackground && (
+        <div
+          aria-hidden
+          style={{
+            position: "absolute",
+            inset: 0,
+            backgroundImage: `${OVERLAY_GRADIENT[overlay]}, ${background!.image}`,
+            backgroundSize: "cover, cover",
+            backgroundPosition: `${focalX}% ${focalY}%, ${focalX}% ${focalY}%`,
+            backgroundRepeat: "no-repeat, no-repeat",
+          }}
+        />
+      )}
+      <div
+        style={{
+          padding: DENSITY_PAD[density],
+          display: "grid",
+          gap: "16px",
+          color: "var(--ds-ink-scene)",
+          position: hasBackground ? "relative" : undefined,
+          zIndex: hasBackground ? 1 : undefined,
+        }}
+      >
         {(eyebrow || meta) && (
           <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "16px" }}>
             {eyebrow ? <Eyebrow tone="gold">{eyebrow}</Eyebrow> : <span />}
             {meta}
           </div>
         )}
         {children}
       </div>
     </Surface>
   );
 }
```

**Commit 1**: `feat(ui): add background prop to SceneCard with overlay and focal controls`

## §M1.2 — Stories + tests

Extend `SceneCard.stories.tsx` with `WithBackground`, `WithBackgroundVeil`, `WithBackgroundNoOverlay`, `WithBackgroundFocalShift` stories (full code in v1 §1.2).

Extend `SceneCard.test.tsx` with 3 test cases:
- `renders background layer when background.image is provided`
- `omits background layer when background prop is undefined`
- `applies scrim/veil/none overlay based on prop`

Run:
```bash
pnpm --filter @werewolf/ui test
pnpm visual:ui --update-snapshots   # 4 new SceneCard stories × 2 themes × 2 viewports = +16 baselines
```

Inspect new baselines manually before committing.

**Commit 2**: `test(ui): cover SceneCard background slot with stories and unit tests`

## §M1.3 — Regression guard for anti-pattern

Add to `scripts/regression.mjs`:

```js
import { glob } from "node:fs/promises";  // or via fast-glob if pinned

async function checkPrimitiveOverrideAntiPattern() {
  const PRIMITIVE_NAMES = ["paper-card", "scene-card", "pill", "medallion", "surface", "eyebrow", "display", "toast", "dialog", "sheet", "empty-state"];

  const FORBIDDEN_PATTERNS = [
    // Direct class override in :global()
    new RegExp(`:global\\([^)]*\\.(${PRIMITIVE_NAMES.join("|")})\\b`, "g"),
    // Direct data attribute override in :global()
    new RegExp(`:global\\([^)]*\\[data-ds-(${PRIMITIVE_NAMES.join("|")})\\b`, "g"),
  ];

  const files = []; // walk apps/web/components/**/*.module.css recursively
  // (implementation uses fs.readdir recursive — Codex fills in)

  const violations = [];
  for (const file of files) {
    const src = await fs.readFile(file, "utf8");
    for (const pattern of FORBIDDEN_PATTERNS) {
      const matches = src.matchAll(pattern);
      for (const match of matches) {
        violations.push({ file, line: src.slice(0, match.index).split("\n").length, match: match[0] });
      }
    }
  }

  if (violations.length > 0) {
    const detail = violations.map((v) => `  ${v.file}:${v.line}  ${v.match}`).join("\n");
    throw new Error(
      `Primitive identity override detected in ${violations.length} location(s):\n${detail}\n\n` +
      `Either extend the primitive (M1 pattern) or use a wrapper-context selector.\n` +
      `See packages/ui/docs/tokens.md "Anti-pattern" section.`,
    );
  }
}

// Register in main runner:
await check("primitive override anti-pattern", checkPrimitiveOverrideAntiPattern);
```

**Important**: this guard will catch the existing `:global(.history-shell .paper-card)` in `History.module.css` immediately. That's intentional — it forces M3 to be done properly. Until M3 lands, the guard runs in WARN mode (logs but exits 0). M3's last commit flips to FAIL mode.

To bootstrap: introduce the guard with `process.env.PRIMITIVE_OVERRIDE_GUARD === "fail"` switch:

```js
if (violations.length > 0) {
  const mode = process.env.PRIMITIVE_OVERRIDE_GUARD ?? "warn";
  const message = `Primitive identity override detected...`;
  if (mode === "fail") {
    throw new Error(message);
  } else {
    console.warn(`[WARN] ${message}\n(Set PRIMITIVE_OVERRIDE_GUARD=fail to enforce.)`);
  }
}
```

After M3 lands and `History.module.css` is clean, flip default to `fail` in M3's last commit.

**Commit 3**: `feat(regression): warn on primitive identity overrides from CSS modules`

## §M1.4 — Document the pattern

Append to `packages/ui/docs/tokens.md`:

```md
## Hero banners via SceneCard background

```tsx
<SceneCard
  eyebrow="ДОСИЕ"
  density="lg"
  background={{ image: 'url("/game-art/account/account-hero-banner.webp")', overlay: "scrim" }}
>
  <Display size="h1">{userName}</Display>
</SceneCard>
```

Overlays: `scrim` (default, strong), `veil` (medium), `none` (minimal tint).
Focal: `focalX`/`focalY` 0-100, default 50/50.

## Anti-pattern: `:global()` primitive overrides

```css
/* ❌ FORBIDDEN */
:global(.paper-card) { background: dark }
:global([data-ds-scene-card]) { color: white }

/* ✓ ALLOWED — wrapper-context accent */
.caseFileShell[data-outcome="win"] [data-ds-scene-card] {
  border-left: 2px solid var(--ds-accent-green);
}
```

Enforced by `pnpm regression` contract.
```

Append to `AGENTS.md` (Design system section):
```md
### Hero banners

Hero images go through `SceneCard.background` prop, NOT page-local `<Image fill>` wrappers and NOT `:global()` CSS overrides. See `packages/ui/docs/tokens.md`.

### Motion discipline

Three tiers — see prompt v2 §0.1. Forbidden: Motion in `Pill`, `PaperCard`, `SceneCard`, `Display`, `Eyebrow`, `Medallion`, `EmptyState`, `Surface`.
```

**Commit 4**: `docs(ui): document SceneCard background pattern and anti-pattern guard`

**M1 close-out**:
- All UI tests pass
- New baselines committed (+16)
- Regression guard active in WARN mode
- No existing consumer broken
- `pnpm verify` green

---

# §N1 — Pill overhaul (~2h, 5 commits)

**Goal**: Pill primitive matches or exceeds the magic of legacy `.btn` so consumers stop reaching for `.btn`. CSS-only, zero Motion.

## §N1.1 — Tokens first

Append to `packages/ui/src/tokens.css`:

```css
:where(:root, [data-ds]) {
  /* Existing tokens... */

  /* Pill enrichment */
  --ds-shimmer-duration: 360ms;
  --ds-shimmer-overlay: linear-gradient(90deg, transparent, oklch(1 0 0 / 0.18), transparent);
  --ds-lift-y: -2px;
  --ds-press-scale: 0.98;
  --ds-press-duration: 80ms;

  /* Rich gradients for primary intents */
  --ds-gradient-primary-rich: linear-gradient(135deg, oklch(0.55 0.165 25), oklch(0.42 0.155 25));
  --ds-gradient-secondary-paper: linear-gradient(135deg, oklch(0.94 0.022 78 / 0.075), oklch(0.94 0.022 78 / 0.12));

  /* Faction gradients (react to data-theme on ancestor) */
  --ds-gradient-faction-werewolves: linear-gradient(135deg, oklch(0.55 0.14 145), oklch(0.40 0.13 145));
  --ds-gradient-faction-mafia: linear-gradient(135deg, oklch(0.55 0.165 25), oklch(0.32 0.16 25));
}

/* Faction-context resolution (reads data-faction, NOT data-theme — see §M1.0.b) */
:where([data-faction="werewolves"]) {
  --ds-gradient-faction: var(--ds-gradient-faction-werewolves);
  --ds-accent-faction: oklch(0.55 0.10 145);
}

:where([data-faction="mafia"]) {
  --ds-gradient-faction: var(--ds-gradient-faction-mafia);
  --ds-accent-faction: var(--ds-accent-blood);
}
```

**Commit 1**: `feat(ui): add shimmer + lift + faction gradient tokens for Pill enrichment`

## §N1.2 — Pill shimmer + lift + press

Edit `packages/ui/src/primitives/Pill.tsx`:

```diff
 import { forwardRef, type ButtonHTMLAttributes, type ReactNode, type ElementType } from "react";
+import "../styles/pill.css";

-export type PillIntent = "primary" | "secondary" | "ghost" | "danger";
+export type PillIntent = "primary" | "secondary" | "ghost" | "danger" | "faction";
 export type PillSize = "sm" | "md" | "lg";

 export interface PillProps extends ButtonHTMLAttributes<HTMLButtonElement> {
   intent?: PillIntent;
   size?: PillSize;
+  /** Enable diagonal sheen sweep on hover. */
+  shimmer?: boolean;
+  /** Use uppercase + letter-spaced tracking (formal CTAs). */
+  tracked?: boolean;
   children: ReactNode;
   as?: ElementType;
 }
```

Then in `packages/ui/src/styles/pill.css` (existing file, extend):

```css
.ds-pill {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;  /* touch target */
  border: 1px solid transparent;
  border-radius: var(--ds-radius-chip);
  padding: 0 20px;
  cursor: pointer;
  font-weight: 800;
  transition:
    transform 180ms ease,
    box-shadow 180ms ease,
    border-color 180ms ease,
    background 180ms ease;
  isolation: isolate;
  overflow: hidden;
}

.ds-pill:hover:not(:disabled) {
  transform: translateY(var(--ds-lift-y));
}

.ds-pill:active:not(:disabled) {
  transform: scale(var(--ds-press-scale));
  transition: transform var(--ds-press-duration) ease;
}

.ds-pill:disabled {
  cursor: not-allowed;
  opacity: 0.48;
}

/* Shimmer overlay — opt-in via shimmer prop */
.ds-pill[data-shimmer="true"]::before {
  content: "";
  position: absolute;
  inset: -120% auto -120% -40%;
  z-index: -1;
  width: 46%;
  background: var(--ds-shimmer-overlay);
  transform: rotate(18deg);
  transition: transform var(--ds-shimmer-duration) ease;
  pointer-events: none;
}

.ds-pill[data-shimmer="true"]:hover:not(:disabled)::before {
  transform: translateX(280%) rotate(18deg);
}

/* Tracked uppercase */
.ds-pill[data-tracked="true"] {
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

/* Intent variants */
.ds-pill[data-intent="primary"] {
  background: var(--ds-gradient-primary-rich), var(--ds-accent-blood);
  color: oklch(0.96 0.02 80);
  box-shadow:
    0 14px 34px oklch(0.42 0.155 25 / 0.34),
    inset 0 1px oklch(1 0 0 / 0.18);
}

.ds-pill[data-intent="primary"]:hover:not(:disabled) {
  box-shadow:
    0 20px 48px oklch(0.42 0.155 25 / 0.48),
    inset 0 1px oklch(1 0 0 / 0.18);
}

.ds-pill[data-intent="secondary"] {
  border: 1px solid oklch(0.94 0.022 78 / 0.35);
  background: var(--ds-gradient-secondary-paper);
  color: var(--ds-ink-scene);
  box-shadow: inset 0 1px oklch(1 0 0 / 0.08);
}

.ds-pill[data-intent="secondary"]:hover:not(:disabled) {
  border-color: var(--ds-accent-gold);
  background: oklch(0.94 0.022 78 / 0.12);
  box-shadow: 0 14px 34px oklch(0 0 0 / 0.24);
}

.ds-pill[data-intent="ghost"] {
  background: transparent;
  color: var(--ds-ink-primary);
  border: 1px solid oklch(0.40 0.018 60 / 0.2);
}

.ds-pill[data-intent="ghost"]:hover:not(:disabled) {
  border-color: var(--ds-accent-gold);
  background: oklch(0.94 0.022 78 / 0.4);
}

.ds-pill[data-intent="danger"] {
  background: var(--ds-accent-blood);
  color: oklch(0.96 0.02 80);
}

/* Faction — reacts to ancestor data-theme */
.ds-pill[data-intent="faction"] {
  background: var(--ds-gradient-faction, var(--ds-gradient-primary-rich));
  color: oklch(0.96 0.02 80);
  box-shadow:
    0 14px 34px oklch(0 0 0 / 0.34),
    inset 0 1px oklch(1 0 0 / 0.18);
}

.ds-pill[data-intent="faction"]:hover:not(:disabled) {
  box-shadow:
    0 20px 48px oklch(0 0 0 / 0.48),
    inset 0 1px oklch(1 0 0 / 0.18);
}

/* Size variants */
.ds-pill[data-size="sm"] {
  min-height: 36px;
  padding: 0 14px;
  font-size: var(--ds-type-body-sm);
}

.ds-pill[data-size="md"] { /* default */ }

.ds-pill[data-size="lg"] {
  min-height: 52px;
  padding: 0 28px;
  font-size: var(--ds-type-lede);
}
```

Update the `Pill` render to emit `data-shimmer`, `data-tracked`, `data-intent`, `data-size` attributes and apply the `ds-pill` className.

**Commit 2**: `feat(ui): enrich Pill with shimmer + lift + press physics + rich gradients`

## §N1.3 — Faction intent + tracked uppercase

(Already wired in §N1.2 — separate commit for clarity of git history.)

**Commit 3**: `feat(ui): add faction intent and tracked uppercase variants to Pill`

## §N1.4 — Stories + tests

Extend `Pill.stories.tsx` with:

```tsx
export const WithShimmer: Story = {
  args: { intent: "primary", shimmer: true, children: "Избери игра" },
};

export const Tracked: Story = {
  args: { intent: "primary", tracked: true, shimmer: true, children: "Избери игра" },
};

export const FactionWerewolves: Story = {
  args: { intent: "faction", children: "Влез на масата" },
  decorators: [
    (Story) => <div data-faction="werewolves" style={{ padding: 24 }}><Story /></div>,
  ],
};

export const FactionMafia: Story = {
  args: { intent: "faction", children: "Влез на масата" },
  decorators: [
    (Story) => <div data-faction="mafia" style={{ padding: 24 }}><Story /></div>,
  ],
};

export const AllSizes: Story = {
  render: () => (
    <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
      <Pill intent="primary" size="sm">Малък</Pill>
      <Pill intent="primary" size="md">Среден</Pill>
      <Pill intent="primary" size="lg">Голям</Pill>
    </div>
  ),
};
```

Extend `Pill.test.tsx`:

```tsx
it("emits data-shimmer attribute when shimmer prop true", () => {
  const { container } = render(<Pill shimmer>x</Pill>);
  expect(container.firstChild).toHaveAttribute("data-shimmer", "true");
});

it("emits data-tracked attribute when tracked prop true", () => {
  const { container } = render(<Pill tracked>x</Pill>);
  expect(container.firstChild).toHaveAttribute("data-tracked", "true");
});

it("inherits faction gradient when wrapped in [data-theme]", () => {
  const { container } = render(
    <div data-theme="werewolves">
      <Pill intent="faction">x</Pill>
    </div>,
  );
  // Token resolution is CSS-only; verify the data-intent attribute is set
  expect(container.querySelector(".ds-pill")).toHaveAttribute("data-intent", "faction");
});

it("min-height meets 44px touch target by default", () => {
  const { container } = render(<Pill>x</Pill>);
  const styles = window.getComputedStyle(container.firstChild as Element);
  // Note: jsdom doesn't render CSS; assert via attribute instead
  expect(container.querySelector(".ds-pill")).toBeTruthy();
});

// --- A11y verification tests (§3.2 requirement #7) ---

it("preserves text content semantics when tracked uppercase is active", () => {
  // CSS text-transform: uppercase must NOT alter DOM text — screen readers
  // should still announce "Избери игра", not "ИЗБЕРИ ИГРА"
  const { container } = render(<Pill tracked>Избери игра</Pill>);
  expect(container.textContent).toBe("Избери игра");
});

it("does not add aria-hidden or break interactive semantics with shimmer", () => {
  const { container } = render(<Pill shimmer>Action</Pill>);
  const pill = container.querySelector(".ds-pill") as HTMLElement;
  expect(pill.getAttribute("aria-hidden")).toBeNull();
  expect(pill.tagName).toBe("BUTTON"); // remains focusable
});

it("forwards aria-pressed for toggle usage (filter pattern)", () => {
  const { container } = render(<Pill aria-pressed={true}>Filter</Pill>);
  expect(container.querySelector(".ds-pill")).toHaveAttribute("aria-pressed", "true");
});

it("faction intent emits semantic data-intent regardless of theme context", () => {
  const { container } = render(
    <div data-faction="werewolves">
      <Pill intent="faction">x</Pill>
    </div>,
  );
  // Note: data-faction (not data-theme) per §M1.0.b separation
  expect(container.querySelector(".ds-pill")).toHaveAttribute("data-intent", "faction");
});
```

**Visual story variants for axe coverage** — add to `Pill.stories.tsx`:

```tsx
export const FocusedShimmer: Story = {
  args: { intent: "primary", shimmer: true, children: "Избери игра" },
  parameters: { pseudo: { focusVisible: true } },
};

export const DisabledFaction: Story = {
  args: { intent: "faction", disabled: true, children: "Не може" },
  decorators: [
    (Story) => <div data-faction="mafia" style={{ padding: 24 }}><Story /></div>,
  ],
};

export const TrackedBulgarianText: Story = {
  args: { intent: "primary", tracked: true, shimmer: true, children: "Избери игра и започни вечерта" },
};
```

These stories are picked up by `pnpm visual:ui` → axe runs on each → contrast/focus violations surface automatically.

Run:

```bash
pnpm --filter @werewolf/ui test
pnpm visual:ui --update-snapshots
```

**Commit 4**: `test(ui): cover Pill variants with a11y (focus, semantics, contrast)`

## §N1.5 — Documentation

Append to `packages/ui/docs/tokens.md`:

```md
## Pill primitive (enriched)

```tsx
<Pill intent="primary" shimmer tracked>Избери игра</Pill>
<Pill intent="faction">Влез на масата</Pill>  {/* inherits theme gradient */}
<Pill intent="secondary" size="sm">Виж повече</Pill>
```

| Prop | Values | Default | Purpose |
|---|---|---|---|
| `intent` | primary / secondary / ghost / danger / faction | primary | Visual emphasis |
| `size` | sm / md / lg | md | 36 / 44 / 52 px height |
| `shimmer` | boolean | false | Diagonal sheen on hover |
| `tracked` | boolean | false | Uppercase + letter-spacing |
| `as` | ElementType | "button" | Render as Link, etc. |

### Faction intent
Reacts to ancestor `[data-faction="werewolves"]` or `[data-faction="mafia"]` and picks the matching gradient. Use for game-mode-specific CTAs. Note: `data-faction` is orthogonal to `data-theme` (light/dark) — see AGENTS.md "Theme + faction attributes" section.

### Shimmer policy
CSS-only sweep via `::before` pseudo-element. No Motion. Use on primary CTAs in cinematic contexts (hero, mode-choice cards). Default off — opt-in only.
```

**Commit 5**: `docs(ui): document enriched Pill API + shimmer policy`

**N1 close-out**:
- Visual baselines updated (+12 for new Pill stories × 2 themes × 2 viewports)
- `pnpm verify` green
- All existing Pill consumers unbroken (additive only)
- `bg-copy-reviewer` agent on docs

---

# §N2 — Card interactive + accent (~1h, 3 commits)

**Goal**: PaperCard and SceneCard react physically when wrapped in an interactive element (link, button).

## §N2.1 — Tokens

Append to `tokens.css`:

```css
:where(:root, [data-ds]) {
  /* Card interaction */
  --ds-card-lift-y: -3px;
  --ds-shadow-card-elevated:
    0 1px 0 oklch(1 0 0 / 0.45) inset,
    0 24px 56px -28px oklch(0.20 0.05 60 / 0.65);
  --ds-shadow-scene-elevated:
    0 1px 0 oklch(1 0 0 / 0.06) inset,
    0 40px 80px -40px oklch(0 0 0 / 0.75);
}
```

**Commit 1**: `feat(ui): add card elevated shadow and lift tokens`

## §N2.2 — `interactive` + `accent` props on PaperCard + SceneCard

```diff
 export type PaperCardAccent = "neutral" | "win" | "loss" | "warning" | "info";

 export interface PaperCardProps {
   eyebrow?: string;
   density?: "sm" | "md" | "lg";
   meta?: ReactNode;
+  interactive?: boolean;
+  accent?: PaperCardAccent;
   children: ReactNode;
 }
```

In the PaperCard render:
- If `interactive`: add hover lift via inline CSS class `data-interactive="true"`
- If `accent`: add `data-accent={accent}` attribute, styled via tokens

In `packages/ui/src/styles/card.css` (new file or extend existing):

```css
[data-ds-paper-card][data-interactive="true"],
[data-ds-scene-card][data-interactive="true"] {
  cursor: pointer;
  transition:
    transform 200ms ease,
    box-shadow 200ms ease;
}

[data-ds-paper-card][data-interactive="true"]:hover {
  transform: translateY(var(--ds-card-lift-y));
  box-shadow: var(--ds-shadow-card-elevated);
}

[data-ds-scene-card][data-interactive="true"]:hover {
  transform: translateY(var(--ds-card-lift-y));
  box-shadow: var(--ds-shadow-scene-elevated);
}

[data-ds-paper-card][data-interactive="true"]:active,
[data-ds-scene-card][data-interactive="true"]:active {
  transform: scale(0.99);
  transition: transform 80ms ease;
}

/* Accent border (left side) */
[data-ds-paper-card][data-accent="win"],
[data-ds-scene-card][data-accent="win"] {
  border-left: 2px solid var(--ds-accent-green);
}

[data-ds-paper-card][data-accent="loss"],
[data-ds-scene-card][data-accent="loss"] {
  border-left: 2px solid var(--ds-accent-blood);
}

[data-ds-paper-card][data-accent="warning"],
[data-ds-scene-card][data-accent="warning"] {
  border-left: 2px solid var(--ds-accent-gold);
}

[data-ds-paper-card][data-accent="info"],
[data-ds-scene-card][data-accent="info"] {
  border-left: 2px solid oklch(0.55 0.12 220);
}

[data-ds-paper-card][data-accent="neutral"],
[data-ds-scene-card][data-accent="neutral"] {
  border-left: 2px solid oklch(0.55 0.015 60 / 0.4);
}
```

Same diff for `SceneCard.tsx` — add the props, emit data attributes.

Import the new CSS file in `packages/ui/src/index.ts`:
```ts
import "./styles/card.css";
```

(Or per `packages/ui/package.json` exports — Codex chooses the existing pattern.)

**Commit 2**: `feat(ui): add interactive and accent props to PaperCard and SceneCard`

## §N2.3 — Stories + tests + docs

Add stories: `Interactive`, `WithAccentWin`, `WithAccentLoss`, `WithAccentWarning`.

Add tests:
- Emits `data-interactive` when prop true
- Emits `data-accent` when prop set
- No data attributes when props omitted (backwards compat)

Document in `tokens.md`:

```md
## PaperCard / SceneCard interactive mode

```tsx
<PaperCard interactive as={Link} href="/play" accent="win">
  <Display size="h3">Селото оцеля</Display>
</PaperCard>
```

`interactive` adds hover lift + focus ring + press feedback.
`accent` adds semantic left border: win | loss | warning | info | neutral.

Use `accent` for outcome-coded list items (e.g. CaseFileCard, AchievementCard).
```

**Commit 3**: `test(ui): cover card interactive + accent variants, document API`

**N2 close-out**:
- `pnpm verify` green
- Existing PaperCard/SceneCard consumers unbroken (additive)
- M3 ready to consume `<SceneCard interactive accent={outcome}>`

---

# §M2 — /account + /status pilot (~2h, 5 commits)

**Goal**: prove the enriched primitives on 2 distinct moods — dossier (account, scrim) and watchtower (status, veil).

## §M2.1 — /account hero restoration

Edit `apps/web/components/account/AccountHero.tsx`:

```diff
-      <SceneCard eyebrow="ДОСИЕ" density="lg">
+      <SceneCard
+        eyebrow="ДОСИЕ"
+        density="lg"
+        background={{
+          image: "var(--art-account)",
+          overlay: "scrim",
+          focalY: 35,
+        }}
+      >
```

Uses `--art-account` token added in §M1.0.a. Single point of change if assets move; responsive variants resolved centrally.

**Commit 1**: `feat(account): restore dossier hero banner through SceneCard background`

## §M2.2 — /account inline styles → CSS module

Move all `style={...}` patterns from `AccountHero.tsx` into `AccountHero.module.css`. Add:
- Gold ring accent on avatar via `::after`
- Stats grid responsive breakpoints
- Stamped-folder feeling (warm subtle paper-grain via low-opacity background)

(Full CSS in v1 §2.2.)

**Commit 2**: `refactor(account): move hero inline styles to CSS module + gold ring accent`

## §M2.3 — /account responsive fix

Verify dark/light + mobile 375px. Fix any breakage discovered.

**Commit 3**: `fix(account): tune hero responsive layout for mobile + dark theme`

## §M2.4 — /status hero restoration

Edit `apps/web/components/status/StatusHero.tsx`:

```diff
-      <SceneCard eyebrow="СЪСТОЯНИЕ НА УСЛУГИТЕ" density="lg">
+      <SceneCard
+        eyebrow="СЪСТОЯНИЕ НА УСЛУГИТЕ"
+        density="lg"
+        background={{
+          image: "var(--art-status)",
+          overlay: "veil",
+        }}
+      >
```

Note `overlay: "veil"` — status is reassuring, not cinematic. Banner stays present.

**Commit 4**: `feat(status): restore harbor banner with veil overlay (operational mood)`

## §M2.5 — /status service tile polish

Light touch on `StatusServiceTiles.tsx`:
- Ensure all colours use `--ds-*` tokens
- Pulse animation on `down` status (CSS keyframe, no Motion)
- Slightly stronger badge contrast

**Commit 5**: `style(status): refine service tile badges + pulse accent for outages`

**M2 close-out**:
- `pnpm visual --grep "account|status"` → manual review → update baselines
- `pnpm verify` green
- `bg-copy-reviewer` agent on touched files
- **Invoke `frontend-design` skill**:
  > Review /account and /status after PR M2. /account identity is "dignified dossier" — gold accents, monospace stats. /status is "operational watchtower" — calm, reassuring veil. Suggest 3 improvements ranked by impact. Don't propose new primitives.
- Apply top 1-2 suggestions in a single follow-up commit if material.

---

# §M3 — /history full rebuild (~3h, 6 commits)

**Goal**: rebuild /history cleanly using enriched primitives. Remove all anti-patterns. Flip M1 regression guard to `fail` at the end.

## §M3.1 — EvidenceWall hero

```diff
+ import { Display, Eyebrow, SceneCard } from "@werewolf/ui";

-       <header className="evidence-wall-header">
-         <p className="section-kicker">архив</p>
-         <h1>Архив на масата</h1>
-         <p className="evidence-wall-subtitle">Всяко дело носи дата, играчите, ролите и развръзката.</p>
-       </header>
+       <header aria-label="Архив на масата" className={styles.heroFrame}>
+         <SceneCard
+           eyebrow="АРХИВ"
+           density="lg"
+           background={{ image: "var(--art-history)", overlay: "scrim" }}
+         >
+           <Display size="hero">Архив на масата</Display>
+           <p className={styles.heroSubtitle}>Всяко дело носи дата, играчите, ролите и развръзката.</p>
+         </SceneCard>
+       </header>
```

**Commit 1**: `refactor(history): restore EvidenceWall hero with archive SceneCard background`

## §M3.2 — Filter buttons → Pill

```diff
-       <div className="evidence-filters" role="group" aria-label="Филтри по дело">
+       <div className={styles.evidenceFilters} role="group" aria-label="Филтри по дело">
          {FILTERS.map((item) => (
-           <button key={item.value} ... onClick={() => setFilter(item.value)}>
-             {item.label}
-           </button>
+           <Pill
+             key={item.value}
+             intent={filter === item.value ? "secondary" : "ghost"}
+             size="sm"
+             aria-pressed={filter === item.value}
+             onClick={() => setFilter(item.value)}
+           >
+             {item.label}
+           </Pill>
          ))}
        </div>
```

**Commit 2**: `refactor(history): adopt enriched Pill for evidence filters`

## §M3.3 — CaseFileCard on SceneCard (not PaperCard with override)

This is the heart of the rebuild. Use the enriched `<SceneCard interactive accent={...}>` from N2.

```diff
- import { Display, PaperCard } from "@werewolf/ui/server";
+ import { Display, SceneCard, Pill } from "@werewolf/ui/server";

  export function CaseFileCard({ game }: { game: HistoryGameView }) {
    const family = modeFamily(game.mode);
    const outcome = outcomeFor(game);
-   const style = { "--tilt": `${tiltFor(game.id)}deg` } as CSSProperties;

    return (
-     <article className="case-file-shell" data-family={family} data-outcome={outcome} style={style}>
-       <span className="pushpin" aria-hidden="true" />
-       <PaperCard eyebrow={`ДЕЛО №${game.code}`} ... >
+     <article className={styles.caseFileShell} data-family={family}>
+       <SceneCard
+         eyebrow={`ДЕЛО №${game.code}`}
+         density="md"
+         interactive
+         accent={outcome === "win" ? "win" : outcome === "loss" ? "loss" : "neutral"}
+         meta={<span className={styles.caseFileDate}>{shortDate(game.endedAt)}</span>}
+       >
          {/* content unchanged, just className references swap to module */}
+         <Display size="h3" as="h2">{winnerBg(game.winnerTeam)}</Display>
+         ...
+         <footer className={styles.caseFileFoot}>
+           <span className={styles.caseFileEvents}>{eventsBg(game.eventCount)}</span>
+           <Pill as={Link} href={`/history/${game.id}/replay`} intent="ghost" size="sm">
+             Отвори дело →
+           </Pill>
+         </footer>
+       </SceneCard>
+     </article>
    );
  }
```

Update `History.module.css`:
- Remove `:global(.history-shell .paper-card)` block (THE anti-pattern)
- Remove `.case-file-shell` tilt transform
- Remove `.pushpin` rule
- Remove `:global(.case-file)` parchment rule
- Add module-scoped: `.heroFrame`, `.heroSubtitle`, `.evidenceFilters`, `.caseFileShell`, `.caseFileDate`, `.caseFileFoot`, `.caseFileEvents`

**Commit 3**: `refactor(history): rebuild CaseFileCard on SceneCard with interactive + outcome accent`

## §M3.4 — Drop tilt helper

```bash
rm apps/web/lib/history-tilt.ts  # if not used elsewhere — verify first
```

**Commit 4**: `chore(history): drop retired tilt helper after pushpin retirement`

## §M3.5 — Replay page sections

Migrate `apps/web/app/history/[gameId]/replay/page.tsx`:
- Hero gets `background: { image: "var(--art-replay)", overlay: "scrim" }`
- `<section className="replay-verdict-card">` → `<PaperCard eyebrow="ПОБЕДА" density="md">`
- `<section className="replay-participants">` → `<PaperCard eyebrow="ИГРАЧИ" density="md">`
- `<article className="replay-achievements">` → `<PaperCard eyebrow="ОТКЛЮЧЕНИ МОМЕНТИ" density="md">`
- Timeline phase groups wrapped in `<PaperCard density="sm">`

**Commit 5**: `refactor(history): migrate replay sections to PaperCard primitives`

## §M3.6 — Dead CSS sweep + flip regression guard to fail

Sweep all dead rules from `History.module.css`. Document in `docs/css-cleanup-log.md`.

Flip M1 regression guard from WARN to FAIL by removing the env var gate in `scripts/regression.mjs`:

```diff
- const mode = process.env.PRIMITIVE_OVERRIDE_GUARD ?? "warn";
- if (mode === "fail") {
-   throw new Error(message);
- } else {
-   console.warn(...);
- }
+ throw new Error(message);
```

Run `pnpm regression` — must pass (the /history overrides are gone now). If anything else still has overrides, FIX THEM in this commit (small additional sweep).

**Commit 6**: `chore(history): remove primitive override rules + enforce anti-pattern guard`

**M3 close-out**:
- `wc -l apps/web/components/history/History.module.css` — expect 40%+ reduction
- `rg ":global\(.*paper-card" apps/web` returns 0
- `rg ":global\(.*scene-card" apps/web` returns 0
- `pnpm regression` runs guard in FAIL mode, still passes
- `pnpm visual --grep "history"` reviewed + baselines updated
- `pnpm verify` green
- `bg-copy-reviewer` agent on touched files
- **Invoke `frontend-design` skill**:
  > Review /history list + /history/[id]/replay after PR M3. Identity is "detective archive" — cinematic, restrained, no decorations. Look for hierarchy issues and where polish would land. Suggest 3-5 improvements.
- Apply top 1-2 in follow-up commit if material.

---

# §M4 — /privacy + /terms — Trust + formal pair (~2h, 5 commits)

## §M4.1 — /privacy hero

```diff
- <SceneCard eyebrow="…" density="lg">
+ <SceneCard
+   eyebrow="…"
+   density="lg"
+   background={{ image: "var(--art-privacy)", overlay: "scrim" }}
+ >
```

**Commit 1**: `feat(privacy): restore open-vault hero through SceneCard background`

## §M4.2 — /privacy polish — brass accents

In `Privacy*.module.css`: add subtle brass hairline at section borders, warm gold hover glow on promise icons (CSS transition, no Motion).

**Commit 2**: `style(privacy): add warm brass accents to promise sections`

## §M4.3 — /terms hero

```diff
- <SceneCard eyebrow="…" density="lg">
+ <SceneCard
+   eyebrow="…"
+   density="lg"
+   background={{ image: "var(--art-terms)", overlay: "scrim" }}
+ >
```

Try `overlay: "scrim"` first; if terms-banner is already dark, switch to `overlay: "veil"` and pick what reads better.

**Commit 3**: `feat(terms): restore sealed-handshake hero through SceneCard background`

## §M4.4 — /terms polish — formal restraint

Cooler tones than /privacy. Section headers feel formal-but-not-stiff. Slightly denser hierarchy if currently airy.

**Commit 4**: `style(terms): refine formal legal hierarchy and section rhythm`

## §M4.5 — Dead CSS sweep

`pnpm visual --grep "privacy|terms"`. Inspect. Update baselines. Remove dead `.privacy-hero-*` / `.terms-hero-*` chrome from module files. Append to `docs/css-cleanup-log.md`.

**Commit 5**: `chore(css): remove dead privacy + terms hero rules + log update`

**M4 close-out**: `pnpm verify`, `bg-copy-reviewer`.

---

# §N3 — Motion polish (~1h, 3 commits)

**Goal**: refine existing 3 Motion files (Dialog/Sheet/Toast) with spring physics + stagger. NO new Motion files.

## §N3.1 — Dialog spring transitions

In `packages/ui/src/primitives/Dialog.tsx`, replace linear easing with spring:

```diff
 <motion.div
   initial={{ scale: 0.95, opacity: 0 }}
   animate={{ scale: 1, opacity: 1 }}
   exit={{ scale: 0.95, opacity: 0 }}
-  transition={{ duration: 0.18, ease: "easeOut" }}
+  transition={{ type: "spring", stiffness: 320, damping: 28 }}
 />
```

Update visual baselines for Dialog stories.

**Commit 1**: `refactor(ui): switch Dialog open/close to spring transitions`

## §N3.2 — Sheet drag-to-dismiss on mobile

In `Sheet.tsx`, add `drag="y"` + `onDragEnd` handler on mobile breakpoint:

```tsx
const isMobile = useBreakpoint("(max-width: 768px)");

<motion.div
  drag={isMobile ? "y" : false}
  dragConstraints={{ top: 0, bottom: 0 }}
  dragElastic={0.2}
  onDragEnd={(_, info) => {
    if (info.offset.y > 100) onClose();
  }}
/>
```

(Implementation detail: `useBreakpoint` may need to be added — keep it tiny, no new dep.)

**Commit 2**: `feat(ui): add drag-to-dismiss to Sheet on mobile breakpoints`

## §N3.3 — Toast stagger

In `Toast.tsx` or toast host, when multiple toasts appear, stagger their entrance:

```tsx
<AnimatePresence>
  {toasts.map((toast, i) => (
    <motion.div
      key={toast.id}
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -20, opacity: 0 }}
      transition={{ delay: i * 0.06, type: "spring", stiffness: 280, damping: 24 }}
    >
      {/* toast content */}
    </motion.div>
  ))}
</AnimatePresence>
```

**Commit 3**: `feat(ui): add stagger to multi-Toast appearances`

**N3 close-out**:
- Motion file count still = 3 (`grep -l "from \"motion/react\"" packages/ui/src/primitives | wc -l` == 3)
- Bundle budget still green (`pnpm perf:budget`)
- Visual baselines updated for Dialog/Sheet/Toast

---

# §M5 — /report + /faq (~2h, 5 commits)

## §M5.1 — /report hero

```diff
+ background={{
+   image: "var(--art-report)",
+   overlay: "scrim",
+   focalY: 40,
+ }}
```

**Commit 1**: `feat(report): restore lighthouse banner through SceneCard background`

## §M5.2 — /report wizard polish

Wizard step indicators → `<Pill intent="ghost" size="sm" tracked>1 / 3</Pill>`. Active step → `intent="faction"` (picks faction theme). Success CTA grouping consistent.

**Commit 2**: `style(report): polish wizard steps with enriched Pill chrome`

## §M5.3 — /faq hero

```diff
+ background={{
+   image: "var(--art-faq)",
+   overlay: "scrim",
+ }}
```

Keep existing `faq-hearth-motif.webp` footer Image (it's a foot motif, not hero — separate concern).

**Commit 3**: `feat(faq): restore hearth banner through SceneCard background`

## §M5.4 — /faq hearth glow polish

In `FaqHearth.module.css`:
- Warm amber radial gradient on expanded answer (atmospheric, CSS-only)
- Search input focus uses `--ds-focus-ring`
- Category section borders slightly warmer

**Commit 4**: `style(faq): warm hearth glow on expanded answers + focused search`

## §M5.5 — Dead CSS sweep

Same protocol. Remove dead `.report-hero-*` / `.faq-hearth-banner*` chrome.

**Commit 5**: `chore(css): remove dead report + faq hero rules + log update`

**M5 close-out**: `pnpm verify`, `bg-copy-reviewer`.

---

# §M6 — 6 remaining pages (~3h, ~6-9 commits, conditional split)

**Decision rule**: if diff > 15 files changed, split into M6a (list pages) and M6b (flow pages).

## §M6.1 — /friends

Hero: `<SceneCard background={{ image: "var(--art-friends)", overlay: "scrim" }}>`. Friend cards: `<PaperCard interactive>`. Pending invites: small `sealed-letter` artifact accent.

**Commit**: `feat(friends): restore social-table hero and polish friend cards`

## §M6.2 — /achievements

Hero: identify available asset or note imagegen need in M0 audit. Locked vs unlocked: stronger Medallion hierarchy. Cards: `<PaperCard accent={isUnlocked ? "win" : "neutral"}>`.

**Commit**: `style(achievements): restore legends identity with shelf and medallion polish`

## §M6.3 — /leaderboard

Hero: masthead via SceneCard. Rankings as editorial rows in `<PaperCard density="sm">`. Top-3 with `<Medallion>`.

**Commit**: `style(leaderboard): refine evening-paper masthead and ranking hierarchy`

## §M6.4 — /tutorial

TutorialFlipbook hero: existing asset or imagegen if needed. Slide rhythm unchanged. Decorations restrained.

**Commit**: `feat(tutorial): restore first-steps hero atmosphere`

## §M6.5 — /sign-in

Hero/stage background. OAuth buttons use enriched Pill with `shimmer`. Form feels like invitation.

**Commit**: `style(sign-in): warm entry stage with enriched Pill OAuth buttons`

## §M6.6 — /create + theme verify

Confirm tavern bg renders in default theme. Faction accents on `/werewolf/create` (green) and `/mafia/create` (red) — uses `intent="faction"` Pills + `data-faction` ancestor (already migrated in §M1.0.b prep).

Verification:

```bash
# After M1.0.b prep, all create pages should have data-faction (not data-theme) for werewolves/mafia
rg 'data-theme="(werewolves|mafia)"' apps/web/app/create apps/web/app/werewolf apps/web/app/mafia
# Expected: 0 hits (all renamed to data-faction)
rg 'data-faction="(werewolves|mafia)"' apps/web/app/create apps/web/app/werewolf apps/web/app/mafia
# Expected: hits on all 3 create pages
```

**Commits**:
- `fix(create): ensure tavern background renders in default theme`
- `style(create): strengthen faction accents with enriched Pill faction intent`

**M6 close-out**:
- If diff > 15 files: split into M6a/M6b (open M6b as separate PR)
- `pnpm verify`
- `pnpm perf:budget` — verify no regression
- `bg-copy-reviewer` agent
- **Invoke `frontend-design` skill** for cross-page consistency review

---

# §N4 — Optional new primitives (conditional, ~2-3h)

**Only execute** if M3-M6 reveal concrete duplication patterns.

Triggers:
- **`Tile`**: if /history + /achievements + /friends all show identical tile-style grid items
- **`Tabs`**: if /account dashboard or /leaderboard introduces tab navigation
- **`SectionHeader`**: if 10+ files repeat `<Eyebrow><Display size="..."><p>` pattern verbatim

For each trigger:
1. Add primitive to `packages/ui/src/primitives/`
2. Tests + 4 stories + MDX cheatsheet
3. Migrate 2-3 consumers as proof
4. Document in `tokens.md` + AGENTS.md

**If no triggers**: skip N4 entirely. Document in M7 close-out why.

---

# §M7 — Final hardening (~1h, 3 commits)

## §M7.1 — Sweep + measure + primitive API health

### Final metrics

```bash
# Architectural invariants
wc -l apps/web/app/globals.css
find apps/web -name "*.module.css" | wc -l
rg ":global\(.*\.(paper-card|scene-card|pill|medallion|surface)" apps/web | wc -l  # MUST be 0
rg ":global\(.*\[data-ds-" apps/web | wc -l  # MUST be 0
rg "style=\{\{" apps/web/components apps/web/app --type tsx | wc -l  # should be lower than M0 baseline
grep -l "from \"motion/react\"" packages/ui/src/primitives | wc -l  # MUST be 3
rg 'data-theme="(werewolves|mafia)"' apps/web | wc -l  # MUST be 0 (renamed to data-faction in §M1.0.b)

# Pipelines
pnpm visual 2>&1 | tail -3
pnpm visual:ui 2>&1 | tail -3
pnpm perf:budget 2>&1 | tail -5
pnpm regression 2>&1 | tail -3
```

### Primitive API health check (§3.2 #6 enforcement)

```bash
# Audit prop count per primitive
echo "Primitive API health (threshold: 7 props)"
echo "─────────────────────────────────────────"
for f in packages/ui/src/primitives/*.tsx; do
  name=$(basename "$f" .tsx)
  # Count props inside the *Props interface (heuristic: lines like "  propName?: type" inside interface block)
  props=$(awk '/^export interface .+Props/,/^}/' "$f" | grep -cE "^\s+\w+\??:\s")
  status="ok"
  if [ "$props" -gt 7 ]; then
    status="WARN — consider composition"
  fi
  printf "  %-15s %d props  %s\n" "$name" "$props" "$status"
done
```

Expected output after v2:

```
  Surface         5 props   ok
  Eyebrow         2 props   ok
  Display         3 props   ok
  PaperCard       5 props   ok   (eyebrow, density, meta, interactive, accent)
  SceneCard       6 props   ok   (eyebrow, density, meta, background, interactive, accent)
  Pill            6 props   ok   (intent, size, shimmer, tracked, as, children)
  Medallion       3 props   ok
  Toast           3 props   ok
  Dialog          5 props   ok
  Sheet           5 props   ok
  EmptyState      4 props   ok
```

If any primitive exceeds 7 props, document in `docs/hero-restoration-closing-report.md` and propose composition refactor for a future PR. Don't try to fix in M7 — too late in the engagement.

Remove any final leftover dead CSS, inline styles that should be modules, duplicate gradients between modules.

**Commit 1**: `chore(css): final sweep + primitive API health audit`

## §M7.2 — Cleanup leftover override patterns

Final regression guard run with FAIL mode. Anything that still leaks → fix.

**Commit 2**: `chore(frontend): remove final primitive override leftovers`

## §M7.3 — Document the restoration

Append to `docs/css-cleanup-log.md` and create `docs/hero-restoration-closing-report.md`:

```md
# Hero restoration closing report — 2026-XX-XX

## Summary
- Pages restored: 13+
- Primitive overrides removed: X (now 0)
- New SceneCard tests: 3
- New Pill stories: 5
- New visual baselines: ~30+
- Motion file count unchanged: 3
- Bundle budget: X / 550 KB

## Per-page outcomes
[Codex fills in: link to before/after baselines per page]

## Primitive API health (post-v2 props count)
[Output of §M7.1 prop count audit — flag any > 7 as future composition candidate]

## Frontend-design skill findings
[Summary of frontend-design suggestions applied, deferred, or rejected]

## Architectural invariants verified
- [ ] Zero `:global()` primitive overrides (regression guard in FAIL mode)
- [ ] Motion file count = 3 (Dialog, Sheet, Toast)
- [ ] All `data-theme="werewolves|mafia"` migrated to `data-faction`
- [ ] All hero `SceneCard.background` use `var(--art-*)` tokens (no raw image-set strings)
- [ ] No new dependencies added since v3.1
- [ ] No `prefers-reduced-motion` guards in any file
- [ ] All Bulgarian copy preserved (per `bg-copy-reviewer` agent runs)
```

**Commit 3**: `docs(frontend): document hero restoration closing report and policy`

**M7 close-out**:
- `pnpm verify` green
- Closing report committed
- Tag the commit: `git tag hero-restoration-v2 HEAD`

---

# §A — Acceptance criteria (after all PRs)

| Metric | Before | Target |
|---|---|---|
| `:global(.*\.(paper-card\|scene-card\|...))` selectors | 5+ | **0** |
| `:global(.*\[data-ds-...\])` selectors | unknown | **0** |
| Pages with visible hero banner | 0 | **13+** |
| `SceneCard` consumers with `background` prop | 0 | **13+** |
| Hero `background.image` using `var(--art-*)` token | 0% | **100%** (no raw image-set inline strings) |
| `data-theme="werewolves\|mafia"` attribute | 4+ files | **0** (migrated to `data-faction`) |
| New SceneCard tests | n/a | **3** |
| New Pill variants (shimmer/tracked/faction) | n/a | **3** props |
| New Pill stories | n/a | **5+** |
| New Pill a11y tests | n/a | **5** (semantics, ARIA, contrast) |
| Primitive max props (any single primitive) | ≤5 | **≤7** (composition trigger if exceeded) |
| Motion primitive files | 3 | **3** (unchanged) |
| Per-page CSS modules | 48 | 48+ (likely +2 from N PRs) |
| `globals.css` size | 3,745 LOC | < 3,850 (small growth from new `--art-*` tokens) |
| `pnpm verify` | green | green |
| `pnpm visual:ui` baselines | 68 | 90+ |
| `pnpm visual` baselines | 88 | ~100+ |
| `pnpm perf:budget` | green | green (no regression) |
| `pnpm regression` | 16 contracts | 17 contracts (+ primitive override guard) |

## Qualitative

- `/account` feels like a dossier
- `/history` feels like a detective archive
- `/privacy` feels trustworthy
- `/terms` is formal but not dry
- `/report` helps, doesn't alarm
- `/faq` is warm and conversational
- `/status` is calm operations
- `/friends` has social warmth
- `/achievements` carries "legends", not "badges"
- `/leaderboard` is "evening newspaper"
- `/create` carries tavern + faction atmosphere
- Pill buttons feel premium (shimmer, lift, gradient depth)
- Cards feel physical when interactive (hover lift, press feedback)
- Dialog/Sheet/Toast feel springier

---

# §B — Failure modes

| Symptom | Cause | Fix |
|---|---|---|
| Hero text unreadable on banner | Wrong overlay | Switch `none` → `veil` → `scrim` |
| Banner subject crushed/wrong | Focal off | Tune `focalX`/`focalY` |
| `pnpm visual` diff massive | Hero migration changed layout flow | Inspect; usually intentional, verify mobile |
| `pnpm --filter @werewolf/ui test` fails | Test selectors don't match new DOM | Update selectors |
| Pill shimmer barely visible | Token `--ds-shimmer-overlay` too subtle on light bg | Bump opacity, test on both themes |
| Card hover doesn't lift | `interactive` not passed to consumer | Verify prop forwarding |
| Faction Pill renders primary gradient | Missing `data-theme` ancestor | Wrap in `<div data-theme="werewolves">` or set on `<main>` |
| `wc -l History.module.css` doesn't shrink in M3 | Codex kept dead rules | Re-run delete protocol |
| `pnpm regression` fails after M3 | Some other module still has override | Sweep all of `apps/web/components/**/*.module.css` |
| Motion file count > 3 after N3 | New Motion import sneaked in | Revert; spring transitions stay in existing 3 only |
| `bg-copy-reviewer` flags text drift | Polish accidentally changed Bulgarian copy | Revert text; only banner-related copy can change |
| `pnpm perf:budget` fails | New image too large or new dep | Check `pnpm why` + asset sizes |

---

# §C — Operator notes (Codex / ChatGPT)

## Pacing

- **One PR open at a time.** Don't draft M3 while M2 is in review.
- **N1 + N2 MUST land before M3 starts.** Codex enforces via git log check.
- **M3 is the highest-risk PR.** Take 2 commits for the rebuild if needed; don't compress.
- **N3 lands between M4 and M5** — spring/drag/stagger benefits Dialog usage in M5 wizard.

## Skill invocations

| Skill | When | Why |
|---|---|---|
| `bg-copy-reviewer` | After every JSX/.md commit | Bulgarian copy invariant |
| `frontend-design` | M2 close, M3 close, M6 close, M7 close | Creative review at key boundaries (4 invocations max) |
| `role-mechanics-reviewer` | Never in v2 | Out of scope — pure frontend |

## When to pause

Pause and surface status to user when:
- Audit (M0) reveals an unexpected asset gap or override count significantly different from estimate
- Visual diff in M3 shows unexpected page-wide regression (not just /history)
- `frontend-design` returns suggestions that require user buy-in (e.g. "consider new primitive")
- N4 trigger emerges but borderline (2 vs 3 consumers)
- M6 diff approaches 15 files (split decision)

Don't pause for:
- Per-commit test/regression failures — revert and retry
- Routine visual baseline updates after manual review

## Discipline

- **Conservative > clever.** When in doubt, keep existing rule.
- **Token-first.** New colour need → token, not prop.
- **No new dependencies.**
- **No `prefers-reduced-motion` guards.**
- **Visual baselines reviewed manually before update.**
- **Sacred files frozen.**
- **Anti-pattern guard never disabled.**

---

# §D — Sources

- `docs/frontend-audit-v3/codex-prompt-hero-restoration-and-page-polish-v1.md` (historical reference)
- `docs/frontend-audit-v3/codex-prompt-post-redesign-cleanup-v2-conservative.md` (cleanup operating rules)
- `docs/frontend-audit-v3/codex-prompt-hybrid-redesign-adoption-v3.1-master.md` (design system foundation)
- `docs/dictionary.md` (Bulgarian copy SOT)
- `docs/css-cleanup-log.md` (cumulative CSS sweep log — extended in M3+M4+M5+M6+M7)
- `docs/hero-restoration-audit.md` (created in M0)
- `docs/hero-restoration-closing-report.md` (created in M7)
- `packages/ui/docs/tokens.md` (extended in M1 + N1 + N2)
- `AGENTS.md` (extended in M1)

State verified against worktree on 2026-05-25.
