import type { SceneSettings } from "@ggez/shared";
import type { Command } from "../command-stack";
import type { SceneDocument } from "../../document/scene-document";

export function createSetSceneSettingsCommand(
  scene: SceneDocument,
  nextSettings: SceneSettings,
  beforeSettings?: SceneSettings
): Command {
  const before = structuredClone(beforeSettings ?? scene.settings);
  const next = structuredClone(nextSettings);

  return {
    label: "set scene settings",
    execute(nextScene) {
      nextScene.setSettings(structuredClone(next));
    },
    undo(nextScene) {
      nextScene.setSettings(structuredClone(before));
    }
  };
}
