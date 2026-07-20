import Link, { type LinkProps } from "next/link";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import type { PillIntent, PillSize } from "@werewolf/ui/server";

type NextLinkPillProps = LinkProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof LinkProps | "href"> & {
    intent?: PillIntent;
    size?: PillSize;
    shimmer?: boolean;
    tracked?: boolean;
    children: ReactNode;
  };

function cx(...classes: Array<string | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function NextLinkPill({
  intent = "primary",
  size = "md",
  shimmer = false,
  tracked = false,
  className,
  children,
  ...props
}: NextLinkPillProps) {
  return (
    <Link
      {...props}
      className={cx("ds-pill", `ds-pill--${intent}`, className)}
      data-ds-pill={intent}
      data-intent={intent}
      data-size={size}
      data-shimmer={shimmer ? "true" : undefined}
      data-tracked={tracked ? "true" : undefined}
    >
      {children}
    </Link>
  );
}
