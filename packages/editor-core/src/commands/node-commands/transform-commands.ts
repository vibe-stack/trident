import type { Transform, Vec3 } from "@ggez/shared";
import { isInstancingNode, scaleVec3, vec3 } from "@ggez/shared";
import type { Command } from "../command-stack";
import type { SceneDocument } from "../../document/scene-document";
import { applyPositionDelta, flipScaleAxis } from "./helpers";

export type TransformAxis = "x" | "y" | "z";

export function createTranslateNodesCommand(nodeIds: string[], delta: Vec3): Command {
  return {
    label: "translate selection",
    execute(scene) {
      applyPositionDelta(scene, nodeIds, delta);
    },
    undo(scene) {
      applyPositionDelta(scene, nodeIds, scaleVec3(delta, -1));
    }
  };
}

export function createMirrorNodesCommand(nodeIds: string[], axis: TransformAxis): Command {
  return {
    label: `mirror ${axis}`,
    execute(scene) {
      flipScaleAxis(scene, nodeIds, axis);
    },
    undo(scene) {
      flipScaleAxis(scene, nodeIds, axis);
    }
  };
}

export function createSetNodeTransformCommand(
  scene: SceneDocument,
  nodeId: string,
  nextTransform: Transform,
  beforeTransform?: Transform
): Command {
  const node = scene.getNode(nodeId);

  if (!node) {
    return {
      label: "set transform",
      execute() {},
      undo() {}
    };
  }

  const before = structuredClone(beforeTransform ?? node.transform);
  const next = isInstancingNode(node)
    ? {
        position: structuredClone(nextTransform.position),
        rotation: structuredClone(nextTransform.rotation),
        scale: structuredClone(nextTransform.scale)
      }
    : structuredClone(nextTransform);

  return {
    label: "set transform",
    execute(nextScene) {
      const nextNode = nextScene.getNode(nodeId);

      if (!nextNode) {
        return;
      }

      nextNode.transform = structuredClone(next);
      nextScene.touch();
    },
    undo(nextScene) {
      const nextNode = nextScene.getNode(nodeId);

      if (!nextNode) {
        return;
      }

      nextNode.transform = structuredClone(before);
      nextScene.touch();
    }
  };
}

export function axisDelta(axis: TransformAxis, amount: number): Vec3 {
  if (axis === "x") {
    return vec3(amount, 0, 0);
  }

  if (axis === "y") {
    return vec3(0, amount, 0);
  }

  return vec3(0, 0, amount);
}
