import type { GridSnapValue } from "@web-hammer/render-pipeline";
import { FloatingPanel } from "@/components/editor-shell/FloatingPanel";
import { Grid3X3 } from "@/components/editor-shell/icons";
import { Button } from "@/components/ui/button";
import { DragInput } from "@/components/ui/drag-input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { formatSnapValue } from "@/viewport/utils/snap";

export function SnapControl({
  currentSnapSize,
  gridSnapValues,
  onSetSnapEnabled,
  onSetSnapSize,
  snapEnabled
}: {
  currentSnapSize: GridSnapValue;
  gridSnapValues: readonly GridSnapValue[];
  onSetSnapEnabled: (enabled: boolean) => void;
  onSetSnapSize: (snapSize: GridSnapValue) => void;
  snapEnabled: boolean;
}) {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <FloatingPanel className="flex h-11 items-center gap-2.5 px-3 text-[11px] text-foreground/72">
            <Grid3X3 className="size-3.5 text-emerald-300" />
            <Switch checked={snapEnabled} onCheckedChange={onSetSnapEnabled} size="sm" />
            <div className="h-5 w-px bg-white/8" />
            <Button className="h-7 rounded-xl px-2.5 text-[11px] font-medium" size="sm" variant="ghost">
              {formatSnapValue(currentSnapSize)}
            </Button>
          </FloatingPanel>
        }
      />
      <PopoverContent align="start" className="w-56 rounded-2xl bg-popover/96 p-2 shadow-[0_18px_48px_rgba(4,12,10,0.46)] backdrop-blur-xl">
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-[10px] font-medium tracking-[0.18em] text-foreground/45 uppercase">Grid Snap</span>
            <Switch checked={snapEnabled} onCheckedChange={onSetSnapEnabled} size="sm" />
          </div>
          <DragInput
            className="w-full"
            min={0.05}
            onChange={onSetSnapSize}
            onValueCommit={onSetSnapSize}
            precision={2}
            step={0.05}
            value={currentSnapSize}
          />
          <div className="grid grid-cols-4 gap-1">
            {gridSnapValues.map((snapValue) => (
              <Button
                className={cn(
                  "h-6 rounded-lg px-0 text-[10px] font-medium",
                  snapValue === currentSnapSize && "bg-emerald-500/18 text-emerald-200"
                )}
                key={snapValue}
                onClick={() => onSetSnapSize(snapValue)}
                size="xs"
                variant="ghost"
              >
                {formatSnapValue(snapValue)}
              </Button>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}