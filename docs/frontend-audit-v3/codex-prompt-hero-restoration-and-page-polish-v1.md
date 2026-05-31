# Codex master prompt — Hero restoration + per-page polish v1

Sequel to `codex-prompt-post-redesign-cleanup-v2-conservative.md`. After PRs A-J landed and the codebase is on a stable plateau, this prompt addresses the **single biggest user-visible regression** of the cleanup: **hero banner images were stripped during primitive migration**, leaving pages feeling flat and generic.

This is a **restoration + polish** engagement, not another cleanup. Each affected page gets its hero banner back **and** a focused polish pass so it feels intentional, not just "repaired."

| # | PR | Scope | Effort | Commits |
|---|---|---|---|---|
| 1 | **PR M1** Foundation | Extend `SceneCard` with `background` prop + scrim overlay + tests + docs | ~1 h | 3 |
| 2 | **PR M2** /account | Restore hero banner + dossier polish | ~2 h | 4 |
| 3 | **PR M3** /history | Cinematic archive rebuild (worst case) | ~3 h | 6 |
| 4 | **PR M4** /privacy + /terms | Trust + formal pair (shared pattern) | ~2 h | 5 |
| 5 | **PR M5** /report + /faq | Helpful + cozy pair | ~2 h | 5 |
| 6 | **PR M6** /status | Monitoring polish | ~1 h | 3 |
| 7 | **PR M7** /create + theme verify | Tavern bg verification + light-theme fix | ~1 h | 2 |

**Total**: ≈ 28 atomic commits across 7 PRs, ~12 hours Codex work at high reasoning. **NO reverts. NO existing primitives broken.** This is purely additive (1 new prop) plus per-page wiring.

> **Operating rules** (non-negotiable, inherited from v2 conservative + new restoration constraints):
> 1. After every commit: `pnpm regression && pnpm typecheck && pnpm build`. If red → revert that commit.
> 2. At each PR boundary: full `pnpm verify`.
> 3. Visual regression: `pnpm visual` MUST be reviewed manually before `pnpm visual:update`. Hero restoration WILL change snapshots — that's intentional, but inspect each diff.
> 4. **NO `prefers-reduced-motion` guards anywhere.** Project convention.
> 5. **NO new fonts.** Stack stays: Noto Serif Display + Noto Serif + Iowan Old Style.
> 6. **NO new deps.** SceneCard extension is pure CSS/React, no Motion, no Radix.
> 7. Sacred preservation list (§0.2) — DO NOT TOUCH.
> 8. After every commit touching JSX text or `.md` → invoke `bg-copy-reviewer` agent.
> 9. PRs ship in order (M1 → M2 → ... → M7). Don't open M2 until M1 merges.
> 10. Atomic commits, no folding.
> 11. **Critical new rule**: **NO `:global()` selectors in CSS modules that override primitive identity.** If a page needs custom styling, either extend the primitive (PR M1 pattern) or use a page-local wrapper class on the consumer side. The `:global(.history-shell .paper-card) { background: dark }` anti-pattern from PR C is the bug we're paying for now — never recreate it.
> 12. **Per-page identity is encouraged.** Each page can carry its own atmospheric accents in its CSS module (decorative overlays, page-specific gradients, accent borders). What's forbidden is global style scoping that overrides shared primitives.

---

# §0 — Pre-flight, sacred list, gates

## §0.1 — Pre-flight verification

```bash
# v3.1 + cleanup must have landed
test -f packages/ui/src/primitives/SceneCard.tsx                            && echo "✓ SceneCard exists"
test -f apps/web/components/account/AccountHero.tsx                         && echo "✓ AccountHero migrated"
ls apps/web/public/game-art/account/account-hero-banner.{avif,webp,png}     && echo "✓ account banner present"
ls apps/web/public/game-art/legal/{privacy,terms,report,faq-hearth,status,replay}-banner.{avif,webp,png}  && echo "✓ legal banners present"
ls apps/web/public/game-art/bg-history-archive.{avif,webp,png}              && echo "✓ history archive present"
grep -q ":global(.history-shell .paper-card)" apps/web/components/history/History.module.css  && echo "⚠ anti-pattern still present — PR M3 will remove"

# Baseline metrics for impact tracking
pnpm regression 2>&1 | tail -3                                              # must be green
pnpm --filter @werewolf/ui test 2>&1 | tail -3                              # all passing
pnpm --filter @werewolf/web test 2>&1 | tail -3                             # 89+ passing
```

If any of the "✓" checks fail → STOP, the cleanup PRs are not in the expected state.

## §0.2 — Sacred preservation list

Inherited from v2 plus restoration-specific:

- `apps/web/hooks/use-timer-countdown.ts`
- `apps/web/lib/use-modal.ts`, `auth-errors.ts`, `clipboard.ts`
- `apps/web/components/account/AccountDangerZone.tsx` — destructive flow; only its OUTER wrapper may change in M2
- `apps/web/components/play-room-client.tsx` — frozen during M; play UI is not affected
- `apps/game-server/src/**` — out of scope, this is frontend-only work
- `packages/shared/src/{role-assignment,win-conditions,protocol}.ts` — frozen
- All `--art-*` tokens in `globals.css:50-80` — kept; just consume them via new SceneCard prop
- All 11 existing primitives' public API — only SceneCard adds a new optional prop in M1
- Bulgarian production copy — only polish text changes allowed, and `bg-copy-reviewer` agent reviews

