# Codex prompt — Pre-launch "everything else" (без TTS)

Цялостно пре-launch finalization PR: OAuth official assets swap, email infrastructure (Resend), forgot password / email verification flows, GDPR pages с реален БГ legal draft, account settings UI, welcome onboarding, beta badge, feedback widget, status page. **Всяка нова страница е cinematic с уникален generated art**.

8 нови imagen assets, ~16 atomic commits. **TTS изключено по изричен избор** — ще е отделен PR.

---

## Prompt (paste below)

You are working in the **werewolf_mafia** monorepo (pnpm 10 + Turbo, Next.js 16 App Router + React 19 + Tailwind 4, Colyseus 0.17, PostgreSQL + Drizzle, Better Auth 1.6). Read `AGENTS.md`, `CLAUDE.md`, `docs/audio-narrator-plan.md` first.

Invariants:
- All commit messages in **English** (project convention).
- All user-facing copy in **Bulgarian** Cyrillic. Exception: OAuth provider names "Google" and "Discord" (brand names, intentional).
- Minimal new npm dependencies — only **`resend`** is justified below; nothing else.
- Use `/imagen` (gpt-image-2) for 8 new art assets. `pnpm optimize:assets` produces WebP variants.
- Each new page must be **visually unique** — distinct theme per page, no reused layouts.
- Work on branch `feat/pre-launch-everything`.
- Each stage = atomic commit(s) per the strategy section at the end.

### Pre-locked product decisions (no Codex clarifying questions needed)

- **Email provider**: Resend (`resend` npm package, $0 free tier sufficient for launch).
- **Email verification**: required from start (`requireEmailVerification: true` in Better Auth).
- **GDPR legal text**: realistic Bulgarian draft, lawyer-reviewable. Not Lorem placeholder.
- **Beta badge**: visible during launch window, env-toggleable.
- **Feedback widget**: floating button, route to `/api/feedback`, delivers via Resend email to operator + optional Discord webhook.
- **Status page**: simple service health view (web + game-server + DB + OAuth providers).
- **Analytics**: intentionally out of scope; separate PR later.

---

## Stage 1 — Generate 8 art assets via `/imagen`

All assets target `apps/web/public/game-art/`. Each prompt explicitly forbids text/letters/symbols (overlay copy in HTML). After all 8 are generated, run `pnpm optimize:assets`.

### Asset 1: Forgot password — "Locksmith"

**Path:** `apps/web/public/game-art/auth/forgot-password-locksmith.png`

```
A painterly cinematic photograph of a pair of weathered hands
gently holding a single brass key above a candlelit oak workbench.
Several other unfinished brass keys lie scattered nearby alongside
small craftsman's files and a tiny mortar. Soft directional
candlelight from the upper right, warm amber tones throughout,
deep shadows at the edges. Mood: patience, careful craftsmanship,
the quiet moment before remaking what was lost. Oil-paint style
with visible brushwork, vignetted corners. No text, no letters,
no numbers, no symbols anywhere. Aspect ratio 3:2.
```

### Asset 2: Reset password — "Forge"

**Path:** `apps/web/public/game-art/auth/reset-password-forge.png`

```
A painterly cinematic illustration of a glowing brass key resting
on a blacksmith's anvil, faint sparks dancing in the air above
it. The forge in the background glows deep ember-red, casting
warm light across dark stone walls. The blacksmith's silhouetted
hands are visible at the edges, mid-shaping. Mood: transformation,
heat, decisive moment of crafting something new and strong. Oil-
paint style with bold brushwork, dramatic chiaroscuro contrast.
No text, no letters, no numbers, no symbols anywhere. Aspect
ratio 3:2.
```

### Asset 3: Verify email — "Wax seal"

**Path:** `apps/web/public/game-art/auth/verify-email-seal.png`

```
A close-up overhead painterly photograph of a brass wax seal
stamp pressing fresh crimson wax onto a folded cream-colored
letter. A lit beeswax candle is visible in the upper left corner,
its flame casting warm yellow glow across the paper. Drops of
spent wax sit nearby. The seal has been pressed and is being
lifted, revealing the imprint in the wax (but the imprint is
abstract texture, NOT a recognizable symbol or letter). Mood:
ceremony, finality, the official moment of confirmation. Oil-
paint style, warm sepia and crimson palette. No text, no letters,
no numbers, no readable symbols. Aspect ratio 1:1.
```

### Asset 4: Account dossier — "Personal case file"

**Path:** `apps/web/public/game-art/auth/account-dossier.png`

```
A painterly overhead cinematic photograph of a manila folder
sitting open on a worn oak detective's desk, the folder
containing several blank sheets of aged paper and a single
empty photograph frame. A brass desk lamp casts directional
light from the upper left, a small inkpot and fountain pen rest
to the side. The folder is unlabeled (no text on any tab).
Mood: personal archive, the moment of opening one's own file
for the first time. Oil-paint style, warm amber and cream
palette with deep shadows at the corners. No text, no letters,
no numbers, no readable symbols on any paper or surface. Aspect
ratio 3:4.
```

### Asset 5: Privacy — "Vault"

**Path:** `apps/web/public/game-art/auth/privacy-vault.png`

```
A painterly close-up illustration of an ornate brass-bound
mahogany strongbox with a heavy iron padlock and decorative
corner reinforcements. The box sits on a dark velvet cloth
draped over an oak surface. A single brass key hangs on a small
hook nearby, slightly out of focus. Soft directional lighting
from upper left creates rich highlights on the brass fittings.
Mood: protection, secrecy, things held safely. Oil-paint style
with intricate metallic detail, warm umber and gold palette.
No text, no letters, no numbers, no engravings on the strongbox.
Aspect ratio 1:1.
```

### Asset 6: Terms — "Handshake under candlelight"

**Path:** `apps/web/public/game-art/auth/terms-handshake.png`

```
A painterly cinematic illustration of two pairs of weathered
hands meeting in a firm handshake above a candle-lit oak
tavern table. A partially-unrolled parchment scroll lies
beneath the handshake, an old brass-trimmed quill resting at
its edge. A pewter mug sits to one side. The candle flame
flickers warm gold from the lower right. Mood: ceremonial
agreement, mutual respect, the moment a deal is sealed. Oil-
paint style, warm amber and earthen brown palette, deep shadows
at the corners. No text, no letters, no numbers, no readable
markings on the parchment. Aspect ratio 3:2.
```

### Asset 7: Report — "Lighthouse beacon"

**Path:** `apps/web/public/game-art/auth/report-lighthouse.png`

```
A painterly cinematic illustration of a small stone lighthouse
on a low cliff at twilight, its warm amber beam cutting
through wispy coastal fog. Dark teal-grey sea below with hints
of waves. The lighthouse window glows steady. A single seabird
silhouetted against the misty horizon. Mood: vigilance,
guidance, the calm assurance that someone is watching. Oil-
paint style, blue-grey and warm ember palette, atmospheric
perspective. No text, no letters, no numbers, no symbols
anywhere. Aspect ratio 3:2.
```

### Asset 8: Status — "Harbor watch lantern"

**Path:** `apps/web/public/game-art/auth/status-harbor.png`

```
A wide painterly cinematic illustration of a brass oil-lantern
mounted on the wooden bow of a moored boat in a foggy harbor
at dawn. Behind, the silhouettes of other ships' masts and a
distant stone quay are visible through the mist. The lantern's
flame is steady, casting warm reflection on calm dark water.
Mood: steady watchfulness, calm vigilance, systems running well.
Oil-paint style, predominantly cool blue-grey palette with
warm amber lantern accent, atmospheric haze. No text, no
letters, no numbers, no symbols anywhere. Aspect ratio 16:9.
```

### After generation

1. Verify all 8 PNG files exist in `apps/web/public/game-art/auth/`.
2. Run `pnpm optimize:assets`. Verify WebP + mobile variants are produced.
3. Quick sanity check: open each PNG, confirm no stray text/numbers/symbols. If imagen produced any visible letters, **regenerate** that asset with stronger emphasis on the "no text" clauses.

---

## Stage 2 — Email infrastructure (Resend)

### Add dependency

```bash
pnpm --filter web add resend
```

This is the **only** new npm dep in this PR. Justified: Better Auth requires a transactional email provider for password reset + verification flows.

### Env vars

Add to `.env.example` + `.env.local.example`:

```
# Resend transactional email
RESEND_API_KEY=
RESEND_FROM=Върколак и Мафия <noreply@example.com>
```

Update `apps/web/lib/env.ts` to expose `RESEND_API_KEY` (optional in dev, required in prod-mode).

### Email service module

Create `apps/web/lib/email.ts`:

```ts
import { Resend } from "resend";

const resendClient = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM_ADDRESS = process.env.RESEND_FROM ?? "Върколак и Мафия <noreply@local.invalid>";

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export async function sendEmail(params: SendEmailParams) {
  if (!resendClient) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("RESEND_API_KEY липсва в production среда.");
    }
    console.log("[email:dev]", params.subject, "→", params.to);
    console.log("[email:dev:html]", params.html);
    return;
  }

  const result = await resendClient.emails.send({
    from: FROM_ADDRESS,
    to: params.to,
    subject: params.subject,
    html: params.html,
    text: params.text,
  });

  if (result.error) {
    throw new Error(`Грешка при изпращане на имейл: ${result.error.message}`);
  }

  return result.data;
}
```

In dev (no Resend key) emails are logged to console — sufficient for local testing of flows. In production, missing key throws.

### Email template helpers

Create `apps/web/lib/email-templates.ts` with three rendered templates (in БГ):

```ts
interface BaseTemplateParams {
  brandUrl: string;
}

interface ResetPasswordParams extends BaseTemplateParams {
  resetUrl: string;
  displayName: string;
}

interface VerifyEmailParams extends BaseTemplateParams {
  verifyUrl: string;
  displayName: string;
}

interface FeedbackParams extends BaseTemplateParams {
  body: string;
  reporterEmail: string | null;
  page: string;
}

const STYLE_INTRO = `
  <body style="font-family: Georgia, 'Noto Serif', serif; background: #1a1410; margin: 0; padding: 24px;">
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width: 580px; margin: 0 auto; background: #f0e0c4; border: 1px solid rgba(50,30,10,0.4); border-radius: 12px;">
      <tr><td style="padding: 32px;">
`;
const STYLE_OUTRO = `
      </td></tr>
    </table>
  </body>
`;

export function renderResetPasswordEmail(params: ResetPasswordParams) {
  const text = `Здравей, ${params.displayName}.

Получихме заявка за нова парола за твоя профил във Върколак и Мафия.

Ако ти си я заявил, отвори този линк за да създадеш нова парола:
${params.resetUrl}

