import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";

interface TutorialSlideProps {
  bg: "night" | "day";
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
};

export function TutorialSlide({ bg, kicker, title, body, callout, children }: TutorialSlideProps) {
  return (
    <article className={`tutorial-slide ${BG_CLASS[bg]}`}>
      <div className="tutorial-slide-art" aria-hidden="true" />
      <div className="tutorial-slide-content">
        <div className="tutorial-slide-copy">
          <p className="tutorial-slide-kicker">{kicker}</p>
          <h1 className="tutorial-slide-title">{title}</h1>
          <div className="tutorial-slide-body">{body}</div>
        </div>
        {callout ? (
          <details className="tutorial-slide-callout">
            <summary>{callout.label}<ChevronDown size={16} aria-hidden="true" /></summary>
            <span>{callout.text}</span>
          </details>
        ) : null}
        {children ? <div className="tutorial-slide-interaction">{children}</div> : null}
      </div>
    </article>
  );
}
