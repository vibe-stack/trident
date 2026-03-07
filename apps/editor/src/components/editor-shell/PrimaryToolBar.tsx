import type { ToolId } from "@web-hammer/tool-system";
import { FloatingPanel } from "@/components/editor-shell/FloatingPanel";
import { toolIconFor } from "@/components/editor-shell/icons";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export function PrimaryToolBar({
  activeToolId,
  onSetToolId,
  tools
}: {
  activeToolId: ToolId;
  onSetToolId: (toolId: ToolId) => void;
  tools: Array<{ id: ToolId; label: string }>;
}) {
  return (
    <FloatingPanel className="flex h-11 items-center gap-1.5 p-2">
      {tools.map((tool) => {
        const Icon = toolIconFor(tool.id);
        const active = tool.id === activeToolId;

        return (
          <Tooltip key={tool.id}>
            <TooltipTrigger
              render={
                <Button
                  className={cn(
                    "size-7 rounded-xl text-foreground/58 transition-colors hover:text-foreground",
                    active && "bg-emerald-500/18 text-emerald-300 shadow-[inset_0_0_0_1px_rgba(52,211,153,0.18)]"
                  )}
                  onClick={() => onSetToolId(tool.id)}
                  size="icon-sm"
                  variant="ghost"
                />
              }
            >
              <Icon className="size-4" />
            </TooltipTrigger>
            <TooltipContent>{tool.label}</TooltipContent>
          </Tooltip>
        );
      })}
    </FloatingPanel>
  );
}