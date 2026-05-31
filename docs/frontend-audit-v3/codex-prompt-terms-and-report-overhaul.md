# Codex prompt — `/terms` and `/report` complete overhaul

Цялостен redesign на двете последни utility страници в site-а:
- **`/terms`** става **"Кодекс на масата"** — honor commitments framing вместо legal wall, с ОК/НЕ-ОК визуални примери и acceptance moment за authenticated users.
- **`/report`** става **multi-step guided wizard** с type-specific evidence helpers, anonymous/identified toggle, и cinematic success state с lighthouse beam animation.

И двете страници използват **painterly-marketing aesthetic** (same family като homepage, /account, /privacy). **2 нови imagen асета** (cinematic banners).

**⚠ Работа директно върху main branch** — без feature branch. Codex commit-ва incrementally directly to main.

~16 atomic English commits across two pages.

---

## Pre-analysis (current state)

### `/terms` — текущо

- Stage handshake portrait art ляво (3:4, 320px)
- Heavy brass card дясно с 11 numbered sections (h2 + p × 11)
- Cream-on-brass typography
- Footer "Към началото" link

**Лошото:**
- 11 секции изглеждат еднакво важни — никаква йерархия
- Legal-speak за поведенчески правила, които трябва да са на човешки
- Никакъв acceptance moment за logged-in users
- Никакви визуални примери за ОК/НЕ-ОК поведение
- Brass-plaque визуал не пасва с обновените homepage/account/privacy

### `/report` — текущо

- Lighthouse portrait art ляво
- Brass card дясно с single-page form: select dropdown + textarea + 2 inputs + submit
- One-shot submission — overwhelms novice users
- Generic "Какво се случи? Кога? Кой?" placeholder за всички types
- Plain success state "Сигналът е получен"

**Лошото:**
- Wall of fields without progressive disclosure
- No type-specific guidance (a copyright report needs different info than abuse)
- No transparency on response timeline
- No anonymous vs identified distinction
- Bare success state — no closure feeling

---

## Pre-decisions (locked)

- **Design system**: `painterly-marketing` (same като homepage, /account, /privacy). NOT pure legal-modern reader.
- **`/terms` framing**: "Кодекс на масата" — honor commitments (5 cards) + legal annex (collapsible).
- **`/terms` unique**: ОК/НЕ-ОК visual examples per behavioral commitment + acceptance moment for authenticated users.
- **`/report` framing**: Multi-step wizard (4 steps + success state).
- **`/report` unique**: Type-specific evidence helpers + anonymous/identified toggle + lighthouse-beam success animation + reference number.
- **Imagen scope**: 2 mandatory banners (terms + report). One optional success-state illustration for /report.
- **🚨 Branch policy**: Work directly on `main`. No feature branch creation. Codex commits each commit individually to main, in the order specified.
- **No new npm dependencies**.

---

## Stage 1 — Generate imagen banners

### Asset 1: Terms banner — "handshake at the table"

**Path:** `apps/web/public/game-art/legal/terms-banner.png`

```
A wide cinematic banner illustration of two pairs of weathered
hands meeting in a firm handshake above a candlelit oak table,
captured straight-on at table height. The hands are simplified
silhouettes — no detailed faces or fingers, just the gesture of
agreement. A partially-unrolled blank parchment scroll lies on
the table beneath the handshake, with a quill resting at its
edge and a small brass inkwell to the right. A single candle
flame glows warm gold from the lower-right; the upper-left fades
into deep shadow. The lower third of the frame gradient-fades
to near-black for legible text overlay. Mood: agreement, mutual
respect, the moment when honor is offered and accepted. Painterly
oil style with rich brushwork, warm earth-brown and amber palette
with brass accents, vignetted corners, dramatic chiaroscuro. No
text, no readable letters, no numbers, no markings on the
parchment or any surface anywhere. Aspect ratio 16:9.
```

**Size:** 1920 × 1080.

### Asset 2: Report banner — "lighthouse in the fog"

**Path:** `apps/web/public/game-art/legal/report-banner.png`

```
A wide cinematic banner illustration of a small stone lighthouse
on a low coastal cliff at twilight, viewed from a moderate
distance across darkening sea water. The lighthouse beam cuts
warm amber through cool wispy fog, sweeping across the frame
from the right toward the lower-left. A few seabirds silhouetted
against the misty horizon. Dark rocky coastline at the base.
The lower third of the frame gradient-fades to deep indigo near-
black for text overlay legibility. Mood: vigilance, guidance,
the reassurance that someone is watching even when conditions
are murky. Painterly oil style with atmospheric brushwork, cool
blue-grey sea atmosphere with warm ember beam accents, dramatic
atmospheric perspective, vignetted corners. No text, no readable
letters, no numbers, no symbols anywhere. Aspect ratio 16:9.
```

**Size:** 1920 × 1080.

### Asset 3 (optional): Report success illustration

**Path:** `apps/web/public/game-art/legal/report-received.png`

```
A painterly cinematic illustration of a single envelope with a
wax seal, sitting on a worn oak desk under warm directional
candlelight from the upper-left. The wax seal is rich red with
a faint embossed circular pattern (no readable text in the
seal). A faint glow emanates from the envelope as if it has
just been delivered. Background: deeply blurred dark wood paneling
with hints of brass fittings. Mood: received, acknowledged, in
safe hands. Painterly oil style with rich impasto, warm amber
and ember-red palette with deep wood-brown surface, vignetted
corners. No text, no readable letters, no numbers, no markings
anywhere. Aspect ratio 4:3.
```

**Size:** 1024 × 768.

Optional. If imagen quota is tight, skip — success state will use existing report-banner cropped + animation.

### After generation

```bash
ls apps/web/public/game-art/legal/terms-banner.png
ls apps/web/public/game-art/legal/report-banner.png
pnpm optimize:assets
ls apps/web/public/game-art/legal/*.webp
```

Verify no visible text/letters in any image. Regenerate if needed.

Запазете старите `terms-handshake.png` и `report-lighthouse.png` (могат да служат за OG fallback). Не изтривайте.

---

## Stage 2 — `/terms` redesign as "Кодекс на масата"

### Updated `apps/web/app/terms/page.tsx`

```tsx
import type { Metadata } from "next";
import { headers } from "next/headers";
import { JsonLd } from "@/components/JsonLd";
import { ResourceHints } from "@/components/resource-hints";
import { TermsCodex } from "@/components/terms/TermsCodex";
import { auth } from "@/lib/auth";
import { absoluteUrl, routeMetadata } from "@/lib/seo";

const LAST_UPDATED = "19 май 2026";

export const metadata: Metadata = routeMetadata({
  title: "Кодекс на масата | Върколак и Мафия",
  description: "Правилата, които правят масата честна — за блъфа, за уважението, за чистата игра.",
  path: "/terms",
  image: "/game-art/legal/terms-banner.png",
  imageAlt: "Ръкостискане над масата под светлина на свещ",
  robots: { index: true, follow: true },
  absoluteTitle: true,
});

export default async function TermsPage() {
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders }).catch(() => null);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Кодекс на масата",
    inLanguage: "bg-BG",
    dateModified: "2026-05-19",
    url: absoluteUrl("/terms"),
  };

  return (
    <main className="shell terms-shell">
      <ResourceHints images={["/game-art/legal/terms-banner.webp"]} />
      <JsonLd data={jsonLd} />
      <TermsCodex
        lastUpdated={LAST_UPDATED}
        isAuthenticated={Boolean(session?.user?.id)}
        userName={session?.user?.name ?? null}
      />
    </main>
  );
}
```

### `apps/web/components/terms/TermsCodex.tsx` (orchestrator)

```tsx
import { TermsHero } from "./TermsHero";
import { TermsAcceptance } from "./TermsAcceptance";
import { TermsCommitments } from "./TermsCommitments";
import { TermsConflict } from "./TermsConflict";
import { TermsLegalAnnex } from "./TermsLegalAnnex";

interface Props {
  lastUpdated: string;
  isAuthenticated: boolean;
  userName: string | null;
}

export function TermsCodex({ lastUpdated, isAuthenticated, userName }: Props) {
  return (
    <div className="terms-page">
      <TermsHero lastUpdated={lastUpdated} />

      <div className="terms-content">
        {isAuthenticated ? <TermsAcceptance userName={userName} /> : null}
        <TermsCommitments />
        <TermsConflict />
        <TermsLegalAnnex />
      </div>
    </div>
  );
}
```

### `TermsHero` component

