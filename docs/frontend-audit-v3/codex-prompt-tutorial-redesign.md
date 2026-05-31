# Codex prompt — Redesign `/tutorial` (Cinematic Flipbook)

Целта: текущата `/tutorial` страница е wall-of-text 3×2 grid от cards + дублиран "Телефонът е карта" блок. Превръщаме я в **кинематографичен 6-слайдов flipbook** с painterly day/night scenes, един интерактивен clue-reveal момент в Slide 3, и emphatic dual-mode CTA на финала.

---

## Prompt (paste below)

You are working in the **werewolf_mafia** monorepo (pnpm 10 + Turbo, Next.js 16 App Router + React 19 + Tailwind 4). Read `AGENTS.md` first — invariants:
- Всичкият user-facing copy на български. Без Latin words в UI.
- Не въвеждай нови npm dependencies (`sharp` вече е там за asset pipeline).
- Не пипай game-server, schemas, role-assignment.
- Без accessibility prompts извън стандартните ARIA attributes в JSX по-долу.

Имаш достъп до `/imagen` (gpt-image-2). Генерирай **две** painterly сцени за visual anchor на slides. `pnpm optimize:assets` автоматично прави WebP вариантите.

### Контекст

Текуща страница `/tutorial`:
- Рендерира се от `apps/web/app/tutorial/page.tsx`.
- Hero + 6-card step grid (Избери маса / Въведи име / Раздай ролите / Изиграй нощта / Говори през деня / Гласувай).
- "Примерна мини-маса" с 5 demo играчи + 4 phase rounds (text-only).
- `tutorial-table-mode` секция "Телефонът е карта, не микрофон" — **дублира** същата секция в `/werewolf/rules`.

Текущ скрийншот: `audit-v3/desktop/13-tutorial.png`.

### Концепция: 6-slide cinematic flipbook

Цялата страница е една horizontal flipbook (един слайд видим в даден момент):

| Slide | Заглавие | Сцена | Body | Интерактивност |
|---|---|---|---|---|
| 1 | Преди нощта | Day scene (low opacity overlay) | Setup: масата, ритуалът, имената | — |
| 2 | Нощта | Night scene full | Очите се затварят, ролите действат | — |
| 3 | Денят | Day scene full | Денят се будна — четене на масата | **5 face-down chips → клик flip → clue reveal** |
| 4 | Гласът | Day scene zoomed на ръце | Гласуването оставя следа | — |
| 5 | Развръзката | Night scene cropped + filter | Какво остава след вечерта | — |
| 6 | Готов? | Split-screen Day/Night | Финал — изборът сега е твой | **Dual-mode emphatic CTA picker** |

### Files to touch

1. `apps/web/app/tutorial/page.tsx` — server wrapper, renders client flipbook.
2. `apps/web/components/tutorial/TutorialFlipbook.tsx` — **нов**, главен client component (slide state, URL sync, keyboard, localStorage).
3. `apps/web/components/tutorial/TutorialSlide.tsx` — **нов** generic slide layout.
4. `apps/web/components/tutorial/TutorialProgress.tsx` — **нов** thin progress bar + dot pagination + skip link.
5. `apps/web/components/tutorial/SlideSetup.tsx` — **нов**, Slide 1.
6. `apps/web/components/tutorial/SlideNight.tsx` — **нов**, Slide 2.
7. `apps/web/components/tutorial/SlideDay.tsx` — **нов**, Slide 3 (взима DayClueChips).
8. `apps/web/components/tutorial/SlideVote.tsx` — **нов**, Slide 4.
9. `apps/web/components/tutorial/SlideResolution.tsx` — **нов**, Slide 5.
10. `apps/web/components/tutorial/SlideFinal.tsx` — **нов**, Slide 6 с dual-mode CTA.
11. `apps/web/components/tutorial/DayClueChips.tsx` — **нов** interactive chips.
12. `apps/web/app/globals.css` — нови `.tutorial-flipbook`, `.tutorial-slide`, `.tutorial-progress`, `.clue-chips` блокове. Премахни **всичко** свързано с `.tutorial-shell`, `.tutorial-hero`, `.tutorial-board`, `.tutorial-step-card`, `.tutorial-demo-table`, `.tutorial-table-mode`, `.demo-player-grid`, `.demo-round-list`.

Не пипай:
- `/werewolf/rules` — "Телефонът е карта" остава там, премахваме само дубликата от tutorial-а.
- Game-server / schemas.

---

