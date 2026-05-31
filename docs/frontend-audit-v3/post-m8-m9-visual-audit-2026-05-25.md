# Post-M8/M9 Visual Audit — 2026-05-25

**Method**: Playwright MCP, Chromium, viewport 1280×800 (desktop) + 375×812 (mobile). Dev server on `localhost:3000`. 16 pages screenshot-ed across both viewports.

**State**: PR M8 (hero presence boost) + PR M9 (light theme + shadow-safe polish) landed. Anti-pattern guard active. Motion file count = 3.

## 🟢 Кои промени работят отлично

| Страница | Какво се вижда добре |
|---|---|
| `/` landing | Mode-choice cards (Върколак / Мафия) са с премиум-feel бутони, shimmer работи, dark hero е cinematic |
| `/werewolf` | Hero бавно мистична българска ферма — light theme прави pages-а топъл и фолклорен |
| `/mafia` | Hero rainy noir street — точно правилният тон |
| `/account` | Dignified dossier — avatar gold ring + cinematic hero банер |
| `/history` | Cinematic archive — dark hero работи; case files в `SceneCard.interactive` |
| `/privacy`, `/terms`, `/report`, `/faq`, `/status` | Hero presence reаlly boosted, banners са видими, не са squashed |
| `/leaderboard` | "ВЕЧЕРЕН БРОЙ НА МАСАТА" newspaper masthead identity силен |
| `/achievements` | "Малките легенди" — копи migration работи в title, hero е тематичен |
| `/friends` | Social-table hero със silhouette — добро identity |
| `/sign-in` | Hero "Покажи се на масата" — invitation feeling |
| `/create` | Tavern background visible, faction accents работят |
| `/tutorial` | "Наръчник в шест сцени" + slide progression — четим и интерактивен |
| Mobile `/werewolf` | Misty banner adapts beautifully, CTAs touch-friendly |
| Mobile `/` | Mode cards stack правилно, hero преходи плавно |
| Footer | "Помощ" link towards /faq добавен ✓ |

## 🔴 Реални frontend проблеми

### Severity 1 — Functional bugs

#### 1.1 **Metadata title duplication** на 4+ страници

**Симптом**: tab titles показват `"Твоето досие | Върколак и Мафия | Върколак и Мафия"` (дублиран suffix).

**Засегнати страници**:
- `/account` → "Твоето досие | Върколак и Мафия | Върколак и Мафия"
- `/friends` → "Познати на масата | Върколак и Мафия | Върколак и Мафия"
- `/create` → "Създай игра | Върколак и Мафия | Върколак и Мафия"

**Root cause**: `apps/web/app/layout.tsx:30` дефинира `title.template: "%s | ${SITE_NAME}"`. Per-page титри (`apps/web/app/account/page.tsx:18`, `friends/page.tsx:8`, `create/page.tsx:7`) **вече** включват `| Върколак и Мафия` ръчно — template ги дублира.

**Fix**: премахни `| Върколак и Мафия` от per-page титри. Tемплейтът ще го добави автоматично:

```diff
- title: "Твоето досие | Върколак и Мафия",
+ title: "Твоето досие",
```

Списък с per-page титри засегнати (от `grep "title:.*Върколак и Мафия"`):
- `apps/web/app/account/page.tsx:18`
- `apps/web/app/create/page.tsx:7`
- `apps/web/app/faq/page.tsx:10`
- `apps/web/app/forgot-password/page.tsx:7`
- `apps/web/app/friends/page.tsx:8`
- `apps/web/app/history/[gameId]/replay/page.tsx:20`
- `apps/web/app/lobby/page.tsx:6`
- `apps/web/app/mafia/create/page.tsx:6`
- `apps/web/app/mafia/join/[[...roomCode]]/page.tsx:6`
- `apps/web/app/not-found.tsx:6`

Всичките трябва да загубят `| Върколак и Мафия` suffix.

**SEO impact**: search engines виждат duplicated brand name → wrong cardinality за branded search.

