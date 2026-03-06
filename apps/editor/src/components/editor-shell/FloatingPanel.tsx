import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function FloatingPanel({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "pointer-events-auto rounded-2xl bg-background/74 shadow-[0_18px_60px_rgba(4,12,10,0.42)] backdrop-blur-xl",
        className
      )}
      {...props}
    />
  );
}