## Стъпка 1 — Generate art assets чрез `/imagen`

### Asset #1: Night scene

**Path:** `apps/web/public/game-art/tutorial-night-scene.png`

**Imagen prompt:**
```
A painterly cinematic illustration of a candlelit wooden table at
night, viewed from a slight upper three-quarter angle. Six dimly
visible playing cards lie face-down in a fan arrangement at the
center of the table. Cool moonlight falls through a small window
from the upper right, casting pale blue highlights on the table
edge and on the back of one chair. A single flickering candle on
the opposite side casts warm amber light. The silhouetted hands
of unseen players are barely visible at the edges of the frame,
suggesting a tense pause before action. Dark wood paneling in
the deeply blurred background, with a few faint shapes of
bottles and books. Mood: hushed, secretive, the moment just
before something is whispered. Oil-paint style with visible
brushwork, desaturated palette dominated by warm amber and cool
moonlight blue, deep shadow falloff at the edges (natural
vignette). No text, no symbols, no letters, no numbers anywhere
in the image. Aspect ratio 16:9.
```

**Size:** 1920 × 1080.

### Asset #2: Day scene

**Path:** `apps/web/public/game-art/tutorial-day-scene.png`

**Imagen prompt:**
```
A painterly cinematic illustration of the same wooden table in
the morning. Warm golden daylight streams through an open window
from the upper left, casting long soft shadows across the table.
The cards are now turned face-up but rendered with motion blur —
focus is on accusatory hands gesturing across the table, palms
open or pointing forward. A half-finished glass of dark red wine
sits at the right edge. A sense of debate and recognition. Mood:
suspicion, the moment when accusations begin to crystallize. Oil-
paint style with visible brushwork, warmer palette with golden
amber, dusty rose, and earthen brown, deep shadow falloff at
the corners. No text, no symbols, no letters, no numbers
anywhere in the image. Aspect ratio 16:9.
```

**Size:** 1920 × 1080.

### След генерация

1. Save и двата PNG в горните пътеки.
2. Стартирай `pnpm optimize:assets` — създава WebP + mobile варианти.
3. Verify:
   ```bash
   ls apps/web/public/game-art/tutorial-night-scene.{png,webp}
   ls apps/web/public/game-art/tutorial-day-scene.{png,webp}
   ```

---

## Стъпка 2 — Code

### `apps/web/app/tutorial/page.tsx`

```tsx
import type { Metadata } from "next";
import { TutorialFlipbook } from "@/components/tutorial/TutorialFlipbook";

export const metadata: Metadata = {
  title: "Първа игра | Върколак и Мафия",
  description: "Кинематографичен наръчник за първа игра без регистрация — една вечер в шест сцени.",
};

export default function TutorialPage() {
  return (
    <main className="shell tutorial-shell">
      <TutorialFlipbook />
    </main>
  );
}
```

### `apps/web/components/tutorial/TutorialFlipbook.tsx`

```tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { TutorialProgress } from "./TutorialProgress";
import { SlideSetup } from "./SlideSetup";
import { SlideNight } from "./SlideNight";
import { SlideDay } from "./SlideDay";
import { SlideVote } from "./SlideVote";
import { SlideResolution } from "./SlideResolution";
import { SlideFinal } from "./SlideFinal";

const TOTAL_SLIDES = 6;
const STORAGE_KEY_COMPLETED = "tutorial-completed";
const STORAGE_KEY_LAST_SLIDE = "tutorial-last-slide";

export function TutorialFlipbook() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [current, setCurrent] = useState(1);

  // Restore slide on mount: priority is URL ?step > localStorage last-slide > 1.
  useEffect(() => {
    const fromUrl = Number(searchParams.get("step"));
    if (Number.isFinite(fromUrl) && fromUrl >= 1 && fromUrl <= TOTAL_SLIDES) {
      setCurrent(fromUrl);
      return;
    }
    const stored = Number(window.localStorage.getItem(STORAGE_KEY_LAST_SLIDE));
    if (Number.isFinite(stored) && stored >= 1 && stored <= TOTAL_SLIDES) {
      setCurrent(stored);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync slide → URL + localStorage.
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("step", String(current));
    router.replace(`/tutorial?${params.toString()}`, { scroll: false });
    window.localStorage.setItem(STORAGE_KEY_LAST_SLIDE, String(current));
    if (current === TOTAL_SLIDES) {
      window.localStorage.setItem(STORAGE_KEY_COMPLETED, "1");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  const goTo = useCallback((slide: number) => {
    if (slide < 1 || slide > TOTAL_SLIDES) return;
    setCurrent(slide);
  }, []);

  const next = useCallback(() => goTo(current + 1), [current, goTo]);
  const prev = useCallback(() => goTo(current - 1), [current, goTo]);

  // Keyboard navigation: arrows.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const tag = (event.target as HTMLElement | null)?.tagName ?? "";
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (event.key === "ArrowRight") next();
      if (event.key === "ArrowLeft") prev();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev]);

  const slide = useMemo(() => {
    switch (current) {
      case 1: return <SlideSetup />;
      case 2: return <SlideNight />;
      case 3: return <SlideDay />;
      case 4: return <SlideVote />;
      case 5: return <SlideResolution />;
      case 6: return <SlideFinal />;
      default: return <SlideSetup />;
    }
  }, [current]);

  return (
    <section className="tutorial-flipbook" aria-label="Наръчник за първа игра">
      <TutorialProgress current={current} total={TOTAL_SLIDES} onJump={goTo} />

      <div className="tutorial-slide-stage" role="region" aria-live="polite" aria-atomic="false">
        {slide}
      </div>

      <nav className="tutorial-nav" aria-label="Навигация между сцените">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={prev}
          disabled={current === 1}
          aria-label="Предишна сцена"
        >
          ← Назад
        </button>
        <span className="tutorial-nav-counter">
          Сцена {current} от {TOTAL_SLIDES}
        </span>
        <button
          type="button"
          className="btn btn-primary"
          onClick={next}
          disabled={current === TOTAL_SLIDES}
          aria-label="Следваща сцена"
        >
          Напред →
        </button>
      </nav>

      {current === 1 ? (
        <p className="tutorial-keyboard-hint">
          Съвет: ← → за по-бърза навигация.
        </p>
      ) : null}
    </section>
  );
}
```

### `apps/web/components/tutorial/TutorialProgress.tsx`

```tsx
"use client";

import Link from "next/link";

interface Props {
  current: number;
  total: number;
  onJump: (slide: number) => void;
}

export function TutorialProgress({ current, total, onJump }: Props) {
  return (
    <header className="tutorial-progress">
      <div className="tutorial-progress-bar" aria-hidden>
        <div
          className="tutorial-progress-fill"
          style={{ width: `${(current / total) * 100}%` }}
        />
      </div>

      <div className="tutorial-progress-dots" role="tablist" aria-label="Сцени">
        {Array.from({ length: total }, (_, index) => {
          const slide = index + 1;
          const isActive = slide === current;
          const isPast = slide < current;
          return (
            <button
              key={slide}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-label={`Сцена ${slide}`}
              data-state={isActive ? "active" : isPast ? "past" : "future"}
              onClick={() => onJump(slide)}
              className="tutorial-progress-dot"
            />
          );
        })}
      </div>

      <Link href="/" className="tutorial-skip-link">
        Прескочи →
      </Link>
    </header>
  );
}
```

### `apps/web/components/tutorial/TutorialSlide.tsx` (generic layout)

```tsx
import type { ReactNode } from "react";

interface SlideProps {
  bg: "night" | "day" | "day-low" | "day-zoom" | "night-cropped" | "split";
  kicker: string;
  title: string;
  body: ReactNode;
  callout?: { label: string; text: string };
  children?: ReactNode;
}

const BG_CLASS: Record<SlideProps["bg"], string> = {
  night: "slide-bg-night",
  day: "slide-bg-day",
  "day-low": "slide-bg-day slide-bg-low",
  "day-zoom": "slide-bg-day slide-bg-zoom",
  "night-cropped": "slide-bg-night slide-bg-cropped",
  split: "slide-bg-split",
};

export function TutorialSlide({ bg, kicker, title, body, callout, children }: SlideProps) {
  return (
    <article className={`tutorial-slide ${BG_CLASS[bg]}`}>
      <div className="tutorial-slide-scrim" aria-hidden />
      <div className="tutorial-slide-content">
        <p className="tutorial-slide-kicker">{kicker}</p>
        <h2 className="tutorial-slide-title">{title}</h2>
        <div className="tutorial-slide-body">{body}</div>
        {callout ? (
          <aside className="tutorial-slide-callout">
            <strong>{callout.label}</strong>
            <span>{callout.text}</span>
          </aside>
        ) : null}
        {children}
      </div>
    </article>
  );
}
```

