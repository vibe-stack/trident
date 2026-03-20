import type { Asset, Entity, GeometryNode, Material } from "@ggez/shared";
import type { SceneDocument } from "@ggez/editor-core";
import type { PrefabDefinition, PrefabSnapshot } from "./types";

const PREFAB_DATA_KEY = "prefabData";
const PREFAB_NAME_KEY = "prefabName";
const PREFAB_DESCRIPTION_KEY = "prefabDescription";

export function encodePrefabAsAsset(prefab: PrefabDefinition): Asset {
  const snapshot: PrefabSnapshot = {
    entities: prefab.entities,
    materials: prefab.materials,
    nodes: prefab.nodes,
    rootNodeIds: prefab.rootNodeIds
  };

  return {
    id: prefab.id,
    metadata: {
      [PREFAB_DATA_KEY]: JSON.stringify(snapshot),
      [PREFAB_DESCRIPTION_KEY]: prefab.description,
      [PREFAB_NAME_KEY]: prefab.name,
      createdAt: prefab.createdAt
    },
    path: "",
    type: "prefab"
  };
}

export function decodePrefabFromAsset(asset: Asset): PrefabDefinition | undefined {
  if (asset.type !== "prefab") {
    return undefined;
  }

  const raw = asset.metadata[PREFAB_DATA_KEY];

  if (typeof raw !== "string") {
    return undefined;
  }

  try {
    const snapshot = JSON.parse(raw) as PrefabSnapshot;

    return {
      createdAt: typeof asset.metadata.createdAt === "string" ? asset.metadata.createdAt : new Date().toISOString(),
      description: typeof asset.metadata[PREFAB_DESCRIPTION_KEY] === "string" ? asset.metadata[PREFAB_DESCRIPTION_KEY] : "",
      entities: snapshot.entities ?? [],
      id: asset.id,
      materials: snapshot.materials ?? [],
      name: typeof asset.metadata[PREFAB_NAME_KEY] === "string" ? asset.metadata[PREFAB_NAME_KEY] : asset.id,
      nodes: snapshot.nodes ?? [],
      rootNodeIds: snapshot.rootNodeIds ?? []
    };
  } catch {
    return undefined;
  }
}

export function getPrefabsFromScene(scene: SceneDocument): PrefabDefinition[] {
  const prefabs: PrefabDefinition[] = [];

  scene.assets.forEach((asset) => {
    const prefab = decodePrefabFromAsset(asset);

    if (prefab) {
      prefabs.push(prefab);
    }
  });

  return prefabs;
}

export function capturePrefabSnapshot(
  scene: SceneDocument,
  nodeIds: string[]
): PrefabSnapshot {
  const selectedNodeIdSet = new Set(nodeIds);
  const collectedNodeIds = new Set<string>();
  const collectedNodes: GeometryNode[] = [];
  const collectedEntities: Entity[] = [];
  const referencedMaterialIds = new Set<string>();

  function collectNodeTree(nodeId: string) {
    if (collectedNodeIds.has(nodeId)) {
      return;
    }

    const node = scene.getNode(nodeId);

    if (!node) {
      return;
    }

    collectedNodeIds.add(nodeId);
    collectedNodes.push(structuredClone(node));

    if (node.kind === "brush" && node.data.faces) {
      for (const face of node.data.faces) {
        if (face.materialId) {
          referencedMaterialIds.add(face.materialId);
        }
      }
    }

    if (node.kind === "primitive" && node.data.materialId) {
      referencedMaterialIds.add(node.data.materialId);
    }

    if (node.kind === "mesh" && node.data.faces) {
      for (const face of node.data.faces) {
        if (face.materialId) {
          referencedMaterialIds.add(face.materialId);
        }
      }
    }

    scene.nodes.forEach((child) => {
      if (child.parentId === nodeId) {
        collectNodeTree(child.id);
      }
    });

    scene.entities.forEach((entity) => {
      if (entity.parentId === nodeId) {
        collectedEntities.push(structuredClone(entity));
      }
    });
  }

  nodeIds.forEach((id) => collectNodeTree(id));

  const rootNodeIds = nodeIds.filter((id) => {
    const node = scene.getNode(id);

    if (!node) {
      return false;
    }

    return !node.parentId || !selectedNodeIdSet.has(node.parentId);
  });

  const relocalizedNodes = collectedNodes.map((node) => {
    if (node.parentId && !collectedNodeIds.has(node.parentId)) {
      return { ...node, parentId: undefined };
    }

    return node;
  });

  const relocalizedEntities = collectedEntities.map((entity) => {
    if (entity.parentId && !collectedNodeIds.has(entity.parentId)) {
      return { ...entity, parentId: undefined };
    }

    return entity;
  });

  const collectedMaterials: Material[] = [];

  referencedMaterialIds.forEach((materialId) => {
    const material = scene.materials.get(materialId);

    if (material) {
      collectedMaterials.push(structuredClone(material));
    }
  });

  return {
    entities: relocalizedEntities,
    materials: collectedMaterials,
    nodes: relocalizedNodes,
    rootNodeIds
  };
}
