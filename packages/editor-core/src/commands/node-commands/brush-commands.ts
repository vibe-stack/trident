import {
  createAxisAlignedBrushFromBounds,
  extrudeAxisAlignedBrush,
  offsetAxisAlignedBrushFace,
  splitAxisAlignedBrush,
  splitAxisAlignedBrushAtCoordinate,
  type BrushAxis
} from "@ggez/geometry-kernel";
import type { BrushNode, Transform } from "@ggez/shared";
import { isBrushNode } from "@ggez/shared";
import type { Command } from "../command-stack";
import type { SceneDocument } from "../../document/scene-document";
import { createSetBrushDataCommand } from "./data-commands";
import { createDuplicateNodeId } from "./helpers";

export function createSplitBrushNodesCommand(
  scene: SceneDocument,
  nodeIds: string[],
  axis: BrushAxis
): {
  command: Command;
  splitIds: string[];
} {
  const plannedSplits = nodeIds
    .map((nodeId) => scene.getNode(nodeId))
    .filter((node): node is BrushNode => Boolean(node && isBrushNode(node)))
    .map((node) => {
      const splitBrushes = splitAxisAlignedBrush(node.data, axis);

      if (!splitBrushes) {
        return undefined;
      }

      return {
        original: structuredClone(node),
        replacements: splitBrushes.map((brush, index) => ({
          ...structuredClone(node),
          id: createDuplicateNodeId(scene, `${node.id}:clip:${axis}:${index + 1}`),
          name: `${node.name} ${axis.toUpperCase()}${index + 1}`,
          data: brush
        }))
      };
    })
    .filter((plan): plan is { original: BrushNode; replacements: BrushNode[] } => Boolean(plan));

  return {
    command: {
      label: `clip ${axis}`,
      execute(nextScene) {
        plannedSplits.forEach((plan) => {
          nextScene.removeNode(plan.original.id);
          plan.replacements.forEach((replacement) => {
            nextScene.addNode(structuredClone(replacement));
          });
        });
      },
      undo(nextScene) {
        plannedSplits.forEach((plan) => {
          plan.replacements.forEach((replacement) => {
            nextScene.removeNode(replacement.id);
          });
          nextScene.addNode(structuredClone(plan.original));
        });
      }
    },
    splitIds: plannedSplits.flatMap((plan) => plan.replacements.map((replacement) => replacement.id))
  };
}

export function createSplitBrushNodeAtCoordinateCommand(
  scene: SceneDocument,
  nodeId: string,
  axis: BrushAxis,
  coordinate: number
): {
  command: Command;
  splitIds: string[];
} {
  const node = scene.getNode(nodeId);

  if (!node || !isBrushNode(node)) {
    return {
      command: {
        label: `clip ${axis}`,
        execute() {},
        undo() {}
      },
      splitIds: []
    };
  }

  const splitBrushes = splitAxisAlignedBrushAtCoordinate(node.data, axis, coordinate);

  if (!splitBrushes) {
    return {
      command: {
        label: `clip ${axis}`,
        execute() {},
        undo() {}
      },
      splitIds: []
    };
  }

  const original = structuredClone(node);
  const replacements = splitBrushes.map((brush, index) => ({
    ...structuredClone(node),
    id: createDuplicateNodeId(scene, `${node.id}:clip:${axis}:${index + 1}`),
    name: `${node.name} ${axis.toUpperCase()}${index + 1}`,
    data: brush
  }));

  return {
    command: {
      label: `clip ${axis}`,
      execute(nextScene) {
        nextScene.removeNode(original.id);
        replacements.forEach((replacement) => {
          nextScene.addNode(structuredClone(replacement));
        });
      },
      undo(nextScene) {
        replacements.forEach((replacement) => {
          nextScene.removeNode(replacement.id);
        });
        nextScene.addNode(structuredClone(original));
      }
    },
    splitIds: replacements.map((replacement) => replacement.id)
  };
}

