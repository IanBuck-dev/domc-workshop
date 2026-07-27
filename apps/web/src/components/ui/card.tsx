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
  className,
  children,
  ...props
}: {
  as?: ElementType;
  elevation?: "flat" | "raised" | "floating";
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
        className,
      )}
    >
      {children}
    </Tag>
  );
}
