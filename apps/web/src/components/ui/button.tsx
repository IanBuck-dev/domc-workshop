import type { ComponentPropsWithRef, ReactNode } from "react";
import { classNames } from "./class-names";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const variantClass: Record<ButtonVariant, string> = {
  primary: "button",
  secondary: "button secondary",
  ghost: "text-button",
  danger: "danger-button",
};

/**
 * Für Links, die wie eine Schaltfläche aussehen sollen. Ein <Link> bleibt ein
 * Link, bekommt aber dieselben Klassen wie <Button>.
 */
export function buttonClassName(
  variant: ButtonVariant = "primary",
  className?: string,
) {
  return classNames(variantClass[variant], className);
}

export function Button({
  variant = "primary",
  className,
  type = "button",
  ...props
}: ComponentPropsWithRef<"button"> & { variant?: ButtonVariant }) {
  return (
    <button
      {...props}
      type={type}
      className={buttonClassName(variant, className)}
    />
  );
}

/**
 * Schaltfläche, die nur ein Symbol zeigt. Der Beschriftungstext ist Pflicht,
 * damit die Bedienung mit Tastatur und Screenreader eindeutig bleibt.
 */
export function IconButton({
  label,
  tone = "neutral",
  className,
  type = "button",
  children,
  ...props
}: Omit<ComponentPropsWithRef<"button">, "aria-label"> & {
  label: string;
  tone?: "neutral" | "danger";
  children: ReactNode;
}) {
  return (
    <button
      {...props}
      type={type}
      aria-label={label}
      title={label}
      className={classNames(
        "icon-button",
        tone === "danger" && "danger",
        className,
      )}
    >
      {children}
    </button>
  );
}