export function createExtrudeBrushNodesCommand(
  scene: SceneDocument,
  nodeIds: string[],
  axis: BrushAxis,
  amount: number,
  direction: -1 | 1
): Command {
  const snapshots = nodeIds
    .map((nodeId) => scene.getNode(nodeId))
    .filter((node): node is BrushNode => Boolean(node && isBrushNode(node)))
    .map((node) => ({
      before: structuredClone(node.data),
      next: extrudeAxisAlignedBrush(node.data, axis, amount, direction),
      nodeId: node.id
    }))
    .filter((snapshot): snapshot is { before: BrushNode["data"]; next: BrushNode["data"]; nodeId: string } => Boolean(snapshot.next));

  return {
    label: `extrude ${axis}`,
    execute(nextScene) {
      snapshots.forEach((snapshot) => {
        const node = nextScene.getNode(snapshot.nodeId);

        if (node && isBrushNode(node)) {
          node.data = structuredClone(snapshot.next);
          nextScene.touch();
        }
      });
    },
    undo(nextScene) {
      snapshots.forEach((snapshot) => {
        const node = nextScene.getNode(snapshot.nodeId);

        if (node && isBrushNode(node)) {
          node.data = structuredClone(snapshot.before);
          nextScene.touch();
        }
      });
    }
  };
}

export function createOffsetBrushFaceCommand(
  scene: SceneDocument,
  nodeId: string,
  axis: BrushAxis,
  side: "max" | "min",
  amount: number
): Command {
  const node = scene.getNode(nodeId);

  if (!node || !isBrushNode(node)) {
    return {
      label: `extrude ${axis}`,
      execute() {},
      undo() {}
    };
  }

  const next = offsetAxisAlignedBrushFace(node.data, axis, side, amount);

  if (!next) {
    return {
      label: `extrude ${axis}`,
      execute() {},
      undo() {}
    };
  }

  return createSetBrushDataCommand(scene, nodeId, next, node.data);
}

export function createPlaceBrushNodeCommand(
  scene: SceneDocument,
  transform: Transform,
  brush: Pick<BrushNode, "data" | "name"> = {
    data: createAxisAlignedBrushFromBounds({
      x: { min: -2, max: 2 },
      y: { min: -1.5, max: 1.5 },
      z: { min: -2, max: 2 }
    }),
    name: "Blockout Brush"
  }
): {
  command: Command;
  nodeId: string;
} {
  const nodeId = createDuplicateNodeId(scene, "node:brush:placed");
  const node: BrushNode = {
    id: nodeId,
    kind: "brush",
    name: brush.name,
    transform: structuredClone(transform),
    data: structuredClone(brush.data)
  };

  return {
    command: {
      label: "place brush",
      execute(nextScene) {
        nextScene.addNode(structuredClone(node));
      },
      undo(nextScene) {
        nextScene.removeNode(node.id);
      }
    },
    nodeId
  };
}

export function createAssignMaterialToBrushesCommand(
  scene: SceneDocument,
  nodeIds: string[],
  materialId: string
): Command {
  const snapshots = nodeIds
    .map((nodeId) => scene.getNode(nodeId))
    .filter((node): node is BrushNode => Boolean(node && isBrushNode(node)))
    .map((node) => ({
      before: structuredClone(node.data.faces),
      nodeId: node.id,
      next: node.data.planes.map((plane, index) => ({
        id: node.data.faces[index]?.id ?? `face:${node.id}:${index}`,
        materialId,
        plane,
        vertexIds: node.data.faces[index]?.vertexIds ?? []
      }))
    }));

  return {
    label: "assign material",
    execute(nextScene) {
      snapshots.forEach((snapshot) => {
        const node = nextScene.getNode(snapshot.nodeId);

        if (node && isBrushNode(node)) {
          node.data.faces = structuredClone(snapshot.next);
          nextScene.touch();
        }
      });
    },
    undo(nextScene) {
      snapshots.forEach((snapshot) => {
        const node = nextScene.getNode(snapshot.nodeId);

        if (node && isBrushNode(node)) {
          node.data.faces = structuredClone(snapshot.before);
          nextScene.touch();
        }
      });
    }
  };
}