import { Info } from "lucide-react";
import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/utils";

export function InfoCallout({
  title,
  children,
  className,
  ...props
}: HTMLAttributes<HTMLElement> & {
  title: string;
  children: ReactNode;
}) {
  return (
    <aside
      role="note"
      className={cn(
        "flex gap-3 border-l-4 border-info bg-info-surface px-4 py-3 text-info-foreground",
        className,
      )}
      {...props}
    >
      <Info aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-info" />
      <div className="min-w-0">
        <p className="text-label">{title}</p>
        <div className="mt-2 text-ui">{children}</div>
      </div>
    </aside>
  );
}