Линкът е валиден за 1 час. Ако не си заявявал нова парола, просто игнорирай това писмо.

Дано следващата нощ е спокойна.
Върколак и Мафия`;

  const html = `${STYLE_INTRO}
    <h1 style="color: #842f2b; font-size: 24px; margin: 0 0 16px;">Заявка за нова парола</h1>
    <p style="color: #2a1b10; font-size: 16px; line-height: 1.55; margin: 0 0 16px;">
      Здравей, <strong>${params.displayName}</strong>.
    </p>
    <p style="color: #2a1b10; font-size: 16px; line-height: 1.55; margin: 0 0 24px;">
      Получихме заявка за нова парола за твоя профил във Върколак и Мафия. Ако ти си я заявил, отвори бутона по-долу за да създадеш нова парола.
    </p>
    <p style="margin: 0 0 24px;">
      <a href="${params.resetUrl}" style="background: #842f2b; color: #fff5e0; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 700; display: inline-block;">Създай нова парола</a>
    </p>
    <p style="color: #4f3829; font-size: 13px; line-height: 1.5; margin: 0;">
      Линкът е валиден за 1 час. Ако не си заявявал нова парола, просто игнорирай това писмо.
    </p>
  ${STYLE_OUTRO}`;

  return { subject: "Нова парола за Върколак и Мафия", html, text };
}

export function renderVerifyEmail(params: VerifyEmailParams) {
  const text = `Здравей, ${params.displayName}.

Потвърди имейла си за Върколак и Мафия като отвориш този линк:
${params.verifyUrl}

Линкът е валиден за 24 часа.

Добре дошъл на масата.
Върколак и Мафия`;

  const html = `${STYLE_INTRO}
    <h1 style="color: #842f2b; font-size: 24px; margin: 0 0 16px;">Потвърди имейла си</h1>
    <p style="color: #2a1b10; font-size: 16px; line-height: 1.55; margin: 0 0 16px;">
      Здравей, <strong>${params.displayName}</strong>.
    </p>
    <p style="color: #2a1b10; font-size: 16px; line-height: 1.55; margin: 0 0 24px;">
      Потвърди имейла си за Върколак и Мафия. Това е последната стъпка преди да отвориш първа стая.
    </p>
    <p style="margin: 0 0 24px;">
      <a href="${params.verifyUrl}" style="background: #842f2b; color: #fff5e0; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 700; display: inline-block;">Потвърди имейла</a>
    </p>
    <p style="color: #4f3829; font-size: 13px; line-height: 1.5; margin: 0;">
      Линкът е валиден за 24 часа.
    </p>
  ${STYLE_OUTRO}`;

  return { subject: "Потвърди имейла за Върколак и Мафия", html, text };
}

export function renderFeedbackEmail(params: FeedbackParams) {
  const text = `Нова бележка от Върколак и Мафия

Страница: ${params.page}
От: ${params.reporterEmail ?? "анонимен"}

Бележка:
${params.body}`;

  const html = `${STYLE_INTRO}
    <h1 style="color: #842f2b; font-size: 22px; margin: 0 0 16px;">Нова бележка от играч</h1>
    <p style="color: #4f3829; font-size: 13px; letter-spacing: 0.1em; text-transform: uppercase; margin: 0 0 4px;">страница</p>
    <p style="color: #2a1b10; font-size: 15px; margin: 0 0 16px;">${params.page}</p>
    <p style="color: #4f3829; font-size: 13px; letter-spacing: 0.1em; text-transform: uppercase; margin: 0 0 4px;">от</p>
    <p style="color: #2a1b10; font-size: 15px; margin: 0 0 16px;">${params.reporterEmail ?? "(анонимен)"}</p>
    <p style="color: #4f3829; font-size: 13px; letter-spacing: 0.1em; text-transform: uppercase; margin: 0 0 4px;">бележка</p>
    <p style="color: #2a1b10; font-size: 15px; line-height: 1.6; margin: 0; white-space: pre-wrap;">${params.body}</p>
  ${STYLE_OUTRO}`;

  return { subject: `Бележка от ${params.page}`, html, text };
}
```

### Better Auth hooks

In `apps/web/lib/auth.ts`, extend the config:

```ts
import { renderResetPasswordEmail, renderVerifyEmail } from "./email-templates";
import { sendEmail } from "./email";

export const auth = betterAuth({
  // ... existing config
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    autoSignIn: true,
    requireEmailVerification: true,
    sendResetPassword: async ({ user, url }) => {
      const template = renderResetPasswordEmail({
        brandUrl: process.env.BETTER_AUTH_URL ?? "",
        resetUrl: url,
        displayName: user.name ?? "приятел",
      });
      await sendEmail({ to: user.email, ...template });
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      const template = renderVerifyEmail({
        brandUrl: process.env.BETTER_AUTH_URL ?? "",
        verifyUrl: url,
        displayName: user.name ?? "приятел",
      });
      await sendEmail({ to: user.email, ...template });
    },
  },
  // ... rest
});
```

### Update env checker

Extend `scripts/check-production-env.mjs` to require `RESEND_API_KEY` in production. Warn (not fail) if missing — email flows will throw at runtime.

---

## Stage 3 — OAuth official assets swap

### Download official brand assets

Codex: fetch and save these as static files in `apps/web/public/brand/`:

- **Google G logo**: from https://developers.google.com/identity/branding-guidelines — multicolor "G" mark. Save as `apps/web/public/brand/google-g.svg`.
- **Discord wordmark**: from https://discord.com/branding — clearbit mark or full wordmark. Save as `apps/web/public/brand/discord-mark.svg`.

If direct download fails in the Codex environment, embed the official SVG path data inline (it's publicly available, royalty-free for OAuth UI per both companies' brand guidelines).

For Google G, the canonical SVG is approximately:
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
  <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
  <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
  <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0124 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
  <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 01-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
</svg>
```

For Discord mark, canonical SVG:
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 127.14 96.36" fill="#5865F2">
  <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z"/>
</svg>
```

### Update OAuthButton

In `apps/web/components/sign-in/OAuthButton.tsx`:

```tsx
import Image from "next/image";

function GoogleG() {
  return (
    <Image
      src="/brand/google-g.svg"
      alt=""
      width={24}
      height={24}
      aria-hidden
      style={{ display: "block" }}
    />
  );
}

function DiscordMark() {
  return (
    <Image
      src="/brand/discord-mark.svg"
      alt=""
      width={28}
      height={22}
      aria-hidden
      style={{ display: "block" }}
    />
  );
}
```

(Codex: Next.js `<Image>` with SVG sometimes needs explicit width/height. Adjust to plain `<img>` if Image complains about SVG.)

Verify after change: OAuth buttons on `/sign-in` still render correctly with official assets.

---

## Stage 4 — Forgot password + Reset password pages

### Page: `/forgot-password`

**File:** `apps/web/app/forgot-password/page.tsx`

Cinematic single-column page with locksmith art as left/background panel + form card on right (desktop) or stacked (mobile).

```tsx
import type { Metadata } from "next";
import { ForgotPasswordClient } from "@/components/auth/ForgotPasswordClient";

export const metadata: Metadata = {
  title: "Загубен ключ | Върколак и Мафия",
  description: "Заяви нова парола за твоя профил във Върколак и Мафия.",
};

export default function ForgotPasswordPage() {
  return (
    <main className="shell locksmith-shell">
      <ForgotPasswordClient />
    </main>
  );
}
```

**File:** `apps/web/components/auth/ForgotPasswordClient.tsx`

```tsx
"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";

export function ForgotPasswordClient() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");
    setErrorMsg("");

    const result = await authClient.forgetPassword({
      email,
      redirectTo: "/reset-password",
    });

    if (result.error) {
      setErrorMsg(result.error.message ?? "Грешка при заявката.");
      setStatus("error");
      return;
    }

    setStatus("sent");
  }

  return (
    <section className="locksmith-stage">
      <div className="locksmith-art" aria-hidden />

      <article className="locksmith-card">
        <header>
          <p className="locksmith-kicker">загубен ключ</p>
          <h1>Майсторим нов ключ.</h1>
          <p className="locksmith-subtitle">
            Дай имейла си — ще ти изпратим линк за нова парола. Линкът е валиден за един час.
          </p>
        </header>

        {status === "sent" ? (
          <div className="locksmith-success" role="status">
            <p>Готово. Провери имейла си.</p>
            <p className="locksmith-success-hint">Не виждаш писмото? Провери в "Спам" или "Промоции".</p>
          </div>
        ) : (
          <form onSubmit={submit} className="locksmith-form">
            <label>
              <span>Имейл</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@domain.com"
                autoComplete="email"
                required
              />
            </label>

            {errorMsg ? <p className="locksmith-error" role="alert">{errorMsg}</p> : null}

            <button
              type="submit"
              className="btn btn-primary"
              disabled={status === "submitting"}
            >
              {status === "submitting" ? "Изпращаме..." : "Изпрати линк"}
            </button>
          </form>
        )}

        <footer className="locksmith-foot">
          <Link href="/sign-in" className="locksmith-foot-link">← Към входа</Link>
        </footer>
      </article>
    </section>
  );
}
```

### Page: `/reset-password`

Receives `?token=...` from email link. Forge-themed art.

**File:** `apps/web/app/reset-password/page.tsx`

```tsx
import type { Metadata } from "next";
import { Suspense } from "react";
import { ResetPasswordClient } from "@/components/auth/ResetPasswordClient";

export const metadata: Metadata = {
  title: "Нов ключ | Върколак и Мафия",
  description: "Създай нова парола за твоя профил.",
};

export default function ResetPasswordPage() {
  return (
    <main className="shell forge-shell">
      <Suspense fallback={<p className="forge-loading">Подготвяме ковачницата...</p>}>
        <ResetPasswordClient />
      </Suspense>
    </main>
  );
}
```

**File:** `apps/web/components/auth/ResetPasswordClient.tsx`

