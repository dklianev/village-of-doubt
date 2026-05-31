# Codex prompt — `/account` complete overhaul (Player Profile Dashboard)

Цялостен redesign на `/account` — от **brass-plaque-on-painterly-art settings form** към **cinematic player profile dashboard** в духа на homepage-а. Страницата вече **не е** просто settings page; тя става **lichno досие** на играча с stats, последни игри, postizheniya, профил, и опасна зона.

**Key shift**: `/account` пасва на painterly-marketing системата (същата като /history, /achievements, /leaderboard, homepage), **не** на legal-modern системата. Това е PRODUCT page, не utility page.

~14 atomic English commits. Branch: `feat/account-dashboard-overhaul`. **1 нова imagen banner снимка**.

---

## Pre-analysis (current state)

### Текуща структура

`/account` използва same pattern като /privacy, /terms, /report:
- Sticky painterly portrait art ляво (3:4 aspect, 320px wide)
- Brass-textured cream card дясно с 4 секции: Профил / Входове / Твоите данни / Изтрий профила
- Cream-on-brass typography
- Plain inline form за name edit

### Проблеми

| # | Issue | Severity |
|---|---|---|
| 1 | **Brass-textured card с double inset borders** — изглежда като 2010 forum profile, не като 2026 product | 🔴 |
| 2 | **Settings-style layout** — потребителят влиза, изпитва "това е settings", без visual value | 🔴 |
| 3 | **Никаква user data** — няма брой игри, win rate, последни ходове, отключени постижения. Профилът губи смисъл когато всичко стои само в /history /achievements /leaderboard | 🟠 |
| 4 | **Sticky portrait art ляво** — заема 320px, дава нула функционална стойност за settings page | 🟠 |
| 5 | **Cream-on-brass form inputs** — не consistent с другите modernized pages | 🟡 |
| 6 | **Delete account-ът визуално равен на rest** — danger zone не е достатъчно отделена | 🟠 |
| 7 | **Email verification badge inline** — губи се в текст; ако не е verified, потребителят не получава ясен CTA | 🟡 |
| 8 | **Няма "член от" / "tier" / "stat snapshot"** в hero областта | 🟠 |

### Какво е силната версия?

Homepage задава тонa — **cinematic painterly banner** + content cards под него. /history (Evidence Wall), /achievements (Brass Plaques), /leaderboard (Vintage Newspaper) всичките са product-pages с rich content + theatrical presentation.

`/account` трябва да следва **същия pattern**: cinematic banner → personal identity card → stats → achievements showcase → recent games → settings → danger zone.

Така /account става **най-посещаваната personal page** — не "settings". Дава причина да се връщаш.

---

## Pre-decisions (locked)

- **Design system**: `painterly-marketing` (homepage/history/achievements/leaderboard family). NOT legal-modern. Banner art + cinematic chrome.
- **Layout**: full-width banner отгоре (16:9) + content stack под него с modern cards. Single column, max-width ~960px центрирано.
- **Card style**: NEW `painterly-card` clean variant — dark surface с warm amber accents, no brass texture inside card, hairline borders. Different from legal-modern (lighter, more game-themed), different from old brass-plaque (cleaner, more product-y).
- **Data sources**: existing queries (`getGameHistoryForUser`, `getAchievementsForUser`) + new computed stats helper.
- **Imagen scope**: 1 нов cinematic banner (replaces existing portrait art `account-dossier.png`). The old portrait stays in repo за back-compat но не се ползва.
- **Settings remain functional**: name edit + email verification badge + provider list + data export + delete account — но в по-добра presentation.
- **Branch**: `feat/account-dashboard-overhaul`.

---

## Stage 1 — Generate cinematic banner via `/imagen`

### Asset: Account hero banner

**Path:** `apps/web/public/game-art/account/account-hero-banner.png`

```
A wide cinematic banner illustration of a detective's personal
study at night, captured from a slight low angle. Center frame:
an oak desk covered with leather-bound dossier folders stacked
diagonally, a brass desk lamp glowing warm gold from the upper-
left casting strong directional light, a half-finished glass of
dark red wine on the right, a few wax-sealed letters at the
desk edge, an ornate brass key resting on top of one folder.
Background: deeply blurred bookshelf wall with painted family
portraits in heavy gilt frames, hints of a velvet curtain at the
far edge. The lower third of the frame gradient-fades to near-
black for text overlay legibility. Mood: personal sanctuary,
accumulated stories, the place where private decisions are made.
Oil-paint style with rich painterly brushwork, warm amber and
umber palette with deep mahogany browns and brass highlights,
atmospheric depth, vignetted corners. No text, no readable
letters, no numbers, no visible writing or symbols anywhere.
Aspect ratio 16:9.
```

**Size:** 1920 × 1080.

После: `pnpm optimize:assets`. Verify both PNG + WebP exist. If imagen output показва stray letters/numbers, regenerate с по-силен emphasis на "no text".

**Note:** Запазете старите assets `account-dossier.png` + `.webp` — могат да са OG fallback. Не ги изтривайте в този PR.

---

## Stage 2 — Server-side data aggregation

### New helper: account stats

**File:** Create `apps/web/lib/account-stats.ts`

