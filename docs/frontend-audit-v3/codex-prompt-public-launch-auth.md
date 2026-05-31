# Codex prompt — Public launch auth + sign-in redesign

Голяма work item за public launch:
1. **Премахни anonymous mode** — всеки трябва да е логнат за да играе.
2. **Добави Google OAuth** към съществуващите Discord + email/password.
3. **Кинематографичен redesign** на `/sign-in` с painterly background + themed OAuth buttons.
4. **Themed OAuth button surfaces** генерирани с `/imagen` — brass for Google, steel-blue for Discord.
5. **Auth gates** на всеки game route.
6. **GDPR essentials** — cookie banner, privacy template, account deletion endpoint.
7. **Site chrome update** — user avatar dropdown.

---

## Prompt (paste below)

You are working in the **werewolf_mafia** monorepo (pnpm 10 + Turbo, Next.js 16 App Router + React 19 + Tailwind 4, PostgreSQL via Drizzle, Better Auth 1.6). Read `AGENTS.md` first — invariants:
- Всичкият user-facing copy на български.
- Не въвеждай нови npm dependencies (Better Auth + Drizzle вече са там).
- Не пипай game-server, schemas, role-assignment.
- Без accessibility prompts извън стандартните ARIA attributes.

Имаш достъп до `/imagen` (gpt-image-2). Генерирай **3** asset-а. `pnpm optimize:assets` автоматично прави WebP вариантите.

### Контекст

Сайтът е готов за публично пускане. Текущ auth setup (`apps/web/lib/auth.ts`):
- Better Auth с email/password + Discord OAuth.
- Anonymous fallback логика в `apps/web/app/api/game-token/route.ts` (приема `anonymousUserId` + `anonymousDisplayName` и подписва `anon:` prefix token).
- LocalStorage-based anonymous identity в `apps/web/lib/anonymous-player.ts`.

Текущ `/sign-in`: plain `auth-form.tsx` с email/password toggle, без OAuth buttons. Discord е wired само в сървъра, но няма UI бутон.

Anonymous flow trябва да **изчезне напълно** от UI-а. Запази файла `apps/web/lib/anonymous-player.ts` като deprecated stub (export-ите остават, но връщат празни стойности) за back-compat на тестове — но никой компонент не го ползва.

---

## Стъпка 1 — Generate 3 art assets чрез `/imagen`

### Asset #1: Sign-in background (overhead table scene)

**Path:** `apps/web/public/game-art/sign-in-table.png`

**Imagen prompt:**
```
A painterly cinematic overhead photograph of an old wooden table
in candlelight, viewed straight from above. Six playing cards
lie face-down in a loose fan arrangement at the center of the
table, their backs decorated with subtle dark ornament. A single
brass candlestick with a flickering flame sits at the upper left
corner of the frame, casting warm directional light across the
wood grain. A half-empty glass of dark red wine in the lower
right corner. The deep wood grain is visible across the entire
surface, with knots and aged patina. Mood: invitation, ritual,
the moment before a private game begins. Oil-paint style with
visible brushwork, warm amber and ember-red palette, deep
shadow falloff at the edges (natural vignette). No text, no
letters, no numbers, no symbols, no markings on the cards
backs or anywhere else in the image. Aspect ratio 3:4 (vertical
portrait orientation).
```

**Size:** 1280 × 1707 (3:4 vertical).

### Asset #2: Google brass button surface

**Path:** `apps/web/public/game-art/oauth-google-plate.png`

**Imagen prompt:**
```
A close-up photograph of a small horizontal brass plate, polished
with a soft warm golden tone, viewed straight on. The surface is
smooth with very subtle horizontal brush-grain, slight darker
patina at the upper and lower edges, gentle directional highlight
running diagonally across the upper third. Photographic realism.
The entire frame is the brass plate, edge to edge, suitable as
a button background. No text, no letters, no engravings, no
symbols whatsoever anywhere on the surface. Aspect ratio 4:1
(wide horizontal).
```

**Size:** 1024 × 256 (4:1 horizontal).

### Asset #3: Discord steel-blue button surface

**Path:** `apps/web/public/game-art/oauth-discord-plate.png`

**Imagen prompt:**
```
A close-up photograph of a small horizontal metal plate with a
cool steel-blue tone, polished with subtle indigo and slate
undertones, viewed straight on. The surface is smooth with very
subtle horizontal brush-grain, slight darker patina at the upper
and lower edges, gentle directional highlight running diagonally
across the upper third. Photographic realism. The entire frame
is the steel-blue plate, edge to edge, suitable as a button
background. No text, no letters, no engravings, no symbols
whatsoever anywhere on the surface. Aspect ratio 4:1 (wide
horizontal).
```

**Size:** 1024 × 256 (4:1 horizontal).

### След генерация

1. Save и трите PNG в горните пътеки.
2. Стартирай `pnpm optimize:assets` — създава WebP + mobile варианти.
3. Verify:
   ```bash
   ls apps/web/public/game-art/sign-in-table.{png,webp}
   ls apps/web/public/game-art/oauth-google-plate.{png,webp}
   ls apps/web/public/game-art/oauth-discord-plate.{png,webp}
   ```

---

## Стъпка 2 — Better Auth Google integration

### `apps/web/lib/auth.ts`

Добави Google провайдъра в `socialProviders` (по модел на Discord):

```ts
socialProviders: buildSocialProviders(),
```

И extract-вай в helper:

```ts
function buildSocialProviders() {
  const providers: Record<string, unknown> = {};

  if (process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET) {
    providers.discord = {
      clientId: process.env.DISCORD_CLIENT_ID,
      clientSecret: process.env.DISCORD_CLIENT_SECRET,
    };
  }

  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    providers.google = {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    };
  }

  return Object.keys(providers).length > 0 ? providers : undefined;
}
```

### `.env.example` + `.env.local.example`

Добави нови env vars:
```
# OAuth — Google (https://console.cloud.google.com/apis/credentials)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# OAuth — Discord (https://discord.com/developers/applications)
DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=
```

И в `apps/web/lib/env.ts` (ако има env validation) — направи Google client id + secret optional но typed.

### Callback URL за Google

В README-а на проекта (или нов `docs/auth-setup.md`) добави:
- За Google: callback URL е `${BETTER_AUTH_URL}/api/auth/callback/google`
- За Discord: `${BETTER_AUTH_URL}/api/auth/callback/discord`
- Production стойност: `https://<домейн>/api/auth/callback/{provider}`

---

## Стъпка 3 — Remove anonymous flow

### Файлове за изтриване / преписване