```tsx
"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";

export function ResetPasswordClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  if (!token) {
    return (
      <section className="forge-stage">
        <div className="forge-art" aria-hidden />
        <article className="forge-card">
          <h1>Невалиден линк</h1>
          <p>Този линк е празен или повреден. Заяви нов от страницата "Загубен ключ".</p>
          <Link href="/forgot-password" className="btn btn-primary">Заяви нов линк</Link>
        </article>
      </section>
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMsg("");

    if (password.length < 8) {
      setErrorMsg("Паролата трябва да е поне 8 символа.");
      setStatus("error");
      return;
    }
    if (password !== confirm) {
      setErrorMsg("Двете полета трябва да съвпадат.");
      setStatus("error");
      return;
    }

    setStatus("submitting");

    const result = await authClient.resetPassword({ token, newPassword: password });
    if (result.error) {
      setErrorMsg(result.error.message ?? "Грешка при смяната на парола.");
      setStatus("error");
      return;
    }

    setStatus("done");
    setTimeout(() => router.push("/sign-in"), 1800);
  }

  return (
    <section className="forge-stage">
      <div className="forge-art" aria-hidden />

      <article className="forge-card">
        <header>
          <p className="forge-kicker">нов ключ</p>
          <h1>Затвори нов ключ зад себе си.</h1>
          <p className="forge-subtitle">
            Избери здрава парола — поне 8 символа. Запомни я добре, защото ще ти отваря вратата всеки път.
          </p>
        </header>

        {status === "done" ? (
          <p className="forge-success" role="status">Готово. Сега те водим към входа...</p>
        ) : (
          <form onSubmit={submit} className="forge-form">
            <label>
              <span>Нова парола</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Поне 8 символа"
                minLength={8}
                autoComplete="new-password"
                required
              />
            </label>
            <label>
              <span>Повтори</span>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Същата парола"
                minLength={8}
                autoComplete="new-password"
                required
              />
            </label>

            {errorMsg ? <p className="forge-error" role="alert">{errorMsg}</p> : null}

            <button type="submit" className="btn btn-primary" disabled={status === "submitting"}>
              {status === "submitting" ? "Заковавам..." : "Затвори ключа"}
            </button>
          </form>
        )}
      </article>
    </section>
  );
}
```

### CSS for `/forgot-password` + `/reset-password`

Add to `globals.css`:

```css
/* ============================== */
/* Locksmith (forgot password)    */
/* ============================== */

.locksmith-shell {
  display: grid;
  place-items: center;
  padding: 24px 16px;
  min-height: 100vh;
}

.locksmith-stage {
  display: grid;
  grid-template-columns: 1fr;
  max-width: 1100px;
  width: 100%;
  gap: 24px;
  align-items: stretch;
  min-height: 600px;
}

@media (min-width: 960px) {
  .locksmith-stage {
    grid-template-columns: 1.1fr 1fr;
  }
}

.locksmith-art {
  position: relative;
  border-radius: 24px;
  min-height: 280px;
  background-image:
    radial-gradient(ellipse at center, rgba(0,0,0,0) 30%, rgba(0,0,0,0.6) 100%),
    image-set(
      url("/game-art/auth/forgot-password-locksmith.webp") type("image/webp"),
      url("/game-art/auth/forgot-password-locksmith.png") type("image/png")
    );
  background-size: cover;
  background-position: center;
  box-shadow: 0 24px 48px rgba(0,0,0,0.5);
}

.locksmith-card {
  background-color: #f0e0c4;
  background-image:
    linear-gradient(155deg, rgba(255,250,238,0.55), rgba(238,222,196,0.35)),
    image-set(
      url("/game-art/textures/brass-plate.webp") type("image/webp"),
      url("/game-art/textures/brass-plate.png") type("image/png")
    );
  background-size: cover;
  background-blend-mode: multiply;
  padding: 36px 32px;
  border-radius: 14px;
  box-shadow:
    inset 0 0 0 1px rgba(255, 240, 200, 0.55),
    inset 0 0 0 4px rgba(50, 30, 10, 0.5),
    inset 0 0 0 6px rgba(255, 240, 200, 0.55),
    0 20px 50px rgba(0, 0, 0, 0.45);
  color: #1a1410;
  display: grid;
  gap: 20px;
  align-content: start;
}

.locksmith-kicker {
  font-size: 0.72rem;
  letter-spacing: 0.32em;
  text-transform: uppercase;
  font-weight: 700;
  color: #842f2b;
}

.locksmith-card h1 {
  font-family: "Noto Serif Display", "Noto Serif", serif;
  font-size: clamp(1.875rem, 4vw, 2.5rem);
  font-weight: 900;
  letter-spacing: -0.01em;
  line-height: 1.1;
  margin: 8px 0 0;
}

.locksmith-subtitle {
  font-size: 0.95rem;
  line-height: 1.6;
  color: rgba(26, 20, 16, 0.85);
}

.locksmith-form {
  display: grid;
  gap: 14px;
}

.locksmith-form label {
  display: grid;
  gap: 4px;
}

.locksmith-form label > span {
  font-size: 0.7rem;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  font-weight: 700;
  color: #842f2b;
}

.locksmith-form input {
  padding: 10px 14px;
  border: 1px solid rgba(50, 30, 10, 0.35);
  border-radius: 8px;
  background: rgba(255, 250, 238, 0.8);
  font-size: 1rem;
  color: #1a1410;
}

.locksmith-error {
  padding: 10px 14px;
  background: rgba(132, 47, 43, 0.12);
  color: #842f2b;
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 700;
}

.locksmith-success {
  padding: 18px;
  background: rgba(46, 107, 46, 0.14);
  border-left: 3px solid #2e6b2e;
  border-radius: 0 12px 12px 0;
  color: #1a1410;
  display: grid;
  gap: 6px;
}

.locksmith-success p {
  margin: 0;
  font-size: 1rem;
}

.locksmith-success-hint {
  font-size: 0.85rem !important;
  color: rgba(26, 20, 16, 0.7);
}

.locksmith-foot {
  margin-top: 8px;
}

.locksmith-foot-link {
  font-size: 0.85rem;
  font-weight: 700;
  color: #842f2b;
  text-decoration: none;
}

.locksmith-foot-link:hover {
  text-decoration: underline;
}

/* ============================== */
/* Forge (reset password)         */
/* ============================== */

.forge-shell {
  display: grid;
  place-items: center;
  padding: 24px 16px;
  min-height: 100vh;
}

.forge-stage {
  display: grid;
  grid-template-columns: 1fr;
  max-width: 1100px;
  width: 100%;
  gap: 24px;
  min-height: 600px;
}

@media (min-width: 960px) {
  .forge-stage {
    grid-template-columns: 1fr 1.1fr;
  }
}

.forge-art {
  border-radius: 24px;
  min-height: 280px;
  background-image:
    radial-gradient(ellipse at center, rgba(0,0,0,0) 30%, rgba(20,5,0,0.7) 100%),
    image-set(
      url("/game-art/auth/reset-password-forge.webp") type("image/webp"),
      url("/game-art/auth/reset-password-forge.png") type("image/png")
    );
  background-size: cover;
  background-position: center;
  box-shadow: 0 24px 48px rgba(0,0,0,0.55);
}

.forge-card {
  background-color: #1a1410;
  background-image:
    radial-gradient(ellipse 60% 50% at 30% 20%, rgba(217, 74, 61, 0.12), transparent 70%),
    radial-gradient(ellipse 50% 40% at 70% 80%, rgba(217, 154, 66, 0.08), transparent 70%);
  padding: 36px 32px;
  border-radius: 14px;
  border: 1px solid rgba(217, 154, 66, 0.18);
  color: #f5e8c8;
  display: grid;
  gap: 20px;
  align-content: start;
}

.forge-kicker {
  font-size: 0.72rem;
  letter-spacing: 0.32em;
  text-transform: uppercase;
  font-weight: 700;
  color: #d19a42;
}

.forge-card h1 {
  font-family: "Noto Serif Display", "Noto Serif", serif;
  font-size: clamp(1.875rem, 4vw, 2.5rem);
  font-weight: 900;
  letter-spacing: -0.01em;
  line-height: 1.1;
  color: #f5e8c8;
  margin: 8px 0 0;
}

.forge-subtitle {
  font-size: 0.95rem;
  line-height: 1.6;
  color: rgba(245, 232, 200, 0.78);
}

.forge-form { display: grid; gap: 14px; }
.forge-form label { display: grid; gap: 4px; }
.forge-form label > span {
  font-size: 0.7rem;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  font-weight: 700;
  color: #d19a42;
}
.forge-form input {
  padding: 10px 14px;
  border: 1px solid rgba(217, 154, 66, 0.35);
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.35);
  color: #f5e8c8;
  font-size: 1rem;
}

.forge-error {
  padding: 10px 14px;
  background: rgba(217, 74, 61, 0.18);
  border-left: 3px solid #d94a3d;
  color: #f5e8c8;
  border-radius: 0 8px 8px 0;
  font-size: 0.85rem;
  font-weight: 700;
}

.forge-success {
  padding: 14px 18px;
  background: rgba(46, 107, 46, 0.22);
  border-left: 3px solid #5cb85c;
  border-radius: 0 8px 8px 0;
  color: #f5e8c8;
  font-size: 1rem;
}
```

---

## Stage 5 — Verify email page

### Page: `/verify-email`

Receives `?token=...` from verification email. Wax seal art.

**File:** `apps/web/app/verify-email/page.tsx`

```tsx
import type { Metadata } from "next";
import { Suspense } from "react";
import { VerifyEmailClient } from "@/components/auth/VerifyEmailClient";

export const metadata: Metadata = {
  title: "Потвърждение | Върколак и Мафия",
  description: "Потвърди имейла си за достъп до масата.",
};

export default function VerifyEmailPage() {
  return (
    <main className="shell seal-shell">
      <Suspense fallback={<p className="seal-loading">Восъкът се топи...</p>}>
        <VerifyEmailClient />
      </Suspense>
    </main>
  );
}
```

**File:** `apps/web/components/auth/VerifyEmailClient.tsx`

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";

type VerifyState = "idle" | "verifying" | "success" | "error";

export function VerifyEmailClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [state, setState] = useState<VerifyState>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!token) {
      setState("error");
      setErrorMsg("Този линк е празен или повреден.");
      return;
    }

    setState("verifying");

    authClient.verifyEmail({ query: { token } })
      .then((result) => {
        if (result.error) {
          setErrorMsg(result.error.message ?? "Линкът вече е използван или изтекъл.");
          setState("error");
          return;
        }
        setState("success");
        setTimeout(() => router.push("/"), 2000);
      })
      .catch((error) => {
        console.error("[verify-email]", error);
        setErrorMsg("Грешка при потвърждение.");
        setState("error");
      });
  }, [token, router]);

  return (
    <section className="seal-stage">
      <figure className="seal-art" aria-hidden />

      <article className="seal-card">
        <p className="seal-kicker">потвърждение</p>
        <h1>{state === "success" ? "Печатът е поставен." : "Притискаме печата..."}</h1>

        {state === "verifying" ? (
          <p className="seal-body">Восъкът се втвърдява. Изчакай миг.</p>
        ) : null}

        {state === "success" ? (
          <>
            <p className="seal-body">Имейлът е потвърден. Сега си на масата.</p>
            <p className="seal-hint">Водим те към началото...</p>
          </>
        ) : null}

        {state === "error" ? (
          <>
            <p className="seal-error" role="alert">{errorMsg}</p>
            <div className="seal-actions">
              <Link href="/sign-in" className="btn btn-secondary">Към входа</Link>
            </div>
          </>
        ) : null}
      </article>
    </section>
  );
}
```

### CSS for verify-email

```css
.seal-shell {
  display: grid;
  place-items: center;
  padding: 24px 16px;
  min-height: 100vh;
}

