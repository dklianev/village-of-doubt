# Codex prompt — Footer slim-down + Feedback FAB visibility scope

Малък focused fix след ChatGPT review на homepage footer:
1. Премахни **дублиращ brand tagline** от footer (вече в navbar)
2. Премахни **дублиращ "Въпроси" link** (вече в navbar SECONDARY_LINKS)
3. **Tighten footer margin-top** от 48px → 24px
4. **Скрий feedback FAB на marketing/info routes** (показвай само на product routes)

~4 atomic English commits, един малък PR.

---

## Pre-analysis (findings from ChatGPT review)

### Issue 1 — Duplicate brand tagline в footer

**File:** `apps/web/components/SiteFooter.tsx:17`

```tsx
<p className="site-footer-credit">Върколак и Мафия · социална игра на сенки</p>
```

Същият tagline вече се показва в navbar (`apps/web/components/site-chrome.tsx`):
- `<span className="site-brand-wordmark">Върколак · Мафия</span>`
- `<span className="site-brand-subtitle">Социална игра на сенки</span>`

Footer-ът дублира информация без да добавя стойност — само заема вертикално място. Премахваме.

### Issue 2 — Duplicate FAQ link

**File:** `apps/web/components/SiteFooter.tsx:13-14`

```tsx
<Link href="/faq">Въпроси</Link>
<span aria-hidden>·</span>
```

FAQ link-ът вече е в navbar SECONDARY_LINKS (от `apps/web/components/site-chrome.tsx`). Footer-ът го повтаря. Запазваме само legal + operational links: Поверителност, Условия, Сигнал, Състояние.

### Issue 3 — Footer "floats" too far from content

**File:** `apps/web/app/globals.css:12296`

```css
.site-footer {
  margin-top: 48px;
}
```

Скрийншот на homepage показва ~70-80% от viewport-а под последната content секция е празно тъмно поле, после footer-ът. 48px margin-top увеличава separation. Tighter 24px ще "придърпа" footer-а към последната content секция.

### Issue 4 — Feedback FAB shown on marketing pages

**File:** `apps/web/components/feedback/FeedbackWidget.tsx`

В момента FAB-ът е mounted в `layout.tsx` и се показва на **всяка** страница. Това включва marketing/info pages (homepage, family pages, sign-in, legal pages) където посетителите не са в product context. Feedback widgets са по-уместни на product pages където users активно работят с приложението.

Hide FAB on:
- `/` (homepage)
- `/werewolf` (family marketing page)
- `/mafia` (family marketing page)
- `/werewolf/rules`, `/mafia/rules` (rules pages)
- `/werewolf/roles`, `/mafia/roles`, `/roles` (role listings)
- `/sign-in`, `/forgot-password`, `/reset-password`, `/verify-email` (auth flow)
- `/privacy`, `/terms`, `/faq`, `/status` (legal/info)

Show FAB on:
- `/account` (settings + delete)
- `/play/[code]` (in-game)
- `/lobby/[code]` (room invite)
- `/werewolf/create`, `/mafia/create` (wizards)
- `/werewolf/join/[code]`, `/mafia/join/[code]` (join flow with code)
- `/history`, `/leaderboard`, `/achievements`, `/friends` (user product pages)
- `/tutorial` (active tutorial use)

---

## Prompt (paste below)

You are working in the **werewolf_mafia** monorepo. Read `AGENTS.md` first.

Invariants:
- All commit messages in **English** (project convention).
- All user-facing copy in **Bulgarian** Cyrillic.
- No new npm dependencies.
- Branch: `feat/footer-and-fab-polish`.

This PR addresses 4 small UX findings from ChatGPT review of homepage rendering. See "Pre-analysis" section above for full evidence.

---

## Stage 1 — Slim down `SiteFooter` component

**File:** `apps/web/components/SiteFooter.tsx`

Replace the entire component:

```tsx
import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-links">
        <Link href="/privacy">Поверителност</Link>
        <span aria-hidden>·</span>
        <Link href="/terms">Условия</Link>
        <span aria-hidden>·</span>
        <Link href="/report">Сигнал</Link>
        <span aria-hidden>·</span>
        <Link href="/status">Състояние</Link>
      </div>
    </footer>
  );
}
```

Changes:
- Removed `<Link href="/faq">Въпроси</Link>` + adjacent separator (Issue 2).
- Removed `<p className="site-footer-credit">Върколак и Мафия · социална игра на сенки</p>` (Issue 1).

**Acceptance:** Footer renders only 4 links (Поверителност, Условия, Сигнал, Състояние). No brand tagline below.

---

## Stage 2 — Tighten footer margin and clean orphan CSS

**File:** `apps/web/app/globals.css:12294-12326`

Update the `.site-footer` rule:

```css
.site-footer {
  padding: 24px 16px;
  margin-top: 24px;  /* was 48px — Issue 3 */
  border-top: 1px solid rgba(255, 240, 200, 0.08);
  color: rgba(232, 217, 187, 0.55);
  font-size: 0.8rem;
  text-align: center;
}
```

Remove the now-orphan `.site-footer-credit` rule (lines 12324-12326):

```css
/* DELETE THIS BLOCK:
.site-footer-credit {
  margin-top: 8px;
}
*/
```

**Acceptance:** Footer sits 24px below last content section. No CSS warnings for unused `.site-footer-credit` class.

---

## Stage 3 — Add pathname-based visibility to `FeedbackWidget`

**File:** `apps/web/components/feedback/FeedbackWidget.tsx`

At the top of the component (right after `usePathname()`), add visibility logic:

