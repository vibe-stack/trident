import type { AnimationEditorStore } from "@ggez/anim-editor-core";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ParameterTypeSelect } from "./node-inspector";
import { StudioSection, editorInputClassName, editorSelectClassName } from "./shared";

type EditorState = ReturnType<AnimationEditorStore["getState"]>;

export function LeftSidebar(props: { store: AnimationEditorStore; state: EditorState }) {
  const { state, store } = props;

  return (
    <aside className="flex h-full min-h-0 flex-col overflow-hidden rounded-[28px] bg-[#091012]/78 p-3 shadow-[0_24px_80px_rgba(0,0,0,0.42)] ring-1 ring-white/7 backdrop-blur-2xl">
      <div className="mb-3 flex items-center justify-between px-1">
        <div>
          <div className="text-[10px] font-medium tracking-[0.04em] text-zinc-500">Document</div>
          <div className="mt-1 text-sm font-medium text-zinc-100">Authoring</div>
        </div>
      </div>

      <ScrollArea className="h-full">
        <div className="space-y-3 pr-1">
          <StudioSection
            title="Graphs"
            variant="soft"
            action={
              <Button variant="ghost" size="icon-xs" onClick={() => store.addGraph()} aria-label="Add graph">
                <Plus />
              </Button>
            }
          >
            <div className="space-y-2">
              {state.document.graphs.map((entry) => {
                const selected = entry.id === state.selection.graphId;

                return (
                  <button
                    key={entry.id}
                    onClick={() => store.selectGraph(entry.id)}
                    className={selected ? "w-full rounded-2xl bg-emerald-500/14 px-3 py-2.5 text-left text-[12px] font-medium text-zinc-50 shadow-[inset_0_0_0_1px_rgba(52,211,153,0.22)]" : "w-full rounded-2xl bg-white/4 px-3 py-2.5 text-left text-[12px] text-zinc-300 transition hover:bg-white/7"}
                  >
                    {entry.name}
                  </button>
                );
              })}
            </div>
          </StudioSection>

          <StudioSection
            title="Parameters"
            variant="soft"
            action={
              <Button variant="ghost" size="icon-xs" onClick={() => store.addParameter()} aria-label="Add parameter">
                <Plus />
              </Button>
            }
          >
            <div className="space-y-2">
              {state.document.parameters.map((parameter) => (
                <div key={parameter.id} className="grid grid-cols-[minmax(0,1fr)_118px] gap-2">
                  <Input value={parameter.name} onChange={(event) => store.updateParameter(parameter.id, { name: event.target.value })} className={editorInputClassName} />
                  <ParameterTypeSelect value={parameter.type} onChange={(value) => store.updateParameter(parameter.id, { type: value })} />
                </div>
              ))}
            </div>
          </StudioSection>

          <StudioSection
            title="Layers"
            variant="soft"
            action={
              <Button variant="ghost" size="icon-xs" onClick={() => store.addLayer()} aria-label="Add layer">
                <Plus />
              </Button>
            }
          >
            <div className="space-y-2.5">
              {state.document.layers.map((layer) => (
                <div key={layer.id} className="space-y-2">
                  <Input value={layer.name} onChange={(event) => store.updateLayer(layer.id, { name: event.target.value })} className={editorInputClassName} />
                  <select value={layer.graphId} onChange={(event) => store.updateLayer(layer.id, { graphId: event.target.value })} className={editorSelectClassName}>
                    {state.document.graphs.map((entry) => (
                      <option key={entry.id} value={entry.id}>
                        {entry.name}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </StudioSection>

          <StudioSection
            title="Masks"
            variant="soft"
            action={
              <Button variant="ghost" size="icon-xs" onClick={() => store.addMask()} aria-label="Add mask">
                <Plus />
              </Button>
            }
          >
            <div className="space-y-2.5">
              {state.document.masks.map((mask) => (
                <div key={mask.id} className="space-y-2">
                  <Input value={mask.name} onChange={(event) => store.updateMask(mask.id, { name: event.target.value })} className={editorInputClassName} />
                  <Input
                    value={mask.rootBoneName ?? ""}
                    onChange={(event) => store.updateMask(mask.id, { rootBoneName: event.target.value || undefined })}
                    placeholder="Root bone"
                    className={editorInputClassName}
                  />
                </div>
              ))}
            </div>
          </StudioSection>
        </div>
      </ScrollArea>
    </aside>
  );
}