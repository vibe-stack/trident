import type { GeometryNode } from "@ggez/shared";
import type { Command } from "../command-stack";
import type { SceneDocument } from "../../document/scene-document";

export function createSetNodeCommand(
  scene: SceneDocument,
  nodeId: string,
  nextNode: GeometryNode,
  beforeNode?: GeometryNode
): Command {
  const node = scene.getNode(nodeId);

  if (!node) {
    return {
      label: "set node",
      execute() {},
      undo() {}
    };
  }

  const before = structuredClone(beforeNode ?? node);
  const next = structuredClone(nextNode);

  return {
    label: "set node",
    execute(nextScene) {
      nextScene.addNode(structuredClone(next));
    },
    undo(nextScene) {
      nextScene.addNode(structuredClone(before));
    }
  };
}
