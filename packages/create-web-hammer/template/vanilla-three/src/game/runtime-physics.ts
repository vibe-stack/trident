import type RAPIER from "@dimforge/rapier3d-compat";
import { deriveRenderScene, type DerivedRenderScene } from "@ggez/render-pipeline";
import { createDynamicRigidBody, createStaticRigidBody } from "@ggez/runtime-physics-rapier";
import type { Material } from "@ggez/shared";
import type { ThreeRuntimeSceneInstance } from "@ggez/three-runtime";
import { Matrix4, Quaternion, Vector3 } from "three";

export type RuntimePhysicsSession = {
  colliderCount: number;
  dispose: () => void;
  getBody: (nodeId: string) => RAPIER.RigidBody | undefined;
  renderScene: DerivedRenderScene;
  syncVisuals: () => void;
};

export function createRuntimePhysicsSession(options: {
  runtimeScene: ThreeRuntimeSceneInstance;
  world: RAPIER.World;
}): RuntimePhysicsSession {
  const renderScene = deriveRuntimeRenderScene(options.runtimeScene);
  const physicsMeshes = renderScene.meshes.filter((mesh) => mesh.physics?.enabled);
  const physicsMeshIds = new Set(physicsMeshes.map((mesh) => mesh.nodeId));
  const staticMeshes = renderScene.meshes.filter((mesh) => !physicsMeshIds.has(mesh.nodeId));
  const bodiesByNodeId = new Map<string, RAPIER.RigidBody>();
  const dynamicBindings: Array<{
    body: RAPIER.RigidBody;
    object: NonNullable<ReturnType<ThreeRuntimeSceneInstance["nodesById"]["get"]>>;
  }> = [];

  staticMeshes.forEach((mesh) => {
    const body = createStaticRigidBody(options.world, mesh);
    bodiesByNodeId.set(mesh.nodeId, body);
  });

  physicsMeshes.forEach((mesh) => {
    const body = createDynamicRigidBody(options.world, mesh);
    bodiesByNodeId.set(mesh.nodeId, body);
    const object = options.runtimeScene.nodesById.get(mesh.nodeId);

    if (object) {
      dynamicBindings.push({ body, object });
    }
  });

  return {
    colliderCount: staticMeshes.length + physicsMeshes.length,
    dispose() {
      bodiesByNodeId.clear();
      dynamicBindings.length = 0;
    },
    getBody(nodeId) {
      return bodiesByNodeId.get(nodeId);
    },
    renderScene,
    syncVisuals() {
      dynamicBindings.forEach(({ body, object }) => {
        const translation = body.translation();
        const rotation = body.rotation();
        scratchWorldMatrix.compose(
          scratchPosition.set(translation.x, translation.y, translation.z),
          scratchQuaternion.set(rotation.x, rotation.y, rotation.z, rotation.w),
          object.scale
        );

        if (object.parent) {
          object.parent.updateMatrixWorld(true);
          scratchLocalMatrix.copy(object.parent.matrixWorld).invert().multiply(scratchWorldMatrix);
          scratchLocalMatrix.decompose(object.position, object.quaternion, scratchScale);
          object.scale.copy(scratchScale);
          return;
        }

        scratchWorldMatrix.decompose(object.position, object.quaternion, scratchScale);
        object.scale.copy(scratchScale);
      });
    }
  };
}

function deriveRuntimeRenderScene(runtimeScene: ThreeRuntimeSceneInstance): DerivedRenderScene {
  return deriveRenderScene(
    runtimeScene.scene.nodes,
    runtimeScene.scene.entities,
    runtimeScene.scene.materials.map(toSharedMaterial),
    runtimeScene.scene.assets
  );
}

function toSharedMaterial(material: ThreeRuntimeSceneInstance["scene"]["materials"][number]): Material {
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

const scratchLocalMatrix = new Matrix4();
const scratchPosition = new Vector3();
const scratchQuaternion = new Quaternion();
const scratchScale = new Vector3();
const scratchWorldMatrix = new Matrix4();
