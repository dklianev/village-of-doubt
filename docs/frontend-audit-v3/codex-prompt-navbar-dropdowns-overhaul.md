# Codex prompt — Navbar dropdowns overhaul (unified modern design + lucide-react intro)

Цялостен redesign на двата navbar dropdown-а (user menu + dots overflow menu) към **unified modern dark glass surface** с inline icons, grouped sections, amber accent, slide-in animation, и light theme variant. Въвежда **lucide-react** като нова dependency за utility UI icons (стандартна industry practice). Тематичните brand SVG-та (achievements, FAQ categories, service tiles, promise badges) **остават custom** — те носят characterа на site-а.

**Работа директно на `main`.** ~7 atomic English commits. ~30 минути Codex.

---

## Pre-analysis

### Current state

**User dropdown** (in `AuthChip.tsx`):
- Cream parchment surface
- Serif text, 4 items (Моят профил / История / Постижения / Изход)
- Hairline separator преди Изход
- "Изход" с червен accent (destructive marker)

**Dots overflow dropdown** (in `site-chrome.tsx`):
- Same cream parchment surface
- Serif text, 7 items (История / Постижения / Класация / Приятели / Първа игра / Въпроси / Състояние)
- No separators, no grouping
- Flat list

### Issues

| # | Issue | Severity |
|---|---|---|
| 1 | Cream parchment surface не пасва с обновените pages (dark cinematic + amber accents) | 🟠 |
| 2 | Никакви icons — items са plain text | 🟠 |
| 3 | Dots dropdown e flat 7-item list — no logical grouping | 🟡 |
| 4 | Inconsistent separators (само user dropdown ги има) | 🟡 |
| 5 | Hover state е basic — no amber accent, no left border line | 🟡 |
| 6 | Без entry animation — instant pop | 🟡 |
| 7 | Light theme не работи на dropdown-ите (нямат overrides) | 🟢 |

### Decision: lucide-react за utility icons

Site-ът има 2 categories икони:
- **Branded thematic** (achievement plaques, FAQ category drawers, service tile glyphs) → **STAY custom** — те носят characterа
- **Utility UI chrome** (nav items, theme toggle, sound toggle, dropdown items) → **MIGRATE to lucide-react** — standard, tree-shakable, consistent

Този PR ВЪВЕЖДА lucide-react с **минимален initial usage** (dropdown items only). Future PRs могат migrate-ват и останалите utility icons (menu/close/theme/sound buttons в site-chrome).

---

## Pre-decisions (locked)

| Decision | Choice |
|---|---|
| Add new dependency `lucide-react` | YES — standard practice |
| Use lucide for thematic brand icons | NO — keep custom (achievement plaques, FAQ categories, etc.) |
| Use lucide for dropdown items | YES — utility nav |
| Migrate other utility icons (menu/theme/sound) в този PR | NO — defer to follow-up PR за focused scope |
| Dropdown surface color | Dark glass `rgba(17, 12, 10, 0.92)` + `backdrop-filter: blur(10px)` |
| Light theme | YES — cream parchment surface |
| Section grouping в dots dropdown | YES — 3 groups: Игра / Социал / Помощ |
| Entry animation | YES — slide down + fade (220ms) |
| Painterly radial halo behind dropdown | NO — too heavy for nav element, keep clean |
| Branch | Directly on `main` |

---

## Stage 1 — Add lucide-react dependency

**File:** `apps/web/package.json`

Use the **latest stable major** (`^1.16.0` или по-нов; verify с `npm view lucide-react version` ако е minor bump-ed):

```bash
pnpm add lucide-react@latest --filter web
```

Verify installed version:
```bash
pnpm why lucide-react
node -p "require('lucide-react/package.json').version"
```

Expected `1.16.0` or newer. Lucide-react v1.x supports React 19 native (peerDep `"^16.5.1 || ^17.0.0 || ^18.0.0 || ^19.0.0"`) — no compat shim needed.

**Lock file:** verify `pnpm-lock.yaml` updated. Commit lock file with the dependency.

**Note:** lucide-react е tree-shakable — само used icons влизат в bundle. Initial usage в този PR ≈ 8 icons, ~40-50KB gzip.

