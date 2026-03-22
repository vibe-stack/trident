import type { AnimationEditorStore } from "@ggez/anim-editor-core";
import { useEffect, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { StudioSection } from "../shared";
import { GraphsSection } from "./graphs-section";
import { LayersSection } from "./layers-section";
import { MasksSection } from "./masks-section";
import { ParametersSection } from "./parameters-section";
import { RigSummary } from "./rig-summary";
import type { EditorState } from "./types";

export function LeftSidebar(props: { store: AnimationEditorStore; state: EditorState; characterFileName?: string }) {
  const [selectedMaskId, setSelectedMaskId] = useState<string>(props.state.document.masks[0]?.id ?? "");
  const selectedMask = props.state.document.masks.find((mask) => mask.id === selectedMaskId) ?? props.state.document.masks[0];

  useEffect(() => {
    if (selectedMask && selectedMask.id !== selectedMaskId) {
      setSelectedMaskId(selectedMask.id);
      return;
    }

    if (!selectedMask && selectedMaskId) {
      setSelectedMaskId("");
    }
  }, [selectedMask, selectedMaskId]);

  return (
    <aside className="flex h-full min-h-0 flex-col overflow-hidden rounded-[28px] bg-[#091012]/40 p-3 shadow-[0_24px_80px_rgba(0,0,0,0.42)] ring-1 ring-white/7 backdrop-blur-md pb-16">
      <div className="mb-3 flex items-center justify-between px-1">
        <div>
          <div className="text-[10px] font-medium tracking-[0.04em] text-zinc-500">Document</div>
          <div className="mt-1 text-sm font-medium text-zinc-100">Authoring</div>
        </div>
      </div>

      <ScrollArea className="h-full">
        <div className="space-y-3 pr-1">
          <StudioSection title="Rig" variant="soft">
            <RigSummary rig={props.state.document.rig} characterFileName={props.characterFileName} />
          </StudioSection>
          <GraphsSection store={props.store} state={props.state} />
          <ParametersSection store={props.store} state={props.state} />
          <LayersSection store={props.store} state={props.state} />
          <MasksSection
            store={props.store}
            state={props.state}
            selectedMaskId={selectedMaskId}
            onSelectMask={setSelectedMaskId}
            onCreateMask={() => {
              props.store.addMask();
              const nextMasks = props.store.getState().document.masks;
              setSelectedMaskId(nextMasks[nextMasks.length - 1]?.id ?? "");
            }}
          />
        </div>
      </ScrollArea>
    </aside>
  );
}