.seal-stage {
  display: grid;
  grid-template-columns: 1fr;
  max-width: 760px;
  width: 100%;
  gap: 32px;
  align-items: center;
}

@media (min-width: 720px) {
  .seal-stage {
    grid-template-columns: 320px 1fr;
  }
}

.seal-art {
  margin: 0;
  border-radius: 24px;
  aspect-ratio: 1 / 1;
  background-image:
    radial-gradient(ellipse at center, rgba(0,0,0,0) 40%, rgba(40,10,10,0.55) 100%),
    image-set(
      url("/game-art/auth/verify-email-seal.webp") type("image/webp"),
      url("/game-art/auth/verify-email-seal.png") type("image/png")
    );
  background-size: cover;
  background-position: center;
  box-shadow: 0 24px 48px rgba(0, 0, 0, 0.45);
}

.seal-card {
  display: grid;
  gap: 12px;
  align-content: start;
}

.seal-kicker {
  font-size: 0.72rem;
  letter-spacing: 0.32em;
  text-transform: uppercase;
  font-weight: 700;
  color: #d94a3d;
}

.seal-card h1 {
  font-family: "Noto Serif Display", "Noto Serif", serif;
  font-size: clamp(1.875rem, 4vw, 2.75rem);
  font-weight: 900;
  letter-spacing: -0.01em;
  line-height: 1.1;
  margin: 4px 0 0;
  color: #f5e8c8;
}

.seal-body {
  font-size: 1.05rem;
  line-height: 1.6;
  color: rgba(245, 232, 200, 0.85);
}

.seal-hint {
  font-size: 0.85rem;
  font-style: italic;
  color: rgba(245, 232, 200, 0.6);
}

.seal-error {
  padding: 12px 16px;
  background: rgba(217, 74, 61, 0.18);
  border-left: 3px solid #d94a3d;
  border-radius: 0 8px 8px 0;
  color: #f5e8c8;
  font-weight: 700;
}

.seal-actions {
  margin-top: 16px;
  display: flex;
  gap: 12px;
}
```

---

## Stage 6 — Account settings page

### Page: `/account`

Personal dossier theme. Auth-gated. Shows avatar + name + email + connected providers + delete button.

**File:** `apps/web/app/account/page.tsx`

```tsx
import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AccountClient } from "@/components/account/AccountClient";

export const metadata: Metadata = {
  title: "Твоето досие | Върколак и Мафия",
  description: "Профил, име, парола и контрол на твоите данни.",
};

export default async function AccountPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/sign-in?redirect=/account");
  }

  return (
    <main className="shell dossier-shell">
      <AccountClient
        userId={session.user.id}
        email={session.user.email}
        name={session.user.name ?? ""}
        image={session.user.image ?? null}
        emailVerified={session.user.emailVerified ?? false}
      />
    </main>
  );
}
```

**File:** `apps/web/components/account/AccountClient.tsx`

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";

interface Props {
  userId: string;
  email: string;
  name: string;
  image: string | null;
  emailVerified: boolean;
}

export function AccountClient(props: Props) {
  const router = useRouter();
  const [name, setName] = useState(props.name);
  const [savingName, setSavingName] = useState(false);
  const [nameStatus, setNameStatus] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteStatus, setDeleteStatus] = useState<"idle" | "deleting" | "error">("idle");
  const [deleteError, setDeleteError] = useState("");

  async function saveName() {
    setSavingName(true);
    setNameStatus("");
    const result = await authClient.updateUser({ name });
    setSavingName(false);
    if (result.error) {
      setNameStatus("Грешка при запис.");
      return;
    }
    setNameStatus("Запазено.");
    setTimeout(() => setNameStatus(""), 2200);
  }

  async function deleteAccount() {
    setDeleteStatus("deleting");
    setDeleteError("");
    try {
      const response = await fetch("/api/account/delete", { method: "POST" });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        setDeleteError(body.error ?? "Грешка при изтриване.");
        setDeleteStatus("error");
        return;
      }
      await authClient.signOut();
      router.push("/");
      router.refresh();
    } catch (error) {
      setDeleteError("Грешка при изтриване.");
      setDeleteStatus("error");
    }
  }

  async function exportData() {
    window.location.href = "/api/account/export";
  }

  return (
    <section className="dossier-stage">
      <figure className="dossier-art" aria-hidden />

      <article className="dossier-card">
        <header className="dossier-head">
          <p className="dossier-kicker">досие</p>
          <h1>Твоето място на масата.</h1>
          <p className="dossier-subtitle">
            Профилът пази историята, постиженията и поканите. Тук ги управляваш.
          </p>
        </header>

        <section className="dossier-section">
          <h2>Профил</h2>
          <div className="dossier-row">
            <div className="dossier-avatar">
              {props.image ? <img src={props.image} alt="" /> : <span>{(props.name[0] ?? "?").toUpperCase()}</span>}
            </div>
            <div className="dossier-meta">
              <label>
                <span>Име на масата</span>
                <input value={name} maxLength={32} onChange={(e) => setName(e.target.value)} />
              </label>
              <button
                type="button"
                className="btn btn-secondary dossier-save-btn"
                onClick={saveName}
                disabled={savingName || name === props.name}
              >
                {savingName ? "Запазване..." : "Запази"}
              </button>
              {nameStatus ? <p className="dossier-status">{nameStatus}</p> : null}
            </div>
          </div>

          <p className="dossier-email">
            <strong>Имейл:</strong> {props.email}
            {props.emailVerified ? (
              <span className="dossier-badge dossier-badge-ok">Потвърден</span>
            ) : (
              <span className="dossier-badge dossier-badge-warn">Непотвърден</span>
            )}
          </p>
        </section>

        <section className="dossier-section">
          <h2>Твоите данни</h2>
          <p>
            Имаш право да изтеглиш всичко, което сме записали за теб (GDPR — право на преносимост).
          </p>
          <button type="button" className="btn btn-secondary" onClick={exportData}>
            Изтегли моите данни (JSON)
          </button>
        </section>

        <section className="dossier-section dossier-danger">
          <h2>Изтрий профила</h2>
          <p>
            Изтриването е окончателно. Имената от твоите игри ще бъдат заменени с "Изтрит играч", а постиженията ще изчезнат.
          </p>

          {showDeleteConfirm ? (
            <div className="dossier-confirm">
              <p><strong>Сигурен/сигурна ли си?</strong> Това действие не може да бъде върнато.</p>
              {deleteError ? <p className="dossier-error" role="alert">{deleteError}</p> : null}
              <div className="dossier-confirm-actions">
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={deleteAccount}
                  disabled={deleteStatus === "deleting"}
                >
                  {deleteStatus === "deleting" ? "Изтриваме..." : "Да, изтрий"}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowDeleteConfirm(false)}
                >
                  Отмени
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => setShowDeleteConfirm(true)}
            >
              Изтрий моя профил
            </button>
          )}
        </section>

        <footer className="dossier-foot">
          <Link href="/" className="dossier-foot-link">← Към началото</Link>
        </footer>
      </article>
    </section>
  );
}
```

### CSS for account dossier

```css
.dossier-shell {
  display: grid;
  place-items: start center;
  padding: 32px 16px 64px;
  min-height: 100vh;
}

.dossier-stage {
  display: grid;
  grid-template-columns: 1fr;
  max-width: 980px;
  width: 100%;
  gap: 32px;
}

@media (min-width: 900px) {
  .dossier-stage {
    grid-template-columns: 320px 1fr;
    align-items: start;
  }
}

.dossier-art {
  margin: 0;
  border-radius: 18px;
  aspect-ratio: 3 / 4;
  background-image:
    radial-gradient(ellipse at center, rgba(0,0,0,0) 50%, rgba(20,10,5,0.5) 100%),
    image-set(
      url("/game-art/auth/account-dossier.webp") type("image/webp"),
      url("/game-art/auth/account-dossier.png") type("image/png")
    );
  background-size: cover;
  background-position: center;
  position: sticky;
  top: 96px;
  box-shadow: 0 24px 48px rgba(0,0,0,0.45);
}

@media (max-width: 899px) {
  .dossier-art {
    position: relative;
    top: 0;
    aspect-ratio: 16 / 9;
  }
}

.dossier-card {
  display: grid;
  gap: 28px;
  padding: 32px;
  background: #f0e0c4;
  background-image:
    linear-gradient(155deg, rgba(255,250,238,0.55), rgba(238,222,196,0.35)),
    image-set(
      url("/game-art/textures/brass-plate.webp") type("image/webp"),
      url("/game-art/textures/brass-plate.png") type("image/png")
    );
  background-size: cover;
  background-blend-mode: multiply;
  border-radius: 14px;
  box-shadow:
    inset 0 0 0 1px rgba(255, 240, 200, 0.55),
    inset 0 0 0 4px rgba(50, 30, 10, 0.5),
    inset 0 0 0 6px rgba(255, 240, 200, 0.55),
    0 20px 50px rgba(0, 0, 0, 0.45);
  color: #1a1410;
}

.dossier-kicker {
  font-size: 0.72rem;
  letter-spacing: 0.32em;
  text-transform: uppercase;
  font-weight: 700;
  color: #842f2b;
}

.dossier-head h1 {
  font-family: "Noto Serif Display", "Noto Serif", serif;
  font-size: clamp(1.875rem, 4vw, 2.5rem);
  font-weight: 900;
  letter-spacing: -0.01em;
  line-height: 1.1;
  margin: 4px 0 8px;
}

.dossier-subtitle {
  font-size: 0.95rem;
  color: rgba(26, 20, 16, 0.78);
}

.dossier-section {
  display: grid;
  gap: 12px;
  padding-top: 20px;
  border-top: 1px solid rgba(50, 30, 10, 0.25);
}

.dossier-section h2 {
  font-family: "Noto Serif Display", serif;
  font-size: 1.125rem;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.16em;
  color: #842f2b;
}

.dossier-row {
  display: grid;
  grid-template-columns: 80px 1fr;
  gap: 16px;
  align-items: start;
}

.dossier-avatar {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: rgba(50, 30, 10, 0.6);
  border: 2px solid rgba(255, 240, 200, 0.55);
  overflow: hidden;
  display: grid;
  place-items: center;
  color: #fff5e0;
  font-family: "Noto Serif Display", serif;
  font-size: 2rem;
  font-weight: 900;
}

.dossier-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.dossier-meta { display: grid; gap: 6px; }
.dossier-meta label { display: grid; gap: 4px; }
.dossier-meta label > span {
  font-size: 0.7rem;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  font-weight: 700;
  color: #842f2b;
}
.dossier-meta input {
  padding: 8px 12px;
  border: 1px solid rgba(50, 30, 10, 0.35);
  border-radius: 8px;
  background: rgba(255, 250, 238, 0.8);
  font-size: 1rem;
  color: #1a1410;
}

.dossier-save-btn { width: fit-content; }
.dossier-status {
  font-size: 0.85rem;
  color: #2e6b2e;
  font-style: italic;
}

.dossier-email {
  font-size: 0.95rem;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.dossier-badge {
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  padding: 4px 10px;
  border-radius: 999px;
}

.dossier-badge-ok { background: rgba(46, 107, 46, 0.22); color: #1d4f1d; }
.dossier-badge-warn { background: rgba(217, 154, 66, 0.28); color: #5a3c10; }

.dossier-danger {
  border-color: rgba(132, 47, 43, 0.3);
}

.dossier-danger h2 { color: #842f2b; }

.dossier-confirm {
  display: grid;
  gap: 12px;
  padding: 16px;
  background: rgba(132, 47, 43, 0.1);
  border-radius: 12px;
  border: 1px solid rgba(132, 47, 43, 0.25);
}

.dossier-confirm-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.dossier-error {
  padding: 8px 12px;
  background: rgba(132, 47, 43, 0.2);
  color: #842f2b;
  border-radius: 8px;
  font-weight: 700;
  font-size: 0.85rem;
}

.btn-danger {
  background: #842f2b;
  color: #fff5e0;
  border: 1px solid #4a1a18;
  font-weight: 700;
}

.btn-danger:hover { background: #6d2421; }

.dossier-foot {
  margin-top: 8px;
}

.dossier-foot-link {
  font-size: 0.85rem;
  font-weight: 700;
  color: #842f2b;
  text-decoration: none;
}
```