## §0.3 — Atomic commit gates

After EVERY commit:

```bash
pnpm regression && pnpm typecheck && pnpm build
```

If red → `git revert HEAD`. Don't pile fixes.

After commits touching `packages/ui/src/**`:

```bash
pnpm --filter @werewolf/ui test
pnpm visual:ui   # focus stories + per-route axe must stay green
```

After commits touching page-level chrome (hero/banner):

```bash
pnpm visual    # full app visual regression; expect intentional diffs
# Inspect EACH diff PNG manually before pnpm visual:update
```

At each PR boundary:

```bash
pnpm verify
```

## §0.4 — Per-page identity guide (creative direction for Codex)

Each page has a distinct atmosphere. When polishing, lean into these moods. Don't invent new motifs — use what already exists in the asset bank.

| Page | Mood | Existing motifs | Polish direction |
|---|---|---|---|
| `/account` | **Dignified dossier** | Gold-bordered avatar, monospace stats | Strengthen gold accents, warm brown undertone, ensure stats feel like a tally not a metrics dashboard |
| `/history` | **Detective archive** | Red thread, evidence cards, sepia banner | Cinematic dark; carded entries with subtle outcome accents (no tilt or pushpin — those felt cute, not serious) |
| `/privacy` | **Open vault** | Brass keys, transparent panes | Warm, trustworthy; hero feels reassuring, not intimidating |
| `/terms` | **Sealed handshake** | Wax seal, formal documents | Restrained, formal, slightly cooler tones than /privacy |
| `/report` | **Lighthouse beacon** | Light beam over dark water | Hero feels like beacon — bright accent against deep background; helpful, not alarming |
| `/faq` | **Hearth glow** | Fire embers, gathered chairs | Warm orange/amber glow; conversational; hero feels like sitting near a fire |
| `/status` | **Operational watchtower** | Lighthouse harbor, monitoring lights | Clean, calm; banner is reassuring presence, not the focus — tiles are the focus |
| `/create` (3 versions) | **Tavern preparation** | Wooden tables, candle light, tavern atmosphere | Tavern bg should be visible; faction theme (werewolves green / mafia red) drives accent color |

These guides drive Codex's `frontend-design` skill invocations at PR M2 + PR M3 ends.

---

# §1 — PR M1: Foundation — extend SceneCard (~1 h, 3 commits)

**Goal**: add optional `background` prop to `SceneCard` so consumers can render a hero banner image behind the dark scene tone, without `:global()` overrides.

## §1.1 — Extend `SceneCard.tsx`

```diff
 import type { ReactNode } from "react";
 import { Eyebrow } from "./Eyebrow";
 import { Surface } from "./Surface";

+export interface SceneCardBackground {
+  /** CSS image source — either a URL or a CSS image-set token (e.g. "var(--art-history)") */
+  image: string;
+  /** Overlay strength to ensure text contrast on top of the image. Default: "scrim". */
+  overlay?: "scrim" | "veil" | "none";
+  /** Horizontal focal point in % (0 = left, 50 = center, 100 = right). Default: 50. */
+  focalX?: number;
+  /** Vertical focal point in %. Default: 50. */
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

 const DENSITY_PAD = {
   sm: "16px",
   md: "28px",
   lg: "48px",
 } as const;

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

**Commit 1**: `feat(ui): add background prop to SceneCard with overlay + focal control`

## §1.2 — Stories + tests

Extend `packages/ui/src/primitives/SceneCard.stories.tsx`:

```tsx
// New stories appended to existing file
export const WithBackground: Story = {
  args: {
    eyebrow: "АРХИВ",
    density: "lg",
    background: {
      image: 'url("/game-art/bg-history-archive.webp")',
      overlay: "scrim",
    },
    children: (
      <>
        <Display size="h1">Архив на масата</Display>
        <p style={{ color: "var(--ds-ink-scene-soft)", margin: 0 }}>Всяко дело носи дата, играчите, ролите и развръзката.</p>
      </>
    ),
  },
};

export const WithBackgroundVeil: Story = {
  args: {
    ...WithBackground.args,
    background: { ...(WithBackground.args!.background as any), overlay: "veil" },
  },
};

export const WithBackgroundNoOverlay: Story = {
  args: {
    ...WithBackground.args,
    background: { ...(WithBackground.args!.background as any), overlay: "none" },
  },
};

export const WithBackgroundFocalShift: Story = {
  args: {
    ...WithBackground.args,
    background: { ...(WithBackground.args!.background as any), focalX: 25, focalY: 80 },
  },
};
```

Extend `packages/ui/src/primitives/SceneCard.test.tsx`:

```tsx
it("renders background layer when background.image is provided", () => {
  const { container } = render(
    <SceneCard background={{ image: 'url("/x.webp")' }}>content</SceneCard>,
  );
  const layer = container.querySelector("[aria-hidden]") as HTMLElement | null;
  expect(layer).toBeTruthy();
  expect(layer?.style.backgroundImage).toContain('url("/x.webp")');
});

