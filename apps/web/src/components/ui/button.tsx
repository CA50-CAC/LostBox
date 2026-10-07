/**
 * Buttons and button-styled links. Every size is at least 44px tall so it's
 * easy to hit with a thumb (WCAG 2.5.5 target size).
 */
import Link from "next/link";
import type { ComponentProps } from "react";

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-accent text-accent-foreground hover:brightness-110 active:brightness-95",
  secondary: "border border-border-tint bg-background text-foreground hover:border-accent/50 hover:bg-accent-soft",
  danger: "border border-danger/50 bg-background text-danger hover:bg-danger-soft",
  ghost: "text-foreground hover:bg-accent-soft",
};

export function buttonClass(variant: ButtonVariant = "primary", extra = ""): string {
  return [
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2 text-base font-bold",
    "transition-[background-color,border-color,filter,transform] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100",
    VARIANTS[variant],
    extra,
  ].join(" ");
}

export function Button({ variant = "primary", className = "", ...props }: ComponentProps<"button"> & { variant?: ButtonVariant }) {
  return <button className={buttonClass(variant, className)} {...props} />;
}

export function ButtonLink({
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<typeof Link> & { variant?: ButtonVariant }) {
  return <Link className={buttonClass(variant, className)} {...props} />;
}