**Migration note (v0 → v1):** Lucide-react v1 changed defaults slightly. Codex check release notes ако някой icon има broken import. Most named exports remain identical to v0 (User, History, Trophy, LogOut, Clock, Users, Sparkles, HelpCircle, Activity, ListOrdered).

---

## Stage 2 — Shared dropdown design tokens

**File:** `apps/web/app/globals.css`

Add нов section за shared dropdown CSS variables (before any dropdown-specific rules):

```css
/* ============================== */
/* Navbar dropdowns — shared      */
/* ============================== */

.nav-dropdown {
  --dropdown-bg: rgba(17, 12, 10, 0.92);
  --dropdown-surface-hover: rgba(245, 232, 200, 0.06);
  --dropdown-border: rgba(245, 232, 200, 0.14);
  --dropdown-border-strong: rgba(245, 232, 200, 0.22);
  --dropdown-text: #f5e8c8;
  --dropdown-text-muted: rgba(245, 232, 200, 0.72);
  --dropdown-text-soft: rgba(245, 232, 200, 0.5);
  --dropdown-accent: #d19a42;
  --dropdown-accent-soft: rgba(209, 154, 66, 0.18);
  --dropdown-danger: #d94a3d;
  --dropdown-danger-soft: rgba(217, 74, 61, 0.16);

  position: absolute;
  min-width: 220px;
  max-width: 280px;
  padding: 8px;
  background: var(--dropdown-bg);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid var(--dropdown-border);
  border-radius: 14px;
  box-shadow:
    0 24px 48px rgba(0, 0, 0, 0.55),
    0 4px 8px rgba(0, 0, 0, 0.35),
    inset 0 1px 0 rgba(245, 232, 200, 0.06);
  z-index: 60;
  animation: nav-dropdown-in 220ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

@keyframes nav-dropdown-in {
  from {
    opacity: 0;
    transform: translateY(-6px) scale(0.97);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

[data-theme="light"] .nav-dropdown {
  --dropdown-bg: rgba(252, 246, 236, 0.96);
  --dropdown-surface-hover: rgba(132, 47, 43, 0.08);
  --dropdown-border: rgba(83, 52, 31, 0.16);
  --dropdown-border-strong: rgba(83, 52, 31, 0.28);
  --dropdown-text: #2a1b10;
  --dropdown-text-muted: rgba(42, 27, 16, 0.74);
  --dropdown-text-soft: rgba(42, 27, 16, 0.5);
  --dropdown-accent: #842f2b;
  --dropdown-accent-soft: rgba(132, 47, 43, 0.12);
  --dropdown-danger: #a02a22;
  --dropdown-danger-soft: rgba(160, 42, 34, 0.12);
}

/* Dropdown items */

.nav-dropdown-item {
  display: grid;
  grid-template-columns: 20px 1fr;
  gap: 12px;
  align-items: center;
  width: 100%;
  padding: 10px 12px;
  background: transparent;
  border: none;
  border-left: 2px solid transparent;
  border-radius: 8px;
  color: var(--dropdown-text);
  font-family: "Noto Sans", system-ui, -apple-system, "Segoe UI", sans-serif;
  font-size: 0.92rem;
  font-weight: 600;
  text-align: left;
  text-decoration: none;
  cursor: pointer;
  transition: background 120ms ease, color 120ms ease, border-color 120ms ease;
}

.nav-dropdown-item:hover {
  background: var(--dropdown-surface-hover);
  color: var(--dropdown-accent);
  border-left-color: var(--dropdown-accent);
}

.nav-dropdown-item:focus-visible {
  outline: none;
  background: var(--dropdown-surface-hover);
  color: var(--dropdown-accent);
}

.nav-dropdown-item-icon {
  width: 18px;
  height: 18px;
  color: var(--dropdown-text-muted);
  transition: color 120ms ease;
}

.nav-dropdown-item:hover .nav-dropdown-item-icon {
  color: var(--dropdown-accent);
}

/* Destructive variant — for Logout */

.nav-dropdown-item-danger {
  color: var(--dropdown-danger);
}

.nav-dropdown-item-danger:hover {
  background: var(--dropdown-danger-soft);
  color: var(--dropdown-danger);
  border-left-color: var(--dropdown-danger);
}

.nav-dropdown-item-danger:hover .nav-dropdown-item-icon {
  color: var(--dropdown-danger);
}

/* Section group */

.nav-dropdown-group {
  display: grid;
  gap: 2px;
}

.nav-dropdown-group + .nav-dropdown-group {
  margin-top: 6px;
  padding-top: 8px;
  border-top: 1px solid var(--dropdown-border);
}

.nav-dropdown-group-label {
  padding: 6px 12px 4px;
  font-size: 0.66rem;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  font-weight: 700;
  color: var(--dropdown-text-soft);
}

/* Separator before destructive items */

.nav-dropdown-divider {
  height: 1px;
  margin: 6px 8px;
  background: var(--dropdown-border);
}
```

