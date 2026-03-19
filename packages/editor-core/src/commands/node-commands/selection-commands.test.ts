import { describe, expect, test } from "bun:test";
import { vec3, type GeometryNode } from "@ggez/shared";
import { createSceneDocument } from "../../document/scene-document";
import { createInstanceNodesCommand } from "./selection-commands";

describe("createInstanceNodesCommand", () => {
  test("creates a parallel instanced group from a selected source-plus-instances cluster", () => {
    const scene = createSceneDocument();
    const nodes: GeometryNode[] = [
      {
        data: {},
        id: "node:cluster",
        kind: "group",
        name: "Cluster",
        transform: {
          position: vec3(0, 0, 0),
          rotation: vec3(0, 0, 0),
          scale: vec3(1, 1, 1)
        }
      },
      {
        data: {
          assetId: "asset:model:source",
          path: "crate.glb"
        },
        id: "node:model",
        kind: "model",
        name: "Crate",
        parentId: "node:cluster",
        transform: {
          position: vec3(0, 0, 0),
          rotation: vec3(0, 0, 0),
          scale: vec3(1, 1, 1)
        }
      },
      {
        data: {
          sourceNodeId: "node:model"
        },
        id: "node:model:instance:1",
        kind: "instancing",
        name: "Crate Instance 1",
        parentId: "node:cluster",
        transform: {
          position: vec3(2, 0, 0),
          rotation: vec3(0, 0, 0),
          scale: vec3(1, 1, 1)
        }
      },
      {
        data: {
          sourceNodeId: "node:model"
        },
        id: "node:model:instance:2",
        kind: "instancing",
        name: "Crate Instance 2",
        parentId: "node:cluster",
        transform: {
          position: vec3(4, 0, 0),
          rotation: vec3(0, 0, 0),
          scale: vec3(1, 1, 1)
        }
      }
    ];

    nodes.forEach((node) => {
      scene.addNode(structuredClone(node));
    });

    const { command, instanceIds } = createInstanceNodesCommand(scene, ["node:cluster"], vec3(8, 0, 0));

    command.execute(scene);

    expect(instanceIds).toHaveLength(1);

    const createdGroup = scene.getNode(instanceIds[0]);

    expect(createdGroup?.kind).toBe("group");
    expect(createdGroup?.transform.position.x).toBe(8);

    const createdChildren = Array.from(scene.nodes.values()).filter((node) => node.parentId === createdGroup?.id);

    expect(createdChildren).toHaveLength(3);
    expect(createdChildren.every((node) => node.kind === "instancing")).toBe(true);
    expect(createdChildren.map((node) => node.transform.position.x).sort((left, right) => left - right)).toEqual([0, 2, 4]);
    expect(
      createdChildren.every(
        (node) => node.kind === "instancing" && node.data.sourceNodeId === "node:model"
      )
    ).toBe(true);
  });
});