### `apps/web/components/tutorial/SlideSetup.tsx` (Slide 1)

```tsx
import { TutorialSlide } from "./TutorialSlide";

export function SlideSetup() {
  return (
    <TutorialSlide
      bg="day-low"
      kicker="сцена 1 · преди нощта"
      title="Масата се събира."
      body={
        <>
          <p>
            Седем-осем приятели сядат на маса. Никой не е регистриран. Всеки въвежда име, споделяте код,
            влизате в стая. Сървърът ще раздаде картите след минута.
          </p>
          <p>
            Това е единственият момент, в който всички виждат всички. След него всеки знае само своята роля.
          </p>
        </>
      }
      callout={{
        label: "Преди да започнете",
        text: "Дръжте телефоните близо до тялото. Тук имената стават алибита.",
      }}
    />
  );
}
```

### `apps/web/components/tutorial/SlideNight.tsx` (Slide 2)

```tsx
import { TutorialSlide } from "./TutorialSlide";

export function SlideNight() {
  return (
    <TutorialSlide
      bg="night"
      kicker="сцена 2 · нощта"
      title="Очите се затварят."
      body={
        <>
          <p>
            Активните роли действат тайно — Върколаците избират цел, Лечителят пази един, Гадателят проверява.
            Ако нямаш действие, чакаш фазата да приключи.
          </p>
          <p>
            Сървърът пази тайните. На екрана ти виждаш само действия, които те засягат.
          </p>
        </>
      }
      callout={{
        label: "Какво да гледаш",
        text: "Звукът, вибрациите, реакцията на лицата. Нощта издава поведенчески сигнали, не само резултати.",
      }}
    />
  );
}
```

### `apps/web/components/tutorial/DayClueChips.tsx` (интерактивен компонент)

```tsx
"use client";

import { useState } from "react";

const PLAYERS = [
  { name: "Анна", clue: "Говори спокойно, но винаги защитава един и същ играч." },
  { name: "Борис", clue: "Гласува рано, после сменя темата." },
  { name: "Виктор", clue: "Има проверка, но я разкрива косвено." },
  { name: "Галя", clue: "Слуша повече, отколкото говори. Запомня всичко." },
  { name: "Деян", clue: "Обвинява силно без нова причина — често е жертва на блъф." },
] as const;

export function DayClueChips() {
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

  const flip = (name: string) => {
    setRevealed((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  const visited = Object.values(revealed).filter(Boolean).length;

  return (
    <div className="clue-chips" role="group" aria-label="Примерни играчи">
      <p className="clue-chips-hint">
        Кликни 2-3 за да усетиш как се чете масата · посетени: {visited} / {PLAYERS.length}
      </p>
      <div className="clue-chips-row">
        {PLAYERS.map((player) => {
          const isRevealed = Boolean(revealed[player.name]);
          return (
            <button
              key={player.name}
              type="button"
              className="clue-chip"
              data-revealed={isRevealed}
              onClick={() => flip(player.name)}
              aria-pressed={isRevealed}
              aria-label={isRevealed ? `Скрий ${player.name}` : `Разкрий ${player.name}`}
            >
              <span className="clue-chip-inner">
                <span className="clue-chip-front">
                  <span className="clue-chip-initial">{player.name[0]}</span>
                  <span className="clue-chip-name">{player.name}</span>
                </span>
                <span className="clue-chip-back">
                  <strong>{player.name}</strong>
                  <span>{player.clue}</span>
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

### `apps/web/components/tutorial/SlideDay.tsx` (Slide 3 с интерактив)

```tsx
import { TutorialSlide } from "./TutorialSlide";
import { DayClueChips } from "./DayClueChips";

export function SlideDay() {
  return (
    <TutorialSlide
      bg="day"
      kicker="сцена 3 · денят"
      title="Денят се будна — какво остана?"
      body={
        <>
          <p>
            Сега се събира масата. Един от вас вече го няма. Кой говори първо? Кой мълчи прекалено дълго?
            Денят е за четене на масата, не за раздаване на присъди.
          </p>
        </>
      }
      callout={{
        label: "Малък експеримент",
        text: "Това са 5 примерни играчи. Кликни няколко — виж как малка следа изгражда подозрение.",
      }}
    >
      <DayClueChips />
    </TutorialSlide>
  );
}
```

### `apps/web/components/tutorial/SlideVote.tsx` (Slide 4)

```tsx
import { TutorialSlide } from "./TutorialSlide";