1. **`apps/web/lib/anonymous-player.ts`** — направи го deprecated stub:
   ```ts
   // DEPRECATED: anonymous flow беше премахнат за публичното пускане.
   // Файлът остава за back-compat на legacy tests. Не го импортирай в нов код.

   export const ANONYMOUS_USER_ID_KEY = "anonymous-player-id";
   export const ANONYMOUS_DISPLAY_NAME_KEY = "anonymous-display-name";

   export function normalizeDisplayName(value: string) {
     return value.trim().replace(/\s+/g, " ");
   }

   export function validateDisplayNameBg(value: string) {
     const name = normalizeDisplayName(value);
     if (!name) return "Въведи потребителско име.";
     if (name.length < 2) return "Името трябва да е поне 2 символа.";
     if (name.length > 24) return "Името трябва да е до 24 символа.";
     return "";
   }

   export function getOrCreateAnonymousUserId(): string {
     throw new Error("Anonymous flow е премахнат — използвай Better Auth session.");
   }

   export function saveAnonymousIdentity(_displayName: string): { userId: string; displayName: string } {
     throw new Error("Anonymous flow е премахнат — използвай Better Auth session.");
   }

   export function getAnonymousIdentity() {
     return { userId: "", displayName: "" };
   }
   ```

2. **`apps/web/components/games/anonymous-entry-client.tsx`** — пълно преписване като `AuthGatedEntry` компонент:
   ```tsx
   "use client";

   import { useEffect, useState } from "react";
   import { useRouter } from "next/navigation";
   import Link from "next/link";
   import {
     type CommunicationMode, type GameFamily, type GameMode,
     type NarratorMode, type TempoProfile,
   } from "@werewolf/shared";
   import { authClient } from "@/lib/auth-client";

   export function AuthGatedEntry({
     family, mode, initialCode = "",
   }: {
     family: GameFamily; mode: GameMode; initialCode?: string;
   }) {
     const router = useRouter();
     const { data: session, isPending } = authClient.useSession();
     const [roomCode, setRoomCode] = useState(cleanRoomCode(initialCode));
     const [spectator, setSpectator] = useState(false);
     const [error, setError] = useState("");

     const isMafia = family === "mafia";
     const playerCount = mode === "mafia_sport" ? 10 : isMafia ? 10 : 8;
     const tempo: TempoProfile = mode === "mafia_sport" ? "sport_mafia" : "normal_online";
     const communication: CommunicationMode = "built_in_chat";
     const narrator: NarratorMode = "automatic";

     useEffect(() => {
       if (!isPending && !session) {
         const redirect = `${family === "mafia" ? "/mafia" : "/werewolf"}/join${initialCode ? `/${initialCode}` : ""}`;
         router.replace(`/sign-in?redirect=${encodeURIComponent(redirect)}`);
       }
     }, [family, initialCode, isPending, router, session]);

     if (isPending || !session) {
       return <div className="auth-gate-shell"><p>Проверяваме твоя профил…</p></div>;
     }

     function submit() {
       if (!isValidRoomCode(roomCode)) {
         setError("Невалиден код на стая.");
         return;
       }
       setError("");
       const params = new URLSearchParams({
         mode, players: String(playerCount), communication, narrator, tempo,
       });
       if (spectator) params.set("spectator", "1");
       router.push(`/play/${roomCode}?${params.toString()}`);
     }

     return (
       <section className="paper-card join-card rounded-[2rem] p-7" data-theme={family} data-family={family}>
         <p className="section-kicker text-[#842f2b]">влез в стаята</p>
         <h2 className="mt-3 text-4xl font-black">Добре дошъл, {session.user.name ?? "приятел"}.</h2>
         <p className="mt-3 leading-7">Въведи кода на стаята, за да се присъединиш към играта.</p>

         <div className="mt-6 grid gap-4">
           <label className="grid gap-2">
             <span className="text-xs font-black uppercase tracking-[0.25em] text-[#842f2b]">Код на стая</span>
             <input
               className="input"
               value={roomCode}
               maxLength={12}
               onChange={(e) => setRoomCode(cleanRoomCode(e.target.value))}
               placeholder="ABC123"
             />
           </label>
           <label className="flex items-center gap-3 rounded-2xl bg-[#842f2b]/8 p-3 font-bold text-[#4f3829]">
             <input type="checkbox" checked={spectator} onChange={(e) => setSpectator(e.target.checked)} />
             <span>Влез като наблюдател, без да получаваш роля.</span>
           </label>
         </div>

         {error ? <p className="mt-4 rounded-2xl bg-[#842f2b]/10 p-4 font-bold text-[#842f2b]">{error}</p> : null}

         <div className="mt-6 flex flex-wrap gap-3">
           <button className="btn btn-primary" type="button" onClick={submit}>Влез в стая</button>
           <Link className="btn btn-secondary" href={`${family === "mafia" ? "/mafia" : "/werewolf"}/create`}>
             Създай стая
           </Link>
         </div>
       </section>
     );
   }

   function cleanRoomCode(code: string) { return code.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12); }
   function isValidRoomCode(code: string) { return /^[A-Z0-9]{4,12}$/.test(code); }
   ```

   Експорта остава `AnonymousEntryClient` като alias за `AuthGatedEntry` за back-compat в page.tsx файловете — **или** обновявай direct-но page.tsx-ите.

3. **`apps/web/app/api/game-token/route.ts`** — премахни anonymous fallback-а:
   ```ts
   const session = await auth.api.getSession({ headers: await headers() });
   if (!session?.user?.id || !session.user.name) {
     return NextResponse.json({ error: "Трябва да си влязъл за да създадеш token." }, { status: 401 });
   }
   const userId = session.user.id;
   const displayName = session.user.name;
   ```
   Изтрий `body.anonymousUserId` / `body.anonymousDisplayName` parsing-а. Запази `devUserId` fallback **само** ако `allowDevAuth` е true (за local development), но **не** в production.

4. **`apps/web/components/play-room-client.tsx`** — премахни референции към anonymous localStorage. Display name + userId идват от `authClient.useSession()`.

5. **`apps/web/components/achievements-client.tsx`** — premахни `ANONYMOUS_USER_ID_KEY` import; смени към `session.user.id`.

6. **`apps/web/components/lobby/LobbyWizard.tsx`** + **`apps/web/components/lobby/StepRoom.tsx`** — премахни anonymous identity step-а (вече сме логнати). Wizard-ът започва с room name + preset, не с име.

7. **`apps/web/app/friends/page.tsx`** — actualize copy: премахни *"Докато основният flow е anonymous..."* fragment.

### Metadata + copy updates — comprehensive sweep

Премахни **всички** референции към "без акаунт", "без регистрация", "временна идентичност", "влизаш без акаунт" от user-facing copy. Списъкът е exhaustive — не пропускай.

#### Metadata descriptions