---

## Stage 7 — GDPR data export endpoint

### Endpoint: `/api/account/export`

Returns JSON dump of everything we know about the user.

**File:** `apps/web/app/api/account/export/route.ts`

```ts
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { createDatabase, getAchievementsForUser, getRecentGameHistory } from "@werewolf/database";
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Не си влязъл." }, { status: 401 });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "Базата не е достъпна." }, { status: 503 });
  }

  try {
    const db = createDatabase(process.env.DATABASE_URL);
    const userId = session.user.id;

    const achievements = await getAchievementsForUser(db, userId);
    const games = await getRecentGameHistory(db, 500); // user's-relevant subset filtered client-side if needed

    const dump = {
      exportedAt: new Date().toISOString(),
      profile: {
        id: userId,
        email: session.user.email,
        name: session.user.name,
        image: session.user.image,
        emailVerified: session.user.emailVerified,
        createdAt: session.user.createdAt,
      },
      achievements,
      games: games.filter((g) => g.hostId === userId),
      note: "Това е експорт на твоите данни от Върколак и Мафия (GDPR член 20). Запази файла за твоите архиви.",
    };

    return new NextResponse(JSON.stringify(dump, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="werewolf-mafia-export-${userId}-${Date.now()}.json"`,
      },
    });
  } catch (error) {
    console.error("[account-export]", error);
    return NextResponse.json({ error: "Грешка при експорт на данни." }, { status: 500 });
  }
}
```

---

## Stage 8 — Notice-and-takedown page + API

### Page: `/report`

Lighthouse-themed page for reporting abuse, inappropriate content, copyright violations.

**File:** `apps/web/app/report/page.tsx`

```tsx
import type { Metadata } from "next";
import { ReportClient } from "@/components/report/ReportClient";

export const metadata: Metadata = {
  title: "Сигнал | Върколак и Мафия",
  description: "Подай сигнал за нарушение, неуместно поведение или авторски права.",
};

export default function ReportPage() {
  return (
    <main className="shell lighthouse-shell">
      <ReportClient />
    </main>
  );
}
```

**File:** `apps/web/components/report/ReportClient.tsx`

```tsx
"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";

type ReportType = "abuse" | "copyright" | "bug" | "other";

const TYPE_LABELS: Record<ReportType, string> = {
  abuse: "Неуместно поведение / тормоз",
  copyright: "Авторски права",
  bug: "Технически проблем",
  other: "Друго",
};

export function ReportClient() {
  const [type, setType] = useState<ReportType>("abuse");
  const [body, setBody] = useState("");
  const [email, setEmail] = useState("");
  const [evidence, setEvidence] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");
    setErrorMsg("");

    const response = await fetch("/api/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, body, email: email || null, evidence: evidence || null }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setErrorMsg(data.error ?? "Грешка при изпращане.");
      setStatus("error");
      return;
    }

    setStatus("sent");
  }

  return (
    <section className="lighthouse-stage">
      <div className="lighthouse-art" aria-hidden />

      <article className="lighthouse-card">
        <header>
          <p className="lighthouse-kicker">сигнал</p>
          <h1>Светим за тебе.</h1>
          <p className="lighthouse-subtitle">
            Ако нещо не е наред — играч с неуместно поведение, спорно съдържание или нарушение на авторски права — кажи ни. Преглеждаме сигнали в рамките на 48 часа.
          </p>
        </header>

        {status === "sent" ? (
          <div className="lighthouse-success" role="status">
            <p>Сигналът е получен.</p>
            <p className="lighthouse-success-hint">Ще го прегледаме и ще ти отговорим, ако си посочил имейл.</p>
            <Link href="/" className="btn btn-secondary">Към началото</Link>
          </div>
        ) : (
          <form onSubmit={submit} className="lighthouse-form">
            <label>
              <span>Тип сигнал</span>
              <select value={type} onChange={(e) => setType(e.target.value as ReportType)}>
                {(Object.keys(TYPE_LABELS) as ReportType[]).map((key) => (
                  <option key={key} value={key}>{TYPE_LABELS[key]}</option>
                ))}
              </select>
            </label>

            <label>
              <span>Описание</span>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Какво се случи? Кога? Кой?"
                rows={5}
                required
                minLength={20}
                maxLength={4000}
              />
            </label>

            <label>
              <span>Доказателство (опционално)</span>
              <input
                type="text"
                value={evidence}
                onChange={(e) => setEvidence(e.target.value)}
                placeholder="Линк, код на стая, screenshot URL"
              />
            </label>

            <label>
              <span>Твоят имейл (опционално, за отговор)</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@domain.com"
              />
            </label>

            {errorMsg ? <p className="lighthouse-error" role="alert">{errorMsg}</p> : null}

            <button type="submit" className="btn btn-primary" disabled={status === "submitting"}>
              {status === "submitting" ? "Изпращаме..." : "Изпрати сигнал"}
            </button>
          </form>
        )}
      </article>
    </section>
  );
}
```

### API: `/api/report`

**File:** `apps/web/app/api/report/route.ts`

```ts
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/email";
import { renderFeedbackEmail } from "@/lib/email-templates";
import { auth } from "@/lib/auth";

interface ReportBody {
  type?: unknown;
  body?: unknown;
  email?: unknown;
  evidence?: unknown;
}