export function SlideVote() {
  return (
    <TutorialSlide
      bg="day-zoom"
      kicker="сцена 4 · гласът"
      title="Гласът оставя следа."
      body={
        <>
          <p>
            Когато гласуваш, не натискаш просто бутон. Записва се: кой кого е посочил, кога е сменил мнение,
            кой е мълчал. Записът остава за след играта.
          </p>
          <p>
            Гласът е tactical decision — понякога даваш гласа си, за да провокираш реакция, а не за да елиминираш.
          </p>
        </>
      }
      callout={{
        label: "След играта",
        text: "Записът показва точно кой кого е натискал. Аргументирай се за следващата вечер.",
      }}
    />
  );
}
```

### `apps/web/components/tutorial/SlideResolution.tsx` (Slide 5)

```tsx
import { TutorialSlide } from "./TutorialSlide";

export function SlideResolution() {
  return (
    <TutorialSlide
      bg="night-cropped"
      kicker="сцена 5 · развръзката"
      title="Какво остава, когато утрото дойде."
      body={
        <>
          <p>
            След последния глас идва развръзката — една роля се разкрива, едно име влиза в архива, една група
            научава дали играта продължава.
          </p>
          <p>
            И след всичко това — записът. Архивът помни ходовете. Класацията помни имената. Постиженията
            помнят моментите.
          </p>
        </>
      }
      callout={{
        label: "След вечерта",
        text: "Виж записа, провери класацията, отключи постижения. Това е следата на вашата вечер.",
      }}
    />
  );
}
```

### `apps/web/components/tutorial/SlideFinal.tsx` (Slide 6 с emphatic CTA)

```tsx
import Link from "next/link";
import { TutorialSlide } from "./TutorialSlide";

export function SlideFinal() {
  return (
    <TutorialSlide
      bg="split"
      kicker="сцена 6 · готов?"
      title="Изборът сега е твой."
      body={
        <p>
          Шест сцени, една вечер. Сега си готов да отвориш първата стая.
        </p>
      }
    >
      <div className="tutorial-final-picker" role="group" aria-label="Избор на семейство">
        <Link href="/werewolf/create" className="tutorial-final-card" data-family="werewolves">
          <span className="tutorial-final-kicker">фолклор</span>
          <span className="tutorial-final-title">Започни Върколак</span>
          <span className="tutorial-final-line">Първо пада мъглата. После никой не лъже спокойно.</span>
        </Link>
        <Link href="/mafia/create" className="tutorial-final-card" data-family="mafia">
          <span className="tutorial-final-kicker">ноар</span>
          <span className="tutorial-final-title">Започни Мафия</span>
          <span className="tutorial-final-line">Дъждът измива улицата, но не и алибитата.</span>
        </Link>
      </div>

      <div className="tutorial-final-secondary">
        <Link href="/werewolf/rules" className="tutorial-final-secondary-link">Правила за Върколак</Link>
        <span aria-hidden>·</span>
        <Link href="/mafia/rules" className="tutorial-final-secondary-link">Правила за Мафия</Link>
        <span aria-hidden>·</span>
        <Link href="/roles" className="tutorial-final-secondary-link">Всички роли</Link>
      </div>
    </TutorialSlide>
  );
}
```

---

## CSS — в `apps/web/app/globals.css`

```css
/* ============================== */
/* Tutorial flipbook              */
/* ============================== */

.tutorial-shell {
  display: grid;
  place-items: start center;
  padding: 24px 16px 64px;
  min-height: 100vh;
}

.tutorial-flipbook {
  width: 100%;
  max-width: 1200px;
  display: grid;
  gap: 20px;
}

/* Progress header */
.tutorial-progress {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 12px 24px;
  padding: 8px 4px 0;
}

.tutorial-progress-bar {
  grid-column: 1 / -1;
  height: 3px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
  overflow: hidden;
  margin-bottom: 4px;
}

.tutorial-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #d19a42, #d94a3d);
  transition: width 220ms ease;
  border-radius: 2px;
}

.tutorial-progress-dots {
  display: flex;
  gap: 8px;
}

.tutorial-progress-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.3);
  background: transparent;
  cursor: pointer;
  transition: background 120ms ease, border-color 120ms ease, transform 120ms ease;
  padding: 0;
}

.tutorial-progress-dot[data-state="active"] {
  background: #d94a3d;
  border-color: #d94a3d;
  transform: scale(1.18);
}

