import { describe, expect, test } from "bun:test";
import { vec3 } from "@ggez/shared";
import { createSceneDocument } from "@ggez/editor-core";
import type { GeometryNode } from "@ggez/shared";
import {
  capturePrefabSnapshot,
  decodePrefabFromAsset,
  encodePrefabAsAsset,
  getPrefabsFromScene
} from "./prefab-library";
import {
  createDeletePrefabCommand,
  createPlacePrefabCommand,
  createSavePrefabCommand,
  createUpdatePrefabCommand
} from "./prefab-commands";
import type { PrefabDefinition } from "./types";

function createTestScene() {
  const scene = createSceneDocument();

  const brush: GeometryNode = {
    data: {
      faces: [{ materialId: "mat:default", normal: vec3(0, 1, 0), vertices: [] }],
      planes: [{ distance: 1, normal: vec3(0, 1, 0) }],
      previewSize: vec3(2, 2, 2)
    },
    id: "node:wall",
    kind: "brush",
    name: "Wall",
    transform: { position: vec3(0, 0, 0), rotation: vec3(0, 0, 0), scale: vec3(1, 1, 1) }
  } as GeometryNode;

  const child: GeometryNode = {
    data: {
      materialId: "mat:default",
      physics: undefined,
      role: "prop",
      shape: "cube",
      size: vec3(1, 1, 1)
    },
    id: "node:detail",
    kind: "primitive",
    name: "Detail",
    parentId: "node:wall",
    transform: { position: vec3(1, 0, 0), rotation: vec3(0, 0, 0), scale: vec3(0.5, 0.5, 0.5) }
  } as GeometryNode;

  scene.addNode(brush);
  scene.addNode(child);
  scene.setMaterial({
    category: "flat",
    color: "#808080",
    id: "mat:default",
    name: "Default"
  });

  return scene;
}

describe("PrefabLibrary", () => {
  test("encodes and decodes prefab via asset", () => {
    const prefab: PrefabDefinition = {
      createdAt: "2026-01-01T00:00:00Z",
      description: "Test prefab",
      entities: [],
      id: "prefab:test",
      materials: [{ category: "flat", color: "#ff0000", id: "mat:1", name: "Red" }],
      name: "TestPrefab",
      nodes: [
        {
          data: {} as never,
          id: "node:a",
          kind: "group",
          name: "GroupA",
          transform: { position: vec3(0, 0, 0), rotation: vec3(0, 0, 0), scale: vec3(1, 1, 1) }
        }
      ],
      rootNodeIds: ["node:a"]
    };

    const asset = encodePrefabAsAsset(prefab);
    expect(asset.type).toBe("prefab");
    expect(asset.id).toBe("prefab:test");

    const decoded = decodePrefabFromAsset(asset);
    expect(decoded).toBeDefined();
    expect(decoded!.name).toBe("TestPrefab");
    expect(decoded!.nodes.length).toBe(1);
    expect(decoded!.nodes[0].id).toBe("node:a");
    expect(decoded!.materials.length).toBe(1);
    expect(decoded!.rootNodeIds).toEqual(["node:a"]);
  });

  test("returns undefined for non-prefab asset", () => {
    const asset = {
      id: "asset:model",
      metadata: {},
      path: "/models/test.glb",
      type: "model" as const
    };

    expect(decodePrefabFromAsset(asset)).toBeUndefined();
  });

  test("captures subtree with children and materials", () => {
    const scene = createTestScene();
    const snapshot = capturePrefabSnapshot(scene, ["node:wall"]);

    expect(snapshot.nodes.length).toBe(2);
    expect(snapshot.rootNodeIds).toEqual(["node:wall"]);
    expect(snapshot.materials.length).toBe(1);
    expect(snapshot.materials[0].id).toBe("mat:default");
  });

  test("getPrefabsFromScene returns stored prefabs", () => {
    const scene = createTestScene();
    const prefab: PrefabDefinition = {
      createdAt: "2026-01-01T00:00:00Z",
      description: "",
      entities: [],
      id: "prefab:room",
      materials: [],
      name: "Room",
      nodes: [],
      rootNodeIds: []
    };

    scene.setAsset(encodePrefabAsAsset(prefab));

    const prefabs = getPrefabsFromScene(scene);
    expect(prefabs.length).toBe(1);
    expect(prefabs[0].name).toBe("Room");
  });
});

