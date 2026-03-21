import type { AnimationEditorStore } from "@ggez/anim-editor-core";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StudioSection, sectionHintClassName } from "../shared";
import { MaskAuthoringPanel } from "./mask-authoring-panel";
import type { EditorState } from "./types";

export function MasksSection(props: {
  store: AnimationEditorStore;
  state: EditorState;
  selectedMaskId: string;
  onSelectMask: (maskId: string) => void;
  onCreateMask: () => void;
}) {
  const selectedMask = props.state.document.masks.find((mask) => mask.id === props.selectedMaskId) ?? props.state.document.masks[0];

  return (
    <StudioSection
      title="Masks"
      variant="soft"
      action={
        <Button variant="ghost" size="icon-xs" onClick={props.onCreateMask} aria-label="Add mask">
          <Plus />
        </Button>
      }
    >
      {props.state.document.masks.length === 0 ? <div className={sectionHintClassName}>Add a mask to author upper-body overrides and branch-limited layers.</div> : null}

      {props.state.document.masks.length > 0 ? (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            {props.state.document.masks.map((mask) => {
              const selected = mask.id === selectedMask?.id;

              return (
                <button
                  key={mask.id}
                  type="button"
                  onClick={() => props.onSelectMask(mask.id)}
                  className={
                    selected
                      ? "rounded-full bg-emerald-500/14 px-3 py-1.5 text-[11px] font-medium text-zinc-50 shadow-[inset_0_0_0_1px_rgba(52,211,153,0.22)]"
                      : "rounded-full bg-white/6 px-3 py-1.5 text-[11px] text-zinc-300 transition hover:bg-white/10"
                  }
                >
                  {mask.name}
                </button>
              );
            })}
          </div>

          <MaskAuthoringPanel store={props.store} rig={props.state.document.rig} mask={selectedMask} />
        </div>
      ) : null}
    </StudioSection>
  );
}