.tutorial-progress-dot[data-state="past"] {
  background: rgba(217, 154, 66, 0.6);
  border-color: rgba(217, 154, 66, 0.7);
}

.tutorial-skip-link {
  font-size: 0.8rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  font-weight: 700;
  color: rgba(232, 217, 187, 0.7);
  text-decoration: none;
  white-space: nowrap;
}

.tutorial-skip-link:hover {
  color: #d94a3d;
}

/* Slide stage */
.tutorial-slide-stage {
  position: relative;
  border-radius: 24px;
  overflow: hidden;
  min-height: 540px;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.55);
}

.tutorial-slide {
  position: relative;
  width: 100%;
  min-height: 540px;
  background-size: cover;
  background-position: center;
  color: #f5e8c8;
}

/* Background variants — all use the two generated assets */
.slide-bg-night {
  background-image:
    image-set(
      url("/game-art/tutorial-night-scene.webp") type("image/webp"),
      url("/game-art/tutorial-night-scene.png") type("image/png")
    );
}

.slide-bg-day {
  background-image:
    image-set(
      url("/game-art/tutorial-day-scene.webp") type("image/webp"),
      url("/game-art/tutorial-day-scene.png") type("image/png")
    );
}

.slide-bg-low {
  filter: brightness(0.55) saturate(0.85);
}

.slide-bg-zoom {
  background-size: 140% auto;
  background-position: center 65%;
}

.slide-bg-cropped {
  background-size: 130% auto;
  background-position: 30% center;
  filter: brightness(0.7) contrast(1.1);
}

.slide-bg-split {
  background-image:
    linear-gradient(90deg,
      transparent 0%, transparent 49.5%,
      rgba(255, 240, 220, 0.4) 50%,
      transparent 50.5%, transparent 100%
    ),
    image-set(
      url("/game-art/tutorial-day-scene.webp") type("image/webp"),
      url("/game-art/tutorial-day-scene.png") type("image/png")
    ),
    image-set(
      url("/game-art/tutorial-night-scene.webp") type("image/webp"),
      url("/game-art/tutorial-night-scene.png") type("image/png")
    );
  background-size: 100% 100%, 50% 100%, 50% 100%;
  background-position: center, left center, right center;
  background-repeat: no-repeat;
}

/* Dark scrim for text legibility */
.tutorial-slide-scrim {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(180deg, rgba(10, 8, 6, 0.65) 0%, rgba(10, 8, 6, 0.25) 40%, rgba(10, 8, 6, 0.85) 100%);
  pointer-events: none;
}

.tutorial-slide-content {
  position: relative;
  z-index: 1;
  padding: 56px 48px;
  max-width: 720px;
  display: grid;
  gap: 18px;
}

@media (max-width: 640px) {
  .tutorial-slide-content {
    padding: 36px 24px;
  }
  .tutorial-slide-stage {
    min-height: 620px;
  }
  .tutorial-slide {
    min-height: 620px;
  }
}

.tutorial-slide-kicker {
  font-size: 0.75rem;
  letter-spacing: 0.32em;
  text-transform: uppercase;
  font-weight: 700;
  color: #d19a42;
}

.tutorial-slide-title {
  font-family: "Noto Serif Display", "Noto Serif", serif;
  font-weight: 900;
  font-size: clamp(2.25rem, 5vw, 4rem);
  line-height: 1.04;
  letter-spacing: -0.01em;
  color: #f5e8c8;
  text-shadow: 0 2px 16px rgba(0, 0, 0, 0.7);
}

.tutorial-slide-body p {
  font-size: 1.05rem;
  line-height: 1.65;
  color: rgba(245, 232, 200, 0.92);
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.6);
  max-width: 56ch;
  margin: 0 0 12px;
}

.tutorial-slide-callout {
  display: grid;
  gap: 4px;
  padding: 14px 18px;
  border-left: 3px solid #d94a3d;
  background: rgba(0, 0, 0, 0.45);
  border-radius: 0 12px 12px 0;
  max-width: 56ch;
}

.tutorial-slide-callout strong {
  font-size: 0.78rem;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: #d94a3d;
}

.tutorial-slide-callout span {
  font-size: 0.95rem;
  line-height: 1.5;
  color: #f5e8c8;
}

/* Nav buttons */
.tutorial-nav {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 12px;
  margin-top: 8px;
}

.tutorial-nav button:first-child {
  justify-self: start;
}

.tutorial-nav button:last-child {
  justify-self: end;
}

