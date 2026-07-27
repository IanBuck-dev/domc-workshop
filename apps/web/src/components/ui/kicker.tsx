import type { ReactNode } from "react";
import { classNames } from "./class-names";

/**
 * Kurze Überschrift über einem Titel. Die Großschreibung macht das
 * Stylesheet, damit im Quelltext lesbarer deutscher Text steht.
 */
export function Kicker({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <span className={classNames("kicker", className)}>{children}</span>;
}
