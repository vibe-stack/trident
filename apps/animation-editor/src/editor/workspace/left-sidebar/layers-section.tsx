import type { AnimationEditorStore } from "@ggez/anim-editor-core";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DragInput } from "@/components/ui/drag-input";
import { Input } from "@/components/ui/input";
import { StudioSection, editorInputClassName, editorSelectClassName } from "../shared";
import type { EditorState } from "./types";

export function LayersSection(props: { store: AnimationEditorStore; state: EditorState }) {
  return (
    <StudioSection
      title="Layers"
      variant="soft"
      action={
        <Button variant="ghost" size="icon-xs" onClick={() => props.store.addLayer()} aria-label="Add layer">
          <Plus />
        </Button>
      }
    >
      <div className="space-y-3">
        {props.state.document.layers.map((layer) => (
          <div key={layer.id} className="space-y-2 rounded-2xl bg-black/20 p-3">
            <Input value={layer.name} onChange={(event) => props.store.updateLayer(layer.id, { name: event.target.value })} className={editorInputClassName} />
            <select value={layer.graphId} onChange={(event) => props.store.updateLayer(layer.id, { graphId: event.target.value })} className={editorSelectClassName}>
              {props.state.document.graphs.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name}
                </option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <select value={layer.blendMode} onChange={(event) => props.store.updateLayer(layer.id, { blendMode: event.target.value as typeof layer.blendMode })} className={editorSelectClassName}>
                <option value="override">Override</option>
                <option value="additive">Additive</option>
              </select>
              <select value={layer.rootMotionMode} onChange={(event) => props.store.updateLayer(layer.id, { rootMotionMode: event.target.value as typeof layer.rootMotionMode })} className={editorSelectClassName}>
                <option value="none">Root Motion: None</option>
                <option value="full">Root Motion: Full</option>
                <option value="xz">Root Motion: XZ</option>
                <option value="xz-yaw">Root Motion: XZ + Yaw</option>
              </select>
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)_112px] gap-2">
              <select value={layer.maskId ?? ""} onChange={(event) => props.store.updateLayer(layer.id, { maskId: event.target.value || undefined })} className={editorSelectClassName}>
                <option value="">No Mask</option>
                {props.state.document.masks.map((mask) => (
                  <option key={mask.id} value={mask.id}>
                    {mask.name}
                  </option>
                ))}
              </select>
              <DragInput value={layer.weight} min={0} max={1} step={0.05} precision={2} onChange={(value) => props.store.updateLayer(layer.id, { weight: value })} className="w-full" />
            </div>
            <label className="flex h-9 items-center gap-2 rounded-xl bg-white/7 px-3 text-[12px] text-zinc-200">
              <Checkbox checked={layer.enabled} onCheckedChange={(checked) => props.store.updateLayer(layer.id, { enabled: Boolean(checked) })} />
              <span>{layer.enabled ? "Layer enabled" : "Layer disabled"}</span>
            </label>
          </div>
        ))}
      </div>
    </StudioSection>
  );
}