---

## Stage 3 — Refactor `AuthChip` user dropdown

**File:** `apps/web/components/site-chrome/AuthChip.tsx` (or wherever the user dropdown lives — search for "Моят профил" string to find).

### Step 3a: Import lucide icons

```tsx
import { User, History, Trophy, LogOut } from "lucide-react";
```

### Step 3b: Replace dropdown JSX

Find existing dropdown:

```tsx
{open ? (
  <div className="auth-chip-dropdown paper-card" role="menu">
    <Link href="/account" role="menuitem" prefetch={false} onClick={() => setOpen(false)}>
      Моят профил
    </Link>
    <Link href="/history" role="menuitem" prefetch={false} onClick={() => setOpen(false)}>
      История
    </Link>
    <Link href="/achievements" role="menuitem" prefetch={false} onClick={() => setOpen(false)}>
      Постижения
    </Link>
    <div className="auth-chip-divider" role="separator" />
    <button
      type="button"
      role="menuitem"
      className="auth-chip-signout"
      onClick={async () => { /* logout */ }}
    >
      Изход
    </button>
  </div>
) : null}
```

**Replace с:**

```tsx
{open ? (
  <div className="nav-dropdown nav-dropdown-user" role="menu">
    <Link
      href="/account"
      role="menuitem"
      prefetch={false}
      onClick={() => setOpen(false)}
      className="nav-dropdown-item"
    >
      <User className="nav-dropdown-item-icon" aria-hidden strokeWidth={1.8} />
      <span>Моят профил</span>
    </Link>
    <Link
      href="/history"
      role="menuitem"
      prefetch={false}
      onClick={() => setOpen(false)}
      className="nav-dropdown-item"
    >
      <History className="nav-dropdown-item-icon" aria-hidden strokeWidth={1.8} />
      <span>История</span>
    </Link>
    <Link
      href="/achievements"
      role="menuitem"
      prefetch={false}
      onClick={() => setOpen(false)}
      className="nav-dropdown-item"
    >
      <Trophy className="nav-dropdown-item-icon" aria-hidden strokeWidth={1.8} />
      <span>Постижения</span>
    </Link>

    <div className="nav-dropdown-divider" role="separator" />

    <button
      type="button"
      role="menuitem"
      className="nav-dropdown-item nav-dropdown-item-danger"
      onClick={async () => {
        setOpen(false);
        await authClient.signOut();
        router.push("/");
        router.refresh();
      }}
    >
      <LogOut className="nav-dropdown-item-icon" aria-hidden strokeWidth={1.8} />
      <span>Изход</span>
    </button>
  </div>
) : null}
```

### Step 3c: Position the dropdown

`.nav-dropdown-user` нуждае position adjustment, тъй като се рендерира относително към AuthChip:

```css
.nav-dropdown-user {
  right: 0;
  top: calc(100% + 8px);
  min-width: 220px;
}
```

Add to globals.css under shared dropdown rules.

### Step 3d: Remove old CSS

Изтрий старите `.auth-chip-dropdown`, `.auth-chip-divider`, `.auth-chip-signout` правила (они вече не се ползват).

---

## Stage 4 — Refactor dots overflow dropdown with grouped sections

**File:** `apps/web/components/site-chrome.tsx`

### Step 4a: Import lucide icons + define grouped structure

