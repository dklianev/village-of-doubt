import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";

export type PillIntent = "primary" | "secondary" | "danger" | "ghost" | "faction";
export type PillSize = "sm" | "md" | "lg";

type PillBaseProps = {
  intent?: PillIntent;
  size?: PillSize;
  shimmer?: boolean;
  tracked?: boolean;
  children: ReactNode;
};

type PillButtonProps = PillBaseProps &
  ButtonHTMLAttributes<HTMLButtonElement> & {
    as?: "button";
  };

type PillAnchorProps = PillBaseProps &
  AnchorHTMLAttributes<HTMLAnchorElement> & {
    as: "a";
  };

export type PillProps = PillButtonProps | PillAnchorProps;

function cx(...classes: Array<string | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function Pill(props: PillProps) {
  const { intent = "primary", size = "md", shimmer = false, tracked = false, children } = props;
  const className = cx("ds-pill", `ds-pill--${intent}`, props.className);
  const sharedProps = {
    className,
    "data-ds-pill": intent,
    "data-intent": intent,
    "data-size": size,
    "data-shimmer": shimmer ? "true" : undefined,
    "data-tracked": tracked ? "true" : undefined,
  };

  if (props.as === "a") {
    const {
      as: _as,
      intent: _intent,
      size: _size,
      shimmer: _shimmer,
      tracked: _tracked,
      children: _children,
      className: _className,
      ...anchorProps
    } = props;

    return (
      <a {...anchorProps} {...sharedProps}>
        {children}
      </a>
    );
  }

  const {
    as: _as,
    intent: _intent,
    size: _size,
    shimmer: _shimmer,
    tracked: _tracked,
    children: _children,
    className: _className,
    type = "button",
    ...buttonProps
  } = props;

  return (
    <button {...buttonProps} {...sharedProps} type={type}>
      {children}
    </button>
  );
}
