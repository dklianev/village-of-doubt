# Codex prompt — AuthChip overhaul (Brass-locket pill)

Малък focused fix за **AuthChip** в navbar — отвратителната brass-plate текстура се заменя със **glass-blur surface + amber glow halo** около avatar-а. Cohesive с frame system + dropdowns. Modern + unique без to overdo.

**Работа директно на `main`.** ~3 commits. No new dependencies, no new imagen.

---

## Pre-analysis

### Current implementation

**File:** `apps/web/components/site-chrome/AuthChip.tsx` + matching CSS в `globals.css` (`.auth-chip`, `.auth-chip-trigger`, `.auth-chip-photo`, `.auth-chip-chevron`, etc.)

**Стилове в момента ползват:**
- `background-image: image-set(brass-plate.webp ...)` + linear-gradient overlay
- `background-blend-mode: multiply` за brass texture
- Inset double-edge box-shadow (light + dark + light layers) — heavy embossed look
- Chevron emoji "▾" в text

### Issues

| # | Issue |
|---|---|
| 1 | Brass-plate texture е too literal — изглежда like 2010 forum profile pill (especially в light theme — "scratched copper" feel) |
| 2 | Embossed double-edge inset shadow е heavy за nav element |
| 3 | Avatar circle с border но **без glow halo** — feels statically pasted, not "alive" |
| 4 | Chevron e text emoji "▾" — inconsistent с lucide icons в dropdown |
| 5 | Light theme variant просто прави brass по-светъл — все същия dated look |
| 6 | Hover state е basic — само lift, no glow intensification |

---

## Pre-decisions (locked)

| Decision | Choice |
|---|---|
| Brass-plate texture | **REMOVE напълно** — replace с glass-blur |
| Avatar treatment | Amber ring + glow halo (`box-shadow: 0 0 14px amber-soft`) |
| Glow halo pulse animation | **YES** — subtle 3s loop, opacity 0.6 → 1.0 → 0.6 |
| Halo intensification on hover | **YES** — brighter glow + minor lift |
| Chevron | Replace text "▾" с lucide `ChevronDown` icon |
| Chevron rotation on open | **YES** — 180° transform via `[aria-expanded="true"]` |
| Light theme | **YES** — cream surface + darker amber ring + softer halo |
| Loading skeleton + signed-out variants | Keep functional but reuse new styling tokens |
| Branch | Directly on `main` |

---

## Stage 1 — Refactor `AuthChip.tsx` component

**File:** `apps/web/components/site-chrome/AuthChip.tsx`

### Step 1a: Update imports

Add `ChevronDown` to the lucide-react import:

```tsx
import { ChevronDown, History, LogOut, Trophy, User } from "lucide-react";
```

### Step 1b: Replace chevron text with lucide icon

Find the trigger button rendering:

```tsx
<span className="auth-chip-chevron" aria-hidden>▾</span>
```

(May be styled as separate span; search for `auth-chip-chevron`.)

**Replace с:**

```tsx
<ChevronDown className="auth-chip-chevron" aria-hidden strokeWidth={2.2} />
```

### Step 1c: Verify avatar structure

The avatar wrapper should remain:

```tsx
<span className="auth-chip-photo" aria-hidden>
  {avatarUrl ? (
    <img src={avatarUrl} alt="" />
  ) : (
    <span className="auth-chip-initial">{initial}</span>
  )}
</span>
```

No structural change — just CSS will add glow ring.

### Step 1d: Signed-out variant ("Влез") арrow

The signed-out chip ползва `<KeyholeIcon />` + arrow → cleanup за consistency. Replace the text arrow ("→") with lucide `ArrowRight`:

```tsx
import { ArrowRight, ChevronDown, History, LogOut, Trophy, User } from "lucide-react";

// ... in signed-out variant:
<Link href="/sign-in" className="auth-chip auth-chip-signin" prefetch={false}>
  <span className="auth-chip-mark" aria-hidden>
    <KeyholeIcon />
  </span>
  <span className="auth-chip-text">Влез</span>
  <ArrowRight className="auth-chip-arrow" aria-hidden strokeWidth={2.2} />
</Link>
```

---

## Stage 2 — Replace CSS (remove brass, add glass + glow)

**File:** `apps/web/app/globals.css`