```tsx
import {
  Clock,
  Trophy,
  ListOrdered,
  Users,
  Sparkles,
  HelpCircle,
  Activity,
} from "lucide-react";

interface SecondaryLink {
  href: string;
  label: string;
  icon: LucideIcon;
  group: "game" | "social" | "help";
}

const SECONDARY_LINKS: ReadonlyArray<SecondaryLink> = [
  // Game
  { href: "/history", label: "История", icon: Clock, group: "game" },
  { href: "/achievements", label: "Постижения", icon: Trophy, group: "game" },
  { href: "/leaderboard", label: "Класация", icon: ListOrdered, group: "game" },

  // Social
  { href: "/friends", label: "Приятели", icon: Users, group: "social" },

  // Help
  { href: "/tutorial", label: "Първа игра", icon: Sparkles, group: "help" },
  { href: "/faq", label: "Въпроси", icon: HelpCircle, group: "help" },
  { href: "/status", label: "Състояние", icon: Activity, group: "help" },
];

const GROUP_LABELS = {
  game: "Игра",
  social: "Социал",
  help: "Помощ",
} as const;

const GROUP_ORDER = ["game", "social", "help"] as const;
```

(`LucideIcon` тип идва от `import type { LucideIcon } from "lucide-react"`.)

### Step 4b: Replace dropdown render JSX

Find existing dropdown render в site-chrome:

```tsx
{dropdownOpen ? (
  <div className="site-dropdown paper-card" role="menu">
    {SECONDARY_LINKS.map((item) => (
      <Link key={item.href} href={item.href} role="menuitem" prefetch={false}>
        {item.label}
      </Link>
    ))}
  </div>
) : null}
```

**Replace с:**

```tsx
{dropdownOpen ? (
  <div className="nav-dropdown nav-dropdown-overflow" role="menu">
    {GROUP_ORDER.map((groupKey) => {
      const groupLinks = SECONDARY_LINKS.filter((item) => item.group === groupKey);
      if (groupLinks.length === 0) return null;
      return (
        <div key={groupKey} className="nav-dropdown-group">
          <p className="nav-dropdown-group-label">{GROUP_LABELS[groupKey]}</p>
          {groupLinks.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                role="menuitem"
                prefetch={false}
                onClick={() => setDropdownOpen(false)}
                className="nav-dropdown-item"
              >
                <Icon className="nav-dropdown-item-icon" aria-hidden strokeWidth={1.8} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      );
    })}
  </div>
) : null}
```

### Step 4c: Position overflow dropdown

Add to globals.css:

```css
.nav-dropdown-overflow {
  right: 0;
  top: calc(100% + 8px);
  min-width: 240px;
}
```

### Step 4d: Remove old `.site-dropdown` styling

Find and delete `.site-dropdown` rule в globals.css (specific to old paper-card overflow dropdown). Class no longer used.

---

## Stage 5 — Mobile drawer (DRAWER_LINKS) alignment

DRAWER_LINKS в site-chrome.tsx spread-ва SECONDARY_LINKS:

```tsx
const DRAWER_LINKS = [
  { href: "/", label: "Начало" },
  { href: "/werewolf", label: "Върколак" },
  { href: "/mafia", label: "Мафия" },
  ...SECONDARY_LINKS,  // ← These now have .group + .icon fields
];
```

Адаптирай mobile drawer rendering да also display icons. Намери `MobileDrawer` компонент в site-chrome.tsx, и update items rendering:

```tsx
{drawerLinks.map((item) => {
  const Icon = "icon" in item ? item.icon : null;
  const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
  return (
    <Link
      key={`${item.href}:${item.label}`}
      className={active ? "is-active" : ""}
      href={item.href}
      prefetch={false}
      onClick={onClose}
    >
      {Icon ? <Icon aria-hidden strokeWidth={1.8} className="site-drawer-icon" /> : null}
      <span>{item.label}</span>
    </Link>
  );
})}
```

Add small drawer icon CSS:

```css
.site-drawer-nav a {
  display: flex;
  align-items: center;
  gap: 12px;
}

.site-drawer-icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  color: rgba(232, 217, 187, 0.7);
}

.site-drawer-nav a.is-active .site-drawer-icon {
  color: #d19a42;
}
```

For "Начало / Върколак / Мафия" entries (no `icon` field), Codex може to добави разумни lucide icons (`Home`, e.g. `Moon` за Върколак, `Skull` за Мафия) ИЛИ да skip icons за тях. Препоръчвам **skip** — те имат visible family chips above (`FamilyLink`s), drawer icons would be redundant.

Само SECONDARY_LINKS получават icons в drawer.

---

## Stage 6 — Visual regression baselines

```bash
pnpm visual:update
pnpm visual
```