```tsx
import Image from "next/image";

export function TermsHero({ lastUpdated }: { lastUpdated: string }) {
  return (
    <header className="terms-hero" aria-label="Кодекс на масата">
      <div className="terms-hero-banner">
        <Image
          src="/game-art/legal/terms-banner.webp"
          alt=""
          fill
          priority
          sizes="100vw"
          className="terms-hero-img"
        />
        <div className="terms-hero-scrim" aria-hidden />
      </div>

      <div className="terms-hero-inner">
        <p className="terms-hero-kicker">кодекс на масата</p>
        <h1 className="terms-hero-title">Сядаме на една маса.</h1>
        <p className="terms-hero-subtitle">
          Правилата, които правят играта честна — за блъфа, за уважението, за чистата игра.
          Това не са юридически клопки, а обещания между играчи.
        </p>
        <p className="terms-hero-meta">
          Последна актуализация: <time>{lastUpdated}</time>
        </p>
      </div>
    </header>
  );
}
```

### `TermsAcceptance` — UNIQUE авth-only section

Показва се само за logged-in users. Persists acceptance date в localStorage (since terms acceptance is implicit by usage, this is just transparency UX).

```tsx
"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "terms-accepted-version";
const CURRENT_VERSION = "2026-05-19";

interface Props {
  userName: string | null;
}

export function TermsAcceptance({ userName }: Props) {
  const [acceptedAt, setAcceptedAt] = useState<string | null>(null);
  const [justAccepted, setJustAccepted] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as { version: string; acceptedAt: string };
        if (parsed.version === CURRENT_VERSION) {
          setAcceptedAt(parsed.acceptedAt);
        }
      } catch {
        // ignore
      }
    }
  }, []);

  function accept() {
    const now = new Date().toISOString();
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: CURRENT_VERSION, acceptedAt: now }),
    );
    setAcceptedAt(now);
    setJustAccepted(true);
    setTimeout(() => setJustAccepted(false), 3500);
  }

  const formattedDate = acceptedAt
    ? new Intl.DateTimeFormat("bg-BG", { dateStyle: "long" }).format(new Date(acceptedAt))
    : null;

  return (
    <section className="terms-section terms-section-acceptance">
      <header className="terms-section-head">
        <p className="terms-section-kicker">подпис на масата</p>
        <h2>{userName ? `${userName}, прочете ли кодекса?` : "Прочете ли кодекса?"}</h2>
        <p className="terms-section-lede">
          Като играеш, ти приемаш правилата по подразбиране. Този подпис е символичен — показва, че
          съзнателно си се запознал с обещанията на масата.
        </p>
      </header>

      <div className="terms-acceptance-body">
        {acceptedAt ? (
          <div className="terms-acceptance-state terms-acceptance-state-signed">
            <span className="terms-acceptance-mark" aria-hidden>✓</span>
            <div>
              <p className="terms-acceptance-title">Прочетен и приет</p>
              <p className="terms-acceptance-detail">На {formattedDate}.</p>
            </div>
            {justAccepted ? <p className="terms-acceptance-toast">Записано локално в твоя браузър.</p> : null}
          </div>
        ) : (
          <div className="terms-acceptance-state terms-acceptance-state-pending">
            <span className="terms-acceptance-mark" aria-hidden>~</span>
            <div>
              <p className="terms-acceptance-title">Още непрочетен подпис</p>
              <p className="terms-acceptance-detail">Прелисти кодекса и натисни „Подписвам“ долу — само за себе си, за прозрачност.</p>
            </div>
            <button type="button" className="terms-acceptance-btn" onClick={accept}>
              Подписвам кодекса
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
```

### `TermsCommitments` — 5 honor commitments с ОК/НЕ-ОК examples

```tsx
"use client";

import { useState } from "react";

interface Commitment {
  id: string;
  number: number;
  title: string;
  promise: string;
  examplesOk: string[];
  examplesNotOk: string[];
}

const COMMITMENTS: readonly Commitment[] = [
  {
    id: "respect",
    number: 1,
    title: "Уважение към масата",
    promise: "Играй така, че всеки да си тръгне с желание да се върне следваща вечер.",
    examplesOk: [
      "Жесток блъф, който заблуждава селото — добре изиграна роля.",
      "Шумни обвинения по време на гласуване — част от драмата.",
      "Доволно подсмихване, когато планът ти проработи.",
    ],
    examplesNotOk: [
      "Лични обиди към играч, не към ролята му.",
      "Заплахи — реални или „на майтап“.",
      "Расистки, сексистки или хомофобски шеги.",
      "Преследване на играч след играта (имейли, чат канали).",
    ],
  },
  {
    id: "honor-in-play",
    number: 2,
    title: "Чест в играта",
    promise: "Лъжата на масата е разрешена и очаквана. Лъжата извън правилата — не.",
    examplesOk: [
      "Криеш ролята си от селото — част от играта.",
      "Лъжеш, че видя нечия карта — социална дедукция.",
      "Координираш с другите върколаци през частния чат.",
    ],
    examplesNotOk: [
      "Чийт ботове, autoclicker-и или други автоматизирани заявки.",
      "Дублиращи акаунти, за да гласуваш многократно.",
      "Споделяш ролята си през Discord/Telegram с играчи извън стаята.",
      "Преглеждаш ходовете през развойни инструменти.",
    ],
  },
  {
    id: "private-data",
    number: 3,
    title: "Лично достойнство",
    promise: "Каквото е казано на масата, остава на масата. Хората са повече от ролите си.",
    examplesOk: [
      "Споменаваш на масата как си играл предишен ход.",
      "Покажеш на приятел свой replay след играта.",
      "Споделиш статистика от профила си.",
    ],
    examplesNotOk: [
      "Споделяш чужд имейл, телефон или адрес.",
      "Постваш screenshot от чата с име на друг играч навън.",
      "Доксиш играч в социалните мрежи заради игра.",
      "Записваш и публикуваш гласови или видео разговори без съгласие.",
    ],
  },
  {
    id: "your-account",
    number: 4,
    title: "Своя профил",
    promise: "Профилът е твой — отговаряш за достъпа и за поведението му.",
    examplesOk: [
      "Споделяш код на стая с приятели за частна игра.",
      "Сменяш паролата си или излизаш отдалечено при подозрение.",
      "Сигнализираш ни, ако виждаш странна активност.",
    ],
    examplesNotOk: [
      "Споделяш парола с друг човек.",
      "Имитираш друг човек с подвеждащо име.",
      "Създаваш втори акаунт, за да заобиколиш ограничение.",
      "Купуваш или продаваш профили.",
    ],
  },
  {
    id: "age",
    number: 5,
    title: "Възраст",
    promise: "Минимум 13 години. Под 18 — със знанието на родител или настойник.",
    examplesOk: [
      "Играеш от 14 година със съгласие на родителите.",
      "Гимназист в група за вечерта.",
      "Студент на 19 в стая с приятели.",
    ],
    examplesNotOk: [
      "Дете под 13 създава профил.",
      "Възрастен се представя за тийнейджър пред дете на масата.",
      "Възрастен умишлено играе с непълнолетни извън рамките на игровата стая.",
    ],
  },
];

export function TermsCommitments() {
  const [openId, setOpenId] = useState<string | null>(null);

  function toggle(id: string) {
    setOpenId((current) => (current === id ? null : id));
  }

  return (
    <section className="terms-section">
      <header className="terms-section-head">
        <p className="terms-section-kicker">обещания</p>
        <h2>Пет обещания на масата.</h2>
        <p className="terms-section-lede">
          Не са правни клаузи. Са договорки между играчи — какво се прави и какво не.
        </p>
      </header>

      <ol className="terms-commitment-list">
        {COMMITMENTS.map((commitment) => {
          const isOpen = openId === commitment.id;
          return (
            <li key={commitment.id} className="terms-commitment-item" data-open={isOpen}>
              <button
                type="button"
                className="terms-commitment-handle"
                onClick={() => toggle(commitment.id)}
                aria-expanded={isOpen}
              >
                <span className="terms-commitment-num">{commitment.number}</span>
                <div className="terms-commitment-meta">
                  <h3>{commitment.title}</h3>
                  <p>{commitment.promise}</p>
                </div>
                <span className="terms-commitment-chevron" aria-hidden>
                  {isOpen ? "−" : "+"}
                </span>
              </button>

              {isOpen ? (
                <div className="terms-commitment-detail">
                  <div className="terms-examples-grid">
                    <div className="terms-examples terms-examples-ok">
                      <p className="terms-examples-label">Това е добре</p>
                      <ul>
                        {commitment.examplesOk.map((example, i) => (
                          <li key={i}>
                            <span className="terms-examples-icon" aria-hidden>✓</span>
                            <span>{example}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="terms-examples terms-examples-not-ok">
                      <p className="terms-examples-label">Това не е добре</p>
                      <ul>
                        {commitment.examplesNotOk.map((example, i) => (
                          <li key={i}>
                            <span className="terms-examples-icon" aria-hidden>✕</span>
                            <span>{example}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
```