const VALID_TYPES = new Set(["abuse", "copyright", "bug", "other"]);

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as ReportBody;

  const type = typeof body.type === "string" && VALID_TYPES.has(body.type) ? body.type : "other";
  const reportBody = typeof body.body === "string" ? body.body.trim() : "";
  const reporterEmail = typeof body.email === "string" && body.email.trim() ? body.email.trim() : null;
  const evidence = typeof body.evidence === "string" && body.evidence.trim() ? body.evidence.trim() : null;

  if (reportBody.length < 20) {
    return NextResponse.json({ error: "Опиши проблема с поне 20 символа." }, { status: 400 });
  }

  // Optional: include current user info if logged in
  let actorContext = "анонимен";
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (session?.user?.email) {
      actorContext = `${session.user.name ?? "?"} <${session.user.email}>`;
    }
  } catch {
    // ignore
  }

  const operatorEmail = process.env.REPORTS_NOTIFY_EMAIL;
  if (!operatorEmail) {
    console.error("[report] REPORTS_NOTIFY_EMAIL не е конфигуриран — сигналът се записва в console.");
    console.error(JSON.stringify({ type, reportBody, reporterEmail, evidence, actorContext }, null, 2));
    return NextResponse.json({ ok: true });
  }

  const summary = `[${type}] ${actorContext} | Доказателство: ${evidence ?? "няма"}\n\n${reportBody}`;

  try {
    const template = renderFeedbackEmail({
      brandUrl: process.env.BETTER_AUTH_URL ?? "",
      body: summary,
      reporterEmail,
      page: `/report (${type})`,
    });
    await sendEmail({ to: operatorEmail, ...template });
  } catch (error) {
    console.error("[report] email failed", error);
    return NextResponse.json({ error: "Сигналът не успя да се изпрати. Опитай отново." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
```

Add env var to `.env.example`:
```
REPORTS_NOTIFY_EMAIL=
```

### Lighthouse CSS

```css
.lighthouse-shell {
  display: grid;
  place-items: center;
  padding: 24px 16px;
  min-height: 100vh;
}

.lighthouse-stage {
  display: grid;
  grid-template-columns: 1fr;
  max-width: 1100px;
  width: 100%;
  gap: 24px;
  min-height: 600px;
}

@media (min-width: 960px) {
  .lighthouse-stage {
    grid-template-columns: 1.1fr 1fr;
  }
}

.lighthouse-art {
  border-radius: 24px;
  min-height: 280px;
  background-image:
    radial-gradient(ellipse at center, rgba(0,0,0,0) 30%, rgba(10,20,30,0.55) 100%),
    image-set(
      url("/game-art/auth/report-lighthouse.webp") type("image/webp"),
      url("/game-art/auth/report-lighthouse.png") type("image/png")
    );
  background-size: cover;
  background-position: center;
  box-shadow: 0 24px 48px rgba(0,0,0,0.55);
}

.lighthouse-card {
  display: grid;
  gap: 20px;
  padding: 36px 32px;
  background: #f0e0c4;
  background-image:
    linear-gradient(155deg, rgba(255,250,238,0.55), rgba(238,222,196,0.35)),
    image-set(
      url("/game-art/textures/brass-plate.webp") type("image/webp"),
      url("/game-art/textures/brass-plate.png") type("image/png")
    );
  background-size: cover;
  background-blend-mode: multiply;
  border-radius: 14px;
  box-shadow:
    inset 0 0 0 1px rgba(255, 240, 200, 0.55),
    inset 0 0 0 4px rgba(50, 30, 10, 0.5),
    inset 0 0 0 6px rgba(255, 240, 200, 0.55),
    0 20px 50px rgba(0, 0, 0, 0.45);
  color: #1a1410;
}

.lighthouse-kicker {
  font-size: 0.72rem;
  letter-spacing: 0.32em;
  text-transform: uppercase;
  font-weight: 700;
  color: #d19a42;
}

.lighthouse-card h1 {
  font-family: "Noto Serif Display", "Noto Serif", serif;
  font-size: clamp(1.875rem, 4vw, 2.5rem);
  font-weight: 900;
  letter-spacing: -0.01em;
  line-height: 1.1;
}

.lighthouse-form { display: grid; gap: 14px; }

.lighthouse-form label { display: grid; gap: 4px; }

.lighthouse-form label > span {
  font-size: 0.7rem;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  font-weight: 700;
  color: #842f2b;
}

.lighthouse-form input,
.lighthouse-form select,
.lighthouse-form textarea {
  padding: 10px 14px;
  border: 1px solid rgba(50, 30, 10, 0.35);
  border-radius: 8px;
  background: rgba(255, 250, 238, 0.8);
  font-size: 1rem;
  color: #1a1410;
  font-family: inherit;
}

.lighthouse-form textarea { resize: vertical; min-height: 100px; }

.lighthouse-error {
  padding: 10px 14px;
  background: rgba(132, 47, 43, 0.12);
  color: #842f2b;
  border-radius: 8px;
  font-weight: 700;
  font-size: 0.85rem;
}

.lighthouse-success {
  display: grid;
  gap: 10px;
  padding: 18px;
  background: rgba(46, 107, 46, 0.14);
  border-left: 3px solid #2e6b2e;
  border-radius: 0 12px 12px 0;
}

.lighthouse-success-hint {
  font-size: 0.85rem;
  color: rgba(26, 20, 16, 0.7);
}
```

---

## Stage 9 — Privacy + Terms pages with real Bulgarian draft

### `/privacy` — Vault theme

**File:** `apps/web/app/privacy/page.tsx`

Full Bulgarian privacy policy draft. Cinematic page layout: vault art left, document right.

```tsx
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Поверителност | Върколак и Мафия",
  description: "Какви данни събираме, защо ги пазим и какво можеш да направиш с тях.",
};

const LAST_UPDATED = "16 май 2026";

export default function PrivacyPage() {
  return (
    <main className="shell vault-shell">
      <section className="vault-stage">
        <figure className="vault-art" aria-hidden />

        <article className="vault-card">
          <header className="vault-head">
            <p className="vault-kicker">политика за поверителност</p>
            <h1>Твоите тайни остават при теб.</h1>
            <p className="vault-meta">Последна актуализация: {LAST_UPDATED}</p>
          </header>

          <section className="vault-section">
            <h2>1. Кои сме ние</h2>
            <p>
              Платформата "Върколак и Мафия" (по-нататък "ние", "Платформата") е онлайн социална игра. Тази политика обяснява какви лични данни събираме за теб като потребител и как ги обработваме.
            </p>
            <p>
              Адрес за контакт по въпроси за поверителност: <a href="mailto:privacy@example.com">privacy@example.com</a> (заменете преди публикуване с реален домейн).
            </p>
          </section>

          <section className="vault-section">
            <h2>2. Какви данни събираме</h2>
            <p>Когато създаваш профил и играеш:</p>
            <ul>
              <li><strong>Имейл адрес</strong> — за да можеш да влизаш и да получаваш потвърждения / линкове за нова парола.</li>
              <li><strong>Име на масата (display name)</strong> — видимо за другите играчи в стаите ти.</li>
              <li><strong>OAuth идентификатор</strong> (ако влезеш чрез Google или Discord) — техен публичен ID + името от профила им. Не получаваме нито парола, нито лични контакти оттам.</li>
              <li><strong>Профилна снимка</strong> (ако имаш такава в OAuth провайдъра) — съхраняваме URL, не сваляме файла.</li>
              <li><strong>Игрова история</strong> — кои стаи си посетил, кои роли си играл, кога е завършила играта.</li>
              <li><strong>Постижения</strong> — кои са отключени и кога.</li>
              <li><strong>Сесийни данни</strong> — кога си влизал, IP адрес на сесията (за сигурност, не за реклама), browser fingerprint (минимален, за защита от bot атаки).</li>
            </ul>
            <p>Не събираме: телефон, адрес, чувствителни данни, банкова информация (играта е безплатна).</p>
          </section>

          <section className="vault-section">
            <h2>3. Защо ги пазим</h2>
            <ul>
              <li><strong>За да работи играта</strong> — без имейл/име не можем да те разпознаем.</li>
              <li><strong>За статистики и постижения</strong> — класацията и записите изискват история.</li>
              <li><strong>За сигурност</strong> — IP/сесия се ползват за rate limiting и защита от malicious bot активност. Не за маркетинг.</li>
              <li><strong>За контакт с теб</strong> — потвърждение на имейл, нова парола, важни промени в услугата.</li>
            </ul>
          </section>

          <section className="vault-section">
            <h2>4. С кого споделяме</h2>
            <p>Не продаваме данните ти. Не показваме реклами. Технически партньори, които задължително виждат части от данните:</p>
            <ul>
              <li><strong>DigitalOcean</strong> — нашият hosting partner (Германия, EU). Сървърите ни и базата работят там.</li>
              <li><strong>Resend</strong> — изпраща нашите системни имейли (потвърждение, забравена парола). Виждат само имейл адреса и съдържанието на писмото.</li>
              <li><strong>Google / Discord</strong> — само ако ползваш техния OAuth вход. Размяната е по техния стандартен protocol.</li>
              <li><strong>OpenAI</strong> — не получават данни за теб; ползваме ги само за статични art assets, генерирани преди публичното пускане.</li>
            </ul>
            <p>Нямаме други третии лица. Не ползваме Google Analytics, Facebook Pixel, или подобни tracking системи.</p>
          </section>

          <section className="vault-section">
            <h2>5. Колко дълго ги пазим</h2>
            <ul>
              <li><strong>Профил</strong> — докато не го изтриеш.</li>
              <li><strong>Сесии</strong> — 30 дни от последна активност.</li>
              <li><strong>Игрова история</strong> — до 24 месеца, после автоматично се анонимизира.</li>
              <li><strong>Имейли</strong> — Resend пази delivery записи 30 дни, после изтриват.</li>
            </ul>
          </section>

          <section className="vault-section">
            <h2>6. Твоите права (по GDPR)</h2>
            <p>Имаш право да:</p>
            <ul>
              <li>Поискаш копие на всичко, което знаем за теб → бутон "Изтегли моите данни" на <Link href="/account">страницата с твоето досие</Link>.</li>
              <li>Поискаш изтриване на твоя профил → същата страница, секция "Изтрий профила".</li>
              <li>Поправиш грешка в данните ти (име, имейл) → редактиране в досието.</li>
              <li>Оттеглиш съгласие — спираш да ползваш услугата.</li>
              <li>Подадеш жалба пред Комисията за защита на личните данни (КЗЛД) — <a href="https://www.cpdp.bg" target="_blank" rel="noreferrer">cpdp.bg</a>.</li>
            </ul>
            <p>При изтриване: игрите ти остават в архива (за честна история на масата), но името ти се заменя с "Изтрит играч". Постиженията изчезват.</p>
          </section>

          <section className="vault-section">
            <h2>7. Бисквитки</h2>
            <p>Използваме само технически необходими бисквитки:</p>
            <ul>
              <li>Сесийна бисквитка от Better Auth — да помни, че си влязъл.</li>
              <li>Бисквитка за съгласие — да не показваме банера всеки път.</li>
              <li>Local storage за настройки (тема, звук, последно семейство игри).</li>
            </ul>
            <p>Не ползваме analytics/marketing бисквитки.</p>
          </section>

          <section className="vault-section">
            <h2>8. Деца под 13 години</h2>
            <p>Платформата не е предназначена за деца под 13. Не събираме съзнателно данни за лица под тази възраст. Ако родител/настойник установи, че дете е създало профил, може да поиска изтриване чрез контакта по-горе.</p>
          </section>

          <section className="vault-section">
            <h2>9. Промени в политиката</h2>
            <p>Ако променим политиката (например при добавяне на нов технически партньор), ще те уведомим през платформата и/или имейл преди промяната да влезе в сила.</p>
          </section>

          <section className="vault-section">
            <h2>10. Контакт</h2>
            <p>По всякакви въпроси за поверителност: <a href="mailto:privacy@example.com">privacy@example.com</a></p>
            <p>За сигнали и нарушения: <Link href="/report">/report</Link></p>
          </section>

          <footer className="vault-foot">
            <Link href="/" className="vault-foot-link">← Към началото</Link>
          </footer>
        </article>
      </section>
    </main>
  );
}
```

### `/terms` — Handshake theme

Similar structure, full BG legal-aware draft. Codex: model on `/privacy` page above with these sections:

1. Приемане на условията
2. Възрастови ограничения (13+)
3. Профил на потребителя — отговорности
4. Поведение в играта (без harassment, hate speech, чийтиране)
5. Интелектуална собственост — наша + ваша
6. User-generated content (имена, chat) — лиценз ни даваш ограничен
7. Услугата "както е" — disclaimer
8. Ограничаване на отговорност
9. Прекратяване на достъп
10. Приложимо право и юрисдикция (българско право, София)
11. Контакт

(Codex: pишеш в същия cinematic стил като privacy. Same "handshake" art motif. Real legal-aware БГ copy, не Lorem.)

### Vault + handshake CSS

Add to globals.css both `.vault-shell` / `.vault-stage` / `.vault-art` / `.vault-card` and `.handshake-shell` / `.handshake-stage` / `.handshake-art` / `.handshake-card`. Layout similar to lighthouse/locksmith (2-col art+card on desktop, stacked mobile). Vault uses tan/cream paper feel; handshake uses warmer wood-tones.

---

## Stage 10 — Welcome onboarding modal

After first successful sign-in, if `tutorial-completed` localStorage flag is not set, show an overlay welcome modal.

**File:** `apps/web/components/onboarding/WelcomeModal.tsx`

```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";

const STORAGE_KEY = "welcome-modal-shown";

export function WelcomeModal() {
  const { data: session } = authClient.useSession();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!session?.user?.id) return;
    if (window.localStorage.getItem(STORAGE_KEY)) return;
    if (window.localStorage.getItem("tutorial-completed")) {
      window.localStorage.setItem(STORAGE_KEY, "1");
      return;
    }
    setVisible(true);
  }, [session?.user?.id]);

  function dismiss() {
    window.localStorage.setItem(STORAGE_KEY, "1");
    setVisible(false);
  }

  if (!visible) return null;

  const displayName = session?.user?.name ?? "приятел";

  return (
    <div className="welcome-modal-backdrop" role="presentation" onClick={dismiss}>
      <aside
        className="welcome-modal"
        role="dialog"
        aria-label="Добре дошъл"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="welcome-kicker">добре дошъл</p>
        <h2>Здравей, {displayName}.</h2>
        <p className="welcome-body">
          Първа игра за теб? Имаме шест сцени, които те водят през една вечер на масата — какво е нощта, какво е денят, как се чете подозрение.
        </p>
        <p className="welcome-body">
          Иначе кликни "Играй" и създай първа стая. Приятели се канят с код.
        </p>
        <div className="welcome-actions">
          <Link href="/tutorial?welcome=1" className="btn btn-primary" onClick={dismiss}>
            Виж шестте сцени
          </Link>
          <button type="button" className="btn btn-secondary" onClick={dismiss}>
            Знам какво правя — пропусни
          </button>
        </div>
      </aside>
    </div>
  );
}
```

Mount in `apps/web/app/layout.tsx` (after `<ToastHost />`).

CSS:

```css
.welcome-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.65);
  display: grid;
  place-items: center;
  padding: 16px;
  z-index: 100;
  backdrop-filter: blur(6px);
}