it("omits background layer when background prop is undefined", () => {
  const { container } = render(<SceneCard>content</SceneCard>);
  expect(container.querySelector("[aria-hidden]")).toBeNull();
});

it("applies scrim overlay by default and veil/none on request", () => {
  const cases: Array<{ overlay: "scrim" | "veil" | "none" | undefined; expectKeyword: string }> = [
    { overlay: undefined, expectKeyword: "0.92" }, // scrim is darkest at edges
    { overlay: "veil", expectKeyword: "0.78" },
    { overlay: "none", expectKeyword: "0.3" },
  ];
  for (const { overlay, expectKeyword } of cases) {
    const { container } = render(
      <SceneCard background={{ image: 'url("/x.webp")', overlay }}>x</SceneCard>,
    );
    const layer = container.querySelector("[aria-hidden]") as HTMLElement;
    expect(layer.style.backgroundImage).toContain(expectKeyword);
  }
});
```

Run:

```bash
pnpm --filter @werewolf/ui test
pnpm --filter @werewolf/ui build
pnpm visual:ui --update-snapshots   # 4 new SceneCard story snapshots × 2 themes × 2 viewports = 16 new baselines
```

Inspect the new baselines manually before committing.

**Commit 2**: `test(ui): cover SceneCard background slot with stories + unit tests`

## §1.3 — Document the pattern + cement the anti-pattern rule

Append to `packages/ui/docs/tokens.md`:

```md
## Hero banners via SceneCard background

`SceneCard` supports an optional `background` slot for hero banner images.
Consumers pass either a URL or a CSS image-set token:

```tsx
<SceneCard
  eyebrow="ДОСИЕ"
  density="lg"
  background={{ image: 'url("/game-art/account/account-hero-banner.webp")', overlay: "scrim" }}
>
  <Display size="h1">{userName}</Display>
</SceneCard>
```

Overlay options:
- `scrim` (default) — strong dark gradient for full text legibility
- `veil` — medium overlay for atmospheric balance
- `none` — minimal tint, use only when banner art is pre-darkened

Focal control: `focalX`/`focalY` shift the background image origin point
(0-100, default 50/50). Use for banners where the subject is off-center.

## Anti-pattern: `:global()` primitive overrides

CSS modules MUST NOT use `:global(.primitive-class) { ... }` selectors to
override primitive identity. This caused the `/history` regression in PR C:

```css
/* ❌ WRONG — fights with PaperCard's paper identity */
:global(.history-shell .paper-card) {
  background: linear-gradient(105deg, dark);
  color: white;
}

/* ✓ RIGHT — use the primitive variant that matches your intent */
<SceneCard>...</SceneCard>  /* if you need dark, use scene-tone primitive */
```

If a primitive lacks the variant you need:
1. Add an optional prop (like `SceneCard.background`)
2. Test + document the new prop
3. Migrate consumers
```

Append to `AGENTS.md` (Design system section):

```md
### Hero banners

Hero banner images go through `SceneCard`'s `background` prop, not page-local
`<Image fill>` wrappers and not `:global()` CSS overrides. The pattern:

```tsx
<SceneCard
  eyebrow="…"
  density="lg"
  background={{ image: "var(--art-history)", overlay: "scrim" }}
>
  <Display size="h1">…</Display>
  …
</SceneCard>
```