Find existing `.auth-chip*` rules and **изтрий**:
- `.auth-chip` (current with brass-plate background)
- `.auth-chip-loading`
- `.auth-chip-signin` (including hover + arrow)
- `.auth-chip-avatar` (and `.auth-chip-trigger` subset)
- `.auth-chip-photo` (current)
- `.auth-chip-initial`
- `.auth-chip-name`
- `.auth-chip-chevron`
- All `[data-theme="light"] .auth-chip*` variants

**Replace целия block с:**

```css
/* ============================== */
/* Auth chip — modern brass-locket */
/* ============================== */

.auth-chip {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  height: 38px;
  padding: 0 14px 0 4px;
  background: rgba(17, 12, 10, 0.58);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(245, 232, 200, 0.16);
  border-radius: 999px;
  color: #f5e8c8;
  font-family: "Noto Serif", system-ui, serif;
  font-size: 0.92rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-decoration: none;
  cursor: pointer;
  transition:
    border-color 200ms ease,
    background 200ms ease,
    transform 200ms ease;
}

.auth-chip:hover {
  border-color: rgba(217, 154, 66, 0.45);
  background: rgba(17, 12, 10, 0.78);
  transform: translateY(-1px);
}

.auth-chip:focus-visible {
  outline: none;
  border-color: rgba(217, 154, 66, 0.7);
  box-shadow: 0 0 0 3px rgba(217, 154, 66, 0.22);
}

/* Loading skeleton */

.auth-chip-loading {
  width: 96px;
  height: 38px;
  border-radius: 999px;
  background: rgba(17, 12, 10, 0.42);
  border: 1px solid rgba(245, 232, 200, 0.08);
  animation: auth-chip-skeleton-pulse 1.4s ease-in-out infinite;
  padding: 0;
}

@keyframes auth-chip-skeleton-pulse {
  0%, 100% { opacity: 0.55; }
  50% { opacity: 0.85; }
}

/* Signed-out variant */

.auth-chip-signin {
  padding: 0 16px;
}

.auth-chip-mark {
  display: inline-grid;
  place-items: center;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: rgba(217, 154, 66, 0.18);
  border: 1px solid rgba(217, 154, 66, 0.45);
  color: #d19a42;
}

.auth-chip-mark svg {
  width: 14px;
  height: 14px;
}

.auth-chip-text {
  font-weight: 700;
  letter-spacing: 0.04em;
}

.auth-chip-arrow {
  width: 16px;
  height: 16px;
  color: #d19a42;
  transition: transform 200ms ease;
}

.auth-chip-signin:hover .auth-chip-arrow {
  transform: translateX(3px);
}

/* Signed-in variant — avatar + name + chevron */

.auth-chip-avatar {
  position: relative;
  padding: 0;
}

.auth-chip-trigger {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  height: 38px;
  padding: 0 14px 0 4px;
  background: rgba(17, 12, 10, 0.58);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(245, 232, 200, 0.16);
  border-radius: 999px;
  color: #f5e8c8;
  font-family: "Noto Serif", system-ui, serif;
  font-size: 0.92rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  cursor: pointer;
  transition:
    border-color 200ms ease,
    background 200ms ease,
    transform 200ms ease;
}

.auth-chip-trigger:hover {
  border-color: rgba(217, 154, 66, 0.45);
  background: rgba(17, 12, 10, 0.78);
  transform: translateY(-1px);
}

.auth-chip-trigger:focus-visible {
  outline: none;
  border-color: rgba(217, 154, 66, 0.7);
  box-shadow: 0 0 0 3px rgba(217, 154, 66, 0.22);
}

/* Avatar circle with amber glow halo */

.auth-chip-photo {
  position: relative;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  border: 2px solid rgba(217, 154, 66, 0.7);
  background: rgba(13, 10, 8, 0.85);
  display: grid;
  place-items: center;
  overflow: hidden;
  flex-shrink: 0;
  box-shadow:
    0 0 0 1px rgba(13, 10, 8, 0.6),
    0 0 14px rgba(217, 154, 66, 0.34);
  animation: auth-chip-halo-pulse 3.4s ease-in-out infinite;
  transition: box-shadow 280ms ease, border-color 200ms ease;
}

@keyframes auth-chip-halo-pulse {
  0%, 100% {
    box-shadow:
      0 0 0 1px rgba(13, 10, 8, 0.6),
      0 0 14px rgba(217, 154, 66, 0.28);
  }
  50% {
    box-shadow:
      0 0 0 1px rgba(13, 10, 8, 0.6),
      0 0 18px rgba(217, 154, 66, 0.45);
  }
}

.auth-chip-trigger:hover .auth-chip-photo {
  border-color: rgba(217, 154, 66, 0.95);
  box-shadow:
    0 0 0 1px rgba(13, 10, 8, 0.6),
    0 0 22px rgba(217, 154, 66, 0.58);
}

.auth-chip-photo img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.auth-chip-initial {
  font-family: "Noto Serif Display", "Noto Serif", serif;
  font-size: 1rem;
  font-weight: 900;
  color: #d19a42;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
  line-height: 1;
}

.auth-chip-name {
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #f5e8c8;
}

.auth-chip-chevron {
  width: 14px;
  height: 14px;
  color: rgba(217, 154, 66, 0.85);
  transition: transform 240ms cubic-bezier(0.2, 0.8, 0.2, 1);
  flex-shrink: 0;
}

.auth-chip-trigger[aria-expanded="true"] .auth-chip-chevron {
  transform: rotate(180deg);
}

/* Mobile: hide name on tight viewports */

@media (max-width: 768px) {
  .auth-chip-name {
    display: none;
  }
  .auth-chip-trigger {
    padding: 0 10px 0 4px;
    gap: 6px;
  }
}

@media (max-width: 480px) {
  .site-utility-cluster .auth-chip,
  .site-utility-cluster .auth-chip-avatar,
  .site-utility-cluster .site-utility-separator {
    display: none;
  }
}
```

