import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export const editorInputClassName =
  "h-9 rounded-xl border-0 bg-white/7 px-3 text-[12px] text-zinc-100 shadow-none placeholder:text-zinc-500 focus-visible:ring-2 focus-visible:ring-emerald-400/20";

export const editorSelectClassName =
  "h-9 w-full rounded-xl border-0 bg-white/7 px-3 text-[12px] text-zinc-100 outline-none transition focus:ring-2 focus:ring-emerald-400/20";

export const editorTextareaClassName =
  "min-h-40 rounded-xl border-0 bg-white/7 px-3 py-2.5 text-[12px] text-zinc-100 shadow-none placeholder:text-zinc-500 focus-visible:ring-2 focus-visible:ring-emerald-400/20";

export const sectionHintClassName = "text-[11px] leading-5 text-zinc-500";

export function StudioSection(props: {
  title: string;
  action?: ReactNode;
  className?: string;
  bodyClassName?: string;
  variant?: "default" | "soft";
  children: ReactNode;
}) {
  const chromeClassName =
    props.variant === "soft"
      ? "rounded-[22px] bg-white/4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
      : "overflow-hidden border border-white/8 bg-black/25";

  const headerClassName =
    props.variant === "soft"
      ? "flex items-center justify-between px-3 py-2"
      : "flex items-center justify-between border-b border-white/8 bg-white/2 px-3 py-2";

  return (
    <section className={cn(chromeClassName, props.className)}>
      <header className={headerClassName}>
        <h2 className="text-[12px] font-medium tracking-[0.01em] text-zinc-300">{props.title}</h2>
        {props.action}
      </header>
      <div className={cn("space-y-3 p-3", props.bodyClassName)}>{props.children}</div>
    </section>
  );
}

export function PropertyField(props: { label: string; className?: string; children: ReactNode }) {
  return (
    <label className={cn("grid gap-1.5", props.className)}>
      <span className="text-[11px] font-medium tracking-[0.01em] text-zinc-400">{props.label}</span>
      {props.children}
    </label>
  );
}