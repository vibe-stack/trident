import type { Entity, MeshNode, NodeID, Vec3 } from "@ggez/shared";
import { addVec3, isMeshNode } from "@ggez/shared";
import type { Command } from "../command-stack";
import type { SceneDocument } from "../../document/scene-document";
import type { TransformAxis } from "./transform-commands";

export function applyPositionDelta(scene: SceneDocument, nodeIds: string[], delta: Vec3) {
  resolveTopLevelSelectionIds(scene, nodeIds).forEach((nodeId) => {
    const node = scene.getNode(nodeId);

    if (node) {
      node.transform.position = addVec3(node.transform.position, delta);
      scene.touch();
      return;
    }

    const entity = scene.getEntity(nodeId);

    if (!entity) {
      return;
    }

    entity.transform.position = addVec3(entity.transform.position, delta);
    scene.touch();
  });
}

export function flipScaleAxis(scene: SceneDocument, nodeIds: string[], axis: TransformAxis) {
  resolveTopLevelSelectionIds(scene, nodeIds).forEach((nodeId) => {
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

export function createDuplicateNodeId(scene: SceneDocument, sourceId: string): string {
  let attempt = 1;

  while (true) {
    const nodeId = `${sourceId}:copy:${attempt}`;

    if (!scene.getNode(nodeId)) {
      return nodeId;
    }

    attempt += 1;
  }
}

export function createDuplicateEntityId(scene: SceneDocument, sourceId: string): string {
  let attempt = 1;

  while (true) {
    const entityId = `${sourceId}:copy:${attempt}`;

    if (!scene.getEntity(entityId)) {
      return entityId;
    }

    attempt += 1;
  }
}

export function collectDescendantNodeIds(scene: SceneDocument, parentId: NodeID): NodeID[] {
  const descendants: NodeID[] = [];
  const queue = Array.from(scene.nodes.values())
    .filter((node) => node.parentId === parentId)
    .map((node) => node.id);

  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    descendants.push(nodeId);

    scene.nodes.forEach((node) => {
      if (node.parentId === nodeId) {
        queue.push(node.id);
      }
    });
  }

  return descendants;
}

export function collectDescendantEntityIds(scene: SceneDocument, parentId: NodeID): Entity["id"][] {
  const descendantNodeIds = new Set<NodeID>([parentId, ...collectDescendantNodeIds(scene, parentId)]);

  return Array.from(scene.entities.values())
    .filter((entity) => entity.parentId && descendantNodeIds.has(entity.parentId))
    .map((entity) => entity.id);
}

export function resolveTopLevelSelectionIds(scene: SceneDocument, ids: string[]) {
  const selectedIds = new Set(ids);

  return Array.from(
    new Set(
      ids.filter((id) => {
        const node = scene.getNode(id);

        if (node) {
          let currentParentId = node.parentId;

          while (currentParentId) {
            if (selectedIds.has(currentParentId)) {
              return false;
            }

            currentParentId = scene.getNode(currentParentId)?.parentId;
          }

          return true;
        }

        const entity = scene.getEntity(id);

        if (!entity) {
          return false;
        }

        let currentParentId = entity.parentId;

        while (currentParentId) {
          if (selectedIds.has(currentParentId)) {
            return false;
          }

          currentParentId = scene.getNode(currentParentId)?.parentId;
        }

        return true;
      })
    )
  );
}

export function createMeshMutationCommand(
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
