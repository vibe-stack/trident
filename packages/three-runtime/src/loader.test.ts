import { describe, expect, test } from "bun:test";
import { loadWebHammerEngineScene } from "./loader";
import type { WebHammerEngineScene } from "./types";
import { makeTransform, vec3 } from "@web-hammer/shared";
import { Vector3 } from "three";

describe("loadWebHammerEngineScene", () => {
  test("rebuilds grouped runtime hierarchies and resolves entity world transforms", async () => {
    const scene: WebHammerEngineScene = {
      assets: [],
      entities: [
        {
          id: "entity:spawn",
          name: "Spawn",
          parentId: "node:group",
          properties: {},
          transform: makeTransform(vec3(0, 0, 3)),
          type: "player-spawn"
        }
      ],
      layers: [],
      materials: [],
      metadata: {
        exportedAt: new Date("2026-03-12T10:00:00.000Z").toISOString(),
        format: "web-hammer-engine",
        version: 4
      },
      nodes: [
        {
          data: {},
          hooks: [
            {
              config: {
                tags: ["train"]
              },
              id: "hook:tags:test",
              type: "tags"
            }
          ],
          id: "node:group",
          kind: "group",
          name: "Group",
          transform: {
            position: vec3(5, 0, 1),
            rotation: vec3(0, Math.PI / 2, 0),
            scale: vec3(2, 2, 2)
          }
        },
        {
          data: {
            castShadow: false,
            color: "#ffffff",
            enabled: true,
            intensity: 2,
            type: "point"
          },
          id: "node:light",
          kind: "light",
          name: "Light",
          parentId: "node:group",
          transform: makeTransform(vec3(1, 0, 0))
        }
      ],
      settings: {
        player: {
          cameraMode: "fps",
          canCrouch: true,
          canJump: true,
          canRun: true,
          crouchHeight: 1.2,
          height: 1.8,
          jumpHeight: 1,
          movementSpeed: 4,
          runningSpeed: 6
        },
        world: {
          ambientColor: "#ffffff",
          ambientIntensity: 0,
          fogColor: "#000000",
          fogFar: 50,
          fogNear: 10,
          gravity: vec3(0, -9.81, 0),
          physicsEnabled: true
        }
      }
    };

    const loaded = await loadWebHammerEngineScene(scene);
    const groupObject = loaded.nodes.get("node:group");
    const lightObject = loaded.nodes.get("node:light");
    const worldPosition = lightObject?.getWorldPosition(new Vector3());

    expect(groupObject).toBeDefined();
    expect(lightObject?.parent).toBe(groupObject);
    expect(groupObject?.userData.webHammer.hooks?.[0]?.type).toBe("tags");
    expect(worldPosition?.x).toBeCloseTo(5, 5);
    expect(worldPosition?.z).toBeCloseTo(-1, 5);
    expect(loaded.entities[0]?.transform.position.x).toBeCloseTo(11, 5);
    expect(loaded.entities[0]?.transform.position.z).toBeCloseTo(1, 5);
  });
});