### `TermsConflict` — what happens when rule is broken

```tsx
import Link from "next/link";

export function TermsConflict() {
  return (
    <section className="terms-section terms-section-conflict">
      <header className="terms-section-head">
        <p className="terms-section-kicker">когато нещо тръгне накриво</p>
        <h2>Стъпки при нарушение.</h2>
        <p className="terms-section-lede">
          Никой кодекс не е перфектен. Ето как реагираме, когато правилата се пречупят.
        </p>
      </header>

      <ol className="terms-conflict-steps">
        <li>
          <span className="terms-conflict-num">1</span>
          <div>
            <h3>Сигнал</h3>
            <p>Подаваш сигнал през <Link href="/report">страницата за сигнал</Link>. Описваш какво се е случило, кога и кой.</p>
          </div>
        </li>
        <li>
          <span className="terms-conflict-num">2</span>
          <div>
            <h3>Преглед</h3>
            <p>Преглеждаме сигнала в рамките на 48 часа. Може да поискаме допълнителни детайли по имейл.</p>
          </div>
        </li>
        <li>
          <span className="terms-conflict-num">3</span>
          <div>
            <h3>Решение</h3>
            <p>В зависимост от тежестта: предупреждение, временно ограничение, или окончателно прекратяване. Първото нарушение обикновено е предупреждение.</p>
          </div>
        </li>
        <li>
          <span className="terms-conflict-num">4</span>
          <div>
            <h3>Право на отговор</h3>
            <p>Ако смяташ, че решението е грешно, можеш да възразиш през същата страница. Винаги проверяваме повторно.</p>
          </div>
        </li>
      </ol>
    </section>
  );
}
```

### `TermsLegalAnnex` — collapsible legal annex (formal text)

Запазва оригиналните 6 секции (intellectual property, user content, as-is, liability, termination, applicable law) но като **collapsible** annex за тези, които искат пълния правен текст.

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";

interface LegalSection {
  id: string;
  title: string;
  body: React.ReactNode;
}

const SECTIONS: readonly LegalSection[] = [
  {
    id: "ip",
    title: "Интелектуална собственост",
    body: (
      <p>
        Името на платформата, дизайнът, кодът, правилата в сайта и визуалните материали са защитени
        като наше съдържание или съдържание, за което имаме право на ползване. Можеш да споделяш
        линкове към стаи и страници, но не можеш да копираш платформата като собствена услуга.
      </p>
    ),
  },
  {
    id: "user-content",
    title: "Съдържание от играчи",
    body: (
      <p>
        Имената на масата, съобщенията в стая и сигналите са съдържание, което въвеждаш ти. Даваш
        ни ограничено право да го показваме, съхраняваме и обработваме само доколкото е нужно за
        работата на играта, модерацията и историята на стаите.
      </p>
    ),
  },
  {
    id: "as-is",
    title: "Услугата във вида, в който е налична",
    body: (
      <p>
        Работим да поддържаме играта стабилна, но не гарантираме непрекъснат достъп. Възможни са
        прекъсвания, промени в правилата, техническа поддръжка и временни ограничения.
      </p>
    ),
  },
  {
    id: "liability",
    title: "Ограничаване на отговорност",
    body: (
      <p>
        Не носим отговорност за косвени вреди, пропуснати ползи, загубена игрова статистика при
        технически срив или поведение на други играчи извън нашия разумен контрол.
      </p>
    ),
  },
  {
    id: "law",
    title: "Приложимо право",
    body: (
      <p>
        Тези условия се тълкуват според българското право. При спор страните първо търсят
        доброволно уреждане. Ако това не е възможно, компетентни са съдилищата в София, освен ако
        законът изисква друго.
      </p>
    ),
  },
  {
    id: "contact",
    title: "Контакт",
    body: (
      <p>
        За въпроси, сигнали и искания използвай <Link href="/report">страницата за сигнал</Link>.
        За лични данни виж и <Link href="/privacy">политиката за поверителност</Link>.
      </p>
    ),
  },
];