#### 1.2 **Hydration mismatch warning на `/sign-in`**

**Симптом**: Console error при page load:
```
A tree hydrated but some attributes of the server rendered HTML didn't match the client properties.
```

**Root cause**: вероятно `authClient.useSession()` или `data-faction` attribute, който се решава client-side, докато SSR използва различна стойност.

**Recommended fix**: identify the mismatched component (вероятно AuthChip или OAuthButton). Apply `suppressHydrationWarning` ONLY ако е cosmetic, OR гарантирай че server и client render-ват едно и също.

**Risk**: hydration mismatches могат да доведат до flicker, нечеткане на interactive state, или пълни interaction breaks.

### Severity 2 — UX bugs

#### 2.1 **Mobile hero text wraps твърде агресивно**

**Симптом**: `Display size="hero"` (4rem = 64px) не се скалира за 375px viewport. Hero текст се чупи на много редове и заема прекалено много пространство.

**Доказателства (mobile 375px)**:

| Страница | Текст | Брой редове |
|---|---|---:|
| `/privacy` | "Твоите тайни остават при теб." | **4 реда** |
| `/history` | "Архив на масата" | **3 реда** |
| `/terms` | "Сядаме на една маса." | 3 реда |
| `/report` | "Светим за тебе." | 2 реда |

Reference: v2 master prompt §M8 explicitly warned about this с fix:

```css
.heroFrame [data-ds-scene-card] :where(h1) {
  font-size: clamp(2.5rem, 6vw, 4rem);
}
```

Този fix не е приложен на M8 за всичките consumers, или не сработи universal.

**Recommended fix**: добави wrapper-context CSS rule в shared module или в `Display.tsx` primitive (само за `size="hero"` variant):

```tsx
// Display.tsx
const SIZE_FONT: Record<DisplaySize, string> = {
  hero: "clamp(2.5rem, 5.5vw, var(--ds-type-display))",  // ← responsive scale
  h1: "clamp(2rem, 4.5vw, var(--ds-type-h1))",
  // ...
};
```

Promote to **Display primitive** ниво — всички consumers получават responsive scaling without per-page override. Это actual API improvement.

#### 2.2 **"Постижения" eyebrow не е мигриран към "ЛЕГЕНДИ"**

**Симптом**: На `/account` секцията за achievements има eyebrow "ПОСТИЖЕНИЯ" (legacy), но title е "Легенди" (spec).

**Root cause**: PR F copy migration пропусна `apps/web/components/account/AccountAchievements.tsx:18`:
```tsx
<PaperCard eyebrow="ПОСТИЖЕНИЯ" density="md">
```

**Fix**:
```diff
- <PaperCard eyebrow="ПОСТИЖЕНИЯ" density="md">
+ <PaperCard eyebrow="ЛЕГЕНДИ" density="md">
```

**Verification**: след fix, `pnpm check:dict` трябва да не покаже legacy hits за този файл.

### Severity 3 — Polish opportunities

#### 3.1 **Quickstart numbered cards на landing-а изглеждат тънки**

5-те номерирани кръга в `/` "Как започва добра игра" секцията изглеждат minimalist на light background. Cards-овете под кръговете липсват визуална тежест (просто текст с number badge).

**Recommendation**: оборудвай numbered icons в `<PaperCard density="sm">` за visual cohesion с останалите cards.

#### 3.2 **`/history` empty state се чувства самотен**

"Архивът чака първото си писмо" + sealed-letter artifact. На голям desktop viewport empty state stand-ва празно space. Empty state би се поразиталил с допълнителен secondary CTA или образец на „пример дело".

**Recommendation** (low priority): add a secondary CTA `<Pill intent="ghost">Виж примерно дело</Pill>` под empty state action, който отваря demo replay.

#### 3.3 **`/leaderboard` empty state — нещо подобно**

"Изданието още не е тиражирано" + unprinted-paper artifact. Същият feeling — empty state има потенциал за по-rich treatment.

