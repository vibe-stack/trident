import type { GeometryNode, Entity, Material, Vec3 } from "@ggez/shared";
import { addVec3 } from "@ggez/shared";
import type { Command, SceneDocument } from "@ggez/editor-core";
import { createDuplicateNodeId, createDuplicateEntityId } from "@ggez/editor-core";
import type { PrefabDefinition } from "./types";
import { capturePrefabSnapshot, decodePrefabFromAsset, encodePrefabAsAsset } from "./prefab-library";

export function createSavePrefabCommand(
  scene: SceneDocument,
  nodeIds: string[],
  name: string,
  description = ""
): { command: Command; prefabId: string } {
  const prefabId = `prefab:${name.toLowerCase().replace(/\s+/g, "-")}:${Date.now()}`;
  const snapshot = capturePrefabSnapshot(scene, nodeIds);

  const prefab: PrefabDefinition = {
    createdAt: new Date().toISOString(),
    description,
    entities: snapshot.entities,
    id: prefabId,
    materials: snapshot.materials,
    name,
    nodes: snapshot.nodes,
    rootNodeIds: snapshot.rootNodeIds
  };

  const asset = encodePrefabAsAsset(prefab);

  return {
    command: {
      label: "save prefab",
      execute(nextScene) {
        nextScene.setAsset(structuredClone(asset));
        nextScene.touch();
      },
      undo(nextScene) {
        nextScene.assets.delete(prefabId);
        nextScene.touch();
      }
    },
    prefabId
  };
}

export function createPlacePrefabCommand(
  scene: SceneDocument,
  prefabId: string,
  position: Vec3
): { command: Command; nodeIds: string[] } {
  const asset = scene.assets.get(prefabId);

  if (!asset) {
    return {
      command: { execute() {}, label: "place prefab", undo() {} },
      nodeIds: []
    };
  }

  const prefab = decodePrefabFromAsset(asset);

  if (!prefab) {
    return {
      command: { execute() {}, label: "place prefab", undo() {} },
      nodeIds: []
    };
  }

  const nodeIdMap = new Map<string, string>();
  const entityIdMap = new Map<string, string>();
  const placedNodes: GeometryNode[] = [];
  const placedEntities: Entity[] = [];
  const materialsToEnsure: Material[] = [];
  const newRootIds: string[] = [];

  for (const sourceNode of prefab.nodes) {
    const newId = createDuplicateNodeId(scene, sourceNode.id);
    nodeIdMap.set(sourceNode.id, newId);
  }

  for (const sourceEntity of prefab.entities) {
    const newId = createDuplicateEntityId(scene, sourceEntity.id);
    entityIdMap.set(sourceEntity.id, newId);
  }

  for (const sourceNode of prefab.nodes) {
    const newId = nodeIdMap.get(sourceNode.id)!;
    const isRoot = prefab.rootNodeIds.includes(sourceNode.id);
    const newParentId = sourceNode.parentId ? nodeIdMap.get(sourceNode.parentId) : undefined;

    const placedNode: GeometryNode = structuredClone(sourceNode);
    placedNode.id = newId;
    placedNode.parentId = newParentId;

    if (isRoot) {
      placedNode.transform = {
        ...placedNode.transform,
        position: addVec3(placedNode.transform.position, position)
      };
      newRootIds.push(newId);
    }

    placedNodes.push(placedNode);
  }

  for (const sourceEntity of prefab.entities) {
    const newId = entityIdMap.get(sourceEntity.id)!;
    const newParentId = sourceEntity.parentId ? nodeIdMap.get(sourceEntity.parentId) : undefined;

    const placedEntity: Entity = structuredClone(sourceEntity);
    placedEntity.id = newId;
    placedEntity.parentId = newParentId;

    placedEntities.push(placedEntity);
  }

  for (const material of prefab.materials) {
    if (!scene.materials.has(material.id)) {
      materialsToEnsure.push(structuredClone(material));
    }
  }

  return {
    command: {
      label: "place prefab",
      execute(nextScene) {
        for (const material of materialsToEnsure) {
          if (!nextScene.materials.has(material.id)) {
            nextScene.setMaterial(structuredClone(material));
          }
        }

        for (const node of placedNodes) {
          nextScene.addNode(structuredClone(node));
        }

        for (const entity of placedEntities) {
          nextScene.addEntity(structuredClone(entity));
        }

        nextScene.touch();
      },
      undo(nextScene) {
        for (const entity of placedEntities) {
          nextScene.removeEntity(entity.id);
        }

        for (const node of [...placedNodes].reverse()) {
          nextScene.removeNode(node.id);
        }

        for (const material of materialsToEnsure) {
          nextScene.removeMaterial(material.id);
        }

        nextScene.touch();
      }
    },
    nodeIds: newRootIds
  };
}

export function createDeletePrefabCommand(
  scene: SceneDocument,
  prefabId: string
): Command {
  const asset = scene.assets.get(prefabId);

  if (!asset || asset.type !== "prefab") {
    return { execute() {}, label: "delete prefab", undo() {} };
  }

  const savedAsset = structuredClone(asset);

  return {
    label: "delete prefab",
    execute(nextScene) {
      nextScene.assets.delete(prefabId);
      nextScene.touch();
    },
    undo(nextScene) {
      nextScene.setAsset(structuredClone(savedAsset));
      nextScene.touch();
    }
  };
}

export function createUpdatePrefabCommand(
  scene: SceneDocument,
  prefabId: string,
  nodeIds: string[]
): Command {
  const existingAsset = scene.assets.get(prefabId);

  if (!existingAsset || existingAsset.type !== "prefab") {
    return { execute() {}, label: "update prefab", undo() {} };
  }

  const beforeAsset = structuredClone(existingAsset);
  const existingPrefab = decodePrefabFromAsset(existingAsset);

  if (!existingPrefab) {
    return { execute() {}, label: "update prefab", undo() {} };
  }

  const snapshot = capturePrefabSnapshot(scene, nodeIds);
  const updatedPrefab: PrefabDefinition = {
    ...existingPrefab,
    entities: snapshot.entities,
    materials: snapshot.materials,
    nodes: snapshot.nodes,
    rootNodeIds: snapshot.rootNodeIds
  };

  const updatedAsset = encodePrefabAsAsset(updatedPrefab);

  return {
    label: "update prefab",
    execute(nextScene) {
      nextScene.setAsset(structuredClone(updatedAsset));
      nextScene.touch();
    },
    undo(nextScene) {
      nextScene.setAsset(structuredClone(beforeAsset));
      nextScene.touch();
    }
  };
}