export function TermsLegalAnnex() {
  const [open, setOpen] = useState(false);

  return (
    <section className="terms-section terms-section-annex">
      <button
        type="button"
        className="terms-annex-toggle"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <span className="terms-annex-icon" aria-hidden>{open ? "−" : "+"}</span>
        <div>
          <p className="terms-annex-kicker">правен анекс</p>
          <p className="terms-annex-title">Формалните клаузи ({SECTIONS.length})</p>
          <p className="terms-annex-hint">Интелектуална собственост, отговорност, приложимо право — за тези, които искат пълния правен текст.</p>
        </div>
      </button>

      {open ? (
        <ol className="terms-annex-list">
          {SECTIONS.map((section, index) => (
            <li key={section.id} id={section.id} className="terms-annex-item">
              <h3>
                <span className="terms-annex-num">{index + 1}.</span>
                {section.title}
              </h3>
              <div className="terms-annex-body">{section.body}</div>
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}
```

---

## Stage 3 — `/report` redesign as guided wizard

### Updated `apps/web/app/report/page.tsx`

```tsx
import type { Metadata } from "next";
import { headers } from "next/headers";
import { JsonLd } from "@/components/JsonLd";
import { ResourceHints } from "@/components/resource-hints";
import { ReportLighthouse } from "@/components/report/ReportLighthouse";
import { auth } from "@/lib/auth";
import { absoluteUrl, routeMetadata } from "@/lib/seo";

export const metadata: Metadata = routeMetadata({
  title: "Сигнал | Върколак и Мафия",
  description: "Подай сигнал — за нарушение, авторски права, бъг или жалба. Преглеждаме в 48 часа.",
  path: "/report",
  image: "/game-art/legal/report-banner.png",
  imageAlt: "Каменен фар сред мъгла",
  robots: { index: false, follow: false },
  absoluteTitle: true,
});

export default async function ReportPage() {
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders }).catch(() => null);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ContactPage",
    name: "Сигнал",
    inLanguage: "bg-BG",
    url: absoluteUrl("/report"),
  };

  return (
    <main className="shell report-shell">
      <ResourceHints images={["/game-art/legal/report-banner.webp"]} />
      <JsonLd data={jsonLd} />
      <ReportLighthouse
        userEmail={session?.user?.email ?? null}
        userName={session?.user?.name ?? null}
      />
    </main>
  );
}
```

### `apps/web/components/report/ReportLighthouse.tsx` (orchestrator)

```tsx
"use client";

import { useState } from "react";
import { ReportHero } from "./ReportHero";
import { ReportWizard } from "./ReportWizard";

interface Props {
  userEmail: string | null;
  userName: string | null;
}

export function ReportLighthouse({ userEmail, userName }: Props) {
  return (
    <div className="report-page">
      <ReportHero />
      <div className="report-content">
        <ReportWizard userEmail={userEmail} userName={userName} />
      </div>
    </div>
  );
}
```

### `ReportHero`

```tsx
import Image from "next/image";

export function ReportHero() {
  return (
    <header className="report-hero" aria-label="Сигнал">
      <div className="report-hero-banner">
        <Image
          src="/game-art/legal/report-banner.webp"
          alt=""
          fill
          priority
          sizes="100vw"
          className="report-hero-img"
        />
        <div className="report-hero-scrim" aria-hidden />
        <div className="report-hero-beam" aria-hidden />
      </div>

      <div className="report-hero-inner">
        <p className="report-hero-kicker">сигнал</p>
        <h1 className="report-hero-title">Светим за тебе.</h1>
        <p className="report-hero-subtitle">
          Ако нещо не е наред — играч с неуместно поведение, спорно съдържание или нарушение на
          авторски права — кажи ни. Светилникът няма да угасне, докато не разгледаме.
        </p>
        <p className="report-hero-stat">
          <span className="report-hero-stat-icon" aria-hidden>⏱</span>
          <span>Обикновено отговаряме в <strong>24-48 часа</strong></span>
        </p>
      </div>
    </header>
  );
}
```

### `ReportWizard` — multi-step guided form

This is the **big component**. Codex implements 4 steps + success state.

```tsx
"use client";

import { type FormEvent, useId, useState } from "react";
import Link from "next/link";

type ReportType = "abuse" | "copyright" | "bug" | "gdpr" | "other";
type Step = "type" | "details" | "identity" | "review" | "success";

interface Props {
  userEmail: string | null;
  userName: string | null;
}

interface TypeMeta {
  id: ReportType;
  label: string;
  hint: string;
  icon: string;
  evidenceLabel: string;
  evidencePlaceholder: string;
  bodyPlaceholder: string;
}

const TYPE_META: Record<ReportType, TypeMeta> = {
  abuse: {
    id: "abuse",
    label: "Тормоз или неуместно поведение",
    hint: "Друг играч ти причинява дискомфорт или нарушава кодекса на масата.",
    icon: "⚠",
    evidenceLabel: "Код на стая и приблизителен час",
    evidencePlaceholder: "ABC123 · вчера около 21:30",
    bodyPlaceholder: "Какво се случи? Кой беше намесен? Кога? Какви бяха думите или действията?",
  },
  copyright: {
    id: "copyright",
    label: "Авторски права",
    hint: "Съдържание, което нарушава нечии авторски права.",
    icon: "©",
    evidenceLabel: "Линк към материала + кой е автор",
    evidencePlaceholder: "URL към съдържанието + кой е носител на правата",
    bodyPlaceholder: "Какво съдържание е защитено? Кога е публикувано? С какво доказваш правата си?",
  },
  bug: {
    id: "bug",
    label: "Технически бъг",
    hint: "Нещо в играта не работи или се държи неочаквано.",
    icon: "⚙",
    evidenceLabel: "Страница / browser / стъпки",
    evidencePlaceholder: "/play/ABC123 · Chrome 120 · 1. Влязох в стая, 2. ...",
    bodyPlaceholder: "Какво се случи? Какво очакваше да се случи? Можеш ли да го повториш?",
  },
  gdpr: {
    id: "gdpr",
    label: "Лични данни / GDPR",
    hint: "Въпрос или жалба, свързана с обработката на твоите лични данни.",
    icon: "🔒",
    evidenceLabel: "Кое право упражняваш",
    evidencePlaceholder: "Достъп, изтриване, преносимост, възражение, ограничаване",
    bodyPlaceholder: "Какво искаш да направим с твоите данни? Защо?",
  },
  other: {
    id: "other",
    label: "Друго",
    hint: "Не пасва в горните категории, но искаш да ни кажеш.",
    icon: "✉",
    evidenceLabel: "Допълнителна информация (по избор)",
    evidencePlaceholder: "Линк, име на стая, или каквото може да помогне.",
    bodyPlaceholder: "Кажи ни накратко.",
  },
};

const STEPS: Step[] = ["type", "details", "identity", "review"];

export function ReportWizard({ userEmail, userName }: Props) {
  const [step, setStep] = useState<Step>("type");
  const [type, setType] = useState<ReportType>("abuse");
  const [body, setBody] = useState("");
  const [evidence, setEvidence] = useState("");
  const [identity, setIdentity] = useState<"anonymous" | "identified">(userEmail ? "identified" : "anonymous");
  const [email, setEmail] = useState(userEmail ?? "");
  const [status, setStatus] = useState<"idle" | "submitting" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [referenceId, setReferenceId] = useState<string | null>(null);

  const bodyId = useId();
  const evidenceId = useId();
  const emailId = useId();

  const meta = TYPE_META[type];
  const stepIndex = STEPS.indexOf(step);
  const totalSteps = STEPS.length;

  function goNext() {
    const next = STEPS[stepIndex + 1];
    if (next) setStep(next);
  }

  function goBack() {
    const prev = STEPS[stepIndex - 1];
    if (prev) setStep(prev);
  }

  function validateStep(): string | null {
    if (step === "details") {
      if (body.trim().length < 20) return "Опиши с поне 20 символа.";
    }
    if (step === "identity") {
      if (identity === "identified" && email.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
        return "Невалиден имейл.";
      }
    }
    return null;
  }

  function advance() {
    const error = validateStep();
    if (error) {
      setErrorMsg(error);
      return;
    }
    setErrorMsg("");
    goNext();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");
    setErrorMsg("");

    try {
      const response = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          body: body.trim(),
          email: identity === "identified" && email.trim() ? email.trim() : null,
          evidence: evidence.trim() || null,
        }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        setErrorMsg(data.error ?? "Грешка при изпращане.");
        setStatus("error");
        return;
      }

      // Generate a short reference ID client-side for user comfort
      const refId = generateReferenceId();
      setReferenceId(refId);
      setStep("success");
      setStatus("idle");
    } catch {
      setErrorMsg("Грешка при изпращане.");
      setStatus("error");
    }
  }

  if (step === "success") {
    return (
      <ReportSuccessState
        referenceId={referenceId}
        identity={identity}
        type={type}
      />
    );
  }

  return (
    <section className="report-wizard" aria-label="Сигнал — съветник">
      <nav className="report-wizard-progress" aria-label="Стъпки">
        <div className="report-wizard-progress-bar" aria-hidden>
          <div
            className="report-wizard-progress-fill"
            style={{ width: `${((stepIndex + 1) / totalSteps) * 100}%` }}
          />
        </div>
        <p className="report-wizard-progress-label">
          Стъпка {stepIndex + 1} от {totalSteps}
        </p>
      </nav>

      <form onSubmit={submit}>
        {step === "type" && (
          <fieldset className="report-wizard-step">
            <legend>За какво е сигналът?</legend>
            <p className="report-wizard-step-lede">Изберете вида, който най-точно описва ситуацията.</p>
            <div className="report-type-grid">
              {(Object.keys(TYPE_META) as ReportType[]).map((key) => {
                const item = TYPE_META[key];
                return (
                  <label key={key} className="report-type-card" data-active={type === key}>
                    <input
                      type="radio"
                      name="report-type"
                      value={key}
                      checked={type === key}
                      onChange={() => setType(key)}
                    />
                    <span className="report-type-icon" aria-hidden>{item.icon}</span>
                    <span className="report-type-label">{item.label}</span>
                    <span className="report-type-hint">{item.hint}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        )}

        {step === "details" && (
          <fieldset className="report-wizard-step">
            <legend>Какво се случи?</legend>
            <p className="report-wizard-step-lede">
              Колкото повече подробности, толкова по-бързо реагираме.
            </p>

            <div className="report-field">
              <label htmlFor={bodyId}>Описание</label>
              <textarea
                id={bodyId}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder={meta.bodyPlaceholder}
                rows={6}
                minLength={20}
                maxLength={4000}
                required
              />
              <div className="report-field-foot">
                <span className="report-field-count">{body.length} / 4000</span>
              </div>
            </div>

            <div className="report-field">
              <label htmlFor={evidenceId}>{meta.evidenceLabel} <span className="report-field-optional">(по избор)</span></label>
              <input
                id={evidenceId}
                type="text"
                value={evidence}
                onChange={(e) => setEvidence(e.target.value)}
                placeholder={meta.evidencePlaceholder}
                maxLength={500}
              />
            </div>
          </fieldset>
        )}

        {step === "identity" && (
          <fieldset className="report-wizard-step">
            <legend>Как искаш да отговорим?</legend>
            <p className="report-wizard-step-lede">
              Можеш да подадеш сигнала анонимно — но няма да можем да ти отговорим лично.
            </p>

            <div className="report-identity-grid">
              <label className="report-identity-card" data-active={identity === "identified"}>
                <input
                  type="radio"
                  name="report-identity"
                  value="identified"
                  checked={identity === "identified"}
                  onChange={() => setIdentity("identified")}
                />
                <span className="report-identity-title">С имейл</span>
                <span className="report-identity-hint">Получаваш отговор. Имейлът се ползва само за този сигнал.</span>
              </label>

              <label className="report-identity-card" data-active={identity === "anonymous"}>
                <input
                  type="radio"
                  name="report-identity"
                  value="anonymous"
                  checked={identity === "anonymous"}
                  onChange={() => setIdentity("anonymous")}
                />
                <span className="report-identity-title">Анонимно</span>
                <span className="report-identity-hint">Не запазваме имейл. Действаме по сигнала, но не получаваш потвърждение.</span>
              </label>
            </div>

            {identity === "identified" ? (
              <div className="report-field">
                <label htmlFor={emailId}>Твоят имейл</label>
                <input
                  id={emailId}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ime@example.bg"
                  autoComplete="email"
                  required
                />
                {userEmail ? (
                  <p className="report-field-hint">Предварително попълнен от твоя профил.</p>
                ) : null}
              </div>
            ) : null}
          </fieldset>
        )}

        {step === "review" && (
          <fieldset className="report-wizard-step">
            <legend>Преглед преди изпращане.</legend>
            <p className="report-wizard-step-lede">Виж дали всичко изглежда наред.</p>

            <dl className="report-review">
              <div>
                <dt>Вид сигнал</dt>
                <dd>{meta.icon} {meta.label}</dd>
              </div>
              <div>
                <dt>Описание</dt>
                <dd className="report-review-body">{body}</dd>
              </div>
              {evidence ? (
                <div>
                  <dt>Доказателство</dt>
                  <dd>{evidence}</dd>
                </div>
              ) : null}
              <div>
                <dt>Идентичност</dt>
                <dd>
                  {identity === "identified"
                    ? `С имейл (${email})`
                    : "Анонимно"}
                </dd>
              </div>
            </dl>

            <p className="report-review-promise">
              Преглеждаме всеки сигнал в рамките на <strong>48 часа</strong>. При спешност можем да реагираме по-бързо.
            </p>
          </fieldset>
        )}

        {errorMsg ? <p className="report-wizard-error" role="alert">{errorMsg}</p> : null}

        <div className="report-wizard-actions">
          {stepIndex > 0 ? (
            <button type="button" className="report-wizard-back" onClick={goBack}>
              ← Назад
            </button>
          ) : (
            <Link href="/" className="report-wizard-back">
              ← Към началото
            </Link>
          )}

          {step === "review" ? (
            <button
              type="submit"
              className="report-wizard-submit"
              disabled={status === "submitting"}
            >
              {status === "submitting" ? "Изпращаме..." : "Изпрати сигнал"}
            </button>
          ) : (
            <button type="button" className="report-wizard-next" onClick={advance}>
              Напред →
            </button>
          )}
        </div>
      </form>
    </section>
  );
}

function generateReferenceId(): string {
  // Short human-readable reference like "СИГ-A4F3"
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let id = "";
  for (let i = 0; i < 4; i += 1) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return `СИГ-${id}`;
}

function ReportSuccessState({
  referenceId,
  identity,
  type,
}: {
  referenceId: string | null;
  identity: "anonymous" | "identified";
  type: ReportType;
}) {
  const meta = TYPE_META[type];

  return (
    <section className="report-success" role="status">
      <div className="report-success-beam" aria-hidden />

      <div className="report-success-icon" aria-hidden>
        <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="32" cy="32" r="28" />
          <path d="M20 32 L 28 40 L 44 24" />
        </svg>
      </div>

      <p className="report-success-kicker">сигналът е получен</p>
      <h2 className="report-success-title">Светилникът свети.</h2>
      <p className="report-success-detail">
        Получихме сигнала ти за <strong>{meta.label.toLowerCase()}</strong>. Преглеждаме в рамките
        на <strong>48 часа</strong>.
      </p>

      {referenceId ? (
        <div className="report-success-reference">
          <p className="report-success-ref-label">Референция</p>
          <p className="report-success-ref-value">{referenceId}</p>
          <p className="report-success-ref-hint">Запази я, ако искаш да се позовеш на този сигнал по-късно.</p>
        </div>
      ) : null}

      {identity === "identified" ? (
        <p className="report-success-followup">Ще получиш отговор на посочения имейл.</p>
      ) : (
        <p className="report-success-followup">Сигналът е анонимен — няма да получиш потвърждение.</p>
      )}

      <div className="report-success-actions">
        <Link href="/" className="report-success-link">Към началото</Link>
        <Link href="/account" className="report-success-link">Към профила</Link>
      </div>
    </section>
  );
}
```

---

## Stage 4 — CSS overhaul

Премахни всичките `.handshake-*` и `.lighthouse-*` старите правила в globals.css. Добави нови `.terms-*` и `.report-*` блокове.

### Shared CSS variables (терми + report)

```css
.terms-shell,
.report-shell {
  --legal-bg: #0d0a08;
  --legal-surface: rgba(26, 20, 16, 0.72);
  --legal-surface-strong: rgba(36, 28, 22, 0.9);
  --legal-text: #f5e8c8;
  --legal-text-muted: rgba(245, 232, 200, 0.74);
  --legal-text-soft: rgba(245, 232, 200, 0.5);
  --legal-border: rgba(245, 232, 200, 0.12);
  --legal-border-strong: rgba(245, 232, 200, 0.22);
  --legal-accent-warm: #d19a42;
  --legal-accent-warm-soft: rgba(209, 154, 66, 0.18);
  --legal-ok: #6fbf6f;
  --legal-ok-soft: rgba(111, 191, 111, 0.16);
  --legal-not-ok: #d94a3d;
  --legal-not-ok-soft: rgba(217, 74, 61, 0.18);

  background: var(--legal-bg);
  color: var(--legal-text);
  font-family: "Noto Sans", system-ui, -apple-system, "Segoe UI", sans-serif;
  min-height: 100vh;
  padding: 0 0 64px;
}

.terms-shell { --legal-accent: #8a6a4a; }
.report-shell { --legal-accent: #d94a3d; }
```

### Hero shared pattern

```css
/* Hero — shared between /terms and /report */

.terms-hero,
.report-hero {
  position: relative;
  width: 100%;
  min-height: clamp(280px, 38vw, 460px);
  border-bottom: 1px solid var(--legal-border);
  overflow: hidden;
}

.terms-hero-banner,
.report-hero-banner {
  position: absolute;
  inset: 0;
  overflow: hidden;
}

.terms-hero-img,
.report-hero-img {
  object-fit: cover;
  object-position: center 38%;
}

.terms-hero-scrim,
.report-hero-scrim {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(13, 10, 8, 0.22) 0%, rgba(13, 10, 8, 0.55) 50%, rgba(13, 10, 8, 0.95) 100%);
}

/* Animated lighthouse beam over /report hero */

.report-hero-beam {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse 80% 40% at 65% 38%, rgba(217, 154, 66, 0.32) 0%, rgba(217, 154, 66, 0.08) 28%, transparent 50%);
  mix-blend-mode: screen;
  animation: report-beam-pulse 6s ease-in-out infinite;
  pointer-events: none;
}

@keyframes report-beam-pulse {
  0%, 100% { opacity: 0.55; transform: scale(1); }
  50% { opacity: 0.95; transform: scale(1.06); }
}

.terms-hero-inner,
.report-hero-inner {
  position: relative;
  z-index: 1;
  max-width: 980px;
  margin: 0 auto;
  padding: 32px 24px 40px;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
}

.terms-hero-kicker,
.report-hero-kicker {
  font-size: 0.72rem;
  letter-spacing: 0.32em;
  text-transform: uppercase;
  font-weight: 700;
  color: var(--legal-accent);
  margin: 0 0 10px;
}

.terms-hero-title,
.report-hero-title {
  font-family: "Noto Serif Display", "Noto Serif", serif;
  font-size: clamp(2rem, 5vw, 3.4rem);
  font-weight: 900;
  letter-spacing: -0.015em;
  line-height: 1.05;
  color: var(--legal-text);
  text-shadow: 0 2px 14px rgba(0, 0, 0, 0.55);
  margin: 0 0 14px;
  max-width: 22ch;
}

.terms-hero-subtitle,
.report-hero-subtitle {
  font-size: 1.05rem;
  line-height: 1.6;
  color: var(--legal-text-muted);
  max-width: 60ch;
  margin: 0 0 14px;
}

.terms-hero-meta {
  font-size: 0.85rem;
  color: var(--legal-text-soft);
  letter-spacing: 0.04em;
  margin: 0;
}

.report-hero-stat {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  background: rgba(13, 10, 8, 0.55);
  border: 1px solid var(--legal-border-strong);
  border-radius: 999px;
  font-size: 0.92rem;
  color: var(--legal-text-muted);
  align-self: start;
}

.report-hero-stat-icon {
  font-size: 1rem;
}

.terms-content,
.report-content {
  max-width: 980px;
  margin: 0 auto;
  padding: 32px 24px 0;
  display: grid;
  gap: 28px;
}

/* Section base — shared */

.terms-section,
.report-section {
  padding: 28px;
  background: var(--legal-surface);
  border: 1px solid var(--legal-border);
  border-radius: 18px;
}

.terms-section-head,
.report-section-head {
  margin-bottom: 22px;
}

.terms-section-kicker,
.report-section-kicker {
  font-size: 0.72rem;
  letter-spacing: 0.24em;
  text-transform: uppercase;
  font-weight: 700;
  color: var(--legal-accent);
  margin: 0 0 6px;
}

.terms-section-head h2,
.report-section-head h2 {
  font-family: "Noto Serif Display", serif;
  font-size: clamp(1.5rem, 3.2vw, 2rem);
  font-weight: 900;
  letter-spacing: -0.01em;
  line-height: 1.1;
  color: var(--legal-text);
  margin: 0 0 8px;
}

.terms-section-lede,
.report-section-lede {
  font-size: 0.98rem;
  color: var(--legal-text-muted);
  line-height: 1.55;
  margin: 0;
  max-width: 60ch;
}
```

### Terms-specific CSS

```css
/* Terms — Acceptance section */

.terms-section-acceptance {
  background: linear-gradient(155deg, var(--legal-accent-warm-soft), var(--legal-surface));
  border-color: rgba(209, 154, 66, 0.32);
}

.terms-acceptance-body {
  display: grid;
  gap: 14px;
}

.terms-acceptance-state {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 16px;
  align-items: center;
  padding: 18px 22px;
  background: rgba(13, 10, 8, 0.45);
  border: 1px solid var(--legal-border);
  border-radius: 14px;
}

.terms-acceptance-state-signed {
  border-color: rgba(111, 191, 111, 0.4);
  background: linear-gradient(155deg, var(--legal-ok-soft), rgba(13, 10, 8, 0.45));
}

.terms-acceptance-mark {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-size: 1.4rem;
  font-weight: 800;
}

.terms-acceptance-state-signed .terms-acceptance-mark {
  background: var(--legal-ok-soft);
  border: 2px solid var(--legal-ok);
  color: var(--legal-ok);
}

.terms-acceptance-state-pending .terms-acceptance-mark {
  background: var(--legal-accent-warm-soft);
  border: 2px dashed var(--legal-accent-warm);
  color: var(--legal-accent-warm);
}

.terms-acceptance-title {
  font-family: "Noto Serif Display", serif;
  font-size: 1.1rem;
  font-weight: 800;
  color: var(--legal-text);
  margin: 0;
}

.terms-acceptance-detail {
  font-size: 0.88rem;
  color: var(--legal-text-muted);
  margin: 2px 0 0;
}

.terms-acceptance-btn {
  padding: 10px 18px;
  background: var(--legal-accent-warm);
  border: 1px solid var(--legal-accent-warm);
  border-radius: 10px;
  color: #1a1410;
  font-family: inherit;
  font-weight: 700;
  cursor: pointer;
  transition: filter 160ms ease, transform 160ms ease;
}

.terms-acceptance-btn:hover {
  filter: brightness(1.08);
  transform: translateY(-1px);
}

.terms-acceptance-toast {
  position: absolute;
  margin-top: 8px;
  font-size: 0.82rem;
  color: var(--legal-ok);
  animation: terms-toast-in 320ms ease-out;
}

@keyframes terms-toast-in {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Terms — Commitments list (5 cards with ОК/НЕ-ОК) */

.terms-commitment-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 10px;
}

.terms-commitment-item {
  background: var(--legal-surface-strong);
  border: 1px solid var(--legal-border);
  border-radius: 14px;
  overflow: hidden;
  transition: border-color 160ms ease;
}

.terms-commitment-item[data-open="true"] {
  border-color: var(--legal-accent-warm);
}

.terms-commitment-handle {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 16px;
  width: 100%;
  padding: 18px 22px;
  background: transparent;
  border: none;
  color: var(--legal-text);
  font-family: inherit;
  text-align: left;
  cursor: pointer;
  align-items: center;
}

.terms-commitment-num {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--legal-accent-warm-soft);
  border: 2px solid var(--legal-accent-warm);
  color: var(--legal-accent-warm);
  display: grid;
  place-items: center;
  font-family: "Noto Serif Display", serif;
  font-weight: 900;
  font-size: 1.1rem;
}

.terms-commitment-meta h3 {
  font-family: "Noto Serif Display", serif;
  font-size: 1.15rem;
  font-weight: 800;
  margin: 0 0 4px;
  color: var(--legal-text);
}

.terms-commitment-meta p {
  font-size: 0.92rem;
  line-height: 1.55;
  color: var(--legal-text-muted);
  margin: 0;
}

.terms-commitment-chevron {
  font-size: 1.4rem;
  font-weight: 700;
  color: var(--legal-accent-warm);
}

.terms-commitment-detail {
  padding: 4px 22px 22px;
  border-top: 1px dashed var(--legal-border);
  margin-top: -1px;
}

.terms-examples-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
}

@media (min-width: 768px) {
  .terms-examples-grid { grid-template-columns: 1fr 1fr; }
}

.terms-examples {
  padding: 14px 16px;
  border-radius: 12px;
  border-left: 3px solid;
}

.terms-examples-ok {
  background: var(--legal-ok-soft);
  border-left-color: var(--legal-ok);
}

.terms-examples-not-ok {
  background: var(--legal-not-ok-soft);
  border-left-color: var(--legal-not-ok);
}

.terms-examples-label {
  font-size: 0.72rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  font-weight: 700;
  margin: 0 0 10px;
}

.terms-examples-ok .terms-examples-label { color: var(--legal-ok); }
.terms-examples-not-ok .terms-examples-label { color: var(--legal-not-ok); }

.terms-examples ul {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 8px;
}

.terms-examples li {
  display: grid;
  grid-template-columns: 18px 1fr;
  gap: 10px;
  align-items: start;
  font-size: 0.9rem;
  line-height: 1.5;
  color: var(--legal-text);
}

.terms-examples-icon {
  font-weight: 900;
  font-size: 0.95rem;
  margin-top: 1px;
}

.terms-examples-ok .terms-examples-icon { color: var(--legal-ok); }
.terms-examples-not-ok .terms-examples-icon { color: var(--legal-not-ok); }

/* Terms — Conflict flow */

.terms-section-conflict {
  background: linear-gradient(155deg, rgba(58, 79, 122, 0.16), var(--legal-surface));
}

.terms-conflict-steps {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 16px;
  counter-reset: terms-conflict;
}

.terms-conflict-steps li {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 16px;
  padding: 16px 18px;
  background: rgba(13, 10, 8, 0.5);
  border: 1px solid var(--legal-border);
  border-radius: 12px;
}

.terms-conflict-num {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--legal-accent-warm-soft);
  border: 2px solid var(--legal-accent-warm);
  color: var(--legal-accent-warm);
  display: grid;
  place-items: center;
  font-family: "Noto Serif Display", serif;
  font-weight: 900;
  font-size: 1rem;
  flex-shrink: 0;
}

.terms-conflict-steps h3 {
  font-family: "Noto Serif Display", serif;
  font-size: 1.05rem;
  font-weight: 800;
  color: var(--legal-text);
  margin: 0 0 6px;
}

.terms-conflict-steps p {
  font-size: 0.92rem;
  line-height: 1.55;
  color: var(--legal-text-muted);
  margin: 0;
}

.terms-conflict-steps a {
  color: var(--legal-accent-warm);
  text-decoration: underline;
  text-underline-offset: 3px;
}

/* Terms — Legal annex (collapsible) */

.terms-section-annex {
  padding: 0;
  background: transparent;
  border: none;
}

.terms-annex-toggle {
  width: 100%;
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 16px;
  padding: 18px 22px;
  background: var(--legal-surface);
  border: 1px solid var(--legal-border);
  border-radius: 14px;
  color: var(--legal-text);
  font-family: inherit;
  text-align: left;
  cursor: pointer;
  transition: border-color 160ms ease;
}

.terms-annex-toggle:hover {
  border-color: var(--legal-accent-warm);
}

.terms-annex-icon {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--legal-accent-warm-soft);
  color: var(--legal-accent-warm);
  display: grid;
  place-items: center;
  font-weight: 800;
  font-size: 1.2rem;
}

.terms-annex-kicker {
  font-size: 0.7rem;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  font-weight: 700;
  color: var(--legal-accent-warm);
  margin: 0 0 4px;
}

.terms-annex-title {
  font-family: "Noto Serif Display", serif;
  font-size: 1.05rem;
  font-weight: 800;
  color: var(--legal-text);
  margin: 0 0 4px;
}

.terms-annex-hint {
  font-size: 0.85rem;
  color: var(--legal-text-muted);
  margin: 0;
}

.terms-annex-list {
  list-style: none;
  padding: 18px 0 0;
  margin: 0;
  display: grid;
  gap: 16px;
}

.terms-annex-item {
  padding: 16px 18px;
  background: var(--legal-surface);
  border: 1px solid var(--legal-border);
  border-radius: 12px;
  scroll-margin-top: 80px;
}

.terms-annex-item h3 {
  font-family: "Noto Serif Display", serif;
  font-size: 1.05rem;
  font-weight: 800;
  color: var(--legal-text);
  margin: 0 0 10px;
  display: flex;
  align-items: baseline;
  gap: 10px;
}

.terms-annex-num {
  font-size: 0.8em;
  color: var(--legal-text-soft);
}

.terms-annex-body {
  font-size: 0.92rem;
  line-height: 1.65;
  color: var(--legal-text-muted);
}

.terms-annex-body a {
  color: var(--legal-accent-warm);
  text-decoration: underline;
  text-underline-offset: 3px;
}
```

### Report-specific CSS

```css
/* Report wizard */

.report-wizard {
  padding: 28px;
  background: var(--legal-surface);
  border: 1px solid var(--legal-border);
  border-radius: 18px;
}

/* Progress bar */

.report-wizard-progress {
  margin-bottom: 24px;
}

.report-wizard-progress-bar {
  height: 4px;
  background: rgba(245, 232, 200, 0.1);
  border-radius: 2px;
  overflow: hidden;
}

.report-wizard-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--legal-accent-warm), var(--legal-accent));
  border-radius: 2px;
  transition: width 260ms ease;
}