| Файл:линия | Старо | Ново |
|---|---|---|
| `apps/web/app/mafia/create/page.tsx:6` | `"Настрой частна маса за Мафия без регистрация."` | `"Настрой частна маса за Мафия с твоя профил."` |
| `apps/web/app/mafia/join/[[...roomCode]]/page.tsx:6` | `"Въведи име и код за частна Мафия стая без регистрация."` | `"Влез с твоя профил и кода за частна Мафия стая."` |
| `apps/web/app/werewolf/create/page.tsx:6` | `"Настрой частно село за Върколак без регистрация."` | `"Настрой частно село за Върколак с твоя профил."` |
| `apps/web/app/werewolf/join/[[...roomCode]]/page.tsx:6` | `"Въведи име и код за частно село във Върколак без регистрация."` | `"Влез с твоя профил и кода за частно село във Върколак."` |
| `apps/web/app/tutorial/page.tsx:7` | `"Кинематографичен наръчник за първа игра без регистрация - една вечер в шест сцени."` | `"Кинематографичен наръчник за първа игра след вход — една вечер в шест сцени."` |
| `apps/web/app/friends/page.tsx:6` | `"Локален списък с хора за следващата стая и бърза покана без акаунт."` | `"Локален списък с хора за следващата стая и бърза покана за следваща игра."` |

#### Page headings & body copy

| Файл:линия | Старо | Ново |
|---|---|---|
| `apps/web/app/friends/page.tsx:14` (h1) | `"Покани групата без акаунти"` | `"Покани групата за следваща маса"` |
| `apps/web/app/friends/page.tsx` (body) | `"Докато основният flow е anonymous, списъкът с приятели е локален помощник..."` | `"Списъкът с приятели е локален помощник: имена, бележки и бърза покана по код."` |
| `apps/web/app/sign-in/page.tsx:19` | `"...играта още поддържа временна идентичност, но истинската маса започва оттук."` | (изтрий цялото изречение; то се замества от cinematic redesign в Стъпка 5) |
| `apps/web/components/games/game-rules-page.tsx:104` | `"Поканата е досие: кодът влиза директно в стаята без регистрация."` | `"Поканата е досие: кодът влиза директно в стаята след вход."` |
| `apps/web/components/landing-experience.tsx:50` | `"...въвеждаш код и започваш без регистрация."` | `"...въвеждаш код и започваш веднага."` |

#### QuickStart sections (homepage + family-home strip)

⚠ Има **два** файла с почти идентичен код. Промени и двата:

| Файл:линия | Старо | Ново |
|---|---|---|
| `apps/web/components/games/QuickStartSection.tsx:33` | `body: "Влизаш без акаунт, само с име за масата."` | `body: "Влизаш с Google, Discord или имейл."` |
| `apps/web/components/games/QuickStartSection.tsx:90` | `"Влез без акаунт, избери стая, играй."` | `"Влез, избери стая, играй."` |
| `apps/web/components/landing/QuickStartSection.tsx:37` | `body: "Влизаш без акаунт, само с име за масата."` | `body: "Влизаш с Google, Discord или имейл."` |
| `apps/web/components/landing/QuickStartSection.tsx:93` | `"Влез без акаунт, избери стая, играй."` | `"Влез, избери стая, играй."` |

**Bonus:** Стъпка 1 на QuickStart-а в момента е "ИМЕ · Влизаш без акаунт..." със `<UserIcon />` иконка. Преименувай я на "ВХОД" с key/login иконка:
- Промени `title` от `"Име"` на `"Вход"`.
- Замени иконата `User` / `UserIcon` на `Key` или `LogIn` — нова inline SVG, която изобразява ключ или входна врата. Спецификация:
  ```tsx
  function KeyIcon({ className }: { className?: string }) {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="8" cy="12" r="3.5" />
        <path d="M11.5 12 L 21 12 M 18 12 L 18 16 M 21 12 L 21 15" />
      </svg>
    );
  }
  ```

#### Section kickers

| Файл:линия | Старо | Ново |
|---|---|---|
| `apps/web/components/games/anonymous-entry-client.tsx:75` | `<p className="section-kicker text-[#842f2b]">без регистрация</p>` | `<p className="section-kicker text-[#842f2b]">влез в стаята</p>` (или премахни — компонентът се преписва на `AuthGatedEntry`) |
| `apps/web/components/play-room-client.tsx:664` | `<p className="section-kicker text-[#842f2b]">без регистрация</p>` | `<p className="section-kicker text-[#842f2b]">влез в стаята</p>` |

#### Final sweep verify

След всички промени стартирай:
```bash
grep -rEn "без акаунт|без регистрация|временна идентичност|играй без|влизаш без|без профил" apps/web/app apps/web/components 2>/dev/null | grep -v ".next" | grep -v "anonymous-player.ts"
```

Резултатът трябва да е **празен** (без `anonymous-player.ts` deprecated stub-а).

### Homepage CTAs

В `apps/web/components/landing/ModeChoiceCards.tsx` + homepage — primary CTA-та трябва да са:
- Ако НЕ е логнат: главен бутон "Влез и играй" → `/sign-in`
- Ако Е логнат: главен бутон "Избери игра" → `/werewolf` / `/mafia`

Не показвай "Играй без акаунт" link никъде.

---

## Стъпка 4 — Auth gates на всеки game route

Добави auth check в server components на:

1. `apps/web/app/werewolf/create/page.tsx`
2. `apps/web/app/mafia/create/page.tsx`
3. `apps/web/app/werewolf/join/[[...roomCode]]/page.tsx` (или нека `AuthGatedEntry` го прави client-side)
4. `apps/web/app/mafia/join/[[...roomCode]]/page.tsx`
5. `apps/web/app/play/[code]/page.tsx`
6. `apps/web/app/lobby/[code]/page.tsx`
7. `apps/web/app/friends/page.tsx`
8. `apps/web/app/achievements/page.tsx` (личните постижения изискват session)

Pattern (server-side):
```tsx
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export default async function CreatePage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect(`/sign-in?redirect=${encodeURIComponent("/werewolf/create")}`);
  }
  return <CreateClient />;
}
```

`/leaderboard` и `/history` могат да останат public (read-only публични статистики).

---

## Стъпка 5 — Sign-in page redesign (cinematic table)

### `apps/web/app/sign-in/page.tsx`

```tsx
import type { Metadata } from "next";
import { Suspense } from "react";
import { SignInStage } from "@/components/sign-in/SignInStage";

export const metadata: Metadata = {
  title: "Влез в стаята | Върколак и Мафия",
  description: "Влез с Google, Discord или имейл за да отвориш частна маса и да пазиш записаните игри.",
};

export default function SignInPage() {
  return (
    <main className="shell sign-in-shell">
      <Suspense fallback={<div className="sign-in-loading">Подреждаме масата…</div>}>
        <SignInStage />
      </Suspense>
    </main>
  );
}
```

### `apps/web/components/sign-in/SignInStage.tsx`

