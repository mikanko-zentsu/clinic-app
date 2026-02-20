"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-xl font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer select-none active:scale-95 transition-transform",
  {
    variants: {
      variant: {
        default:
          "bg-sky-500 text-white hover:bg-sky-600 active:bg-sky-700",
        destructive:
          "bg-red-500 text-white hover:bg-red-600 active:bg-red-700",
        outline:
          "border-2 border-sky-200 bg-white text-sky-700 hover:bg-sky-50 active:bg-sky-100",
        secondary:
          "bg-sky-100 text-sky-900 hover:bg-sky-200 active:bg-sky-300",
        ghost:
          "text-slate-600 hover:bg-slate-100 active:bg-slate-200",
      },
      size: {
        default: "h-12 px-6 text-base",
        sm: "h-9 px-4 text-sm",
        lg: "h-16 px-8 text-xl",
        xl: "h-20 px-10 text-2xl",
        icon: "h-12 w-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