.report-wizard-progress-label {
  margin: 8px 0 0;
  font-size: 0.78rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  font-weight: 700;
  color: var(--legal-text-soft);
}

/* Step */

.report-wizard-step {
  border: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 18px;
  animation: report-step-in 280ms ease-out;
}

@keyframes report-step-in {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

.report-wizard-step legend {
  font-family: "Noto Serif Display", serif;
  font-size: 1.4rem;
  font-weight: 900;
  color: var(--legal-text);
  margin: 0;
}

.report-wizard-step-lede {
  font-size: 0.95rem;
  color: var(--legal-text-muted);
  line-height: 1.55;
  margin: 0 0 8px;
  max-width: 60ch;
}

/* Type cards (step 1) */

.report-type-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
}

@media (min-width: 640px) {
  .report-type-grid { grid-template-columns: 1fr 1fr; }
}

.report-type-card {
  position: relative;
  display: grid;
  grid-template-columns: auto 1fr;
  grid-template-rows: auto auto;
  gap: 4px 14px;
  padding: 16px 18px;
  background: var(--legal-surface-strong);
  border: 1px solid var(--legal-border);
  border-radius: 12px;
  cursor: pointer;
  transition: border-color 160ms ease, background 160ms ease;
}

.report-type-card:hover {
  border-color: var(--legal-border-strong);
}

