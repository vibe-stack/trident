import type { ToolId } from "@web-hammer/tool-system";
import type { GridSnapValue } from "@web-hammer/render-pipeline";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { FloatingPanel } from "@/components/editor-shell/FloatingPanel";
import { Grid3X3, toolIconFor } from "@/components/editor-shell/icons";
import { cn } from "@/lib/utils";

type ToolPaletteProps = {
  activeToolId: ToolId;
  currentSnapSize: GridSnapValue;
  gridSnapValues: readonly GridSnapValue[];
  onSetSnapSize: (snapSize: GridSnapValue) => void;
  onSetToolId: (toolId: ToolId) => void;
  tools: Array<{ id: ToolId; label: string }>;
};

export function ToolPalette({
  activeToolId,
  currentSnapSize,
  gridSnapValues,
  onSetSnapSize,
  onSetToolId,
  tools
}: ToolPaletteProps) {
  return (
    <div className="pointer-events-none absolute left-1/2 top-4 z-20 flex -translate-x-1/2 items-start gap-3">
      <FloatingPanel className="flex items-center gap-1 p-1.5">
        {tools.map((tool) => {
          const Icon = toolIconFor(tool.id);
          const active = tool.id === activeToolId;

          return (
            <Tooltip key={tool.id}>
              <TooltipTrigger render={<Button
                className={cn(
                  "size-8 rounded-xl text-foreground/58 transition-colors hover:text-foreground",
                  active && "bg-emerald-500/18 text-emerald-300 shadow-[inset_0_0_0_1px_rgba(52,211,153,0.18)]"
                )}
                onClick={() => onSetToolId(tool.id)}
                size="icon-sm"
                variant="ghost"
              />}>
                <Icon className="size-4" />
              </TooltipTrigger>
              <TooltipContent>{tool.label}</TooltipContent>
            </Tooltip>
          );
        })}
      </FloatingPanel>

      <Popover>
        <PopoverTrigger
          render={
            <FloatingPanel className="flex items-center gap-2 px-2.5 py-1.5 text-[11px] text-foreground/72">
              <Grid3X3 className="size-3.5 text-emerald-300" />
              <span>Snap {currentSnapSize}</span>
            </FloatingPanel>
          }
        />
        <PopoverContent align="start" className="w-44 rounded-2xl bg-popover/96 p-2 shadow-[0_18px_48px_rgba(4,12,10,0.46)] backdrop-blur-xl">
          <div className="mb-1 px-1 text-[10px] font-medium tracking-[0.18em] text-foreground/45 uppercase">Grid Snap</div>
          <div className="grid grid-cols-3 gap-1">
            {gridSnapValues.map((snapValue) => (
              <Button
                className={cn(
                  "h-7 rounded-xl text-[11px] font-medium",
                  snapValue === currentSnapSize && "bg-emerald-500/18 text-emerald-200"
                )}
                key={snapValue}
                onClick={() => onSetSnapSize(snapValue)}
                size="sm"
                variant="ghost"
              >
                {snapValue}
              </Button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