---

## Stage 3 — Light theme variant

Append immediately after dark theme rules:

```css
/* Light theme — cream surface, darker amber ring */

[data-theme="light"] .auth-chip,
[data-theme="light"] .auth-chip-trigger {
  background: rgba(252, 246, 236, 0.78);
  border-color: rgba(132, 47, 43, 0.22);
  color: #2a1b10;
  text-shadow: none;
}

[data-theme="light"] .auth-chip:hover,
[data-theme="light"] .auth-chip-trigger:hover {
  background: rgba(252, 246, 236, 0.92);
  border-color: rgba(132, 47, 43, 0.42);
}

[data-theme="light"] .auth-chip:focus-visible,
[data-theme="light"] .auth-chip-trigger:focus-visible {
  border-color: rgba(132, 47, 43, 0.65);
  box-shadow: 0 0 0 3px rgba(132, 47, 43, 0.18);
}

[data-theme="light"] .auth-chip-loading {
  background: rgba(252, 246, 236, 0.5);
  border-color: rgba(83, 52, 31, 0.14);
}

[data-theme="light"] .auth-chip-mark {
  background: rgba(132, 47, 43, 0.14);
  border-color: rgba(132, 47, 43, 0.45);
  color: #842f2b;
}

[data-theme="light"] .auth-chip-arrow {
  color: #842f2b;
}

[data-theme="light"] .auth-chip-photo {
  border-color: rgba(132, 47, 43, 0.62);
  background: rgba(252, 246, 236, 0.95);
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.6),
    0 0 10px rgba(132, 47, 43, 0.22);
  animation: auth-chip-halo-pulse-light 3.4s ease-in-out infinite;
}

@keyframes auth-chip-halo-pulse-light {
  0%, 100% {
    box-shadow:
      0 0 0 1px rgba(255, 255, 255, 0.6),
      0 0 10px rgba(132, 47, 43, 0.2);
  }
  50% {
    box-shadow:
      0 0 0 1px rgba(255, 255, 255, 0.6),
      0 0 14px rgba(132, 47, 43, 0.34);
  }
}

[data-theme="light"] .auth-chip-trigger:hover .auth-chip-photo {
  border-color: rgba(132, 47, 43, 0.85);
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.6),
    0 0 18px rgba(132, 47, 43, 0.4);
}

[data-theme="light"] .auth-chip-initial {
  color: #842f2b;
  text-shadow: none;
}

[data-theme="light"] .auth-chip-name {
  color: #2a1b10;
}

[data-theme="light"] .auth-chip-chevron {
  color: rgba(132, 47, 43, 0.78);
}
```

---

