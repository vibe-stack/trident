import type { AnimationEditorStore } from "@ggez/anim-editor-core";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StudioSection } from "../shared";
import type { EditorState } from "./types";

export function GraphsSection(props: { store: AnimationEditorStore; state: EditorState }) {
  return (
    <StudioSection
      title="Graphs"
      variant="soft"
      action={
        <Button variant="ghost" size="icon-xs" onClick={() => props.store.addGraph()} aria-label="Add graph">
          <Plus />
        </Button>
      }
    >
      <div className="space-y-2">
        {props.state.document.graphs.map((entry) => {
          const selected = entry.id === props.state.selection.graphId;

          return (
            <button
              key={entry.id}
              onClick={() => props.store.selectGraph(entry.id)}
              className={
                selected
                  ? "w-full rounded-2xl bg-emerald-500/14 px-3 py-2.5 text-left text-[12px] font-medium text-zinc-50 shadow-[inset_0_0_0_1px_rgba(52,211,153,0.22)]"
                  : "w-full rounded-2xl bg-white/4 px-3 py-2.5 text-left text-[12px] text-zinc-300 transition hover:bg-white/7"
              }
            >
              {entry.name}
            </button>
          );
        })}
      </div>
    </StudioSection>
  );
}