```tsx
"use client";

import { type FormEvent, useState } from "react";
import { usePathname } from "next/navigation";

// Routes where FeedbackWidget is hidden — marketing/info/auth pages where
// visitors aren't in product context. Show only on product/in-game routes.
const HIDDEN_ROUTES = [
  "/",
  "/werewolf",
  "/mafia",
  "/werewolf/rules",
  "/mafia/rules",
  "/werewolf/roles",
  "/mafia/roles",
  "/roles",
  "/sign-in",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/privacy",
  "/terms",
  "/faq",
  "/status",
] as const;

function shouldHideFeedback(pathname: string): boolean {
  // Exact match (homepage `/` или fixed paths)
  if (HIDDEN_ROUTES.some((route) => route === pathname)) {
    return true;
  }
  // Family marketing roots only (not /werewolf/create, /werewolf/join/CODE etc.)
  // Already covered by exact match above; this leaves /werewolf/* and /mafia/*
  // children visible (e.g., /werewolf/create still shows feedback).
  return false;
}

export function FeedbackWidget() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  // Hide on marketing / info / auth-flow routes.
  if (shouldHideFeedback(pathname)) {
    return null;
  }

  // ... rest of component unchanged
}
```

**Important detail about matching:** The check uses **exact path match**, not prefix match. This is intentional:
- `/werewolf` (family marketing page) — HIDDEN ✓
- `/werewolf/create` (wizard, user actively building room) — SHOWN ✓
- `/werewolf/join/ABC123` (joining specific room) — SHOWN ✓
- `/werewolf/rules` (info page) — HIDDEN ✓
- `/werewolf/roles` (info page) — HIDDEN ✓

So `/werewolf/rules` and `/werewolf/roles` are added explicitly to `HIDDEN_ROUTES`. `/werewolf/create` and `/werewolf/join/*` remain visible because they're not in the list (exact match misses them).

**Acceptance:**
- Open `/` → no FAB visible bottom-right.
- Open `/werewolf` → no FAB.
- Open `/werewolf/rules` → no FAB.
- Open `/werewolf/create` → FAB visible bottom-right.
- Open `/tutorial` → FAB visible.
- Open `/account` (when logged in) → FAB visible.
- Open `/sign-in` → no FAB.
- Open `/faq` → no FAB.

---

## Stage 4 — Update visual regression baselines

The footer change affects homepage (and any other long page where footer is visible). The FAB change affects multiple routes. Run:

```bash
pnpm visual:update
```

This regenerates baselines for affected routes. Review the diff:
- Homepage: footer tighter, no tagline line, no Въпроси link.
- Family pages: same footer change visible.
- Privacy / Terms / FAQ / Status: footer updated; FAB removed.
- `/tutorial`, `/account`, `/play/[code]`, etc.: unchanged footer (legal links visible), FAB still present.

Commit the updated baselines.

---

## Acceptance criteria

1. **Footer component** renders only 4 links: Поверителност · Условия · Сигнал · Състояние. No brand tagline. No "Въпроси" link.
2. **CSS**: `.site-footer.margin-top` is `24px`. `.site-footer-credit` class deleted.
3. **FeedbackWidget**: returns `null` on `/`, `/werewolf`, `/mafia`, `/werewolf/rules`, `/mafia/rules`, `/werewolf/roles`, `/mafia/roles`, `/roles`, `/sign-in`, `/forgot-password`, `/reset-password`, `/verify-email`, `/privacy`, `/terms`, `/faq`, `/status`. Renders normally on all other routes.
4. **Visual regression baselines** updated for affected routes.
5. **`pnpm test`** passes (component tests for FeedbackWidget should be updated if any assert on its rendering).
6. **`pnpm typecheck`** passes.
7. **`pnpm build`** passes.
8. **`pnpm regression`** passes.
9. **All commit messages in English**.

---

## Не пипай

- Navbar (`site-chrome.tsx`) — tagline + FAQ link там остават.
- Other layout files unless directly related to footer/FAB.
- `apps/web/app/layout.tsx` — `<SiteFooter />` и `<FeedbackWidget />` mounts остават.
- FeedbackWidget's actual submit logic — only add visibility gate.
- API routes — no changes.

---

## Verification

```bash
pnpm install
pnpm typecheck
pnpm regression
pnpm test
pnpm build
pnpm smoke
pnpm visual:update    # regen baselines
pnpm visual           # verify pass
pnpm perf:budget
```

Manual checks (start dev server, open routes):
- `/` → no FAB, footer compact (4 links, no tagline).
- `/werewolf` → no FAB, same footer.
- `/werewolf/rules` → no FAB.
- `/werewolf/create` → FAB visible.
- `/tutorial` → FAB visible.
- `/account` (logged in) → FAB visible.
- Existing functionality of FAB unchanged on product routes (click, type, submit).

---

## Commit strategy (4 atomic English commits)

Branch: `feat/footer-and-fab-polish`

1. `style(footer): remove duplicate brand tagline and FAQ link`
2. `style(footer): tighten margin-top from 48 to 24 pixels`
3. `feat(feedback): hide widget on marketing and info routes`
4. `chore(visual): update baselines for footer slim-down and FAB visibility`

PR title: `style: footer slim-down and feedback widget visibility scope`

PR body should:
- Link to before/after homepage screenshot showing the tighter footer.
- Note: navbar already shows brand tagline and FAQ link, so footer doesn't lose information.
- Note: feedback widget remains fully functional on product routes (account, in-game, history, etc.).

---

(End of prompt)
