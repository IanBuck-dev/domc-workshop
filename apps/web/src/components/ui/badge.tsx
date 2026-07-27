import type { ElementType, ReactNode } from "react";
import { classNames } from "./class-names";

/**
 * Tonlagen für Etiketten. Bedeutung statt Farbe benennen, damit gleiche
 * Aussagen im ganzen Prototyp gleich aussehen.
 */
export type BadgeTone =
  "neutral" | "accent" | "info" | "success" | "warning" | "danger";

export function Badge({
  tone = "neutral",
  as: Tag = "span",
  className,
  children,
}: {
  tone?: BadgeTone;
  as?: ElementType;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Tag className={classNames("badge", `badge-${tone}`, className)}>
      {children}
    </Tag>
  );
}