```ts
import { getRoleTeam, type RoleCode } from "@werewolf/shared";
import type { GameHistorySummary } from "@werewolf/database";

export interface PlayerStats {
  totalGames: number;
  totalWins: number;
  winRate: number;
  villageWins: number;
  threatWins: number;
  longestStreak: number;
  memberSince: Date | null;
}

interface GameWithPlayerRole {
  game: GameHistorySummary;
  role: string | null;
}

export function computePlayerStats(rows: GameWithPlayerRole[], memberSince: Date | null): PlayerStats {
  const totalGames = rows.length;
  let totalWins = 0;
  let villageWins = 0;
  let threatWins = 0;
  let currentStreak = 0;
  let longestStreak = 0;

  // Sort by endedAt ascending for streak calculation
  const sorted = [...rows].sort((a, b) => {
    const aTime = a.game.endedAt?.getTime() ?? 0;
    const bTime = b.game.endedAt?.getTime() ?? 0;
    return aTime - bTime;
  });

  for (const row of sorted) {
    const winner = row.game.winnerTeam;
    const role = row.role;
    const won = didPlayerWin(role, winner);

    if (won) {
      totalWins += 1;
      currentStreak += 1;
      longestStreak = Math.max(longestStreak, currentStreak);
      if (winner === "village") villageWins += 1;
      if (winner === "werewolves" || winner === "vampires" || winner === "mafia") threatWins += 1;
    } else {
      currentStreak = 0;
    }
  }

  const winRate = totalGames > 0 ? Math.round((totalWins / totalGames) * 100) : 0;

  return { totalGames, totalWins, winRate, villageWins, threatWins, longestStreak, memberSince };
}

function didPlayerWin(role: string | null, winner: string | null): boolean {
  if (!role || !winner) return false;
  if (winner === "draw") return false;
  if (winner === "maniac") return role === "maniac";
  if (winner === "lovers") return false; // lovers handled separately
  const team = getRoleTeam(role as RoleCode);
  return team === winner;
}
```

### Update `apps/web/app/account/page.tsx`

Server component fetches everything needed. Use existing `@werewolf/database` queries.

```tsx
import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  createDatabase,
  getGameHistoryForUser,
  getAchievementsForUser,
} from "@werewolf/database";
import { ACHIEVEMENTS } from "@werewolf/shared";
import { AccountDashboard } from "@/components/account/AccountDashboard";
import { ResourceHints } from "@/components/resource-hints";
import { auth } from "@/lib/auth";
import { computePlayerStats } from "@/lib/account-stats";

export const metadata: Metadata = {
  title: "Твоето досие | Върколак и Мафия",
  description: "Профил, статистики, постижения и контрол на твоите данни.",
  robots: { index: false, follow: false },
};

export default async function AccountPage() {
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });

  if (!session) {
    redirect("/sign-in?redirect=/account");
  }

  const accounts = await auth.api.listUserAccounts({ headers: requestHeaders }).catch(() => []);
  const providerIds = new Set(accounts.map((account) => account.providerId));
  if (session.user.email) {
    providerIds.add("credential");
  }

  // Fetch player history + achievements server-side
  let games: Awaited<ReturnType<typeof getGameHistoryForUser>> = [];
  let achievements: Awaited<ReturnType<typeof getAchievementsForUser>> = [];
  let memberSince: Date | null = null;

  if (process.env.DATABASE_URL) {
    try {
      const db = createDatabase(process.env.DATABASE_URL);
      games = await getGameHistoryForUser(db, session.user.id, 50);
      achievements = await getAchievementsForUser(db, session.user.id);
      memberSince = session.user.createdAt ? new Date(session.user.createdAt) : null;
    } catch (error) {
      console.error("[account]", error);
    }
  }

  // Codex: getGameHistoryForUser currently returns games without the player's role
  // for the current user. If this is the case, extend the query OR add a second
  // helper getGamePlayerRoleForUser(db, gameIds, userId) → Map<gameId, role>.
  // For now, fall back to "unknown" role. Stats will under-count wins.
  // TODO marker for the extension.

  const stats = computePlayerStats(
    games.map((game) => ({ game, role: null })), // role-unaware until query extends
    memberSince,
  );

  const top3Achievements = ACHIEVEMENTS.filter((def) =>
    achievements.some((unlocked) => unlocked.achievementId === def.id),
  ).slice(0, 3);

  const recentGames = games.slice(0, 3);

  return (
    <main className="shell account-shell">
      <ResourceHints images={["/game-art/account/account-hero-banner.webp"]} />
      <AccountDashboard
        userId={session.user.id}
        email={session.user.email}
        name={session.user.name ?? ""}
        image={session.user.image ?? null}
        emailVerified={session.user.emailVerified ?? false}
        providers={[...providerIds]}
        stats={stats}
        recentGames={recentGames.map((game) => ({
          id: game.id,
          code: game.code,
          mode: modeFromConfig(game.config),
          winnerTeam: game.winnerTeam,
          endedAt: game.endedAt,
        }))}
        unlockedAchievementIds={achievements.map((a) => a.achievementId)}
        totalAchievementCount={ACHIEVEMENTS.length}
      />
    </main>
  );
}

function modeFromConfig(config: unknown): "werewolves_classic" | "mafia_sport" | "mafia_free" {
  if (config && typeof config === "object" && "mode" in config) {
    const mode = (config as { mode?: unknown }).mode;
    if (mode === "werewolves_classic" || mode === "mafia_sport" || mode === "mafia_free") {
      return mode;
    }
  }
  return "werewolves_classic";
}
```

**Codex note**: If `getGameHistoryForUser` doesn't return player role, add new query `getPlayerRoleInGames(db, userId, gameIds): Map<gameId, role>` in `packages/database/src/queries.ts`. Then merge in `computePlayerStats`. If too complex, leave role-aware stats as "unknown" with TODO marker and ship win rate as games-based (winner_team matches any role-team the user had).

---

## Stage 3 — `AccountDashboard` client component (replaces `AccountClient`)

**File:** `apps/web/components/account/AccountDashboard.tsx`

Renders all sections. Heavy file — break into smaller composable pieces.

