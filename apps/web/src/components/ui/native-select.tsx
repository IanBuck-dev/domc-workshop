import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Native `<select>` styled to match `Input`. Kept native rather than built on
 * Radix `Select`: these sit in dense editing forms where keyboard and mobile
 * behaviour of the platform control is the better fit.
 */
function NativeSelect({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      data-slot="native-select"
      className={cn(
        "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm transition-[color,box-shadow] outline-none",
        "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/20",
        className,
      )}
      {...props}
    />
  );
}

export { NativeSelect };