.welcome-modal {
  max-width: 480px;
  width: 100%;
  padding: 32px;
  background-color: #f0e0c4;
  background-image:
    linear-gradient(155deg, rgba(255,250,238,0.55), rgba(238,222,196,0.35)),
    image-set(
      url("/game-art/textures/brass-plate.webp") type("image/webp"),
      url("/game-art/textures/brass-plate.png") type("image/png")
    );
  background-size: cover;
  background-blend-mode: multiply;
  border-radius: 14px;
  box-shadow:
    inset 0 0 0 1px rgba(255, 240, 200, 0.55),
    inset 0 0 0 4px rgba(50, 30, 10, 0.5),
    inset 0 0 0 6px rgba(255, 240, 200, 0.55),
    0 30px 80px rgba(0,0,0,0.6);
  color: #1a1410;
  display: grid;
  gap: 14px;
}

.welcome-kicker {
  font-size: 0.72rem;
  letter-spacing: 0.32em;
  text-transform: uppercase;
  font-weight: 700;
  color: #842f2b;
}

.welcome-modal h2 {
  font-family: "Noto Serif Display", serif;
  font-size: 1.875rem;
  font-weight: 900;
  margin: 4px 0;
}

.welcome-body {
  font-size: 0.95rem;
  line-height: 1.6;
  color: rgba(26, 20, 16, 0.85);
}

.welcome-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 8px;
}
```

---

## Stage 11 — Beta badge + Feedback widget

### Beta badge in site-chrome

In `apps/web/components/site-chrome.tsx`, near the brand mark:

```tsx
{process.env.NEXT_PUBLIC_SHOW_BETA_BADGE !== "false" ? (
  <span className="site-beta-badge" aria-label="Бета версия">БЕТА</span>
) : null}
```

CSS:
```css
.site-beta-badge {
  display: inline-block;
  padding: 2px 8px;
  margin-left: 6px;
  font-size: 0.65rem;
  letter-spacing: 0.18em;
  font-weight: 800;
  color: #fff5e0;
  background: linear-gradient(180deg, #d94a3d, #842f2b);
  border-radius: 4px;
  vertical-align: middle;
  box-shadow: 0 1px 0 rgba(0,0,0,0.3);
}
```

Default visible. To hide: set `NEXT_PUBLIC_SHOW_BETA_BADGE=false` in env.

### Feedback widget

Floating button bottom-right of every page. Click → compact form overlay.

**File:** `apps/web/components/feedback/FeedbackWidget.tsx`

```tsx
"use client";

import { FormEvent, useState } from "react";
import { usePathname } from "next/navigation";

export function FeedbackWidget() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");
    setError("");

    const response = await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body, email: email || null, page: pathname }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.error ?? "Грешка при изпращане.");
      setStatus("error");
      return;
    }

    setStatus("sent");
    setBody("");
  }

  if (!open) {
    return (
      <button
        type="button"
        className="feedback-fab"
        onClick={() => setOpen(true)}
        aria-label="Дай ни бележка"
      >
        💬
      </button>
    );
  }

  return (
    <aside className="feedback-panel" role="dialog" aria-label="Бележка">
      <button
        type="button"
        className="feedback-close"
        onClick={() => { setOpen(false); setStatus("idle"); }}
        aria-label="Затвори"
      >×</button>

      <p className="feedback-kicker">бележка</p>
      <h3>Дай ни бележка.</h3>

      {status === "sent" ? (
        <p className="feedback-sent">Получено. Благодарим.</p>
      ) : (
        <form onSubmit={submit}>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Какво харесваш, какво не? Какво се счупи?"
            rows={4}
            required
            minLength={10}
            maxLength={2000}
          />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Имейл (опционално)"
          />
          {error ? <p className="feedback-error">{error}</p> : null}
          <button type="submit" className="btn btn-primary" disabled={status === "submitting"}>
            {status === "submitting" ? "Изпращаме..." : "Изпрати"}
          </button>
        </form>
      )}
    </aside>
  );
}
```

### API: `/api/feedback`

**File:** `apps/web/app/api/feedback/route.ts`

Similar to `/api/report` but lighter — single body field, no type. Routes through same Resend email to `REPORTS_NOTIFY_EMAIL` operator.

```ts
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/email";
import { renderFeedbackEmail } from "@/lib/email-templates";
import { auth } from "@/lib/auth";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const text = typeof body.body === "string" ? body.body.trim() : "";
  const email = typeof body.email === "string" && body.email.trim() ? body.email.trim() : null;
  const page = typeof body.page === "string" ? body.page : "?";

  if (text.length < 10) {
    return NextResponse.json({ error: "Кажи поне 10 символа." }, { status: 400 });
  }

  let actor = "анонимен";
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (session?.user?.email) actor = `${session.user.name ?? "?"} <${session.user.email}>`;
  } catch {}

  const operatorEmail = process.env.REPORTS_NOTIFY_EMAIL;
  if (!operatorEmail) {
    console.log("[feedback]", { text, email, page, actor });
    return NextResponse.json({ ok: true });
  }

  try {
    const template = renderFeedbackEmail({
      brandUrl: process.env.BETTER_AUTH_URL ?? "",
      body: `${actor}\n\n${text}`,
      reporterEmail: email,
      page,
    });
    await sendEmail({ to: operatorEmail, ...template });
  } catch (error) {
    console.error("[feedback] email failed", error);
    return NextResponse.json({ error: "Бележката не успя да се изпрати." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
```

Mount `<FeedbackWidget />` in `apps/web/app/layout.tsx`.

CSS:

```css
.feedback-fab {
  position: fixed;
  bottom: 24px;
  right: 24px;
  width: 52px;
  height: 52px;
  border-radius: 50%;
  border: none;
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
  font-size: 1.5rem;
  cursor: pointer;
  box-shadow:
    inset 0 1px 0 rgba(255, 240, 200, 0.55),
    inset 0 -1px 0 rgba(50, 30, 10, 0.4),
    0 8px 20px rgba(0, 0, 0, 0.5);
  z-index: 60;
  transition: transform 160ms ease;
}

.feedback-fab:hover { transform: translateY(-2px); }

.feedback-panel {
  position: fixed;
  bottom: 24px;
  right: 24px;
  width: 360px;
  max-width: calc(100vw - 32px);
  padding: 20px;
  background-color: #f0e0c4;
  background-image:
    linear-gradient(155deg, rgba(255,250,238,0.55), rgba(238,222,196,0.35)),
    image-set(
      url("/game-art/textures/brass-plate.webp") type("image/webp"),
      url("/game-art/textures/brass-plate.png") type("image/png")
    );
  background-size: cover;
  background-blend-mode: multiply;
  border-radius: 14px;
  box-shadow:
    inset 0 0 0 1px rgba(255, 240, 200, 0.55),
    inset 0 0 0 4px rgba(50, 30, 10, 0.5),
    inset 0 0 0 6px rgba(255, 240, 200, 0.55),
    0 30px 60px rgba(0,0,0,0.55);
  color: #1a1410;
  z-index: 70;
  display: grid;
  gap: 10px;
}

.feedback-close {
  position: absolute;
  top: 8px;
  right: 12px;
  border: none;
  background: transparent;
  font-size: 1.5rem;
  cursor: pointer;
  color: #842f2b;
  line-height: 1;
}

.feedback-kicker {
  font-size: 0.7rem;
  letter-spacing: 0.32em;
  text-transform: uppercase;
  font-weight: 700;
  color: #842f2b;
}

.feedback-panel h3 {
  font-family: "Noto Serif Display", serif;
  font-size: 1.25rem;
  font-weight: 900;
  margin: 0 0 8px;
}

.feedback-panel textarea,
.feedback-panel input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid rgba(50, 30, 10, 0.35);
  border-radius: 8px;
  background: rgba(255, 250, 238, 0.85);
  font-size: 0.95rem;
  color: #1a1410;
  font-family: inherit;
  margin-bottom: 8px;
  resize: vertical;
}

.feedback-error {
  font-size: 0.8rem;
  color: #842f2b;
  font-weight: 700;
}

.feedback-sent {
  padding: 12px;
  background: rgba(46, 107, 46, 0.18);
  border-radius: 8px;
  color: #1a1410;
  font-weight: 700;
}
```

---

## Stage 12 — Status page

### Page: `/status`

**File:** `apps/web/app/status/page.tsx`

Server-rendered. Pings each service and shows green/yellow/red dot per component. Harbor lantern art as backdrop.

```tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Състояние | Върколак и Мафия",
  description: "Здраве на сървърите и услугите.",
};

export const dynamic = "force-dynamic";

interface ServiceStatus {
  name: string;
  description: string;
  status: "ok" | "degraded" | "down" | "unknown";
  detail?: string;
}

async function checkService(url: string, timeoutMs = 3000): Promise<{ ok: boolean; ms: number }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const start = Date.now();
  try {
    const response = await fetch(url, { signal: controller.signal, cache: "no-store" });
    clearTimeout(timer);
    return { ok: response.ok, ms: Date.now() - start };
  } catch {
    clearTimeout(timer);
    return { ok: false, ms: Date.now() - start };
  }
}