```tsx
"use client";

import { useSearchParams } from "next/navigation";
import { OAuthButton } from "./OAuthButton";
import { EmailPasswordForm } from "./EmailPasswordForm";

export function SignInStage() {
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") ?? "/";

  return (
    <section className="sign-in-stage">
      <div className="sign-in-table" aria-hidden />

      <article className="sign-in-plaque">
        <header className="sign-in-plaque-head">
          <p className="sign-in-kicker">вход на масата</p>
          <h1>Покажи се на масата</h1>
          <p className="sign-in-subtitle">
            Един профил пази историята, статистиките и поканите. Тайните роли остават на сървъра.
          </p>
        </header>

        <div className="sign-in-oauth">
          <OAuthButton provider="google" redirectTo={redirect} />
          <OAuthButton provider="discord" redirectTo={redirect} />
        </div>

        <div className="sign-in-divider" role="separator" aria-label="или с имейл">
          <span>или с имейл</span>
        </div>

        <EmailPasswordForm redirectTo={redirect} />

        <footer className="sign-in-foot">
          <a href="/privacy" className="sign-in-foot-link">Поверителност</a>
          <span aria-hidden>·</span>
          <a href="/terms" className="sign-in-foot-link">Условия</a>
        </footer>
      </article>
    </section>
  );
}
```

### `apps/web/components/sign-in/OAuthButton.tsx`

```tsx
"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";

interface Props {
  provider: "google" | "discord";
  redirectTo: string;
}

const CONFIG = {
  google: {
    label: "Продължи с Google",
    plate: "/game-art/oauth-google-plate.webp",
    fallback: "/game-art/oauth-google-plate.png",
    accent: "warm",
  },
  discord: {
    label: "Продължи с Discord",
    plate: "/game-art/oauth-discord-plate.webp",
    fallback: "/game-art/oauth-discord-plate.png",
    accent: "cool",
  },
} as const;

export function OAuthButton({ provider, redirectTo }: Props) {
  const [isPending, setPending] = useState(false);
  const config = CONFIG[provider];

  async function start() {
    setPending(true);
    try {
      await authClient.signIn.social({
        provider,
        callbackURL: redirectTo,
      });
    } catch (error) {
      console.error(`[oauth:${provider}]`, error);
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      className="oauth-button"
      data-provider={provider}
      data-accent={config.accent}
      onClick={start}
      disabled={isPending}
      aria-label={config.label}
    >
      <span className="oauth-button-logo" aria-hidden>
        {provider === "google" ? <GoogleG /> : <DiscordMark />}
      </span>
      <span className="oauth-button-label">{config.label}</span>
      {isPending ? <span className="oauth-button-spinner" aria-hidden /> : null}
    </button>
  );
}

function GoogleG() {
  // Official Google G logo, multicolor, SVG. Royalty-free for OAuth UI.
  return (
    <svg viewBox="0 0 48 48" width="24" height="24">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.5-5.2l-6.2-5.2c-2 1.4-4.5 2.4-7.3 2.4-5.2 0-9.6-3.3-11.2-7.9l-6.5 5C9.6 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.6l6.2 5.2C41.4 35.7 44 30.3 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

function DiscordMark() {
  // Official Discord mark, simplified SVG.
  return (
    <svg viewBox="0 0 71 55" width="28" height="22" fill="#fff">
      <path d="M60.1 4.9A58.5 58.5 0 0 0 45.7.5l-.6 1.3a52.7 52.7 0 0 1 11.7 4.4 41.2 41.2 0 0 0-31.9-2.4 41.9 41.9 0 0 0-9.7 4.4A52 52 0 0 1 27 .5L26.4.5A58.5 58.5 0 0 0 12 4.9 60.5 60.5 0 0 0 .5 45.3a59 59 0 0 0 18 9 43.6 43.6 0 0 0 3.8-6.2A38.5 38.5 0 0 1 16 45a30.7 30.7 0 0 0 1.5-1.2 41.5 41.5 0 0 0 35.6 0 30.7 30.7 0 0 0 1.5 1.2 38.5 38.5 0 0 1-6.3 3.1c1.2 2.2 2.5 4.3 3.8 6.2a59 59 0 0 0 18-9 60.5 60.5 0 0 0-11.5-40.4ZM23.7 36.6c-3.6 0-6.5-3.3-6.5-7.3s2.9-7.3 6.5-7.3 6.5 3.3 6.5 7.3-2.9 7.3-6.5 7.3Zm23.6 0c-3.6 0-6.5-3.3-6.5-7.3s2.9-7.3 6.5-7.3 6.5 3.3 6.5 7.3-2.9 7.3-6.5 7.3Z" />
    </svg>
  );
}
```

### `apps/web/components/sign-in/EmailPasswordForm.tsx`

Преписан вариант на текущия `auth-form.tsx`, но secondary visual (не primary). Запази email/password + register toggle + redirect-after-success logic с `redirectTo` prop.

```tsx
"use client";

import { FormEvent, useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

type Mode = "sign-in" | "sign-up";

export function EmailPasswordForm({ redirectTo }: { redirectTo: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("sign-in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [isPending, startTransition] = useTransition();

  const nameId = useId();
  const emailId = useId();
  const passwordId = useId();
  const statusId = useId();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("");

    const action =
      mode === "sign-in"
        ? authClient.signIn.email({ email, password })
        : authClient.signUp.email({ name: name || email, email, password });

    const result = await action;
    if (result.error) {
      setStatus(result.error.message ?? "Неуспешна заявка.");
      return;
    }

    startTransition(() => router.push(redirectTo));
  }

  return (
    <form className="email-form" onSubmit={submit}>
      <div className="email-form-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "sign-in"}
          className={mode === "sign-in" ? "is-active" : ""}
          onClick={() => setMode("sign-in")}
        >
          Имам профил
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "sign-up"}
          className={mode === "sign-up" ? "is-active" : ""}
          onClick={() => setMode("sign-up")}
        >
          Нов профил
        </button>
      </div>

      {mode === "sign-up" ? (
        <label htmlFor={nameId}>
          <span>Име на масата</span>
          <input
            id={nameId}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Например: Мила"
            autoComplete="name"
          />
        </label>
      ) : null}

      <label htmlFor={emailId}>
        <span>Имейл</span>
        <input
          id={emailId}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="example@domain.com"
          autoComplete="email"
          required
        />
      </label>

      <label htmlFor={passwordId}>
        <span>Парола</span>
        <input
          id={passwordId}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Поне 8 символа"
          minLength={8}
          autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
          aria-describedby={status ? statusId : undefined}
          required
        />
      </label>

      {status ? (
        <p id={statusId} role="alert" className="email-form-status">{status}</p>
      ) : null}

      <button className="btn btn-primary email-form-submit" type="submit" disabled={isPending}>
        {mode === "sign-in" ? "Влез" : "Създай профил"}
      </button>

      {mode === "sign-in" ? (
        <a href="/forgot-password" className="email-form-forgot">Забравена парола?</a>
      ) : null}
    </form>
  );
}
```

### CSS — `apps/web/app/globals.css`