.report-type-card[data-active="true"] {
  border-color: var(--legal-accent);
  background: rgba(217, 74, 61, 0.14);
}

.report-type-card input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.report-type-icon {
  width: 36px;
  height: 36px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: var(--legal-accent-warm-soft);
  color: var(--legal-accent-warm);
  font-size: 1.2rem;
  font-weight: 800;
  grid-row: 1 / 3;
}

.report-type-label {
  font-weight: 700;
  font-size: 0.98rem;
  color: var(--legal-text);
}

.report-type-hint {
  font-size: 0.82rem;
  color: var(--legal-text-soft);
  line-height: 1.4;
}

/* Field */

.report-field {
  display: grid;
  gap: 6px;
}

.report-field label {
  font-size: 0.85rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: var(--legal-text);
}

.report-field-optional {
  color: var(--legal-text-soft);
  font-weight: 500;
  font-size: 0.78rem;
}

.report-field input,
.report-field textarea {
  padding: 12px 14px;
  border: 1px solid var(--legal-border-strong);
  border-radius: 10px;
  background: rgba(13, 10, 8, 0.5);
  color: var(--legal-text);
  font-family: inherit;
  font-size: 0.98rem;
  line-height: 1.5;
  transition: border-color 120ms ease, box-shadow 120ms ease;
}

