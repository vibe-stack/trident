import type { AnimationEditorStore } from "@ggez/anim-editor-core";
import type { EditorGraphNode, ParameterDefinition, TransitionOperator } from "@ggez/anim-schema";
import { DragInput } from "@/components/ui/drag-input";
import type { StateMachineNode, StateMachineTransition } from "./types";

export const TRANSITION_OPERATORS: TransitionOperator[] = [">", ">=", "<", "<=", "==", "!=", "set"];
export const INTERRUPTION_SOURCES: StateMachineTransition["interruptionSource"][] = ["none", "current", "next", "both"];

export function updateTypedNode<TKind extends EditorGraphNode["kind"]>(
  store: AnimationEditorStore,
  graphId: string,
  nodeId: string,
  expectedKind: TKind,
  updater: (node: Extract<EditorGraphNode, { kind: TKind }>) => Extract<EditorGraphNode, { kind: TKind }>
) {
  store.updateNode(graphId, nodeId, (current) => {
    if (current.kind !== expectedKind) {
      return current;
    }

    return updater(current as Extract<EditorGraphNode, { kind: TKind }>);
  });
}

export function updateStateMachineNode(
  store: AnimationEditorStore,
  graphId: string,
  nodeId: string,
  updater: (node: StateMachineNode) => StateMachineNode
) {
  updateTypedNode(store, graphId, nodeId, "stateMachine", updater);
}

export function buildDefaultTransition(parameter?: ParameterDefinition): StateMachineTransition["conditions"][number] {
  return {
    parameterId: parameter?.id ?? "",
    operator: parameter?.type === "trigger" ? "set" : parameter?.type === "bool" ? "==" : ">",
    value: parameter?.type === "bool" ? true : parameter?.type === "trigger" ? undefined : 0,
  };
}

export function NumericDragInput(props: {
  value: number;
  onChange: (value: number) => void;
  step?: number;
  precision?: number;
  min?: number;
  max?: number;
}) {
  return <DragInput value={props.value} onChange={props.onChange} step={props.step} precision={props.precision} min={props.min} max={props.max} className="w-full" />;
}
