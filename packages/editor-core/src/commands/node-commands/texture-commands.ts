import type { Material, TextureRecord } from "@ggez/shared";
import type { Command } from "../command-stack";
import type { SceneDocument } from "../../document/scene-document";

export function createUpsertTextureCommand(
  scene: SceneDocument,
  texture: TextureRecord
): Command {
  const before = scene.textures.get(texture.id);
  const next = structuredClone(texture);

  return {
    label: before ? "update texture" : "create texture",
    execute(nextScene) {
      nextScene.setTexture(structuredClone(next));
    },
    undo(nextScene) {
      if (before) {
        nextScene.setTexture(structuredClone(before));
        return;
      }

      nextScene.removeTexture(texture.id);
    }
  };
}

export function createDeleteTextureCommand(
  scene: SceneDocument,
  textureId: string,
  fallbackColor = "#a8aea7"
): Command {
  const texture = scene.textures.get(textureId);

  if (!texture) {
    return {
      label: "delete texture",
      execute() {},
      undo() {}
    };
  }

  const affectedMaterials = Array.from(scene.materials.values())
    .filter((material) =>
      material.colorTexture === texture.dataUrl ||
      material.normalTexture === texture.dataUrl ||
      material.metalnessTexture === texture.dataUrl ||
      material.roughnessTexture === texture.dataUrl
    )
    .map((material) => ({
      before: structuredClone(material),
      next: removeTextureFromMaterial(material, texture.dataUrl, fallbackColor)
    }));

  return {
    label: "delete texture",
    execute(nextScene) {
      affectedMaterials.forEach(({ next }) => {
        nextScene.setMaterial(structuredClone(next));
      });
      nextScene.removeTexture(textureId);
    },
    undo(nextScene) {
      nextScene.setTexture(structuredClone(texture));
      affectedMaterials.forEach(({ before }) => {
        nextScene.setMaterial(structuredClone(before));
      });
    }
  };
}

function removeTextureFromMaterial(
  material: Material,
  dataUrl: string,
  fallbackColor: string
) {
  const next = structuredClone(material);

  if (next.colorTexture === dataUrl) {
    next.colorTexture = undefined;
    next.color = fallbackColor;
  }

  if (next.normalTexture === dataUrl) {
    next.normalTexture = undefined;
  }

  if (next.metalnessTexture === dataUrl) {
    next.metalnessTexture = undefined;
  }

  if (next.roughnessTexture === dataUrl) {
    next.roughnessTexture = undefined;
  }

  return next;
}