describe("PrefabCommands", () => {
  test("save prefab creates asset", () => {
    const scene = createTestScene();
    const { command, prefabId } = createSavePrefabCommand(scene, ["node:wall"], "MyWall");

    command.execute(scene);

    const asset = scene.assets.get(prefabId);
    expect(asset).toBeDefined();
    expect(asset!.type).toBe("prefab");

    const decoded = decodePrefabFromAsset(asset!);
    expect(decoded!.name).toBe("MyWall");
    expect(decoded!.nodes.length).toBe(2);
  });

  test("save prefab undo removes asset", () => {
    const scene = createTestScene();
    const { command, prefabId } = createSavePrefabCommand(scene, ["node:wall"], "MyWall");

    command.execute(scene);
    expect(scene.assets.has(prefabId)).toBe(true);

    command.undo(scene);
    expect(scene.assets.has(prefabId)).toBe(false);
  });

  test("place prefab creates new nodes with unique ids", () => {
    const scene = createTestScene();
    const { command: saveCmd, prefabId } = createSavePrefabCommand(scene, ["node:wall"], "MyWall");
    saveCmd.execute(scene);

    const nodeCountBefore = scene.nodes.size;
    const { command: placeCmd, nodeIds } = createPlacePrefabCommand(scene, prefabId, vec3(10, 0, 0));
    placeCmd.execute(scene);

    expect(scene.nodes.size).toBe(nodeCountBefore + 2);
    expect(nodeIds.length).toBe(1);

    const rootNode = scene.getNode(nodeIds[0]);
    expect(rootNode).toBeDefined();
    expect(rootNode!.transform.position.x).toBe(10);
  });

  test("place prefab undo removes placed nodes", () => {
    const scene = createTestScene();
    const { command: saveCmd, prefabId } = createSavePrefabCommand(scene, ["node:wall"], "MyWall");
    saveCmd.execute(scene);

    const nodeCountBefore = scene.nodes.size;
    const { command: placeCmd } = createPlacePrefabCommand(scene, prefabId, vec3(10, 0, 0));
    placeCmd.execute(scene);
    expect(scene.nodes.size).toBe(nodeCountBefore + 2);

    placeCmd.undo(scene);
    expect(scene.nodes.size).toBe(nodeCountBefore);
  });

  test("place prefab materials are added and removed on undo", () => {
    const scene = createTestScene();
    const { command: saveCmd, prefabId } = createSavePrefabCommand(scene, ["node:wall"], "MyWall");
    saveCmd.execute(scene);

    scene.removeMaterial("mat:default");
    expect(scene.materials.has("mat:default")).toBe(false);

    const { command: placeCmd } = createPlacePrefabCommand(scene, prefabId, vec3(5, 0, 0));
    placeCmd.execute(scene);
    expect(scene.materials.has("mat:default")).toBe(true);

    placeCmd.undo(scene);
    expect(scene.materials.has("mat:default")).toBe(false);
  });

  test("update prefab replaces snapshot", () => {
    const scene = createTestScene();
    const { command: saveCmd, prefabId } = createSavePrefabCommand(scene, ["node:wall"], "MyWall");
    saveCmd.execute(scene);

    const beforeAsset = scene.assets.get(prefabId)!;
    const beforePrefab = decodePrefabFromAsset(beforeAsset)!;
    expect(beforePrefab.nodes.length).toBe(2);

    const updateCmd = createUpdatePrefabCommand(scene, prefabId, ["node:detail"]);
    updateCmd.execute(scene);

    const afterAsset = scene.assets.get(prefabId)!;
    const afterPrefab = decodePrefabFromAsset(afterAsset)!;
    expect(afterPrefab.nodes.length).toBe(1);
    expect(afterPrefab.nodes[0].id).toBe("node:detail");

    updateCmd.undo(scene);
    const restoredAsset = scene.assets.get(prefabId)!;
    const restoredPrefab = decodePrefabFromAsset(restoredAsset)!;
    expect(restoredPrefab.nodes.length).toBe(2);
  });

  test("delete prefab removes asset", () => {
    const scene = createTestScene();
    const { command: saveCmd, prefabId } = createSavePrefabCommand(scene, ["node:wall"], "MyWall");
    saveCmd.execute(scene);
    expect(scene.assets.has(prefabId)).toBe(true);

    const deleteCmd = createDeletePrefabCommand(scene, prefabId);
    deleteCmd.execute(scene);
    expect(scene.assets.has(prefabId)).toBe(false);

    deleteCmd.undo(scene);
    expect(scene.assets.has(prefabId)).toBe(true);
  });
});