**Recommendation** (low priority): newspaper "preview issue" treatment с тонално sample ranking row.

#### 3.4 **Light theme: dark cards на /werewolf и /mafia изглеждат hard**

В сечене 1 ("Това е една нощ" / "Тази нощ в града") cards-овете имат тъмни role artwork backgrounds (`#0d0908`) — silhouette иконки видими, но cards са harshly dark на otherwise warm light background.

**Recommendation**: cards могат да имат подсилен warm wrapper или slight color filter за да не bleed-ват като black squares върху parchment.

#### 3.5 **Footer link "Помощ" — semantic accuracy**

Footer добавя `/faq` link като "Помощ". Page title-ът е "Седни до огъня" (spec) — тематично различен от "Помощ" (literal).

**Recommendation**: разгледай дали "Помощ" се чувства правилно за footer (utility nav) или ако трябва "Седни до огъня" (thematic). Не мъжки fix — design decision.

## 📋 Конкретен fix list

### Critical (направи преди deploy)

1. **PR M10.1 — Title duplication fix** (~15 min, 1 commit)
   - Премахни `| Върколак и Мафия` от 10 per-page titles
   - Layout template ще го добавя auto
   - `fix(seo): remove duplicate brand suffix from per-page titles`

2. **PR M10.2 — Hydration warning на /sign-in** (~30 min, 1 commit)
   - Identify mismatched component (likely AuthChip или OAuthButton SSR)
   - Fix или suppress with reasoning
   - `fix(sign-in): resolve hydration mismatch on auth chip`

3. **PR M10.3 — Mobile hero responsive scaling** (~30 min, 1 commit)
   - Add `clamp()` to Display `size="hero"` в primitive
   - Or apply wrapper-context fix universally
   - `feat(ui): responsive font scaling for Display size hero`
   - **Impact**: всички 8 hero страници получават по-добро mobile reading

4. **PR M10.4 — Postижения → Легенди** в AccountAchievements (~5 min, 1 commit)
   - Single string change
   - `fix(account): migrate Постижения eyebrow to Легенди per spec`

### Nice-to-have (когато има време)

5. PR M11 — Empty state richness for /history + /leaderboard
6. PR M12 — Light theme card warmth on /werewolf + /mafia
7. PR M13 — Quickstart numbered cards в PaperCard wrapper

## Метрики финални

| Метрика | Преди M8/M9 | След M8/M9 | Status |
|---|---:|---:|---|
| Pages с hero banner | 13 | 14 | ✅ |
| Hero presence (thin pages) | weak | strong | ✅ |
| Light theme art for landing/werewolf/mafia | only landing | 3 pages | ✅ |
| Shadow clipping | present | fixed | ✅ |
| Footer /faq link | absent | present | ✅ |
| Title duplication | unknown | **10+ pages broken** | 🔴 NEW BUG |
| Mobile hero readability | n/a | **awkward wrap** | 🔴 NEW BUG |
| Hydration warnings | unknown | **1 on /sign-in** | 🔴 NEW |
| Постижения legacy | should be 0 | **still 1 hit** | 🟡 leftover |

## Summary

✅ **M8 + M9 като цяло са успех** — hero presence е реално възстановен, light theme на /werewolf и /mafia донасят атмосфера, shadow polish работи.

🔴 Има **4 нови или leftover проблема** (3 critical, 1 cosmetic-but-fixable) които да адресира малък PR M10:
1. Title metadata duplication (SEO impact)
2. Hydration mismatch на /sign-in (UX impact)
3. Mobile hero text wrap (mobile readability)
4. ПОСТИЖЕНИЯ → ЛЕГЕНДИ leftover (consistency)

🟡 **3 polish opportunities** които не блокират production но биха обогатили UX-а (empty states, light theme cards, quickstart numbered cards).

**Препоръка**: PR M10 (4 critical fixes, ~1.5 часа total) преди deploy. Polish PR-ове M11-M13 може да чакат след production validation.