.tutorial-nav-counter {
  text-align: center;
  font-size: 0.85rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: rgba(232, 217, 187, 0.7);
  font-weight: 700;
}

.tutorial-keyboard-hint {
  text-align: center;
  font-size: 0.78rem;
  font-style: italic;
  color: rgba(232, 217, 187, 0.55);
  letter-spacing: 0.04em;
}

/* ============================== */
/* Day clue chips (Slide 3)       */
/* ============================== */

.clue-chips {
  display: grid;
  gap: 14px;
  margin-top: 16px;
  max-width: 56ch;
}

.clue-chips-hint {
  font-size: 0.8rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: rgba(245, 232, 200, 0.7);
  font-weight: 700;
}

.clue-chips-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 10px;
}

.clue-chip {
  position: relative;
  background: transparent;
  border: none;
  padding: 0;
  cursor: pointer;
  perspective: 800px;
  min-height: 96px;
}

.clue-chip-inner {
  position: relative;
  display: block;
  width: 100%;
  height: 100%;
  min-height: 96px;
  transition: transform 320ms ease;
  transform-style: preserve-3d;
}

.clue-chip[data-revealed="true"] .clue-chip-inner {
  transform: rotateY(180deg);
}

.clue-chip-front,
.clue-chip-back {
  position: absolute;
  inset: 0;
  display: grid;
  align-content: center;
  justify-items: center;
  gap: 6px;
  padding: 12px;
  border-radius: 12px;
  backface-visibility: hidden;
}

.clue-chip-front {
  background:
    linear-gradient(155deg, rgba(255, 240, 220, 0.95), rgba(220, 200, 160, 0.85));
  color: #2a1b10;
  border: 1px solid rgba(83, 52, 31, 0.45);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.45);
}

.clue-chip-back {
  background: rgba(20, 14, 10, 0.92);
  color: #f5e8c8;
  border: 1px solid rgba(217, 74, 61, 0.7);
  transform: rotateY(180deg);
  text-align: left;
  align-content: start;
  padding: 12px 14px;
  font-size: 0.85rem;
  line-height: 1.4;
}

.clue-chip-back strong {
  font-size: 0.95rem;
  color: #d94a3d;
  letter-spacing: 0.04em;
}

.clue-chip-initial {
  font-family: "Noto Serif Display", serif;
  font-size: 2rem;
  font-weight: 900;
  color: #842f2b;
  line-height: 1;
}

.clue-chip-name {
  font-weight: 700;
  font-size: 0.95rem;
  letter-spacing: 0.04em;
}

/* ============================== */
/* Final slide picker (Slide 6)   */
/* ============================== */

.tutorial-final-picker {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
  margin-top: 8px;
}
@media (min-width: 640px) {
  .tutorial-final-picker {
    grid-template-columns: 1fr 1fr;
  }
}

.tutorial-final-card {
  display: grid;
  gap: 8px;
  padding: 22px 24px;
  border-radius: 18px;
  background: rgba(20, 14, 10, 0.75);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: #f5e8c8;
  text-decoration: none;
  transition: transform 180ms ease, border-color 180ms ease, background 180ms ease;
}

.tutorial-final-card:hover {
  transform: translateY(-3px);
  background: rgba(20, 14, 10, 0.9);
}

.tutorial-final-card[data-family="werewolves"]:hover {
  border-color: #d19a42;
}

.tutorial-final-card[data-family="mafia"]:hover {
  border-color: #d94a3d;
}

.tutorial-final-kicker {
  font-size: 0.7rem;
  letter-spacing: 0.32em;
  text-transform: uppercase;
  font-weight: 700;
  color: #d19a42;
}

.tutorial-final-card[data-family="mafia"] .tutorial-final-kicker {
  color: #d94a3d;
}

.tutorial-final-title {
  font-family: "Noto Serif Display", serif;
  font-size: 1.5rem;
  font-weight: 900;
  letter-spacing: -0.01em;
}

.tutorial-final-line {
  font-size: 0.95rem;
  font-style: italic;
  color: rgba(245, 232, 200, 0.78);
}

.tutorial-final-secondary {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  margin-top: 16px;
  font-size: 0.85rem;
  color: rgba(232, 217, 187, 0.7);
}

.tutorial-final-secondary-link {
  color: rgba(232, 217, 187, 0.9);
  text-decoration: underline;
  text-underline-offset: 3px;
  text-decoration-color: rgba(217, 154, 66, 0.5);
}