.report-field textarea {
  resize: vertical;
  min-height: 120px;
}

.report-field input:focus,
.report-field textarea:focus {
  outline: none;
  border-color: var(--legal-accent);
  box-shadow: 0 0 0 3px rgba(217, 74, 61, 0.22);
}

.report-field input::placeholder,
.report-field textarea::placeholder {
  color: var(--legal-text-soft);
}

.report-field-foot {
  display: flex;
  justify-content: space-between;
  font-size: 0.78rem;
}

.report-field-count {
  color: var(--legal-text-soft);
  font-variant-numeric: tabular-nums;
}

.report-field-hint {
  font-size: 0.8rem;
  color: var(--legal-text-soft);
  font-style: italic;
  margin: 0;
}

/* Identity cards (step 3) */

.report-identity-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
}

@media (min-width: 640px) {
  .report-identity-grid { grid-template-columns: 1fr 1fr; }
}

.report-identity-card {
  position: relative;
  display: grid;
  gap: 6px;
  padding: 16px 18px;
  background: var(--legal-surface-strong);
  border: 1px solid var(--legal-border);
  border-radius: 12px;
  cursor: pointer;
  transition: border-color 160ms ease, background 160ms ease;
}

.report-identity-card:hover {
  border-color: var(--legal-border-strong);
}

.report-identity-card[data-active="true"] {
  border-color: var(--legal-accent);
  background: rgba(217, 74, 61, 0.14);
}

.report-identity-card input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.report-identity-title {
  font-weight: 700;
  font-size: 1rem;
  color: var(--legal-text);
}

.report-identity-hint {
  font-size: 0.85rem;
  color: var(--legal-text-soft);
  line-height: 1.4;
}

/* Review (step 4) */

.report-review {
  display: grid;
  gap: 14px;
  padding: 18px 20px;
  background: var(--legal-surface-strong);
  border: 1px solid var(--legal-border);
  border-radius: 12px;
}

.report-review div {
  display: grid;
  gap: 4px;
}

.report-review dt {
  font-size: 0.72rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  font-weight: 700;
  color: var(--legal-accent-warm);
}

.report-review dd {
  font-size: 0.95rem;
  color: var(--legal-text);
  line-height: 1.55;
  margin: 0;
}

.report-review-body {
  white-space: pre-wrap;
  background: rgba(13, 10, 8, 0.4);
  padding: 10px 12px;
  border-radius: 8px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.88rem;
}

.report-review-promise {
  padding: 14px 18px;
  background: var(--legal-accent-warm-soft);
  border-left: 3px solid var(--legal-accent-warm);
  border-radius: 0 10px 10px 0;
  font-size: 0.92rem;
  color: var(--legal-text);
  margin: 0;
}

/* Wizard error */

.report-wizard-error {
  padding: 12px 14px;
  background: rgba(217, 74, 61, 0.18);
  border-left: 3px solid var(--legal-not-ok);
  border-radius: 0 10px 10px 0;
  color: var(--legal-text);
  font-weight: 600;
  font-size: 0.92rem;
  margin: 0;
}

/* Wizard actions */

.report-wizard-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-top: 24px;
}

.report-wizard-back,
.report-wizard-next,
.report-wizard-submit {
  padding: 10px 18px;
  border-radius: 10px;
  font-family: inherit;
  font-weight: 700;
  cursor: pointer;
  transition: filter 160ms ease, transform 160ms ease, border-color 160ms ease;
  text-decoration: none;
  font-size: 0.95rem;
}

.report-wizard-back {
  background: transparent;
  border: 1px solid var(--legal-border-strong);
  color: var(--legal-text-muted);
}

.report-wizard-back:hover {
  border-color: var(--legal-accent);
  color: var(--legal-text);
}

.report-wizard-next,
.report-wizard-submit {
  background: var(--legal-accent);
  border: 1px solid var(--legal-accent);
  color: #fff5e0;
  margin-left: auto;
}

.report-wizard-next:hover:not(:disabled),
.report-wizard-submit:hover:not(:disabled) {
  filter: brightness(1.1);
  transform: translateY(-1px);
}

.report-wizard-submit:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Success state */

.report-success {
  position: relative;
  padding: 48px 28px 32px;
  background: linear-gradient(155deg, var(--legal-accent-warm-soft), var(--legal-surface));
  border: 1px solid var(--legal-accent-warm);
  border-radius: 18px;
  display: grid;
  gap: 14px;
  text-align: center;
  overflow: hidden;
}

.report-success-beam {
  position: absolute;
  inset: -50% 0;
  background: conic-gradient(
    from 0deg at 50% 50%,
    transparent 0deg,
    rgba(217, 154, 66, 0.25) 30deg,
    transparent 60deg,
    transparent 360deg
  );
  animation: report-success-rotate 8s linear infinite;
  pointer-events: none;
  mix-blend-mode: screen;
}

