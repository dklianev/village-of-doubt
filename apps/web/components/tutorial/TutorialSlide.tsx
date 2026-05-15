import type { ReactNode } from "react";

interface TutorialSlideProps {
  bg: "night" | "day" | "day-low" | "day-zoom" | "night-cropped" | "split";
  kicker: string;
  title: string;
  body: ReactNode;
  callout?: {
    label: string;
    text: string;
  };
  children?: ReactNode;
}

const BG_CLASS: Record<TutorialSlideProps["bg"], string> = {
  night: "slide-bg-night",
  day: "slide-bg-day",
  "day-low": "slide-bg-day slide-bg-low",
  "day-zoom": "slide-bg-day slide-bg-zoom",
  "night-cropped": "slide-bg-night slide-bg-cropped",
  split: "slide-bg-split",
};

export function TutorialSlide({ bg, kicker, title, body, callout, children }: TutorialSlideProps) {
  return (
    <article className={`tutorial-slide ${BG_CLASS[bg]}`}>
      <div className="tutorial-slide-scrim" aria-hidden="true" />
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