```css
/* ============================== */
/* Sign-in stage                  */
/* ============================== */

.sign-in-shell {
  display: grid;
  place-items: center;
  padding: 32px 16px;
  min-height: 100vh;
}

.sign-in-stage {
  position: relative;
  display: grid;
  place-items: center;
  width: 100%;
  max-width: 1200px;
  min-height: 760px;
  padding: 24px;
}

.sign-in-table {
  position: absolute;
  inset: 0;
  border-radius: 32px;
  background-image:
    radial-gradient(ellipse 80% 60% at center, rgba(0,0,0,0) 30%, rgba(0,0,0,0.65) 100%),
    image-set(
      url("/game-art/sign-in-table.webp") type("image/webp"),
      url("/game-art/sign-in-table.png") type("image/png")
    );
  background-size: cover;
  background-position: center;
  box-shadow: 0 30px 60px rgba(0,0,0,0.6);
  z-index: 0;
}

.sign-in-plaque {
  position: relative;
  z-index: 1;
  max-width: 480px;
  width: 100%;
  padding: 36px 32px;
  background-color: #f0e0c4;
  background-image:
    linear-gradient(155deg, rgba(255,250,238,0.85), rgba(238,222,196,0.7)),
    image-set(
      url("/game-art/textures/brass-plate.webp") type("image/webp"),
      url("/game-art/textures/brass-plate.png") type("image/png")
    );
  background-size: cover;
  background-blend-mode: normal, multiply;
  color: #1a1410;
  border-radius: 14px;
  box-shadow:
    inset 0 0 0 1px rgba(255, 240, 200, 0.55),
    inset 0 0 0 5px rgba(50, 30, 10, 0.55),
    inset 0 0 0 7px rgba(255, 240, 200, 0.55),
    0 20px 50px rgba(0, 0, 0, 0.55);
}

.sign-in-plaque-head h1 {
  font-family: "Noto Serif Display", "Noto Serif", serif;
  font-size: clamp(2rem, 4vw, 2.75rem);
  font-weight: 900;
  letter-spacing: -0.01em;
  line-height: 1.05;
  color: #1a1410;
  text-shadow:
    0 1px 0 rgba(255, 240, 200, 0.4),
    0 -1px 0 rgba(50, 30, 10, 0.4);
  margin-top: 8px;
}

.sign-in-kicker {
  font-size: 0.72rem;
  letter-spacing: 0.32em;
  text-transform: uppercase;
  font-weight: 700;
  color: #842f2b;
}

.sign-in-subtitle {
  margin-top: 12px;
  font-size: 0.95rem;
  line-height: 1.55;
  color: rgba(26, 20, 16, 0.8);
}

.sign-in-oauth {
  display: grid;
  gap: 10px;
  margin: 24px 0 18px;
}

/* OAuth button */

.oauth-button {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 12px 18px;
  border: 1px solid rgba(50, 30, 10, 0.5);
  border-radius: 10px;
  font-family: "Noto Serif", serif;
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: 0.03em;
  color: #1a1410;
  cursor: pointer;
  transition: transform 160ms ease, box-shadow 160ms ease, filter 160ms ease;
  background-size: cover;
  background-position: center;
  background-blend-mode: multiply;
  text-shadow: 0 1px 0 rgba(255, 240, 200, 0.45);
  box-shadow:
    inset 0 1px 0 rgba(255, 240, 200, 0.55),
    inset 0 -1px 0 rgba(50, 30, 10, 0.4),
    0 6px 14px rgba(0, 0, 0, 0.4);
}

.oauth-button[data-provider="google"] {
  background-color: #c8a366;
  background-image:
    linear-gradient(155deg, rgba(255,250,238,0.45), rgba(238,222,196,0.3)),
    image-set(
      url("/game-art/oauth-google-plate.webp") type("image/webp"),
      url("/game-art/oauth-google-plate.png") type("image/png")
    );
}

.oauth-button[data-provider="discord"] {
  background-color: #5865f2;
  background-image:
    linear-gradient(155deg, rgba(220,230,255,0.35), rgba(60,80,150,0.2)),
    image-set(
      url("/game-art/oauth-discord-plate.webp") type("image/webp"),
      url("/game-art/oauth-discord-plate.png") type("image/png")
    );
  color: #f5f6ff;
  text-shadow: 0 1px 0 rgba(20, 30, 80, 0.6);
}

.oauth-button:hover {
  transform: translateY(-1px);
  box-shadow:
    inset 0 1px 0 rgba(255, 240, 200, 0.6),
    inset 0 -1px 0 rgba(50, 30, 10, 0.5),
    0 10px 22px rgba(0, 0, 0, 0.5);
}

.oauth-button:disabled {
  filter: grayscale(0.3) brightness(0.85);
  cursor: wait;
}

.oauth-button-logo {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  flex-shrink: 0;
}

.oauth-button-label {
  flex: 1;
  text-align: left;
}

.oauth-button-spinner {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid rgba(255,255,255,0.4);
  border-top-color: currentColor;
  animation: oauth-spin 720ms linear infinite;
}

@keyframes oauth-spin {
  to { transform: rotate(360deg); }
}

/* Divider */

.sign-in-divider {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 12px;
  margin: 18px 0;
  font-size: 0.75rem;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: rgba(26, 20, 16, 0.55);
  font-weight: 700;
}

.sign-in-divider::before,
.sign-in-divider::after {
  content: "";
  height: 1px;
  background: rgba(50, 30, 10, 0.35);
}

/* Email form */

.email-form {
  display: grid;
  gap: 12px;
}

.email-form-tabs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px;
  padding: 4px;
  background: rgba(50, 30, 10, 0.1);
  border-radius: 10px;
}

.email-form-tabs button {
  padding: 8px;
  border: none;
  background: transparent;
  font-weight: 700;
  font-size: 0.85rem;
  cursor: pointer;
  border-radius: 8px;
  color: rgba(26, 20, 16, 0.7);
  transition: background 120ms ease, color 120ms ease;
}

.email-form-tabs button.is-active {
  background: #842f2b;
  color: #fff5e0;
}

.email-form label {
  display: grid;
  gap: 4px;
}

.email-form label > span {
  font-size: 0.7rem;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  font-weight: 700;
  color: rgba(132, 47, 43, 0.85);
}

.email-form input {
  padding: 10px 14px;
  border: 1px solid rgba(50, 30, 10, 0.35);
  border-radius: 8px;
  background: rgba(255, 250, 238, 0.8);
  font-size: 1rem;
  color: #1a1410;
}

.email-form-status {
  padding: 10px 14px;
  background: rgba(132, 47, 43, 0.12);
  color: #842f2b;
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 700;
}

.email-form-submit {
  margin-top: 8px;
}

.email-form-forgot {
  display: inline-block;
  margin-top: 4px;
  font-size: 0.8rem;
  color: #842f2b;
  text-decoration: underline;
}

/* Foot */

.sign-in-foot {
  display: flex;
  gap: 10px;
  justify-content: center;
  margin-top: 20px;
  font-size: 0.75rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: rgba(26, 20, 16, 0.55);
}

.sign-in-foot-link {
  color: rgba(26, 20, 16, 0.7);
  text-decoration: underline;
  text-underline-offset: 3px;
}

/* Responsive */

@media (max-width: 640px) {
  .sign-in-stage {
    min-height: 100vh;
    padding: 16px;
  }
  .sign-in-table {
    border-radius: 16px;
  }
  .sign-in-plaque {
    padding: 28px 22px;
  }
}
```