Affected baselines:
- Homepage (navbar with dropdowns closed — should look identical)
- Site-chrome interactive states (dropdown open) — these are interactive and may not be in baseline coverage; manual visual check enough.

If visual coverage tests dropdowns, regenerate. If not, no baseline regen needed.

---

## Acceptance criteria

1. **`lucide-react`** добавен като production dependency.
2. **User dropdown** има 4 items с lucide icons (User / History / Trophy / LogOut), divider преди "Изход", red destructive styling.
3. **Dots dropdown** има 3 grouped sections (Игра / Социал / Помощ) с lucide icons per item, divider лек между groups.
4. **Both dropdowns** ползват shared `nav-dropdown` CSS system — dark glass surface, amber accent on hover, left border line indicator.
5. **Light theme variant** работи за двата dropdown-а (cream parchment surface, dark text, hairline brown border).
6. **Slide-in animation** (220ms cubic-bezier) при отваряне.
7. **Mobile drawer** също показва lucide icons за secondary links (History/Achievements/Leaderboard/Friends/Tutorial/FAQ/Status). Family entries (Home/Werewolf/Mafia) без icons за visual differentiation.
8. **Old CSS classes** `.auth-chip-dropdown`, `.auth-chip-divider`, `.auth-chip-signout`, `.site-dropdown` са removed.
9. **БГ copy непроменена**, English commits.
10. **`pnpm verify` passes**, including bundle size (lucide tree-shakes — initial usage ≈ 8 icons).
11. **Работено директно на `main`**.

---

## Не пипай

- **Thematic brand SVG-та** — achievement icons, FAQ category icons, service tile icons (на /status), promise badges (на /privacy), tutorial DayClueChips, AchievementProgressWreath, FeedbackIcon — всички остават custom.
- **Other utility icons** в site-chrome (menu/close/dots, sound, theme toggle, play arrow) — defer to **future PR**. Този PR introduces lucide; future PR migrates ги.
- Game-server, schemas, Better Auth.
- Frame styling, painterly bg на utility pages — отделни PRs.
- Cookie banner, feedback widget — отделни components.

---

## Verification

```bash
pnpm install               # picks up lucide-react
pnpm typecheck
pnpm regression
pnpm test
pnpm build                 # verify tree-shaking working (no full bundle import)
pnpm smoke
pnpm visual                # if dropdowns covered
pnpm perf:budget           # ensure bundle stays within budget
```

Manual:
1. Logged in → click avatar в navbar → dropdown slide-down with 4 items + icons. Hover → amber color + left border line. Click "Изход" → logs out.
2. Click "..." overflow → dropdown с 3 sections (Игра / Социал / Помощ) + icons. Subtle separators между groups. Hover items → amber accent.
3. Theme toggle → both dropdowns switch към cream parchment surface, dark text, brown accent border.
4. Mobile (390×844) → hamburger → drawer открива се. Secondary links имат icons. Active state shows amber.
5. Bundle check: `pnpm build && du -sh apps/web/.next/static/chunks` — увеличението от lucide трябва да е < 50KB gzipped.

---

## Commit strategy (7 atomic English commits, on `main`)

1. `chore(deps): add lucide-react for utility UI icons`
2. `feat(nav-dropdown): unified dark glass surface for navbar dropdowns`
3. `feat(nav-dropdown): user menu with lucide icons and destructive logout style`
4. `feat(nav-dropdown): grouped sections in overflow menu (Игра Социал Помощ)`
5. `feat(site-chrome): lucide icons in mobile drawer secondary links`
6. `style(nav-dropdown): light theme variant with parchment surface`
7. `chore(css): remove obsolete auth-chip-dropdown and site-dropdown rules`

Workflow:
```bash
git status
git pull origin main --rebase

# Per commit:
# Edit files, validate, commit
git add <files>
git commit -m "English message"
pnpm regression && pnpm typecheck && pnpm build
```

---

## Follow-up potential (NOT in this PR)

Future PR: migrate other utility icons в site-chrome from custom SVG to lucide-react:
- Menu icon → `Menu`
- Close icon → `X`
- Dots icon → `MoreHorizontal`
- Play arrow → `Play`
- Speaker on/off → `Volume2` / `VolumeX`
- Theme sun/moon → `Sun` / `Moon`

Same dependency, more usage, ~10KB extra. Keep this current PR focused on dropdowns.

---

(End of prompt)
