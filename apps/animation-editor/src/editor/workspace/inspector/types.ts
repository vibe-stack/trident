import type { EditorGraphNode } from "@ggez/anim-schema";

export type Blend1DNode = Extract<EditorGraphNode, { kind: "blend1d" }>;
export type Blend2DNode = Extract<EditorGraphNode, { kind: "blend2d" }>;
export type StateMachineNode = Extract<EditorGraphNode, { kind: "stateMachine" }>;
export type StateMachineState = StateMachineNode["states"][number];
export type StateMachineTransition = StateMachineNode["transitions"][number];
