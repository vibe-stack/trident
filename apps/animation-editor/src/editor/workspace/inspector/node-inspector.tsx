import type { AnimationEditorStore } from "@ggez/anim-editor-core";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useEditorStoreValue } from "../../use-editor-store-value";
import { PropertyField, editorInputClassName, editorSelectClassName, sectionHintClassName } from "../shared";
import { Blend1DChildrenEditor, Blend2DChildrenEditor } from "./blend-editors";
import { NumericDragInput, updateTypedNode } from "./shared";
import { StateMachineInspector } from "./state-machine-inspector";

export function NodeInspector(props: { store: AnimationEditorStore }) {
  const state = useEditorStoreValue(props.store, () => props.store.getState(), ["document", "selection", "graphs", "parameters"]);
  const graph = state.document.graphs.find((entry) => entry.id === state.selection.graphId);
  const node = graph?.nodes.find((entry) => entry.id === state.selection.nodeIds[0]);

  return (
    <div className="space-y-3">
      <div className="px-1 text-[12px] font-medium text-zinc-300">Inspector</div>
      {!graph || !node ? <div className={sectionHintClassName}>Select a node to edit its properties.</div> : null}

      {graph && node ? (
        <div className="space-y-3">
          <PropertyField label="Name">
            <Input
              value={node.name}
              onChange={(event) => props.store.updateNode(graph.id, node.id, (current) => ({ ...current, name: event.target.value }))}
              className={editorInputClassName}
            />
          </PropertyField>

          {node.kind === "clip" ? (
            <>
              <PropertyField label="Clip">
                <select
                  value={node.clipId}
                  onChange={(event) => props.store.updateNode(graph.id, node.id, (current) => ({ ...current, clipId: event.target.value }))}
                  className={editorSelectClassName}
                >
                  {state.document.clips.map((clip) => (
                    <option key={clip.id} value={clip.id}>
                      {clip.name}
                    </option>
                  ))}
                </select>
              </PropertyField>
              <PropertyField label="Speed">
                <NumericDragInput
                  value={node.speed}
                  step={0.05}
                  precision={2}
                  onChange={(value) => props.store.updateNode(graph.id, node.id, (current) => ({ ...current, speed: value }))}
                />
              </PropertyField>
              <PropertyField label="Loop">
                <label className="flex h-8 items-center gap-2 rounded-xl bg-white/7 px-2.5 text-[12px] text-zinc-200">
                  <Checkbox
                    checked={node.loop}
                    onCheckedChange={(checked) =>
                      updateTypedNode(props.store, graph.id, node.id, "clip", (current) => ({
                        ...current,
                        loop: Boolean(checked),
                      }))
                    }
                  />
                  <span>{node.loop ? "Looping" : "Play once"}</span>
                </label>
              </PropertyField>
              <PropertyField label="Translation">
                <ButtonGroup className="grid w-full grid-cols-2">
                  <Button
                    type="button"
                    size="xs"
                    variant={node.inPlace ? "outline" : "default"}
                    className={node.inPlace ? "border-white/10 bg-white/6 text-zinc-300 hover:bg-white/10" : "border-emerald-300/30 bg-emerald-300 text-emerald-950 hover:bg-emerald-200"}
                    onClick={() =>
                      updateTypedNode(props.store, graph.id, node.id, "clip", (current) => ({
                        ...current,
                        inPlace: false,
                      }))
                    }
                  >
                    Root Motion
                  </Button>
                  <Button
                    type="button"
                    size="xs"
                    variant={node.inPlace ? "default" : "outline"}
                    className={node.inPlace ? "border-emerald-300/30 bg-emerald-300 text-emerald-950 hover:bg-emerald-200" : "border-white/10 bg-white/6 text-zinc-300 hover:bg-white/10"}
                    onClick={() =>
                      updateTypedNode(props.store, graph.id, node.id, "clip", (current) => ({
                        ...current,
                        inPlace: true,
                      }))
                    }
                  >
                    In Place
                  </Button>
                </ButtonGroup>
              </PropertyField>
            </>
          ) : null}

          {node.kind === "blend1d" ? (
            <>
              <PropertyField label="Parameter">
                <select
                  value={node.parameterId}
                  onChange={(event) => props.store.updateNode(graph.id, node.id, (current) => ({ ...current, parameterId: event.target.value }))}
                  className={editorSelectClassName}
                >
                  {state.document.parameters.map((parameter) => (
                    <option key={parameter.id} value={parameter.id}>
                      {parameter.name}
                    </option>
                  ))}
                </select>
              </PropertyField>
              <Blend1DChildrenEditor store={props.store} graph={graph} node={node} />
            </>
          ) : null}

          {node.kind === "blend2d" ? (
            <>
              <PropertyField label="X Parameter">
                <select
                  value={node.xParameterId}
                  onChange={(event) => props.store.updateNode(graph.id, node.id, (current) => ({ ...current, xParameterId: event.target.value }))}
                  className={editorSelectClassName}
                >
                  {state.document.parameters.map((parameter) => (
                    <option key={parameter.id} value={parameter.id}>
                      {parameter.name}
                    </option>
                  ))}
                </select>
              </PropertyField>
              <PropertyField label="Y Parameter">
                <select
                  value={node.yParameterId}
                  onChange={(event) => props.store.updateNode(graph.id, node.id, (current) => ({ ...current, yParameterId: event.target.value }))}
                  className={editorSelectClassName}
                >
                  {state.document.parameters.map((parameter) => (
                    <option key={parameter.id} value={parameter.id}>
                      {parameter.name}
                    </option>
                  ))}
                </select>
              </PropertyField>
              <Blend2DChildrenEditor store={props.store} graph={graph} node={node} />
            </>
          ) : null}

          {node.kind === "subgraph" ? (
            <PropertyField label="Graph">
              <select
                value={node.graphId}
                onChange={(event) => props.store.updateNode(graph.id, node.id, (current) => ({ ...current, graphId: event.target.value }))}
                className={editorSelectClassName}
              >
                {state.document.graphs.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.name}
                  </option>
                ))}
              </select>
            </PropertyField>
          ) : null}

          {node.kind === "output" ? <div className={sectionHintClassName}>Connect a motion node into the output node to define the graph result.</div> : null}

          {node.kind === "stateMachine" ? <StateMachineInspector store={props.store} graph={graph} node={node} parameters={state.document.parameters} /> : null}
        </div>
      ) : null}
    </div>
  );
}
