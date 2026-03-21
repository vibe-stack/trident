import type { AnimationEditorStore } from "@ggez/anim-editor-core";
import type { EditorGraph } from "@ggez/anim-schema";
import { Input } from "@/components/ui/input";
import { PropertyField, editorInputClassName, sectionHintClassName } from "../shared";
import { NumericDragInput, updateTypedNode } from "./shared";
import type { Blend1DNode, Blend2DNode } from "./types";

export function Blend1DChildrenEditor(props: {
  store: AnimationEditorStore;
  graph: EditorGraph;
  node: Blend1DNode;
}) {
  if (props.node.children.length === 0) {
    return <div className={sectionHintClassName}>Connect clip nodes into this blend to create children, then edit thresholds here.</div>;
  }

  return (
    <div className="space-y-2">
      {props.node.children.map((child) => {
        const childNode = props.graph.nodes.find((candidate) => candidate.id === child.nodeId);

        return (
          <div key={child.nodeId} className="grid grid-cols-[minmax(0,1fr)_96px] gap-2 border border-white/8 bg-black/20 p-2">
            <PropertyField label="Child">
              <Input
                value={child.label ?? childNode?.name ?? child.nodeId}
                onChange={(event) =>
                  updateTypedNode(props.store, props.graph.id, props.node.id, "blend1d", (current) => ({
                    ...current,
                    children: current.children.map((entry) => (entry.nodeId === child.nodeId ? { ...entry, label: event.target.value } : entry)),
                  }))
                }
                className={editorInputClassName}
              />
            </PropertyField>
            <PropertyField label="Threshold">
              <NumericDragInput
                value={child.threshold}
                step={0.05}
                precision={2}
                onChange={(value) =>
                  updateTypedNode(props.store, props.graph.id, props.node.id, "blend1d", (current) => ({
                    ...current,
                    children: current.children.map((entry) => (entry.nodeId === child.nodeId ? { ...entry, threshold: value } : entry)),
                  }))
                }
              />
            </PropertyField>
          </div>
        );
      })}
    </div>
  );
}

export function Blend2DChildrenEditor(props: {
  store: AnimationEditorStore;
  graph: EditorGraph;
  node: Blend2DNode;
}) {
  if (props.node.children.length === 0) {
    return <div className={sectionHintClassName}>Connect clip nodes into this blend to create children, then edit sample positions here.</div>;
  }

  return (
    <div className="space-y-2">
      {props.node.children.map((child) => {
        const childNode = props.graph.nodes.find((candidate) => candidate.id === child.nodeId);

        return (
          <div key={child.nodeId} className="grid grid-cols-[minmax(0,1fr)_84px_84px] gap-2 border border-white/8 bg-black/20 p-2">
            <PropertyField label="Child">
              <Input
                value={child.label ?? childNode?.name ?? child.nodeId}
                onChange={(event) =>
                  updateTypedNode(props.store, props.graph.id, props.node.id, "blend2d", (current) => ({
                    ...current,
                    children: current.children.map((entry) => (entry.nodeId === child.nodeId ? { ...entry, label: event.target.value } : entry)),
                  }))
                }
                className={editorInputClassName}
              />
            </PropertyField>
            <PropertyField label="X">
              <NumericDragInput
                value={child.x}
                step={0.05}
                precision={2}
                onChange={(value) =>
                  updateTypedNode(props.store, props.graph.id, props.node.id, "blend2d", (current) => ({
                    ...current,
                    children: current.children.map((entry) => (entry.nodeId === child.nodeId ? { ...entry, x: value } : entry)),
                  }))
                }
              />
            </PropertyField>
            <PropertyField label="Y">
              <NumericDragInput
                value={child.y}
                step={0.05}
                precision={2}
                onChange={(value) =>
                  updateTypedNode(props.store, props.graph.id, props.node.id, "blend2d", (current) => ({
                    ...current,
                    children: current.children.map((entry) => (entry.nodeId === child.nodeId ? { ...entry, y: value } : entry)),
                  }))
                }
              />
            </PropertyField>
          </div>
        );
      })}
    </div>
  );
}
