import type { AnimationEditorStore } from "@ggez/anim-editor-core";
import { ScrollArea } from "@/components/ui/scroll-area";
import { NodeInspector } from "./inspector";
export function RightSidebar(props: { store: AnimationEditorStore }) {
  return (
    <aside className="h-full overflow-hidden rounded-[28px] bg-[#091012]/40 p-3 shadow-[0_24px_80px_rgba(0,0,0,0.42)] ring-1 ring-white/7 backdrop-blur-md">
      <ScrollArea className="h-full">
        <div className="pr-1">
          <NodeInspector store={props.store} />
        </div>
      </ScrollArea>
    </aside>
  );
}