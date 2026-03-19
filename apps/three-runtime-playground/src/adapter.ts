import { deriveRenderScene, type DerivedRenderScene } from "@ggez/render-pipeline";
import type { Material } from "@ggez/shared";
import type { WebHammerEngineScene } from "@ggez/three-runtime";

export function createPlaybackRenderScene(scene: WebHammerEngineScene): DerivedRenderScene {
  return deriveRenderScene(
    scene.nodes,
    scene.entities,
    scene.materials.map(toSharedMaterial),
    scene.assets
  );
}

function toSharedMaterial(material: WebHammerEngineScene["materials"][number]): Material {
  return {
    color: material.color,
    colorTexture: material.baseColorTexture,
    id: material.id,
    metalness: material.metallicFactor,
    metalnessTexture: material.metallicRoughnessTexture,
    name: material.name,
    normalTexture: material.normalTexture,
    roughness: material.roughnessFactor,
    roughnessTexture: material.metallicRoughnessTexture,
    side: material.side
  };
}
