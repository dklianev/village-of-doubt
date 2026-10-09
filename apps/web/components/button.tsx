import type { ComponentProps } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost";

export function buttonClassName(variant: ButtonVariant, className?: string) {
  return ["btn", `btn-${variant}`, className].filter(Boolean).join(" ");
}

type ButtonProps = ComponentProps<"button"> & { variant?: ButtonVariant };

/**
 * The app's text button: the `.btn` system from globals.css behind one typed API.
 * Defaults to `type="button"` so a button inside a form never submits by accident.
 * Links that should look like buttons use `ButtonLink` from `./button-link`.
 */
export function Button({ variant = "primary", className, type = "button", ...props }: ButtonProps) {
  return <button {...props} type={type} className={buttonClassName(variant, className)} />;
}