.tutorial-final-secondary-link:hover {
  color: #d94a3d;
  text-decoration-color: #d94a3d;
}
```

---

## Acceptance criteria

1. **Generated assets съществуват**:
   - `apps/web/public/game-art/tutorial-night-scene.png` + `.webp`
   - `apps/web/public/game-art/tutorial-day-scene.png` + `.webp`
   - Без visible text/letters/numbers в нито една.
2. **Flipbook navigation**:
   - 6 слайда, един видим в даден момент.
   - Next/Prev бутони — disabled на крайните слайдове.
   - Dot pagination — кликване jump-ва на слайда.
   - URL `?step=N` се синхронизира двупосочно.
   - Keyboard `ArrowLeft`/`ArrowRight` функционират (освен в input/textarea focus).
   - "Прескочи" link top-right → водещ към `/`.
3. **Progress bar**:
   - Тънка златна линия отгоре, скалира от 1/6 до 6/6.
   - Dots показват past/active/future states (различен цвят).
4. **Slide 3 интерактив**:
   - 5 face-down chips с имена + initial letter.
   - Клик → CSS flip 3D rotation, разкрива clue.
   - Visited counter "посетени: N / 5".
   - Втори клик ре-крие chip-а.
5. **Slide 6 dual-mode CTA**:
   - Side-by-side cards Върколак / Мафия с family-coded hover border.
   - Secondary links под тях (Правила Върколак / Правила Мафия / Всички роли).
6. **localStorage flags**:
   - `tutorial-completed` = "1" се записва когато потребителят достигне Slide 6.
   - `tutorial-last-slide` се записва при всяка смяна на слайда.
   - На mount без `?step`, ако има `tutorial-last-slide`, потребителят се връща там.
7. **Cleanup**:
   - Целият `tutorial-table-mode` блок ("Телефонът е карта, не микрофон") изчезва от tutorial-а (остава само в `/werewolf/rules`).
   - Премахнати CSS правила: `.tutorial-hero`, `.tutorial-board`, `.tutorial-step-card`, `.tutorial-demo-table`, `.tutorial-table-mode`, `.demo-player-grid`, `.demo-round-list`.
8. **Responsive**:
   - ≥640px: `.tutorial-final-picker` е 2-кол, callouts с естествен max-width.
   - <640px: всичко 1-кол, slide content padding намалява, slide-stage min-height се увеличава за по-плътен mobile look.
9. **БГ-only copy** — никакви Latin words.
10. **Никакви нови npm dependencies или font imports**.
11. `pnpm regression` + `pnpm typecheck` + `pnpm build` минават.
12. Screenshot-ите в `audit-v3/after/tutorial/` (всеки слайд × desktop + mobile = 12 файла).

---

## Не пипай

- Game-server / schemas / role-assignment.
- `/werewolf/rules` "Телефонът е карта" секцията — остава там.
- `/mafia/rules` нищо.
- `packages/shared` / `packages/database`.
- Без нови npm dependencies, без font packages.

---

## Verification

1. `pnpm optimize:assets` — pass.
2. `pnpm regression` — pass.
3. `pnpm typecheck` — pass.
4. `pnpm build` — pass.
5. Playwright screenshots:
   - 1440 × 900 → `/tutorial?step=1` ... `?step=6` (6 файла).
   - 390 × 844 → `/tutorial?step=1` ... `?step=6` (6 файла).
   - На Slide 3 mobile — направи allshow един screenshot с 2 разкрити chips.
6. Запиши в `audit-v3/after/tutorial/`.
7. Ръчно: тествай keyboard navigation, URL sync, localStorage restore (reload-ни от `?step=4` без params → трябва да се върне на 4).

---

## Commit strategy

Препоръчителни commits на нов клон `feat/tutorial-flipbook`:

All commit messages must be in English (project convention).

1. `chore(art): generated tutorial day + night cinematic scenes`
2. `feat(tutorial): flipbook shell with URL/localStorage state`
3. `feat(tutorial): 6 scenes with painterly backgrounds`
4. `feat(tutorial): interactive clue chips on Slide 3`
5. `feat(tutorial): emphatic dual-mode picker on Slide 6`
6. `chore(tutorial): remove duplicate "Телефонът е карта" + old grid styles`
7. `chore(tutorial): screenshot baseline in audit-v3/after/tutorial/`

PR title: `feat: redesign /tutorial като cinematic 6-slide flipbook — day/night scenes, interactive clue reveal`.

---

(End of prompt)