```tsx
"use client";

import type { GameMode, WinnerTeam } from "@werewolf/shared";
import { AccountHero } from "./AccountHero";
import { AccountStats } from "./AccountStats";
import { AccountAchievements } from "./AccountAchievements";
import { AccountRecentGames, type RecentGameSummary } from "./AccountRecentGames";
import { AccountProfile } from "./AccountProfile";
import { AccountDataExport } from "./AccountDataExport";
import { AccountDangerZone } from "./AccountDangerZone";
import type { PlayerStats } from "@/lib/account-stats";

interface AccountDashboardProps {
  userId: string;
  email: string;
  name: string;
  image: string | null;
  emailVerified: boolean;
  providers: string[];
  stats: PlayerStats;
  recentGames: RecentGameSummary[];
  unlockedAchievementIds: string[];
  totalAchievementCount: number;
}

export function AccountDashboard(props: AccountDashboardProps) {
  return (
    <div className="account-page">
      <AccountHero
        name={props.name}
        image={props.image}
        memberSince={props.stats.memberSince}
        totalGames={props.stats.totalGames}
        totalWins={props.stats.totalWins}
        winRate={props.stats.winRate}
      />

      <div className="account-content">
        {props.stats.totalGames > 0 ? <AccountStats stats={props.stats} /> : null}

        <AccountAchievements
          unlockedIds={props.unlockedAchievementIds}
          total={props.totalAchievementCount}
        />

        {props.recentGames.length > 0 ? <AccountRecentGames games={props.recentGames} /> : null}

        <AccountProfile
          initialName={props.name}
          email={props.email}
          emailVerified={props.emailVerified}
          providers={props.providers}
        />

        <AccountDataExport />

        <AccountDangerZone />
      </div>
    </div>
  );
}
```

### `AccountHero.tsx`

Cinematic banner with avatar + identity + 3 quick-stat chips.

```tsx
import Image from "next/image";

interface AccountHeroProps {
  name: string;
  image: string | null;
  memberSince: Date | null;
  totalGames: number;
  totalWins: number;
  winRate: number;
}

export function AccountHero(props: AccountHeroProps) {
  const initial = (props.name[0] ?? "?").toUpperCase();
  const memberSinceLabel = props.memberSince
    ? new Intl.DateTimeFormat("bg-BG", { year: "numeric", month: "long" }).format(props.memberSince)
    : null;

  return (
    <header className="account-hero" aria-label="Профил">
      <div className="account-hero-banner">
        <Image
          src="/game-art/account/account-hero-banner.webp"
          alt=""
          fill
          priority
          sizes="100vw"
          className="account-hero-img"
        />
        <div className="account-hero-scrim" aria-hidden />
      </div>

      <div className="account-hero-inner">
        <div className="account-hero-avatar">
          {props.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={props.image} alt="" />
          ) : (
            <span className="account-hero-initial">{initial}</span>
          )}
        </div>

        <div className="account-hero-identity">
          <p className="account-hero-kicker">досие</p>
          <h1 className="account-hero-name">{props.name || "Без име"}</h1>
          {memberSinceLabel ? (
            <p className="account-hero-meta">Член от {memberSinceLabel}</p>
          ) : null}
        </div>

        {props.totalGames > 0 ? (
          <dl className="account-hero-quickstats">
            <div>
              <dt>Игри</dt>
              <dd>{props.totalGames}</dd>
            </div>
            <div>
              <dt>Победи</dt>
              <dd>{props.totalWins}</dd>
            </div>
            <div>
              <dt>Процент</dt>
              <dd>{props.winRate}%</dd>
            </div>
          </dl>
        ) : (
          <p className="account-hero-empty">Първото дело още чака име.</p>
        )}
      </div>
    </header>
  );
}
```

### `AccountStats.tsx`

Detail stats grid (4 cards): village wins, threat wins, longest streak, win rate breakdown.

```tsx
import type { PlayerStats } from "@/lib/account-stats";

export function AccountStats({ stats }: { stats: PlayerStats }) {
  return (
    <section className="account-section">
      <header className="account-section-head">
        <h2>Следата ти</h2>
        <p>Какво остана след игрите досега.</p>
      </header>

      <div className="account-stats-grid">
        <article className="account-stat-card">
          <p className="account-stat-label">Селски победи</p>
          <p className="account-stat-value">{stats.villageWins}</p>
          <p className="account-stat-hint">от ролята на селянин</p>
        </article>

        <article className="account-stat-card">
          <p className="account-stat-label">Нощни победи</p>
          <p className="account-stat-value">{stats.threatWins}</p>
          <p className="account-stat-hint">от ролята на върколак или мафиот</p>
        </article>

        <article className="account-stat-card">
          <p className="account-stat-label">Най-дълга серия</p>
          <p className="account-stat-value">{stats.longestStreak}</p>
          <p className="account-stat-hint">{stats.longestStreak === 1 ? "поредна победа" : "поредни победи"}</p>
        </article>

        <article className="account-stat-card">
          <p className="account-stat-label">Победна следа</p>
          <p className="account-stat-value">{stats.winRate}<span className="account-stat-suffix">%</span></p>
          <p className="account-stat-hint">от {stats.totalGames} {stats.totalGames === 1 ? "игра" : "игри"}</p>
        </article>
      </div>
    </section>
  );
}
```

### `AccountAchievements.tsx`

Mini showcase: 3 unlocked (or "still locked" message) + link to /achievements.