## Stage 4 — Visual regression baselines

```bash
pnpm visual:update
pnpm visual
```

Affected baselines (since AuthChip is в navbar, visible на много pages):
- Homepage desktop + mobile (dark + light)
- Тестове за hover state — manual visual check (animations disabled in CI screenshots, halo halo seen at base state)

Verify regen baselines покажат:
- Dark: dark glass pill с amber glow ring around avatar, cream serif text, amber chevron
- Light: cream pill с darker amber ring, dark text, dark amber chevron
- No brass texture visible в either theme

---

## Acceptance criteria

1. **Brass-plate.webp texture премахната** напълно от auth chip — само solid glass + glow.
2. **Avatar glow halo** visible в base state, pulses subtly (3.4s loop).
3. **Hover state** интензифицира halo + leak amber border + lift 1px.
4. **Chevron** е lucide `ChevronDown` icon, rotates 180° при open.
5. **Signed-out variant** "Влез" ползва lucide `ArrowRight`, slide-right on hover.
6. **Light theme** работи: cream surface, darker amber ring, dark brown text.
7. **Focus-visible state** показва amber outline ring за keyboard navigation.
8. **Mobile** (<768px): name hides, само avatar + chevron visible.
9. **Very narrow** (<480px): chip изчезва от utility cluster (вече в drawer).
10. **БГ copy** непроменена, English commits.
11. **`pnpm verify` passes** (no new dependencies — lucide-react вече е там).
12. **Работено директно на `main`**.

---

## Не пипай

- Dropdown menu (separate component) — already обновен в predишен PR.
- AuthChip session logic (`useAuthSession`, `authClient.signOut`) — no change.
- Mobile drawer auth section — не зависи от styling promени.
- Other lucide icon usages — only adding `ChevronDown` + `ArrowRight`.
- Other utility chips (sound toggle, theme toggle) — отделен потенциален PR.

---

## Verification

```bash
pnpm install
pnpm typecheck
pnpm regression
pnpm test
pnpm build
pnpm visual:update
pnpm visual
pnpm perf:budget
```

Manual:

1. **Logged in, dark theme**: AuthChip showed в navbar top-right. Dark glass pill, avatar в amber ring с subtle pulsing glow halo. Name "Демо Играч" в serif. ChevronDown amber.
2. **Hover**: halo brightens (visible glow expand), pill lifts 1px, border becomes brighter amber.
3. **Click**: chevron rotates 180°, dropdown opens (separate styling from previous PR).
4. **Toggle to light theme**: pill становится cream parchment surface, ring става darker burgundy/amber. Halo pulses softer.
5. **Sign out → page redirects to /, signed-out chip**: "Влез" с keyhole icon + ArrowRight which slides right на hover.
6. **Loading state** (briefly visible при auth check): pulsing skeleton pill, no content.
7. **Mobile 768px**: name disappears, only avatar + chevron.
8. **Mobile 480px**: AuthChip изчезва от utility cluster (visible в drawer footer).
9. **Keyboard nav (Tab)**: AuthChip получава focus → visible amber outline ring + halo brighter.

---

## Commit strategy (3 atomic English commits, on `main`)

1. `style(auth-chip): replace brass texture with glass surface and amber glow halo`
2. `feat(auth-chip): swap chevron and arrow emojis for lucide icons with rotation`
3. `chore(visual): regenerate navbar baselines for auth chip polish`

Workflow:
```bash
git status
git pull origin main --rebase

# Stage 1 — CSS rewrite + JSX icon swap
# Edit globals.css (replace .auth-chip* rules), AuthChip.tsx (lucide imports + JSX)
git add apps/web/app/globals.css apps/web/components/site-chrome/AuthChip.tsx
git commit -m "style(auth-chip): replace brass texture with glass surface and amber glow halo"
pnpm regression && pnpm typecheck && pnpm build

# Stage 2 — already part of Stage 1, but if you want to split for review:
# (Skip if already done together)

# Stage 3 — visual baselines
pnpm visual:update
git add apps/web/__visual__/__baseline__/
git commit -m "chore(visual): regenerate navbar baselines for auth chip polish"
pnpm visual
```

If preferring 2 commits instead of 3, merge stages 1+2 (CSS + JSX в един commit) + visual baselines в отделен.

---

(End of prompt)
