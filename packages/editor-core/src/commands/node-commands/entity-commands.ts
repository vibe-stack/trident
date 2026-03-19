import type { Entity } from "@ggez/shared";
import type { Command } from "../command-stack";
import type { SceneDocument } from "../../document/scene-document";

export function createSetEntityCommand(
  scene: SceneDocument,
  entityId: string,
  nextEntity: Entity,
  beforeEntity?: Entity
): Command {
  const entity = scene.getEntity(entityId);

  if (!entity) {
    return {
      label: "set entity",
      execute() {},
      undo() {}
    };
  }

  const before = structuredClone(beforeEntity ?? entity);
  const next = structuredClone(nextEntity);

  return {
    label: "set entity",
    execute(nextScene) {
      nextScene.addEntity(structuredClone(next));
    },
    undo(nextScene) {
      nextScene.addEntity(structuredClone(before));
    }
  };
}
