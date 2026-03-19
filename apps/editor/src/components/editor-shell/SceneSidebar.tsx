import { Cuboid } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { GeometryNode } from "@ggez/shared";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FloatingPanel } from "@/components/editor-shell/FloatingPanel";
import { cn } from "@/lib/utils";

type SceneSidebarProps = {
  nodes: GeometryNode[];
  onCreateBrush: () => void;
  onFocusNode: (nodeId: string) => void;
  onSelectNodes: (nodeIds: string[]) => void;
  selectedNodeId?: string;
};

export function SceneSidebar({
  nodes,
  onCreateBrush,
  onFocusNode,
  onSelectNodes,
  selectedNodeId
}: SceneSidebarProps) {
  return (
    <div className="pointer-events-none absolute inset-y-4 left-4 z-20 flex w-56 bg-black/10 backdrop-blur-md">
      <FloatingPanel className="flex min-h-0 w-full flex-col overflow-hidden">
        <div className="flex items-center justify-between px-3.5 pt-3 pb-2">
          <div className="text-[10px] font-medium tracking-[0.18em] text-foreground/42 uppercase">Scene</div>
          <Button className="pointer-events-auto text-foreground/62" onClick={onCreateBrush} size="icon-xs" type="button" variant="ghost">
            <Cuboid className="size-3.5" />
          </Button>
        </div>
        <ScrollArea className="min-h-0 flex-1 px-2 pb-2">
          <div className="space-y-0.5">
            {nodes.map((node) => (
              <button
                className={cn(
                  "block w-full rounded-xl px-2.5 py-1.5 text-left text-[12px] font-medium text-foreground/62 transition-colors hover:bg-white/5 hover:text-foreground",
                  selectedNodeId === node.id && "bg-emerald-500/14 text-emerald-200"
                )}
                key={node.id}
                onClick={() => onSelectNodes([node.id])}
                onDoubleClick={() => onFocusNode(node.id)}
                type="button"
              >
                <span className="block truncate">{node.name}</span>
              </button>
            ))}
          </div>
        </ScrollArea>
      </FloatingPanel>
    </div>
  );
}
