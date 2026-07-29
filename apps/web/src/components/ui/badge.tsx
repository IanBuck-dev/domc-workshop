import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a&]:hover:bg-primary/90",
        secondary:
          "bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90",
        destructive:
          "bg-destructive text-white focus-visible:ring-destructive/20 dark:bg-destructive/60 dark:focus-visible:ring-destructive/40 [a&]:hover:bg-destructive/90",
        outline:
          "border-border text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
        ghost: "[a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
        link: "text-primary underline-offset-4 [a&]:hover:underline",
        success: "bg-secondary text-secondary-foreground",
        warning: "border-amber-700/30 bg-amber-50 text-amber-900",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

type BadgeTone =
  "neutral" | "success" | "warning" | "danger" | "accent" | "info";

function Badge({
  className,
  variant = "default",
  tone,
  as: Comp = "span",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & {
    asChild?: boolean;
    tone?: BadgeTone;
    as?: React.ElementType;
  }) {
  const SlotComp = asChild ? Slot.Root : Comp;

  return (
    <SlotComp
      data-slot="badge"
      data-variant={variant}
      className={cn(
        badgeVariants({
          variant: (tone
            ? {
                neutral: "secondary",
                success: "success",
                warning: "warning",
                danger: "destructive",
                accent: "secondary",
                info: "outline",
              }[tone]
            : variant) as VariantProps<typeof badgeVariants>["variant"],
        }),
        className,
      )}
      {...props}
    />
  );
}

export { Badge, badgeVariants, type BadgeTone };