---

## Стъпка 6 — Navbar login chip + user menu

Целта: входът да е **visible и emphatic** в navbar-а, не скрит зад "..." overflow. Brass-styled pill, който се чете като част от UI-а, не като прикачен link.

### Текущо състояние

`apps/web/components/site-chrome.tsx` има:
- `SECONDARY_LINKS` array (ред 16-23) — съдържа `{ href: "/sign-in", label: "Вход" }` като последен item. **Махни го оттук** — той ще стане primary navbar element.
- `PrimaryBand` (ред 223-263): "Играй" CTA + family switcher + dots dropdown.
- `UtilityCluster` (ред 273-294): Sound icon + Theme icon, right-aligned.
- `MobileDrawer` (ред 296-343): hamburger menu за mobile.

### Нов layout на navbar

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ [☰] [Brand]  [▶ Играй] [Върколак | Мафия] [⋯]      [🔊] [☾] ║ [Влез →]      │
└──────────────────────────────────────────────────────────────────────────────┘
                                                              ↑ visual separator
                                                                + brass login chip
```

Когато потребителят е логнат, brass chip-ът се заменя с user avatar dropdown:

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ [☰] [Brand]  [▶ Играй] [Върколак | Мафия] [⋯]      [🔊] [☾] ║ [👤 Ани ▾]    │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Нов компонент `apps/web/components/site-chrome/AuthChip.tsx`

```tsx
"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function AuthChip() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (ref.current?.contains(event.target as Node)) return;
      setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (isPending) {
    return <span className="auth-chip auth-chip-loading" aria-hidden />;
  }

  if (!session) {
    return (
      <Link href="/sign-in" className="auth-chip auth-chip-signin" prefetch={false}>
        <span className="auth-chip-text">Влез</span>
        <span className="auth-chip-arrow" aria-hidden>→</span>
      </Link>
    );
  }

  const displayName = session.user.name ?? "Играч";
  const avatarUrl = session.user.image ?? "";
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <div className="auth-chip auth-chip-avatar" ref={ref}>
      <button
        type="button"
        className="auth-chip-trigger"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={`Меню на ${displayName}`}
      >
        <span className="auth-chip-photo" aria-hidden>
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="" />
          ) : (
            <span className="auth-chip-initial">{initial}</span>
          )}
        </span>
        <span className="auth-chip-name">{displayName}</span>
        <span className="auth-chip-chevron" aria-hidden>▾</span>
      </button>

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
            onClick={async () => {
              setOpen(false);
              await authClient.signOut();
              router.push("/");
              router.refresh();
            }}
          >
            Изход
          </button>
        </div>
      ) : null}
    </div>
  );
}
```

### Промени в `apps/web/components/site-chrome.tsx`

1. **Премахни** `/sign-in` от `SECONDARY_LINKS` (ред 22). DRAWER_LINKS spread-ва SECONDARY_LINKS — login-а вече ще е отделен.

2. **Импортирай** `AuthChip` от новия файл.

3. **В `UtilityCluster` функцията** добави visual separator + AuthChip след theme icon:
   ```tsx
   function UtilityCluster({ soundEnabled, themePreference, onToggleSound, onCycleTheme }: ...) {
     return (
       <div className="site-utility-cluster" aria-label="Настройки">
         <button className="site-icon-button" type="button" aria-label={soundEnabled ? "Звук включен" : "Звук изключен"} onClick={onToggleSound}>
           {soundEnabled ? <SpeakerWaveIcon /> : <SpeakerXIcon />}
         </button>
         <button className="site-icon-button" type="button" aria-label={themeLabel(themePreference)} onClick={onCycleTheme}>
           <ThemeIcon preference={themePreference} />
         </button>
         <span className="site-utility-separator" aria-hidden />
         <AuthChip />
       </div>
     );
   }
   ```

4. **В `MobileDrawer`** добави AuthChip в footer-а (под utility cluster), за да е достъпен и от мобилно menu:
   ```tsx
   <div className="site-drawer-footer">
     <UtilityCluster ... />
     <div className="site-drawer-auth">
       <AuthChip />
     </div>
   </div>
   ```

### CSS — brass login chip

В `apps/web/app/globals.css` добави:

```css
/* ============================== */
/* Auth chip in navbar            */
/* ============================== */

.site-utility-separator {
  display: inline-block;
  width: 1px;
  height: 22px;
  background: linear-gradient(180deg, transparent, rgba(255, 240, 200, 0.35), transparent);
  margin: 0 4px;
}

.auth-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 36px;
  padding: 0 14px;
  border-radius: 999px;
  font-family: "Noto Serif", serif;
  font-size: 0.875rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-decoration: none;
  cursor: pointer;
  transition: transform 160ms ease, box-shadow 160ms ease, filter 160ms ease;
  background-color: #c8a366;
  background-image:
    linear-gradient(155deg, rgba(255, 250, 238, 0.45), rgba(238, 222, 196, 0.25)),
    image-set(
      url("/game-art/textures/brass-plate.webp") type("image/webp"),
      url("/game-art/textures/brass-plate.png") type("image/png")
    );
  background-size: cover;
  background-position: center;
  background-blend-mode: multiply;
  color: #1a1410;
  border: 1px solid rgba(50, 30, 10, 0.5);
  box-shadow:
    inset 0 1px 0 rgba(255, 240, 200, 0.55),
    inset 0 -1px 0 rgba(50, 30, 10, 0.4),
    0 4px 10px rgba(0, 0, 0, 0.35);
  text-shadow: 0 1px 0 rgba(255, 240, 200, 0.45);
}

.auth-chip:hover {
  transform: translateY(-1px);
  box-shadow:
    inset 0 1px 0 rgba(255, 240, 200, 0.6),
    inset 0 -1px 0 rgba(50, 30, 10, 0.5),
    0 6px 14px rgba(0, 0, 0, 0.45);
}

/* Signed-out variant */

.auth-chip-signin {
  /* Inherits base brass styling */
}

.auth-chip-arrow {
  font-size: 0.9rem;
  font-weight: 900;
  color: #842f2b;
  transition: transform 160ms ease;
}

.auth-chip-signin:hover .auth-chip-arrow {
  transform: translateX(2px);
}

/* Loading skeleton */

.auth-chip-loading {
  width: 64px;
  opacity: 0.45;
  pointer-events: none;
  background-image: none;
  background-color: rgba(132, 47, 43, 0.18);
}

