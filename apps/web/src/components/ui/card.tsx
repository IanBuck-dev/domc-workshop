import type { ElementType, ReactNode } from "react";
import { classNames } from "./class-names";

/**
 * Weiße Fläche mit Rahmen und Schatten. Die Höhe sagt, wie weit die Fläche
 * über dem Seitenhintergrund liegt: flat für ruhige Listen, raised für den
 * Regelfall, floating für Elemente, die über dem Inhalt liegen.
 */
export function Card({
  as: Tag = "div",
  elevation = "raised",
  interactive = false,
  className,
  children,
  ...props
}: {
  as?: ElementType;
  elevation?: "flat" | "raised" | "floating";
  /** Setzen, wenn die ganze Karte anklickbar ist: Rand und Schatten reagieren. */
  interactive?: boolean;
  className?: string;
  children: ReactNode;
  [key: string]: unknown;
}) {
  return (
    <Tag
      {...props}
      className={classNames(
        "panel",
        elevation === "flat" && "panel-flat",
        elevation === "floating" && "panel-floating",
        interactive && "panel-interactive",
        className,
      )}
    >
      {children}
    </Tag>
  );
}