@keyframes report-success-rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.report-success-icon {
  position: relative;
  z-index: 1;
  margin: 0 auto;
  width: 88px;
  height: 88px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: var(--legal-ok-soft);
  border: 2px solid var(--legal-ok);
  color: var(--legal-ok);
  animation: report-success-pop 480ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

@keyframes report-success-pop {
  0% { transform: scale(0.4); opacity: 0; }
  60% { transform: scale(1.12); }
  100% { transform: scale(1); opacity: 1; }
}

.report-success-icon svg {
  width: 56px;
  height: 56px;
}

.report-success-kicker {
  position: relative;
  z-index: 1;
  font-size: 0.7rem;
  letter-spacing: 0.32em;
  text-transform: uppercase;
  font-weight: 700;
  color: var(--legal-accent-warm);
  margin: 0;
}

.report-success-title {
  position: relative;
  z-index: 1;
  font-family: "Noto Serif Display", serif;
  font-size: clamp(1.75rem, 4vw, 2.4rem);
  font-weight: 900;
  color: var(--legal-text);
  margin: 0;
}

.report-success-detail {
  position: relative;
  z-index: 1;
  font-size: 1rem;
  line-height: 1.6;
  color: var(--legal-text-muted);
  max-width: 50ch;
  margin: 0 auto;
}

.report-success-reference {
  position: relative;
  z-index: 1;
  padding: 16px 20px;
  background: rgba(13, 10, 8, 0.55);
  border: 1px dashed var(--legal-accent-warm);
  border-radius: 12px;
  display: grid;
  gap: 4px;
  max-width: 320px;
  margin: 8px auto 0;
}

.report-success-ref-label {
  font-size: 0.7rem;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  font-weight: 700;
  color: var(--legal-accent-warm);
  margin: 0;
}

.report-success-ref-value {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 1.4rem;
  font-weight: 900;
  color: var(--legal-text);
  letter-spacing: 0.08em;
  margin: 0;
}

.report-success-ref-hint {
  font-size: 0.78rem;
  color: var(--legal-text-soft);
  font-style: italic;
  margin: 0;
}

.report-success-followup {
  position: relative;
  z-index: 1;
  font-size: 0.92rem;
  color: var(--legal-text-muted);
  margin: 0;
  font-style: italic;
}

.report-success-actions {
  position: relative;
  z-index: 1;
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  justify-content: center;
  margin-top: 8px;
}

.report-success-link {
  padding: 10px 18px;
  border: 1px solid var(--legal-border-strong);
  border-radius: 10px;
  color: var(--legal-text-muted);
  text-decoration: none;
  font-weight: 600;
  font-size: 0.9rem;
  transition: border-color 160ms ease, color 160ms ease;
}

.report-success-link:hover {
  border-color: var(--legal-accent-warm);
  color: var(--legal-text);
}

/* Mobile tweaks */

@media (max-width: 640px) {
  .terms-section,
  .report-section,
  .report-wizard { padding: 22px 18px; }

  .terms-commitment-handle { padding: 16px; }
  .terms-commitment-detail { padding: 4px 16px 16px; }
}
```

---

## Stage 5 — Remove obsolete CSS

В globals.css намери и **изтрий** всичките:
- `.handshake-*` rules (old /terms)
- `.lighthouse-*` rules (old /report)

Запазете `.vault-*` правила ако още не са премахнати — те ще се изтрият в Privacy overhaul PR (или вече са изтрити).

---

## Stage 6 — Update `/api/report` (no breaking changes)

API-то вече приема `{ type, body, email, evidence }`. Wizard payload е същият shape — **no changes needed на route.ts**. Само verify-ни че `type` enum включва `"gdpr"` (новата категория).

В `apps/web/app/api/report/route.ts`, find the type validation. Ensure GDPR е валиден type:

```ts
const VALID_TYPES = new Set(["abuse", "copyright", "bug", "gdpr", "other"]);
const typeRaw = typeof body.type === "string" ? body.type : "other";
const type = VALID_TYPES.has(typeRaw) ? typeRaw : "other";
```

И в email subject формира GDPR badge:

```ts
const TYPE_LABEL_BG: Record<string, string> = {
  abuse: "Тормоз",
  copyright: "Авторски права",
  bug: "Бъг",
  gdpr: "GDPR",
  other: "Друго",
};
```

---

## Stage 7 — Visual regression baselines

```bash
pnpm visual:update
pnpm visual
```

Affected: `/terms` desktop + mobile, `/report` desktop + mobile (with wizard at each step + success state).

Add explicit Playwright snapshots for:
- /terms — anonymous + authenticated (acceptance section visible)
- /terms — commitment card expanded showing ОК/НЕ-ОК grid
- /report — wizard step 1, step 2 (abuse), step 2 (copyright), step 4 review
- /report — success state with reference ID visible

---

## Acceptance criteria

1. **2 imagen assets** (mandatory): `terms-banner.png` + `report-banner.png` + WebP. Optional `report-received.png`. All без visible text.
2. **`/terms` — Кодекс на масата**:
   - Cinematic banner отгоре
   - Acceptance section (auth-only) с persisted "подписан/непрочетен" state
   - 5 commitment cards, всяка collapsible с ОК/НЕ-ОК examples (green vs red sidebars)
   - 4-step conflict resolution flow
   - Legal annex collapsible с 6 formal sections
3. **`/report` — Lighthouse Wizard**:
   - Cinematic banner с animated beam pulse
   - Multi-step wizard (4 steps + success): Type → Details → Identity → Review → Success
   - 5 type cards (added GDPR as new category)
   - Per-type evidence labels and placeholders
   - Anonymous/Identified toggle
   - Email pre-fill от session for logged-in users
   - Success state с lighthouse beam rotation animation + checkmark + reference ID
   - "Обикновено отговаряме в 24-48 часа" stat chip в hero
4. **CSS**: shared `legal-*` variables, terms-specific + report-specific styles.
5. **Old `.handshake-*` and `.lighthouse-*` rules removed**.
6. **БГ-only copy**, all commits in English.
7. **Working directly on `main` branch** — no feature branch created.
8. **`pnpm verify` passes** end to end.
9. **Visual baselines updated** for both pages.
10. **No new npm dependencies**.

---

## Не пипай

- /privacy — отделен redesign PR.
- /account, /faq, /sign-in, homepage — извън scope.
- Game-server, schemas, Better Auth.
- Старите painterly portrait assets (terms-handshake.png, report-lighthouse.png) — остават в repo за back-compat.
- `/api/report` payload shape — wizard sends same fields като старата form.

---

## ⚠ Branch policy — work directly on main

Codex commit-ва incrementally directly to `main`. Никакъв feature branch. След всеки commit стартирай `pnpm regression && pnpm typecheck && pnpm build` за да validate. Ако commit чупи build-а, **revert веднага и поправи преди следващ commit**.

```bash
# Verify clean state
git status
git pull origin main --rebase

# After each implementation step:
git add <specific files>
git commit -m "<English message per commit strategy>"
pnpm regression && pnpm typecheck && pnpm build
# If green, continue. If red, revert and fix.
```

Push to main след всеки successful commit OR след batch of commits — по preference на user-а.

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

Manual:

1. **`/terms` anonymous**: hero + 5 commitments + conflict flow + legal annex. NO acceptance section.
2. **`/terms` logged in**: same + acceptance section с "Прочете ли кодекса?" Click "Подписвам" → state changes to "Прочетен и приет на <date>" с green checkmark.
3. **Commitment expansion**: click card → green ОК list + red НЕ-ОК list visible side-by-side.
4. **`/report` wizard step 1**: 5 type cards visible. Click "Тормоз" → ring around card. Click "Напред".
5. **Step 2**: type-specific placeholder в textarea reflects "Тормоз" type. Evidence label: "Код на стая и приблизителен час".
6. **Step 2 → 3**: validation. Type only 5 chars in body → "Опиши с поне 20 символа" error.
7. **Step 3**: identity toggle. Logged-in user defaults to "С имейл" с pre-filled email. Anonymous user defaults to "Анонимно".
8. **Step 4 review**: дd dl shows type icon + label, body text in monospace block, identity choice, optional evidence.
9. **Submit**: shows loading state. On success → animated success page with rotating beam + reference ID like "СИГ-A4F3".
10. **Mobile** (390×844): All steps usable, type cards stack 1-column, identity cards stack 1-column.

---

## Commit strategy (16 atomic English commits, all on main)

**Working directly on `main` branch — no feature branch.**

Terms first (8 commits):
1. `chore(art): generate cinematic terms banner`
2. `feat(terms): cinematic hero with handshake banner`
3. `feat(terms): TermsAcceptance signed state for authenticated visitors`
4. `feat(terms): five commitment cards reframing terms as honor code`
5. `feat(terms): ok and not-ok visual examples per commitment`
6. `feat(terms): conflict resolution flow with four steps`
7. `feat(terms): collapsible legal annex preserving formal clauses`
8. `style(terms): painterly-marketing card system replacing brass plaque`

Report next (8 commits):
9. `chore(art): generate cinematic report banner with optional success illustration`
10. `feat(report): cinematic hero with animated lighthouse beam`
11. `feat(report): multi-step wizard with progress indicator`
12. `feat(report): type cards with per-type evidence helpers and GDPR category`
13. `feat(report): anonymous and identified identity toggle`
14. `feat(report): review step before submission`
15. `feat(report): success state with rotating beam and reference id`
16. `chore(css): remove obsolete handshake and lighthouse brass-plaque styles`

Plus optional:
17. `chore(visual): regenerate baselines for terms codex and report wizard`

PR title (since working on main, no PR — but if rolling up): `feat: terms codex and report wizard overhauls`

---

(End of prompt)