/* Avatar variant */

.auth-chip-avatar {
  position: relative;
  padding: 0;
  background: none;
  border: none;
  box-shadow: none;
}

.auth-chip-avatar:hover {
  transform: none;
  box-shadow: none;
}

.auth-chip-trigger {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 36px;
  padding: 0 12px 0 4px;
  border-radius: 999px;
  font-family: "Noto Serif", serif;
  font-size: 0.875rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  cursor: pointer;
  background-color: #c8a366;
  background-image:
    linear-gradient(155deg, rgba(255, 250, 238, 0.45), rgba(238, 222, 196, 0.25)),
    image-set(
      url("/game-art/textures/brass-plate.webp") type("image/webp"),
      url("/game-art/textures/brass-plate.png") type("image/png")
    );
  background-size: cover;
  background-blend-mode: multiply;
  color: #1a1410;
  border: 1px solid rgba(50, 30, 10, 0.5);
  box-shadow:
    inset 0 1px 0 rgba(255, 240, 200, 0.55),
    inset 0 -1px 0 rgba(50, 30, 10, 0.4),
    0 4px 10px rgba(0, 0, 0, 0.35);
  text-shadow: 0 1px 0 rgba(255, 240, 200, 0.45);
  transition: transform 160ms ease, box-shadow 160ms ease;
}

.auth-chip-trigger:hover {
  transform: translateY(-1px);
}

.auth-chip-photo {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: rgba(50, 30, 10, 0.6);
  border: 1px solid rgba(255, 240, 200, 0.5);
  overflow: hidden;
  flex-shrink: 0;
}

.auth-chip-photo img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.auth-chip-initial {
  font-family: "Noto Serif Display", "Noto Serif", serif;
  font-size: 0.95rem;
  font-weight: 900;
  color: #fff5e0;
  text-shadow: 0 1px 1px rgba(0, 0, 0, 0.5);
}

