import { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-accent text-accent-foreground hover:opacity-90 disabled:opacity-50",
  secondary:
    "bg-surface text-foreground border border-border hover:bg-border/40 disabled:opacity-50",
  ghost: "text-foreground hover:bg-surface disabled:opacity-50",
  // For the confirming step of a destructive action, once the user has
  // already opted into it -- not for the link that opens the confirmation.
  danger: "bg-danger text-white hover:opacity-90 disabled:opacity-50",
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={`inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-medium transition-opacity duration-150 disabled:cursor-not-allowed ${variantClasses[variant]} ${className}`}
      {...props}
    />
  );
}