```tsx
import Link from "next/link";
import { ACHIEVEMENTS } from "@werewolf/shared";
import { AchievementIcon } from "@/components/achievements/AchievementIcon";

interface Props {
  unlockedIds: string[];
  total: number;
}

export function AccountAchievements({ unlockedIds, total }: Props) {
  const unlockedSet = new Set(unlockedIds);
  const top3 = ACHIEVEMENTS.filter((def) => unlockedSet.has(def.id)).slice(0, 3);

  return (
    <section className="account-section">
      <header className="account-section-head">
        <h2>Постижения</h2>
        <p>
          {unlockedIds.length} от {total} легенди отключени.
        </p>
      </header>

      {top3.length > 0 ? (
        <ul className="account-achievement-row">
          {top3.map((def) => (
            <li key={def.id}>
              <article
                className="account-achievement-mini"
                data-tier={def.tier ?? "bronze"}
                data-family={def.family ?? "universal"}
              >
                <AchievementIcon id={def.id} className="account-achievement-icon" />
                <p className="account-achievement-title">{def.titleBg}</p>
              </article>
            </li>
          ))}
        </ul>
      ) : (
        <p className="account-empty-note">
          Заключени са все още. Завърши първата игра, за да гравираш плоча.
        </p>
      )}

      <Link href="/achievements" className="account-section-link">
        Виж всички постижения →
      </Link>
    </section>
  );
}
```

### `AccountRecentGames.tsx`

3 mini case-file cards.

```tsx
import Link from "next/link";
import type { GameMode, WinnerTeam } from "@werewolf/shared";

export interface RecentGameSummary {
  id: string;
  code: string;
  mode: GameMode;
  winnerTeam: WinnerTeam | null;
  endedAt: Date | null;
}

const MODE_LABEL: Record<GameMode, string> = {
  werewolves_classic: "Върколак",
  mafia_sport: "Спортна Мафия",
  mafia_free: "Свободна Мафия",
};

const WINNER_LABEL: Record<string, string> = {
  village: "Селото оцеля",
  werewolves: "Върколаците надделяха",
  vampires: "Вампирите надделяха",
  mafia: "Мафията владее",
  maniac: "Маниакът победи",
  lovers: "Влюбените се измъкнаха",
  draw: "Равенство",
};

export function AccountRecentGames({ games }: { games: RecentGameSummary[] }) {
  return (
    <section className="account-section">
      <header className="account-section-head">
        <h2>Последни вечери</h2>
        <p>Архивът помни последните ти три маси.</p>
      </header>

      <ul className="account-game-list">
        {games.map((game) => (
          <li key={game.id}>
            <article className="account-game-card">
              <header className="account-game-head">
                <span className="account-game-code">Дело №{game.code}</span>
                <time className="account-game-date">{formatDate(game.endedAt)}</time>
              </header>
              <p className="account-game-verdict">
                {game.winnerTeam ? WINNER_LABEL[game.winnerTeam] ?? "Развръзка" : "Незавършена"}
              </p>
              <p className="account-game-mode">{MODE_LABEL[game.mode]}</p>
              <Link href={`/history/${game.id}/replay`} className="account-game-link">
                Отвори дело →
              </Link>
            </article>
          </li>
        ))}
      </ul>

      <Link href="/history" className="account-section-link">
        Виж пълния архив →
      </Link>
    </section>
  );
}

function formatDate(date: Date | null): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("bg-BG", { day: "numeric", month: "short" }).format(date);
}
```

### `AccountProfile.tsx`

Name edit + email + provider list. **Modern form patterns** (not brass inputs).

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";

const PROVIDER_LABELS: Record<string, string> = {
  credential: "Имейл и парола",
  google: "Google",
  discord: "Discord",
};

const PROVIDER_ICONS: Record<string, string> = {
  credential: "✉",
  google: "G",
  discord: "D",
};

interface Props {
  initialName: string;
  email: string;
  emailVerified: boolean;
  providers: string[];
}