async function loadStatuses(): Promise<ServiceStatus[]> {
  const services: ServiceStatus[] = [];

  // Web app (self-check via /api/health if exists, else assume OK since rendered)
  services.push({
    name: "Уеб приложение",
    description: "Този сайт",
    status: "ok",
    detail: "Отговаря",
  });

  // Game server
  const gameServerUrl = process.env.NEXT_PUBLIC_GAME_SERVER_URL?.replace("ws:", "http:").replace("wss:", "https:");
  if (gameServerUrl) {
    const result = await checkService(`${gameServerUrl}/health`);
    services.push({
      name: "Игрови сървър",
      description: "Колизей за стаите",
      status: result.ok ? "ok" : "down",
      detail: result.ok ? `${result.ms}ms` : "Не отговаря",
    });
  }

  // Database (indirect — Postgres healthcheck via env or marker route)
  services.push({
    name: "База данни",
    description: "Postgres за профили и история",
    status: process.env.DATABASE_URL ? "ok" : "unknown",
    detail: process.env.DATABASE_URL ? "Конфигурирана" : "Не е достъпна",
  });

  // OAuth providers
  services.push({
    name: "Google OAuth",
    description: "Вход с Google",
    status: process.env.GOOGLE_CLIENT_ID ? "ok" : "unknown",
    detail: process.env.GOOGLE_CLIENT_ID ? "Активен" : "Не е конфигуриран",
  });

  services.push({
    name: "Discord OAuth",
    description: "Вход с Discord",
    status: process.env.DISCORD_CLIENT_ID ? "ok" : "unknown",
    detail: process.env.DISCORD_CLIENT_ID ? "Активен" : "Не е конфигуриран",
  });

  // Email
  services.push({
    name: "Имейл услуга",
    description: "Resend (потвърждения, нова парола)",
    status: process.env.RESEND_API_KEY ? "ok" : "unknown",
    detail: process.env.RESEND_API_KEY ? "Активна" : "Не е конфигурирана",
  });

  return services;
}

const STATUS_LABEL_BG: Record<ServiceStatus["status"], string> = {
  ok: "Стабилно",
  degraded: "Бавно",
  down: "Прекъсване",
  unknown: "Неизвестно",
};

export default async function StatusPage() {
  const services = await loadStatuses();
  const overall = services.every((s) => s.status === "ok")
    ? "ok"
    : services.some((s) => s.status === "down")
      ? "down"
      : "degraded";

  return (
    <main className="shell harbor-shell">
      <section className="harbor-stage">
        <div className="harbor-art" aria-hidden />

        <article className="harbor-card">
          <header>
            <p className="harbor-kicker">състояние</p>
            <h1>Бдим над масата.</h1>
            <p className="harbor-subtitle">
              Преглед на здравето на услугите ни. Опресняване при всяко зареждане.
            </p>
            <p className={`harbor-overall harbor-overall-${overall}`}>
              <span className="harbor-dot" aria-hidden />
              {overall === "ok" ? "Всички системи работят." : overall === "degraded" ? "Една или повече услуги са в неизвестно състояние." : "Засечена е авария."}
            </p>
          </header>

          <ul className="harbor-list">
            {services.map((service) => (
              <li key={service.name} className={`harbor-item harbor-item-${service.status}`}>
                <span className="harbor-item-dot" aria-hidden />
                <div className="harbor-item-body">
                  <h2>{service.name}</h2>
                  <p className="harbor-item-desc">{service.description}</p>
                  <p className="harbor-item-status">
                    <strong>{STATUS_LABEL_BG[service.status]}</strong>
                    {service.detail ? ` · ${service.detail}` : ""}
                  </p>
                </div>
              </li>
            ))}
          </ul>

          <footer className="harbor-foot">
            <p>Видял си нещо счупено? <a href="/report">Подай сигнал</a>.</p>
            <p className="harbor-foot-time">Проверено в {new Date().toLocaleString("bg-BG")}</p>
          </footer>
        </article>
      </section>
    </main>
  );
}
```

### CSS for status page

Add `harbor-shell` / `harbor-stage` / `harbor-art` / `harbor-card` similar to lighthouse. Wider banner art (16:9 from generated asset). Status dots:

```css
.harbor-dot, .harbor-item-dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #888;
  margin-right: 8px;
  box-shadow: 0 0 8px currentColor;
}

.harbor-overall-ok, .harbor-item-ok { color: #2e6b2e; }
.harbor-overall-ok .harbor-dot, .harbor-item-ok .harbor-item-dot { background: #2e6b2e; }

.harbor-overall-degraded, .harbor-item-degraded, .harbor-item-unknown { color: #d19a42; }
.harbor-overall-degraded .harbor-dot,
.harbor-item-degraded .harbor-item-dot,
.harbor-item-unknown .harbor-item-dot { background: #d19a42; }

.harbor-overall-down, .harbor-item-down { color: #d94a3d; }
.harbor-overall-down .harbor-dot,
.harbor-item-down .harbor-item-dot { background: #d94a3d; }
```

---

## Stage 13 — Wire site-chrome to /status + footer links

In `apps/web/components/site-chrome.tsx`, add `/status` to `SECONDARY_LINKS` and link `/privacy`, `/terms`, `/report`, `/status` in any footer that exists. If no global footer exists, create a minimal `<SiteFooter>` component:

```tsx
"use client";

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
      <p className="site-footer-credit">Върколак и Мафия · социална игра на сенки</p>
    </footer>
  );
}
```

Mount in `app/layout.tsx` after `{children}`.

CSS:
```css
.site-footer {
  padding: 24px 16px;
  text-align: center;
  font-size: 0.8rem;
  color: rgba(232, 217, 187, 0.55);
  border-top: 1px solid rgba(255, 240, 200, 0.08);
  margin-top: 48px;
}
.site-footer-links {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
}
.site-footer-links a {
  color: rgba(232, 217, 187, 0.75);
  text-decoration: none;
}
.site-footer-links a:hover {
  color: #d19a42;
  text-decoration: underline;
}
.site-footer-credit { margin-top: 8px; }
```

---

## Stage 14 — Verification

Run:

```bash
pnpm optimize:assets         # confirm 8 new art assets → WebP
pnpm typecheck
pnpm regression
pnpm test
pnpm build
pnpm smoke
pnpm frontend:e2e
E2E_LOCAL_ONLY=true pnpm e2e:auth
pnpm playtest
pnpm visual:update           # regenerate baselines for new routes
pnpm visual                  # confirm new baselines pass
pnpm perf:budget
```

Manual checks:
- `/forgot-password` → enter email → email sent (or console.log in dev). Click link → `/reset-password?token=...` → new password → redirect to `/sign-in`.
- `/verify-email?token=fake` → shows "Невалиден линк".
- `/account` → edit name, save. Delete confirm flow shows. Export downloads JSON.
- `/report` → submit, email arrives at `REPORTS_NOTIFY_EMAIL`.
- `/privacy`, `/terms`, `/status` render. All links work.
- Feedback floating button on any page → submit → confirmation.
- Welcome modal appears on first login (clear localStorage and login fresh).
- Beta badge visible in navbar.
- OAuth buttons show official Google/Discord logos.

---

## Acceptance criteria

1. **8 new art assets** exist + WebP variants in `apps/web/public/game-art/auth/`.
2. **`resend` is the only new dep** added (justified for transactional email).
3. **`apps/web/lib/email.ts`** + **`apps/web/lib/email-templates.ts`** present and used by Better Auth hooks.
4. **`requireEmailVerification: true`** in Better Auth config.
5. **OAuth buttons** use `/brand/google-g.svg` + `/brand/discord-mark.svg` (official assets).
6. **New routes** all working:
   - `/forgot-password` (locksmith theme)
   - `/reset-password?token=` (forge theme)
   - `/verify-email?token=` (wax seal theme)
   - `/account` (dossier theme, auth-gated)
   - `/report` (lighthouse theme)
   - `/privacy` (vault theme, real BG legal draft)
   - `/terms` (handshake theme, real BG legal draft)
   - `/status` (harbor lantern theme)
7. **New API endpoints**:
   - `/api/account/export` (JSON dump)
   - `/api/report` (sends email via Resend)
   - `/api/feedback` (sends email via Resend)
8. **WelcomeModal** mounts in layout; shows once on first login.
9. **Beta badge** visible in site-chrome; togglable via `NEXT_PUBLIC_SHOW_BETA_BADGE=false`.
10. **Feedback widget** floating button visible on every page.
11. **Site footer** added with links to /privacy, /terms, /report, /status.
12. **All commit messages in English**.
13. **All user-facing copy in Bulgarian** (except brand names Google/Discord).
14. **`pnpm verify`** chain passes end to end.
15. **Each page is visually unique** — locksmith, forge, seal, dossier, vault, handshake, lighthouse, harbor are all distinct concept + art + CSS class names.

---

## Не пипай

- Game-server logic / schemas / role-assignment.
- Existing redesigns (history, achievements, leaderboard, tutorial, sign-in, etc.).
- Better Auth core internals — only configure hooks.
- TTS / audio narrator — explicitly out of scope.
- Existing visual regression baselines for unchanged pages.

---

## Commit strategy (16 atomic commits, all English)

Branch: `feat/pre-launch-everything`

1. `chore(art): generate 8 cinematic art assets for auth and ops pages`
2. `feat(email): integrate Resend + transactional email templates`
3. `feat(auth): wire Better Auth password reset + email verification hooks`
4. `feat(auth): swap OAuth button SVGs for official Google + Discord brand marks`
5. `feat(auth): forgot password page with locksmith theme`
6. `feat(auth): reset password page with forge theme`
7. `feat(auth): verify email page with wax seal theme`
8. `feat(account): account settings page with dossier theme`
9. `feat(gdpr): account data export endpoint`
10. `feat(report): notice-and-takedown page + API with lighthouse theme`
11. `feat(legal): privacy policy page with vault theme + Bulgarian draft`
12. `feat(legal): terms of service page with handshake theme + Bulgarian draft`
13. `feat(onboarding): welcome modal for first-time signed-in users`
14. `feat(ops): beta badge in site chrome + feedback widget + /api/feedback`
15. `feat(ops): status page with harbor lantern theme`
16. `feat(layout): site footer with privacy + terms + report + status links`

PR title: `feat: pre-launch finalization — auth flows, GDPR pages, ops widgets, 8 cinematic themes`

PR body should note:
- New dep: `resend`
- New env vars: `RESEND_API_KEY`, `RESEND_FROM`, `REPORTS_NOTIFY_EMAIL`, `NEXT_PUBLIC_SHOW_BETA_BADGE`
- Email verification now required from start — affects any pre-existing test accounts
- Privacy + Terms text is realistic but lawyer-reviewable before launch; should be reviewed by a BG-licensed attorney before going public

---

(End of prompt)