.auth-chip-name {
  max-width: 96px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.auth-chip-chevron {
  font-size: 0.7rem;
  color: rgba(26, 20, 16, 0.7);
  transition: transform 160ms ease;
}

.auth-chip-trigger[aria-expanded="true"] .auth-chip-chevron {
  transform: rotate(180deg);
}

/* Dropdown */

.auth-chip-dropdown {
  position: absolute;
  right: 0;
  top: calc(100% + 8px);
  min-width: 200px;
  display: grid;
  gap: 2px;
  padding: 10px;
  z-index: 50;
}

.auth-chip-dropdown a,
.auth-chip-dropdown button {
  display: block;
  width: 100%;
  text-align: left;
  padding: 10px 12px;
  border-radius: 8px;
  font-weight: 700;
  font-size: 0.9rem;
  color: #1a1410;
  text-decoration: none;
  background: transparent;
  border: none;
  cursor: pointer;
  transition: background 120ms ease, color 120ms ease;
}

.auth-chip-dropdown a:hover,
.auth-chip-dropdown button:hover {
  background: rgba(132, 47, 43, 0.12);
  color: #842f2b;
}

.auth-chip-divider {
  height: 1px;
  margin: 4px 6px;
  background: rgba(50, 30, 10, 0.18);
}

.auth-chip-signout {
  color: #842f2b !important;
}

/* Mobile drawer auth */

.site-drawer-auth {
  display: grid;
  place-items: center;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid rgba(255, 240, 200, 0.18);
}

@media (max-width: 768px) {
  /* На mobile ширината е тясна — скриваме името, показваме само avatar + chevron */
  .auth-chip-name {
    display: none;
  }
  .auth-chip-trigger {
    padding: 0 8px 0 4px;
  }
}

@media (max-width: 480px) {
  /* На много малки екрани AuthChip се скрива от utility cluster — остава само в drawer-а */
  .site-utility-cluster .auth-chip,
  .site-utility-cluster .auth-chip-avatar,
  .site-utility-cluster .site-utility-separator {
    display: none;
  }
}
```

### Server-side SSR (опционално оптимизация)

За да не "мига" navbar-ът между unauth и auth state на първи render, можеш да създадеш server component wrapper, който прочита session-а server-side и passes до client-side `AuthChip` като initial hint:

```tsx
// apps/web/components/site-chrome/AuthChipShell.tsx (server component)
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { AuthChip } from "./AuthChip";

export async function AuthChipShell() {
  const session = await auth.api.getSession({ headers: await headers() });
  return <AuthChip initialSession={session} />;
}
```

И в `AuthChip` приемай `initialSession` prop и hydrate-вай `authClient.useSession()`-а с него. Това е nice-to-have polish, **не задължително** за този PR — оставяме fallback на `auth-chip-loading` skeleton, който вече покрива race-а.

---

## Стъпка 7 — GDPR essentials

### Privacy policy + Terms

Създай нови страници:

1. `apps/web/app/privacy/page.tsx` — БГ-only privacy policy:
   - Какво се събира: имейл, име, OAuth provider id, статистики на игри.
   - Защо: за account, save state, leaderboard.
   - С кого се споделя: никой трети party.
   - Cookies: само auth/session cookies, без tracking.
   - Account deletion: link към `/account/delete`.

2. `apps/web/app/terms/page.tsx` — БГ-only terms of service:
   - Възраст 13+.
   - No abuse.
   - Service-as-is disclaimer.

Body copy може да е placeholder ("Нашата политика е..." + точка по точка) — user-ът ще го uplodanе по-късно с реален legal text. Важно е страниците **да съществуват** и да са linked-нати от footer + sign-in foot.

### Cookie banner

Нов компонент `apps/web/components/CookieBanner.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const STORAGE_KEY = "cookie-consent";

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!window.localStorage.getItem(STORAGE_KEY)) {
      setVisible(true);
    }
  }, []);

  function accept() {
    window.localStorage.setItem(STORAGE_KEY, "1");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <aside className="cookie-banner" role="dialog" aria-label="Бисквитки">
      <p>
        Използваме само необходими бисквитки за вход и сесия. Прочети{" "}
        <Link href="/privacy">политиката за поверителност</Link>.
      </p>
      <button type="button" className="btn btn-primary" onClick={accept}>
        Разбрах
      </button>
    </aside>
  );
}
```

Mount-ни го в `apps/web/app/layout.tsx` (или site chrome).

### Account deletion endpoint

Нов API route `apps/web/app/api/account/delete/route.ts`:

```ts
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export async function POST() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Не си влязъл." }, { status: 401 });
  }

  // Better Auth не expose-ва delete на user директно — викай delete на user record + sessions.
  // Виж Better Auth docs за актуалния API; ако няма native, виж packages/database да изтрием
  // user-а + cascade на свързани records.

  try {
    await auth.api.deleteUser?.({
      headers: await headers(),
      body: { userId: session.user.id },
    });
  } catch (error) {
    console.error("[account-delete]", error);
    return NextResponse.json({ error: "Не успяхме да изтрием профила." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
```

(Codex: ако Better Auth няма `deleteUser` API в текущата версия, проверете `packages/database/src/queries.ts` за helper или go directly to `db.delete(users).where(eq(users.id, session.user.id))`.)

Прост account page `apps/web/app/account/page.tsx`:

```tsx
// Auth-gated. Показва: avatar, име, имейл, "Изтрий профила" с confirmation.
```

---

## Допълнителни предложения (priority order)

### Critical for public launch
1. **Welcome screen** за first-time user — след първи вход редирект към `/tutorial?welcome=1` ако не е виждал tutorial-а (`tutorial-completed` localStorage не е set).
2. **Forgot password flow** — `/forgot-password` страница + `/reset-password?token=...` страница. Better Auth supports `requestPasswordReset` и `resetPassword`.
3. **Email verification** — изисквай verified email за email/password registrations. Better Auth supports `requireEmailVerification: true`. Add `/verify-email?token=...` страница.
4. **Rate limiting на login** — Better Auth supports `rateLimit` config. Set 5 attempts per 5 min.
5. **OAuth error page** — `/sign-in/error?provider=google&reason=cancelled` — friendly error копи на БГ ("Прекъсна входа през Google. Опитай отново или с имейл.").

### Nice to have post-launch
6. **Account settings page** — promo username, change password, change email, delete account.
7. **Anonymous → registered migration** — при първи вход, ако в localStorage има `tutorial-last-slide` или други hints, attach old game history records to новия account by displayName match.
8. **Multi-session management** — "Виж активни сесии" + "Излез от всички устройства".
9. **2FA / passkeys** — за power users.
10. **Discord guild detection** — ако user влиза през Discord и е в дадена guild, auto-show "Започни стая за guild X" CTA.

### Beta-period polish
11. **"Beta" badge** в site chrome за първите 2-4 седмици.
12. **Feedback widget** — fixed bottom-right icon → /feedback page или email мейлто.
13. **Status page** — `/status` показва game-server health.

---

## Acceptance criteria

1. **Generated assets** (3 файла) съществуват + WebP вариантите.
2. **Better Auth** има Google провайдъра wired + env vars в `.env.example`.
3. **Anonymous flow** напълно изчезнал от UI:
   - `anonymous-entry-client.tsx` преписан като `AuthGatedEntry`.
   - `play-room-client.tsx`, `lobby/*`, `achievements-client.tsx`, `friends/page.tsx` не четат `localStorage.anonymous-*`.
   - `api/game-token/route.ts` изисква session, не приема `anonymousUserId`.
   - Всички "без регистрация" copy strings обновени.
4. **Auth gates** работят на: `/werewolf/{create,join,join/CODE}`, `/mafia/{create,join,join/CODE}`, `/play/[code]`, `/lobby/[code]`, `/friends`, `/achievements`.
   - Unauthenticated → redirect to `/sign-in?redirect=<original>`.
5. **Sign-in page**:
   - Cinematic overhead table background.
   - Brass plaque с form.
   - 2 OAuth бутони с themed brass/steel surfaces.
   - Email/password tabs (Имам профил / Нов профил).
   - Foot links: Поверителност · Условия.
   - "Назад към началото" link премахнат (нямa anonymous fallback).
6. **Site chrome — navbar login chip**:
   - `/sign-in` link е **премахнат** от `SECONDARY_LINKS` (dots dropdown).
   - В `UtilityCluster` след theme icon има visual separator + brass `AuthChip`.
   - Когато НЕ е логнат: brass pill "Влез →" видим в navbar-а.
   - Когато Е логнат: brass pill с avatar (Google/Discord image или initial fallback) + име + chevron.
   - Click на avatar: dropdown с Моят профил / История / Постижения / Изход.
   - На mobile <768px: името се скрива, остава avatar + chevron.
   - На <480px: chip се скрива от utility cluster, остава само в drawer footer.
   - Mobile drawer footer показва `<AuthChip />` под utility cluster.
7. **GDPR**:
   - `/privacy` + `/terms` страници съществуват (placeholder copy OK).
   - CookieBanner компонентът mount-нат на layout-а.
   - `/api/account/delete` endpoint работи.
   - `/account` страница показва delete button.
8. **БГ-only copy** — никакви Latin words.
9. **Никакви нови npm dependencies**.
10. `pnpm regression` + `pnpm typecheck` + `pnpm build` минават.
11. Screenshot-ите в `audit-v3/after/auth/`:
    - `/sign-in` desktop + mobile.
    - `/account` desktop.
    - Homepage за unauth + auth state.

---

## Не пипай

- Game-server / schemas / role-assignment.
- `packages/shared` core types (освен ако ChatGPT-2 препоръчва).
- `packages/database` schema (account/user tables идват от Better Auth migrations).
- Без нови npm dependencies (Better Auth Google провайдъра е в base package).

---

## Verification

1. Setup local Google OAuth:
   - Иди на https://console.cloud.google.com/apis/credentials
   - Create OAuth 2.0 Client ID, тип Web Application.
   - Authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
   - Copy client id + secret в `.env.local`.
2. `pnpm optimize:assets` — pass.
3. `pnpm regression` — pass.
4. `pnpm typecheck` — pass.
5. `pnpm build` — pass.
6. Manual test:
   - Sign in with Google → lands on `/` авторизиран.
   - Sign in with Discord → lands on `/` авторизиран.
   - Email + password registration → email arrives (or stub for now).
   - Try /werewolf/create без login → redirects to `/sign-in?redirect=/werewolf/create`.
   - Sign in → returns to `/werewolf/create`.
   - Cookie banner appears for new visitor, disappears after accept.
   - `/account` → "Изтрий профила" → confirm → user deleted, redirected to `/`.
7. Playwright screenshots в `audit-v3/after/auth/`.

---

## Commit strategy

Препоръчителни commits на нов клон `feat/public-launch-auth`:

All commit messages must be in English (project convention).

1. `chore(art): generated sign-in table + OAuth button surfaces`
2. `feat(auth): add Google provider to Better Auth`
3. `feat(auth): remove anonymous flow from UI components`
4. `feat(auth): auth gates on /create, /join, /play, /lobby, /friends, /achievements`
5. `feat(auth): /api/game-token requires session, not anonymous identity`
6. `feat(sign-in): cinematic table redesign + themed OAuth buttons`
7. `feat(site-chrome): brass AuthChip in navbar with user dropdown`
8. `feat(gdpr): /privacy + /terms + CookieBanner + /account/delete`
9. `chore(copy): replace "без регистрация" with "с твоя профил" across UI`
10. `chore(auth): screenshot baseline in audit-v3/after/auth/`

PR title: `feat: public launch auth — Google + Discord + redesigned sign-in, anonymous mode removed`.

---

(End of prompt)