export function AccountProfile(props: Props) {
  const router = useRouter();
  const [name, setName] = useState(props.initialName);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<"" | "saved" | "error">("");
  const [errorMessage, setErrorMessage] = useState("");

  async function saveName() {
    const next = name.trim();
    if (next.length < 2) {
      setStatus("error");
      setErrorMessage("Името трябва да е поне 2 символа.");
      return;
    }
    setSaving(true);
    setStatus("");
    const result = await authClient.updateUser({ name: next });
    setSaving(false);
    if (result.error) {
      setStatus("error");
      setErrorMessage("Грешка при запис.");
      return;
    }
    setStatus("saved");
    router.refresh();
    setTimeout(() => setStatus(""), 2200);
  }

  return (
    <section className="account-section">
      <header className="account-section-head">
        <h2>Профил</h2>
        <p>Името на масата и входовете към профила.</p>
      </header>

      <div className="account-profile-form">
        <div className="account-field">
          <label htmlFor="account-name">Име на масата</label>
          <div className="account-field-inline">
            <input
              id="account-name"
              type="text"
              value={name}
              maxLength={32}
              onChange={(event) => setName(event.target.value)}
              autoComplete="name"
            />
            <button
              type="button"
              className="account-save-btn"
              onClick={saveName}
              disabled={saving || name.trim() === props.initialName}
            >
              {saving ? "Запазваме..." : "Запази"}
            </button>
          </div>
          {status === "saved" ? <p className="account-status account-status-ok">Запазено.</p> : null}
          {status === "error" ? <p className="account-status account-status-error" role="alert">{errorMessage}</p> : null}
        </div>

        <div className="account-field">
          <p className="account-field-label">Имейл</p>
          <div className="account-field-static">
            <span>{props.email}</span>
            {props.emailVerified ? (
              <span className="account-badge account-badge-ok">Потвърден</span>
            ) : (
              <Link href="/verify-email" className="account-badge account-badge-warn">
                Непотвърден · потвърди →
              </Link>
            )}
          </div>
        </div>

        <div className="account-field">
          <p className="account-field-label">Активни входове</p>
          <ul className="account-provider-list">
            {props.providers.map((provider) => (
              <li key={provider} data-provider={provider}>
                <span className="account-provider-icon" aria-hidden>
                  {PROVIDER_ICONS[provider] ?? "·"}
                </span>
                <span>{PROVIDER_LABELS[provider] ?? provider}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
```

### `AccountDataExport.tsx`

```tsx
"use client";

export function AccountDataExport() {
  function exportData() {
    window.location.href = "/api/account/export";
  }

  return (
    <section className="account-section">
      <header className="account-section-head">
        <h2>Твоите данни</h2>
        <p>Имаш право да изтеглиш всичко, което сме записали за теб.</p>
      </header>

      <button type="button" className="account-export-btn" onClick={exportData}>
        Изтегли моите данни (JSON)
      </button>
    </section>
  );
}
```

### `AccountDangerZone.tsx`

Сериозно отделена секция с red-accent border.

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function AccountDangerZone() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<"idle" | "deleting" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function deleteAccount() {
    setStatus("deleting");
    setErrorMessage("");
    try {
      const response = await fetch("/api/account/delete", { method: "POST" });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        setErrorMessage(data.error ?? "Грешка при изтриване.");
        setStatus("error");
        return;
      }
      await authClient.signOut();
      router.push("/");
      router.refresh();
    } catch {
      setErrorMessage("Грешка при изтриване.");
      setStatus("error");
    }
  }

  return (
    <section className="account-section account-danger">
      <header className="account-section-head">
        <h2>Опасна зона</h2>
        <p>Окончателно изтриване на твоя профил.</p>
      </header>

      <div className="account-danger-body">
        <p>
          Изтриването премахва профила и постиженията. Имената от твоите игри остават в архива, но
          се заменят с „Изтрит играч“ за да не се чупи историята на другите играчи.
        </p>

        {open ? (
          <div className="account-danger-confirm">
            <p>
              <strong>Сигурен/сигурна ли си?</strong> Това действие не може да се върне.
            </p>
            {errorMessage ? <p className="account-status account-status-error" role="alert">{errorMessage}</p> : null}
            <div className="account-danger-actions">
              <button
                type="button"
                className="account-danger-btn"
                onClick={deleteAccount}
                disabled={status === "deleting"}
              >
                {status === "deleting" ? "Изтриваме..." : "Да, изтрий профила"}
              </button>
              <button type="button" className="account-cancel-btn" onClick={() => setOpen(false)}>
                Отказ
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="account-danger-btn" onClick={() => setOpen(true)}>
            Изтрий моя профил
          </button>
        )}
      </div>
    </section>
  );
}
```

---

## Stage 4 — CSS overhaul (`legal-modern` aesthetic ratios, painterly-marketing palette)

Премахни напълно `.dossier-*` block (lines ~11174-11500 в globals.css) и добави нов `.account-*` block:

```css
/* ============================== */
/* Account dashboard               */
/* ============================== */

.account-shell {
  --account-bg: #0d0a08;
  --account-surface: rgba(26, 20, 16, 0.7);
  --account-surface-strong: rgba(36, 28, 22, 0.88);
  --account-text: #f5e8c8;
  --account-text-muted: rgba(245, 232, 200, 0.74);
  --account-text-soft: rgba(245, 232, 200, 0.5);
  --account-border: rgba(245, 232, 200, 0.12);
  --account-border-strong: rgba(245, 232, 200, 0.22);
  --account-accent: #d19a42;
  --account-accent-soft: rgba(209, 154, 66, 0.18);
  --account-danger: #d94a3d;
  --account-danger-soft: rgba(217, 74, 61, 0.16);

  background: var(--account-bg);
  color: var(--account-text);
  font-family: "Noto Sans", system-ui, -apple-system, "Segoe UI", sans-serif;
  min-height: 100vh;
  padding: 0 0 64px;
}

.account-page {
  max-width: 100%;
  margin: 0 auto;
}

.account-content {
  max-width: 960px;
  margin: 0 auto;
  padding: 32px 24px 0;
  display: grid;
  gap: 32px;
}

/* Hero banner */

.account-hero {
  position: relative;
  width: 100%;
  min-height: clamp(280px, 38vw, 460px);
  border-bottom: 1px solid var(--account-border);
}

.account-hero-banner {
  position: absolute;
  inset: 0;
  overflow: hidden;
}

.account-hero-img {
  object-fit: cover;
  object-position: center 38%;
}

.account-hero-scrim {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(180deg, rgba(13, 10, 8, 0.2) 0%, rgba(13, 10, 8, 0.55) 50%, rgba(13, 10, 8, 0.96) 100%),
    linear-gradient(90deg, rgba(13, 10, 8, 0.3) 0%, transparent 40%, transparent 60%, rgba(13, 10, 8, 0.3) 100%);
}

.account-hero-inner {
  position: relative;
  z-index: 1;
  max-width: 960px;
  margin: 0 auto;
  padding: 32px 24px;
  height: 100%;
  display: grid;
  grid-template-columns: auto 1fr;
  grid-template-rows: 1fr auto;
  gap: 16px 24px;
  align-items: end;
}

@media (min-width: 768px) {
  .account-hero-inner {
    grid-template-columns: auto 1fr auto;
    grid-template-rows: 1fr;
    align-items: end;
    padding-bottom: 40px;
  }
}

.account-hero-avatar {
  grid-row: 1;
  width: 96px;
  height: 96px;
  border-radius: 50%;
  border: 3px solid var(--account-accent);
  overflow: hidden;
  background: var(--account-surface-strong);
  display: grid;
  place-items: center;
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(245, 232, 200, 0.12);
}

.account-hero-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.account-hero-initial {
  font-family: "Noto Serif Display", serif;
  font-size: 2.4rem;
  font-weight: 900;
  color: var(--account-accent);
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.6);
}

.account-hero-identity {
  grid-row: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.account-hero-kicker {
  font-size: 0.72rem;
  letter-spacing: 0.32em;
  text-transform: uppercase;
  font-weight: 700;
  color: var(--account-accent);
  margin: 0;
}

.account-hero-name {
  font-family: "Noto Serif Display", "Noto Serif", serif;
  font-size: clamp(1.75rem, 4vw, 2.75rem);
  font-weight: 900;
  letter-spacing: -0.01em;
  line-height: 1.05;
  color: var(--account-text);
  text-shadow: 0 2px 14px rgba(0, 0, 0, 0.55);
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}

.account-hero-meta {
  font-size: 0.88rem;
  color: var(--account-text-muted);
  margin: 4px 0 0;
}

.account-hero-quickstats {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
  padding: 0;
  margin: 0;
}

@media (min-width: 768px) {
  .account-hero-quickstats {
    grid-column: auto;
    grid-row: 1;
    grid-template-columns: repeat(3, auto);
    gap: 22px;
  }
}

.account-hero-quickstats div {
  text-align: center;
}

.account-hero-quickstats dt {
  font-size: 0.7rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--account-text-soft);
  margin: 0 0 2px;
}

.account-hero-quickstats dd {
  font-family: "Noto Serif Display", serif;
  font-size: clamp(1.5rem, 3vw, 2rem);
  font-weight: 900;
  color: var(--account-text);
  margin: 0;
  font-variant-numeric: tabular-nums;
}

.account-hero-empty {
  grid-column: 1 / -1;
  font-size: 0.95rem;
  font-style: italic;
  color: var(--account-text-muted);
  margin: 0;
}

/* Sections */

.account-section {
  padding: 24px;
  background: var(--account-surface);
  border: 1px solid var(--account-border);
  border-radius: 16px;
  display: grid;
  gap: 20px;
}

.account-section-head {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.account-section-head h2 {
  font-family: "Noto Serif Display", "Noto Serif", serif;
  font-size: 1.4rem;
  font-weight: 800;
  letter-spacing: -0.01em;
  color: var(--account-text);
  margin: 0;
}

.account-section-head p {
  font-size: 0.88rem;
  color: var(--account-text-soft);
  margin: 0;
}

.account-section-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--account-accent);
  text-decoration: underline;
  text-underline-offset: 3px;
  align-self: start;
}

.account-section-link:hover {
  text-decoration-thickness: 2px;
}

.account-empty-note {
  font-size: 0.9rem;
  font-style: italic;
  color: var(--account-text-muted);
  margin: 0;
  padding: 16px 18px;
  background: rgba(245, 232, 200, 0.04);
  border: 1px dashed var(--account-border);
  border-radius: 10px;
}

/* Stats grid */

.account-stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

@media (min-width: 768px) {
  .account-stats-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}

.account-stat-card {
  padding: 16px;
  background: var(--account-surface-strong);
  border: 1px solid var(--account-border);
  border-radius: 12px;
  display: grid;
  gap: 4px;
}

.account-stat-label {
  font-size: 0.72rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  font-weight: 700;
  color: var(--account-accent);
  margin: 0;
}

.account-stat-value {
  font-family: "Noto Serif Display", serif;
  font-size: 2rem;
  font-weight: 900;
  color: var(--account-text);
  margin: 0;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.account-stat-suffix {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--account-text-muted);
  margin-left: 2px;
}

.account-stat-hint {
  font-size: 0.76rem;
  color: var(--account-text-soft);
  margin: 0;
  line-height: 1.4;
}

/* Achievement mini row */

.account-achievement-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  list-style: none;
  padding: 0;
  margin: 0;
}

@media (max-width: 640px) {
  .account-achievement-row {
    grid-template-columns: 1fr;
  }
}

.account-achievement-mini {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  background: linear-gradient(155deg, rgba(200, 163, 102, 0.92), rgba(168, 132, 75, 0.85));
  border-radius: 10px;
  color: #1a1410;
  box-shadow: inset 0 1px 0 rgba(255, 240, 200, 0.45), 0 4px 12px rgba(0, 0, 0, 0.35);
}

.account-achievement-mini[data-tier="silver"] {
  background: linear-gradient(155deg, rgba(180, 180, 180, 0.92), rgba(140, 140, 140, 0.85));
}

.account-achievement-mini[data-tier="gold"] {
  background: linear-gradient(155deg, rgba(230, 194, 94, 0.95), rgba(196, 158, 70, 0.88));
}

.account-achievement-icon {
  width: 32px;
  height: 32px;
  color: #1a1410;
  flex-shrink: 0;
}

.account-achievement-title {
  font-family: "Noto Serif Display", serif;
  font-size: 0.88rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  margin: 0;
  text-shadow: 0 1px 0 rgba(255, 240, 200, 0.4);
}

/* Recent games */

.account-game-list {
  display: grid;
  gap: 10px;
  list-style: none;
  padding: 0;
  margin: 0;
}

.account-game-card {
  display: grid;
  grid-template-columns: 1fr auto;
  grid-template-rows: auto auto auto;
  gap: 6px 16px;
  padding: 14px 16px;
  background: var(--account-surface-strong);
  border: 1px solid var(--account-border);
  border-radius: 12px;
  transition: border-color 160ms ease;
}

.account-game-card:hover {
  border-color: var(--account-accent);
}

.account-game-head {
  grid-column: 1 / -1;
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 12px;
}

.account-game-code {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.78rem;
  letter-spacing: 0.08em;
  color: var(--account-accent);
  font-weight: 700;
}

.account-game-date {
  font-size: 0.78rem;
  color: var(--account-text-soft);
  font-variant-numeric: tabular-nums;
}

.account-game-verdict {
  font-family: "Noto Serif Display", serif;
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--account-text);
  margin: 0;
}

.account-game-mode {
  font-size: 0.82rem;
  color: var(--account-text-muted);
  margin: 0;
}

.account-game-link {
  grid-column: 2;
  grid-row: 2 / 4;
  align-self: end;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--account-accent);
  text-decoration: underline;
  text-underline-offset: 3px;
  white-space: nowrap;
}

/* Profile form */

.account-profile-form {
  display: grid;
  gap: 20px;
}

.account-field {
  display: grid;
  gap: 8px;
}

.account-field label,
.account-field-label {
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--account-text);
  margin: 0;
}

.account-field-inline {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.account-field input[type="text"] {
  flex: 1;
  min-width: 200px;
  padding: 10px 14px;
  border: 1px solid var(--account-border-strong);
  border-radius: 10px;
  background: rgba(13, 10, 8, 0.5);
  color: var(--account-text);
  font-family: inherit;
  font-size: 1rem;
  transition: border-color 120ms ease, box-shadow 120ms ease;
}

.account-field input[type="text"]:focus {
  outline: none;
  border-color: var(--account-accent);
  box-shadow: 0 0 0 3px var(--account-accent-soft);
}

.account-save-btn {
  padding: 10px 18px;
  background: var(--account-accent);
  border: 1px solid var(--account-accent);
  border-radius: 10px;
  color: #1a1410;
  font-family: inherit;
  font-weight: 700;
  cursor: pointer;
  transition: filter 160ms ease, transform 160ms ease;
}

.account-save-btn:hover:not(:disabled) {
  filter: brightness(1.08);
  transform: translateY(-1px);
}

.account-save-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.account-status {
  font-size: 0.82rem;
  font-weight: 600;
  margin: 0;
}

.account-status-ok { color: #6fbf6f; }
.account-status-error { color: #e57373; }

.account-field-static {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  padding: 12px 14px;
  background: rgba(13, 10, 8, 0.4);
  border: 1px solid var(--account-border);
  border-radius: 10px;
  font-size: 0.95rem;
}

.account-badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 0.74rem;
  letter-spacing: 0.08em;
  font-weight: 700;
  text-transform: uppercase;
  text-decoration: none;
}

.account-badge-ok {
  background: rgba(111, 191, 111, 0.18);
  color: #6fbf6f;
  border: 1px solid rgba(111, 191, 111, 0.45);
}

.account-badge-warn {
  background: var(--account-danger-soft);
  color: var(--account-danger);
  border: 1px solid var(--account-danger);
}

.account-provider-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 8px;
  list-style: none;
  padding: 0;
  margin: 0;
}

.account-provider-list li {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: rgba(13, 10, 8, 0.4);
  border: 1px solid var(--account-border);
  border-radius: 10px;
  font-size: 0.92rem;
  color: var(--account-text);
}

.account-provider-icon {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: var(--account-accent-soft);
  color: var(--account-accent);
  font-weight: 700;
  font-family: "Noto Serif Display", serif;
}

/* Data export */

.account-export-btn {
  padding: 12px 18px;
  background: var(--account-surface-strong);
  border: 1px solid var(--account-border-strong);
  border-radius: 10px;
  color: var(--account-text);
  font-family: inherit;
  font-weight: 600;
  cursor: pointer;
  align-self: start;
  transition: border-color 160ms ease;
}

.account-export-btn:hover {
  border-color: var(--account-accent);
}

/* Danger zone */

.account-danger {
  border-color: var(--account-danger-soft);
  background: linear-gradient(155deg, var(--account-danger-soft), rgba(13, 10, 8, 0.7));
}

.account-danger .account-section-head h2 {
  color: var(--account-danger);
}

.account-danger-body {
  display: grid;
  gap: 14px;
}

.account-danger-body p {
  font-size: 0.92rem;
  line-height: 1.55;
  color: var(--account-text-muted);
  margin: 0;
}

.account-danger-btn {
  padding: 10px 18px;
  background: var(--account-danger);
  border: 1px solid var(--account-danger);
  border-radius: 10px;
  color: #fff5e0;
  font-family: inherit;
  font-weight: 700;
  cursor: pointer;
  align-self: start;
  transition: filter 160ms ease, transform 160ms ease;
}

.account-danger-btn:hover:not(:disabled) {
  filter: brightness(1.1);
}

.account-danger-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.account-cancel-btn {
  padding: 10px 18px;
  background: transparent;
  border: 1px solid var(--account-border-strong);
  border-radius: 10px;
  color: var(--account-text-muted);
  font-family: inherit;
  font-weight: 600;
  cursor: pointer;
}

.account-danger-confirm {
  padding: 16px 18px;
  background: rgba(217, 74, 61, 0.1);
  border: 1px solid var(--account-danger);
  border-radius: 10px;
  display: grid;
  gap: 12px;
}

.account-danger-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}
```

---

## Stage 5 — Remove obsolete `.dossier-*` CSS

В `apps/web/app/globals.css`:
- Намери `.dossier-shell`, `.dossier-stage`, `.dossier-art`, `.dossier-card`, `.dossier-kicker`, `.dossier-head h1`, `.dossier-subtitle`, `.dossier-section`, `.dossier-section h2`, `.dossier-row`, `.dossier-avatar`, `.dossier-meta`, `.dossier-save-btn`, `.dossier-status`, `.dossier-email`, `.dossier-badge*`, `.dossier-provider-list`, `.dossier-danger`, `.dossier-confirm*`, `.dossier-error`, `.dossier-foot*`
- Изтрий целия блок

CSS файлът става **по-малък**, не по-голям.

---

## Stage 6 — Visual regression baseline

```bash
pnpm visual:update
pnpm visual
```

Affected: `/account` desktop + mobile (single page). Verify:
- Hero banner full-width отгоре
- Avatar overlays banner с amber border
- 3 quickstats inline on desktop (stacked on mobile)
- Stats grid: 4 cards (2×2 mobile, 1×4 desktop)
- Achievement mini-row: 3 plaques (1-column mobile)
- Recent games: 3 cards stack
- Profile form: clean modern inputs
- Danger zone: distinct red-tinted background

---

## Acceptance criteria

1. **1 new imagen asset**: `apps/web/public/game-art/account/account-hero-banner.png` + `.webp`. Wide cinematic banner, no text/letters.
2. **Server-side data**: `page.tsx` fetches `getGameHistoryForUser` + `getAchievementsForUser` and computes `PlayerStats`.
3. **`AccountDashboard`** orchestrates 6 sub-components (Hero, Stats, Achievements, RecentGames, Profile, DataExport, DangerZone).
4. **Cinematic hero banner** with full-width image, avatar overlay (96px circle, amber border), name, member-since, 3 inline quickstats (Games/Wins/%).
5. **Stats grid** (only shown when totalGames > 0): 4 cards (Selski / Threat / Streak / WinRate).
6. **Achievements showcase**: top 3 unlocked plaques + link to `/achievements`. Empty state for new users.
7. **Recent games**: 3 mini case-file cards + link to `/history`. Empty state hidden if no games.
8. **Profile form**: modern input styling (dark surface, amber focus ring, save button right). Email с verified/непотвърден badge — непотвърден badge links to `/verify-email`.
9. **Data export**: clean button, no extra chrome.
10. **Danger zone**: distinctly styled с red-tinted background + accent border. Two-step confirm flow.
11. **Old `.dossier-*` CSS removed**.
12. **Mobile responsive**: hero stack-ва, stats become 2×2 grid, achievements become 1-col, recent games stack.
13. **`pnpm verify` passes**.
14. **All commit messages in English**.
15. **All copy in Bulgarian**.
16. **No new npm dependencies**.

---

## Не пипай

- `/api/account/delete` route — keeps anonymize logic from regression-audit-fixes prompt.
- `/api/account/export` route — separate work.
- `/verify-email` page — separate.
- Better Auth config and session structure.
- Other pages (history/achievements/leaderboard стоят както са).
- `painterly-marketing` системата за other pages.
- Old painterly art `account-dossier.png` — стои in repo.

---

## Verification

```bash
pnpm install
pnpm optimize:assets
pnpm typecheck
pnpm regression
pnpm test
pnpm build
pnpm smoke
pnpm visual:update
pnpm visual
pnpm perf:budget
```

Manual checks:

1. **Anonymous user → `/account`** → redirect to `/sign-in?redirect=/account`. ✓
2. **New user (0 games)**:
   - Hero shows avatar + name + member since
   - Quickstats hidden (replaced with "Първото дело още чака име.")
   - Stats grid hidden (only shows when totalGames > 0)
   - Achievements shows "Заключени са все още."
   - Recent games block hidden (no games)
   - Profile + Data export + Danger zone visible
3. **Logged-in user with games**:
   - Hero shows real numbers
   - All sections visible
   - Achievements shows real unlocked plaques with tier styling
   - Recent games links to `/history/{id}/replay`
4. **Name edit**:
   - Type new name, click Запази → success status, refreshed
   - Empty name → error inline
5. **Email непотвърден badge** → click → navigate to `/verify-email`
6. **Delete account**:
   - Click "Изтрий моя профил" → confirm appears
   - Click "Да, изтрий профила" → API call, success → signOut → redirect to `/`
   - Click "Отказ" → confirm panel disappears
7. **Mobile (390×844)**:
   - Hero stacks vertically (avatar + name above, quickstats below)
   - Stats: 2×2 grid
   - Achievement plaques: 1 column
   - All touch targets ≥ 44px

---

## Commit strategy (14 atomic English commits)

Branch: `feat/account-dashboard-overhaul`

1. `chore(art): generate cinematic banner for account dashboard`
2. `feat(account): server-side stats aggregation helper`
3. `feat(account): AccountHero with cinematic banner and quickstats`
4. `feat(account): AccountStats grid with 4 detail cards`
5. `feat(account): AccountAchievements mini showcase with tier styling`
6. `feat(account): AccountRecentGames with 3 mini case-file cards`
7. `feat(account): AccountProfile with modern inputs and provider list`
8. `feat(account): AccountDataExport and AccountDangerZone separation`
9. `feat(account): orchestrator AccountDashboard replaces AccountClient`
10. `style(account): painterly-marketing card system with amber accents`
11. `chore(css): remove obsolete dossier brass-plaque styles`
12. `feat(account): page.tsx fetches stats, achievements, recent games`
13. `style(account): mobile responsive hero quickstats and stats grid`
14. `chore(visual): regenerate baseline for account dashboard`

PR title: `feat: account page complete overhaul as player profile dashboard`

PR body should:
- Link to before/after screenshots showing visual jump from settings-form-on-brass to cinematic dashboard.
- Note: this is a PRODUCT page now, not a settings page. Treat as analogous to /history or /achievements.
- Reviewer hint: test with a seeded user account that has 5+ games and 3+ unlocked achievements to see full visual state.

---

(End of prompt)