See `packages/ui/docs/tokens.md` for full API.
```

**Commit 3**: `docs(ui): document SceneCard background slot + cement anti-pattern rule`

**PR M1 close-out**:
- All UI tests + visual baselines green
- AGENTS.md updated
- No existing SceneCard consumer broken (backwards compatible — `background` is optional)
- Full `pnpm verify`

---

# §2 — PR M2: /account — Hero banner restoration + dossier polish (~2 h, 4 commits)

## §2.1 — Restore hero banner

Edit `apps/web/components/account/AccountHero.tsx`:

```diff
 export function AccountHero(props: AccountHeroProps) {
   /* ... existing logic ... */
   return (
     <header aria-label="Досие" className={styles.heroFrame}>
-      <SceneCard eyebrow="ДОСИЕ" density="lg">
+      <SceneCard
+        eyebrow="ДОСИЕ"
+        density="lg"
+        background={{
+          image: 'image-set(url("/game-art/account/account-hero-banner.webp") type("image/webp"), url("/game-art/account/account-hero-banner.png") type("image/png"))',
+          overlay: "scrim",
+          focalY: 35,
+        }}
+      >
```

Run `pnpm visual --grep "/account"`. Inspect diff. Hero should now feel like a proper dossier header, not a flat dark rectangle.

**Commit 1**: `feat(account): restore hero banner via SceneCard background slot`

## §2.2 — Dossier polish

Strengthen the dignified-dossier identity. In `AccountHero.module.css`:

- Add a thin gold hairline under the eyebrow (currency: identity feels like a stamped folder)
- Add subtle paper-grain texture to the avatar container border
- Strengthen stat label typography contrast (monospace already, but make it feel more like a tally)

Specifically (additions to existing module, no `:global()`):

```css
.heroFrame {
  /* existing rules */
}

.heroProfile {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 28px;
  align-items: center;
}

.heroAvatar {
  --avatar-size: 96px;
  width: var(--avatar-size);
  height: var(--avatar-size);
  border-radius: 50%;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  position: relative;
}

.heroAvatar::after {
  /* gold-ring shimmer accent */
  content: "";
  position: absolute;
  inset: -6px;
  border-radius: 50%;
  border: 1px solid oklch(0.78 0.115 75 / 0.35);
  pointer-events: none;
}

.heroName {
  display: grid;
  gap: 8px;
}

.heroStats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 32px;
  padding-top: 16px;
  border-top: 1px solid oklch(0.78 0.115 75 / 0.25);
}

@media (max-width: 640px) {
  .heroProfile {
    grid-template-columns: auto;
    text-align: center;
    justify-items: center;
  }
  .heroStats {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 16px;
  }
}
```

Inline styles in `AccountHero.tsx` should move to the module — that's the polish opportunity. Convert `style={quickStatLabelStyle}` etc. to `className={styles.statLabel}` patterns.

**Commit 2**: `refactor(account): move AccountHero inline styles to CSS module + gold ring accent`

## §2.3 — Verify dark/light + mobile

Run:

```bash
pnpm visual --grep "/account"
pnpm visual --grep "account" --update-snapshots   # only after manual review
```

Verify in browser:
- Dark theme: banner visible, scrim ensures text legibility
- Light theme: banner visible (SceneCard is always scene-tone, doesn't switch with theme — confirm acceptable)
- Mobile 375px: hero stacks vertically, avatar centered, stats wrap properly

If something looks off, fix in this commit (don't pile to next PR).

**Commit 3**: `fix(account): tune hero responsive layout for mobile + dark theme`

## §2.4 — Frontend-design review pass

Invoke `frontend-design` skill:

> Review /account hero after banner restoration + polish in PR M2. The page identity is "dignified dossier" — gold accents, monospace stats, warm brown undertone via the new SceneCard banner. Compare to existing dossier-feeling references in the codebase (auth/account-dossier banner, role-detail cards). Suggest 3-5 concrete improvements ranked by impact, focusing on hero impact and stats hierarchy.

Apply the top 1-3 suggestions in a single polish commit. If frontend-design returns nothing actionable, skip this commit.

**Commit 4** (conditional): `style(account): apply frontend-design polish suggestions for dossier feel`

**PR M2 close-out**: `pnpm verify`. Bg-copy-reviewer agent on touched files. Visual baselines committed.

---

# §3 — PR M3: /history — Cinematic archive rebuild (~3 h, 6 commits)

**This is the worst case** — multiple anti-patterns layered on each other. Plan: rebuild cleanly, not patch.

## §3.1 — Restore hero banner + migrate header to SceneCard

Edit `apps/web/components/history/EvidenceWall.tsx`:

```diff
+ import { Display, Eyebrow, SceneCard } from "@werewolf/ui";
+ import styles from "./History.module.css";

  export function EvidenceWall({ games }: { games: HistoryGameView[] }) {
    /* ... existing logic ... */
    return (
      <>
-       <header className="evidence-wall-header">
-         <p className="section-kicker">архив</p>
-         <h1>Архив на масата</h1>
-         <p className="evidence-wall-subtitle">Всяко дело носи дата, играчите, ролите и развръзката.</p>
-       </header>
+       <header aria-label="Архив на масата" className={styles.heroFrame}>
+         <SceneCard
+           eyebrow="АРХИВ"
+           density="lg"
+           background={{
+             image: "var(--art-history)",
+             overlay: "scrim",
+           }}
+         >
+           <Display size="hero">Архив на масата</Display>
+           <p className={styles.heroSubtitle}>
+             Всяко дело носи дата, играчите, ролите и развръзката.
+           </p>
+         </SceneCard>
+       </header>
```

**Commit 1**: `refactor(history): migrate EvidenceWall hero to SceneCard with archive banner`

## §3.2 — Migrate filter buttons to Pill

```diff
+ import { Pill } from "@werewolf/ui";

-       <div className="evidence-filters" role="group" aria-label="Филтри по дело">
+       <div className={styles.evidenceFilters} role="group" aria-label="Филтри по дело">
          {FILTERS.map((item) => (
-           <button
-             key={item.value}
-             type="button"
-             aria-pressed={filter === item.value}
-             data-active={filter === item.value}
-             onClick={() => setFilter(item.value)}
-           >
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

`.evidenceFilters` rule in `History.module.css` should just be a flex container; remove the per-button styling block (now Pill's responsibility).

**Commit 2**: `refactor(history): adopt Pill primitive for evidence wall filters`

## §3.3 — Switch CaseFileCard from PaperCard to SceneCard + remove decorations

The override-fight: PaperCard was forced into dark cinematic. The fix: use SceneCard, which IS dark by design.

Edit `apps/web/components/history/CaseFileCard.tsx`:

```diff
- import { Display, PaperCard } from "@werewolf/ui/server";
+ import { Display, SceneCard, Pill } from "@werewolf/ui/server";
+ import styles from "./History.module.css";

  export function CaseFileCard({ game }: { game: HistoryGameView }) {
    const family = modeFamily(game.mode);
    const outcome = outcomeFor(game);
    const moments = topMoments(game.timeline, 2);
-   const style = { "--tilt": `${tiltFor(game.id)}deg` } as CSSProperties;

    return (
-     <article className="case-file-shell" data-family={family} data-outcome={outcome} style={style}>
-       <span className="pushpin" aria-hidden="true" />
-       <PaperCard eyebrow={`ДЕЛО №${game.code}`} density="md" meta={<span className="case-file-date">{shortDate(game.endedAt)}</span>}>
-         <div className="case-file-content">
-           <div className="case-file-verdict">
-             <Display size="h3" as="h2">{winnerBg(game.winnerTeam)}</Display>
-           </div>
-           <p className="case-file-mode">{modeBg(game.mode)} · {playerCountBg(game)}</p>
-           <ul className="case-file-highlights">
-             {moments.map((moment) => (
-               <li key={moment.id}>
-                 <span className="case-file-bullet" aria-hidden="true" />
-                 {moment.label}
-               </li>
-             ))}
-           </ul>
-           <footer className="case-file-foot">
-             <span className="case-file-events">{eventsBg(game.eventCount)}</span>
-             <Link href={`/history/${game.id}/replay`} className="case-file-cta">
-               Отвори дело <span aria-hidden="true">›</span>
-             </Link>
-           </footer>
-         </div>
-       </PaperCard>
-     </article>
+     <article
+       className={styles.caseFileShell}
+       data-family={family}
+       data-outcome={outcome}
+     >
+       <SceneCard
+         eyebrow={`ДЕЛО №${game.code}`}
+         density="md"
+         meta={<span className={styles.caseFileDate}>{shortDate(game.endedAt)}</span>}
+       >
+         <div className={styles.caseFileContent}>
+           <Display size="h3" as="h2">{winnerBg(game.winnerTeam)}</Display>
+           <p className={styles.caseFileMode}>{modeBg(game.mode)} · {playerCountBg(game)}</p>
+           <ul className={styles.caseFileHighlights}>
+             {moments.map((moment) => (
+               <li key={moment.id}>
+                 <span className={styles.caseFileBullet} aria-hidden="true" />
+                 {moment.label}
+               </li>
+             ))}
+           </ul>
+           <footer className={styles.caseFileFoot}>
+             <span className={styles.caseFileEvents}>{eventsBg(game.eventCount)}</span>
+             <Pill as={Link} href={`/history/${game.id}/replay`} intent="ghost" size="sm">
+               Отвори дело →
+             </Pill>
+           </footer>
+         </div>
+       </SceneCard>
+     </article>
    );
  }
```

Update `History.module.css`:
- Remove `:global(.history-shell .paper-card)` block (THE anti-pattern)
- Remove `.case-file-shell` tilt rotate transform
- Remove `.pushpin` rule entirely
- Remove `:global(.case-file)` parchment-texture rule
- Remove `.case-file h2 etc.` light-text overrides
- Add new module-scoped classes (`.heroFrame`, `.heroSubtitle`, `.evidenceFilters`, `.caseFileShell`, `.caseFileContent`, `.caseFileMode`, `.caseFileHighlights`, `.caseFileBullet`, `.caseFileFoot`, `.caseFileDate`, `.caseFileEvents`) that scope to local rendering

Replace the case-file outcome accent with a subtle left border on the SceneCard wrapper:

```css
.caseFileShell {
  position: relative;
  transition: transform 180ms ease;
}

.caseFileShell:hover {
  transform: translateY(-3px);
}

.caseFileShell[data-outcome="win"] [data-ds-scene-card] {
  border-left: 2px solid oklch(0.55 0.10 145);  /* green accent */
}

.caseFileShell[data-outcome="loss"] [data-ds-scene-card] {
  border-left: 2px solid var(--ds-accent-blood);
}

.caseFileShell[data-outcome="unknown"] [data-ds-scene-card] {
  border-left: 2px solid oklch(0.55 0.015 60 / 0.4);  /* neutral ink-faint */
}
```

Note: `[data-ds-scene-card]` is the data attribute SceneCard already emits — this is **NOT** a `:global()` override of primitive identity, it's a sibling-context selector applied via the parent wrapper. Allowed because we're styling the wrapper's child, not redefining what SceneCard means.

**Commit 3**: `refactor(history): rebuild CaseFileCard on SceneCard primitive (no overrides, no pushpin)`

Also delete unused helper:

```bash
# tiltFor is no longer needed
rm apps/web/lib/history-tilt.ts || true
```

Or if used elsewhere, just stop importing it from CaseFileCard.

**Commit 4**: `chore(history): drop tilt helper after pushpin retirement`

## §3.4 — Migrate replay page sections

`apps/web/app/history/[gameId]/replay/page.tsx` — hero already on SceneCard, but body sections are raw. Migrate:

- `<section className="replay-verdict-card">` → `<PaperCard eyebrow="ПОБЕДА" density="md">` (paper-tone here is fine — this is a content card below cinematic hero)
- `<section className="replay-participants">` → `<PaperCard eyebrow="ИГРАЧИ" density="md">`
- `<section className="replay-timeline-v2">` keep custom but wrap each phase group in `<PaperCard density="sm">`
- `<article className="replay-achievements">` → `<PaperCard eyebrow="ОТКЛЮЧЕНИ МОМЕНТИ" density="md">`
- `<div className="achievement-card">` inside replay → wrap in `<PaperCard density="sm">` or keep custom card with `--ds-*` tokens

Use existing `replay-banner.webp` for the replay hero (replace `bg-history-archive` reference if any):

```diff
- <SceneCard eyebrow="ПРЕГЛЕД СЛЕД ИГРА" density="lg">
+ <SceneCard
+   eyebrow="ПРЕГЛЕД СЛЕД ИГРА"
+   density="lg"
+   background={{
+     image: 'image-set(url("/game-art/legal/replay-banner.webp") type("image/webp"), url("/game-art/legal/replay-banner.png") type("image/png"))',
+     overlay: "scrim",
+   }}
+ >
```

**Commit 5**: `refactor(history): migrate replay sections (verdict + participants + timeline + achievements) to PaperCard`

## §3.5 — Dead CSS sweep + visual baseline update

Now that override-fights are gone, the History module has lots of dead rules. Sweep:

```bash
# In History.module.css, identify rules that no longer have JSX consumers
grep -oE "^[\.:]global\(\.[a-z-]+\)" apps/web/components/history/History.module.css | sort -u > /tmp/history-classes.txt
# For each class, grep apps/web for live refs (same protocol as PR A)
```

Delete:
- `:global(.history-shell .paper-card) { ... }` block + light-text overrides (THE anti-pattern)
- `:global(.evidence-wall-header)` and its h1/subtitle children
- `:global(.evidence-filters button)` and variants
- `:global(.case-file-shell)` transform/tilt rules
- `:global(.case-file)` parchment block
- `:global(.pushpin)` and variants
- `:global(.case-file-verdict)`, `.case-file-mode`, `.case-file-highlights`, `.case-file-bullet`, `.case-file-foot`, `.case-file-events`, `.case-file-cta`, `.case-file-date` rules — replaced by module-scoped versions

Keep:
- `.evidence-shell` page-shell rules
- `.history-empty`, `.history-game-card` (if still consumed)
- `.replay-shell` page-shell
- Any remaining `.replay-*` rules whose consumers were migrated to PaperCard but kept the class name (rare, audit)

Append to `docs/css-cleanup-log.md` documenting the sweep.

Run `pnpm visual --grep "/history"`, manually inspect diffs, then `pnpm visual:update`.

**Commit 6**: `chore(history): remove dead override-fight rules + log cleanup`

**PR M3 close-out**:
- `wc -l apps/web/components/history/History.module.css` — expect significant reduction (probably 30-40% smaller)
- No `:global(.*\.paper-card)` selectors remain
- `pnpm verify` green
- Bg-copy-reviewer agent on touched files
- Invoke `frontend-design` skill:
  > Review /history list + /history/[id]/replay after PR M3 rebuild. Identity is "detective archive" — cinematic dark, restrained accents, no decorative pushpins. Look for inconsistencies, hierarchy issues, or moments where polish would land. Suggest 3-5 improvements.
- Apply top 1-2 suggestions in a follow-up commit if material.

---

# §4 — PR M4: /privacy + /terms — Trust + formal pair (~2 h, 5 commits)

Both pages share the legal-shell structure and benefit from similar restoration.

## §4.1 — /privacy hero restoration

Edit `apps/web/components/privacy/PrivacyHero.tsx`:

```diff
- <SceneCard eyebrow="…" density="lg">
+ <SceneCard
+   eyebrow="…"
+   density="lg"
+   background={{
+     image: 'image-set(url("/game-art/legal/privacy-banner.webp") type("image/webp"), url("/game-art/legal/privacy-banner.png") type("image/png"))',
+     overlay: "scrim",
+   }}
+ >
```

If PrivacyHero passes children that include description text, ensure scrim doesn't fight contrast — `--ds-ink-scene-soft` already adapts.

**Commit 1**: `feat(privacy): restore hero banner via SceneCard background`

## §4.2 — /privacy polish — open vault feel

`apps/web/components/privacy/Privacy*.module.css` or whichever module the hero uses — add subtle accents:
- Hairline brass border at hero bottom (warm gold, low opacity)
- PrivacyPromiseWall icons could gain a subtle gold glow on hover (only `transition`, no Motion)

**Commit 2**: `style(privacy): warm brass accents on hero + promise icons`

## §4.3 — /terms hero restoration

Same as privacy but with `/game-art/legal/terms-banner.{webp,png}` and `overlay: "scrim"`.

The mood is "sealed handshake — formal restraint", so consider `overlay: "veil"` if the banner is already dark enough. Test both, pick what reads better.

**Commit 3**: `feat(terms): restore hero banner via SceneCard background`

## §4.4 — /terms polish — formal seal feel

Subtle wax-seal motif as small icon next to the section eyebrows (use existing legal assets if any, otherwise a tasteful Unicode symbol like ◈ or restraint with no decoration).

Section spacing — terms reads densely; consider slightly larger `density="lg"` on section PaperCards if they currently use `md`.

**Commit 4**: `style(terms): formal section restraint + denser legal hierarchy`

## §4.5 — Dead CSS sweep + visual baselines

`pnpm visual --grep "(privacy|terms)"`. Inspect. Update baselines.

Remove any dead `.privacy-hero-*` / `.terms-hero-*` rules that previously held banner styles (sweep using PR A protocol). Append to `docs/css-cleanup-log.md`.

**Commit 5**: `chore(css): sweep dead privacy + terms hero rules + log update`

**PR M4 close-out**: `pnpm verify`, bg-copy-reviewer.

---

# §5 — PR M5: /report + /faq — Helpful + cozy pair (~2 h, 5 commits)

## §5.1 — /report hero restoration

Edit `apps/web/components/report/ReportHero.tsx`:

```diff
- <SceneCard eyebrow="…" density="lg">
+ <SceneCard
+   eyebrow="…"
+   density="lg"
+   background={{
+     image: 'image-set(url("/game-art/legal/report-banner.webp") type("image/webp"), url("/game-art/legal/report-banner.png") type("image/png"))',
+     overlay: "scrim",
+     focalY: 40,
+   }}
+ >
```

**Commit 1**: `feat(report): restore lighthouse banner via SceneCard background`

## §5.2 — /report wizard polish

`ReportWizard.tsx` uses `EmptyState` + `Pill`. Polish:
- Step indicators could become `<Pill intent="ghost" size="sm">` for consistency
- Success state's CTA buttons grouped with consistent spacing
- Add a subtle "beacon" accent — small light gradient at the wizard's active step

**Commit 2**: `style(report): polish wizard steps with consistent Pill chrome + beacon accent`

## §5.3 — /faq hero restoration

Edit `apps/web/components/faq/FaqHearth.tsx`:

```diff
+ background={{
+   image: 'image-set(url("/game-art/legal/faq-hearth-banner.webp") type("image/webp"), url("/game-art/legal/faq-hearth-banner.png") type("image/png"))',
+   overlay: "scrim",
+ }}
```

Keep the existing `faq-hearth-motif.webp` footer Image — that's already working and gives the page a unique closing motif.

**Commit 3**: `feat(faq): restore hearth banner via SceneCard background`

## §5.4 — /faq hearth polish — fire glow feel

`FaqHearth.module.css` — add:
- Warm amber radial gradient overlay on the question accordion when expanded (atmospheric, not flashy)
- Search input could have a faint glow when focused (use existing `--ds-focus-ring`)
- Category sections feel cozier with slightly warmer borderline tones

**Commit 4**: `style(faq): warm hearth glow on expanded answers + focused search`

## §5.5 — Dead CSS sweep

Same protocol. Remove `.report-hero-*` / `.faq-hearth-banner*` chrome rules that became dead after banner restoration.

**Commit 5**: `chore(css): sweep dead report + faq hero rules + log update`

**PR M5 close-out**: `pnpm verify`, bg-copy-reviewer.

---

# §6 — PR M6: /status — Monitoring polish (~1 h, 3 commits)

The smallest restoration. Banner was discrete to begin with.

## §6.1 — Restore banner

`StatusHero.tsx`:

```diff
- <SceneCard eyebrow="СЪСТОЯНИЕ НА УСЛУГИТЕ" density="lg">
+ <SceneCard
+   eyebrow="СЪСТОЯНИЕ НА УСЛУГИТЕ"
+   density="lg"
+   background={{
+     image: 'image-set(url("/game-art/legal/status-banner.webp") type("image/webp"), url("/game-art/legal/status-banner.png") type("image/png"))',
+     overlay: "veil",   // lighter overlay — status is reassuring, not cinematic
+   }}
+ >
```

**Commit 1**: `feat(status): restore harbor banner via SceneCard background with veil overlay`

## §6.2 — Service tile polish (deferred from v3.1)

`StatusServiceTiles.tsx` was intentionally left on legacy classes. Now is a good moment for a small polish — but **scope-bound**: don't migrate to a Tile primitive (we said no new primitives now). Instead:

- Ensure tiles use `--ds-*` color tokens consistently
- Improve status badge contrast (`ok` green is currently low-saturation; bump within token range)
- Add subtle pulse animation on `down` status (CSS-only, no Motion)

**Commit 2**: `style(status): polish service tile badges + pulse accent for outages`

## §6.3 — Dead CSS sweep

If any `.status-hero-banner` chrome remains (unlikely after PR A), sweep it.

**Commit 3**: `chore(css): final status hero sweep + log update`

**PR M6 close-out**: `pnpm verify`.

---

# §7 — PR M7: /create + theme verification (~1 h, 2 commits)

## §7.1 — Verify lobby tavern background renders

The 3 create pages (`/create`, `/werewolf/create`, `/mafia/create`) rely on `.lobby-shell::before` pseudo-element, which is gated to `html[data-theme="dark"]`. Audit:

1. What's the default HTML `data-theme` in production? (Check `<html>` rendering in `apps/web/app/layout.tsx`.)
2. If default is `light`, the tavern bg is invisible on /create — that's a regression.

**Fix decision**:
- If users expect light theme + tavern visible: remove the `data-theme="dark"` gate, OR add a `.lobby-shell::before { display: block }` rule that's NOT theme-gated, OR move the bg into a per-page CSS module that doesn't depend on global theme.
- If users expect dark theme by default: confirm `<html data-theme="dark">` and document in AGENTS.md.

Make the choice in code + document in `AGENTS.md` under "Theme defaults".

**Commit 1**: `fix(create): ensure lobby tavern background renders in default theme + document policy`

## §7.2 — Faction accent confirmation

`/werewolf/create` has `data-theme="werewolves"` and `/mafia/create` has `data-theme="mafia"`. Confirm these:
- Apply expected color accent (green for village, red for mafia) on the create wizard
- Pair correctly with the tavern banner (werewolves dark tavern vs mafia red-lit tavern — both assets exist)

If accents are weak or invisible, add a `[data-family="werewolves"]` / `[data-family="mafia"]` scope in `LobbyWizard.module.css` to strengthen them.

**Commit 2**: `style(create): strengthen faction accents on werewolves + mafia create pages`

**PR M7 close-out**: `pnpm verify`, manual visual smoke on the 3 create pages in both themes.

---

# §8 — Acceptance criteria (after all PRs M1-M7)

| Metric | Before | After |
|---|---|---|
| `:global(.*\.paper-card)` selectors in any `.module.css` | 5+ | **0** |
| `:global(.*\.scene-card)` selectors | 0 | **0** (regression check) |
| Pages with hero banner image visible | 0 (none working) | **7** (/account, /history, /privacy, /terms, /report, /faq, /status) |
| `SceneCard` consumers with `background` prop | 0 | **7+** |
| New SceneCard tests | n/a | **3 new test cases** |
| `pnpm visual:ui` baselines for SceneCard | 4 | **8+** (existing + WithBackground variants) |
| `pnpm visual` baselines for pages | 88 | **~96+** (intentional updates per page) |
| Dead CSS rules swept | n/a | logged in `docs/css-cleanup-log.md` |
| Pages on `@werewolf/ui` primitives (unchanged) | 14 | 14 (no regression) |
| `pnpm regression` contracts | 16 | 16 (no new ones added) |

**Must-pass at every PR boundary**: `pnpm verify` green.

---

# §9 — Failure modes

| Symptom | Cause | Fix |
|---|---|---|
| Hero banner image renders but text is unreadable | Wrong `overlay` setting | Switch from `none`/`veil` to `scrim` |
| Banner image looks crushed / wrong subject visible | Focal point off | Tune `focalX`/`focalY` (e.g. 30/70 for ground-level subject) |
| `pnpm visual` diff massive on a page you didn't touch | Hero migration changed page layout flow | Inspect; this is usually intentional, but check mobile breakpoints |
| `pnpm --filter @werewolf/ui test` fails after M1 | New tests assume DOM structure that doesn't match | Inspect rendered HTML in test; adjust selectors |
| `wc -l History.module.css` doesn't shrink in M3 | Codex kept dead rules "just in case" | Re-run delete protocol from PR A §A.2 |
| Pill in CaseFileCard loses link semantics | `<Pill as={Link} href=...>` doesn't forward props | Check Pill's API; if `as` doesn't accept `Link`, wrap differently: `<Link href><Pill>...</Pill></Link>` |
| Theme switcher breaks SceneCard banner | Backgrounds are scene-tone tokens (theme-invariant) | This is by design — banner should look right in both themes |
| Lobby tavern bg broken on `/create` | Gated to `data-theme="dark"` | PR M7 fix |
| `bg-copy-reviewer` flags polish text changes | Polish accidentally changed Bulgarian copy | Revert text; only the new banner-related copy should change |
| `frontend-design` returns generic feedback | Prompt was too generic | Reprompt with explicit identity guide from §0.4 |

---

# §10 — Operator notes (Codex / ChatGPT)

- **One PR open at a time.** Don't draft M3 branch while M2 is in review.
- **PR M3 is the highest-risk** — most rules to remove, most consumers to migrate. Take 2 commits for the rebuild step if needed; don't compress.
- **Visual baselines WILL change.** That's expected. Inspect each diff PNG manually. If a diff is unintentional (e.g. wrong-direction shift), revert that commit.
- **Conservative > clever.** When in doubt, keep the existing rule. We're restoring + polishing, not aggressive cleanup.
- **`frontend-design` skill at PR M2 + M3 close-out only.** Don't overuse — it's expensive and most pages don't need creative direction.
- **Every commit message in English, every user-facing string in Bulgarian.** Always invoke `bg-copy-reviewer` on JSX + `.md` touching commits.
- **No new dependencies.** SceneCard extension is pure CSS/React.
- **No `prefers-reduced-motion` guards anywhere.** Project convention.
- **Sacred files in §0.2 still apply.** `play-room-client.tsx`, game-server, AccountDangerZone body — all frozen.
- **The anti-pattern rule from §0 invariant #11 is the most important new rule.** Never reintroduce `:global(.*\.primitive-class)` overrides. If you find yourself wanting to override a primitive's identity from a page module, STOP and either extend the primitive (PR M1 pattern) or rethink the page-level approach.

---

# §11 — Sources

- `docs/frontend-audit-v3/codex-prompt-hybrid-redesign-adoption-v3.1-master.md` (design system foundation)
- `docs/frontend-audit-v3/codex-prompt-post-redesign-cleanup-v1.md` (cleanup implementation spec)
- `docs/frontend-audit-v3/codex-prompt-post-redesign-cleanup-v2-conservative.md` (cleanup operating rules)
- `docs/css-cleanup-log.md` (cumulative CSS sweep log)
- `packages/ui/docs/tokens.md` (token catalog — extended in PR M1)
- `AGENTS.md` (project conventions — extended in PR M1)

State verified against worktree on 2026-05-25.
