import {
  extrudeAxisAlignedBrush,
  inflateEditableMesh,
  offsetEditableMeshTop,
  splitAxisAlignedBrush,
  type BrushAxis
} from "@web-hammer/geometry-kernel";
import type { BrushNode, Entity, GeometryNode, MeshNode, ModelNode, Vec3 } from "@web-hammer/shared";
import { addVec3, isBrushNode, isMeshNode, scaleVec3, vec3 } from "@web-hammer/shared";
import type { Command } from "./command-stack";
import type { SceneDocument } from "../document/scene-document";

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

export function createDuplicateNodesCommand(
  scene: SceneDocument,
  nodeIds: string[],
  offset: Vec3
): {
  command: Command;
  duplicateIds: string[];
} {
  const duplicates = nodeIds
    .map((nodeId) => scene.getNode(nodeId))
    .filter((node): node is GeometryNode => Boolean(node))
    .map((node) => {
      const duplicate = structuredClone(node);
      duplicate.id = createDuplicateNodeId(scene, node.id);
      duplicate.name = `${node.name} Copy`;
      duplicate.transform.position = addVec3(node.transform.position, offset);
      return duplicate;
    });

  return {
    command: {
      label: "duplicate selection",
      execute(nextScene) {
        duplicates.forEach((duplicate) => {
          nextScene.addNode(structuredClone(duplicate));
        });
      },
      undo(nextScene) {
        duplicates.forEach((duplicate) => {
          nextScene.removeNode(duplicate.id);
        });
      }
    },
    duplicateIds: duplicates.map((duplicate) => duplicate.id)
  };
}

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

export function createMeshInflateCommand(scene: SceneDocument, nodeIds: string[], factor: number): Command {
  const snapshots = nodeIds
    .map((nodeId) => scene.getNode(nodeId))
    .filter((node): node is MeshNode => Boolean(node && isMeshNode(node)))
    .map((node) => ({
      before: structuredClone(node.data),
      next: inflateEditableMesh(node.data, factor),
      nodeId: node.id
    }));

  return createMeshMutationCommand("mesh inflate", snapshots);
}

export function createMeshRaiseTopCommand(scene: SceneDocument, nodeIds: string[], amount: number): Command {
  const snapshots = nodeIds
    .map((nodeId) => scene.getNode(nodeId))
    .filter((node): node is MeshNode => Boolean(node && isMeshNode(node)))
    .map((node) => ({
      before: structuredClone(node.data),
      next: offsetEditableMeshTop(node.data, amount),
      nodeId: node.id
    }));

  return createMeshMutationCommand("mesh raise top", snapshots);
}

export function createPlaceModelNodeCommand(
  scene: SceneDocument,
  position: Vec3,
  model: Pick<ModelNode, "data" | "name">
): {
  command: Command;
  nodeId: string;
} {
  const nodeId = createDuplicateNodeId(scene, "node:model:placed");
  const node: ModelNode = {
    id: nodeId,
    kind: "model",
    name: model.name,
    transform: {
      position,
      rotation: vec3(0, 0, 0),
      scale: vec3(1, 1, 1)
    },
    data: structuredClone(model.data)
  };

  return {
    command: {
      label: "place asset",
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

export function createPlaceEntityCommand(entity: Entity): Command {
  return {
    label: "place entity",
    execute(scene) {
      scene.addEntity(structuredClone(entity));
    },
    undo(scene) {
      scene.removeEntity(entity.id);
    }
  };
}

function applyPositionDelta(scene: SceneDocument, nodeIds: string[], delta: Vec3) {
  nodeIds.forEach((nodeId) => {
    const node = scene.getNode(nodeId);

    if (!node) {
      return;
    }

    node.transform.position = addVec3(node.transform.position, delta);
    scene.touch();
  });
}

function flipScaleAxis(scene: SceneDocument, nodeIds: string[], axis: TransformAxis) {
  nodeIds.forEach((nodeId) => {
    const node = scene.getNode(nodeId);

    if (!node) {
      return;
    }

    node.transform.scale = {
      ...node.transform.scale,
      [axis]: node.transform.scale[axis] * -1
    };
    scene.touch();
  });
}

function createDuplicateNodeId(scene: SceneDocument, sourceId: string): string {
  let attempt = 1;

  while (true) {
    const nodeId = `${sourceId}:copy:${attempt}`;

    if (!scene.getNode(nodeId)) {
      return nodeId;
    }

    attempt += 1;
  }
}

function createMeshMutationCommand(
  label: string,
  snapshots: Array<{ before: MeshNode["data"]; next: MeshNode["data"]; nodeId: string }>
): Command {
  return {
    label,
    execute(nextScene) {
      snapshots.forEach((snapshot) => {
        const node = nextScene.getNode(snapshot.nodeId);

        if (node && isMeshNode(node)) {
          node.data = structuredClone(snapshot.next);
          nextScene.touch();
        }
      });
    },
    undo(nextScene) {
      snapshots.forEach((snapshot) => {
        const node = nextScene.getNode(snapshot.nodeId);

        if (node && isMeshNode(node)) {
          node.data = structuredClone(snapshot.before);
          nextScene.touch();
        }
      });
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
