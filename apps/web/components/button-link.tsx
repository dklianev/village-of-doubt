import Link, { type LinkProps } from "next/link";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { buttonClassName, type ButtonVariant } from "./button";

type ButtonLinkProps = LinkProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof LinkProps | "href"> & {
    variant?: ButtonVariant;
    children: ReactNode;
  };

/** A navigation that looks like a `Button`; client-side routing through next/link. */
export function ButtonLink({ variant = "primary", className, ...props }: ButtonLinkProps) {
  return <Link {...props} className={buttonClassName(variant, className)} />;
}
