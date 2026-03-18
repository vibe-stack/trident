import {
  createMoverSystemDefinition,
  createOpenableSystemDefinition,
  createPathMoverSystemDefinition,
  createScenePathResolver,
  createSequenceSystemDefinition,
  createTriggerSystemDefinition,
  type GameplayRuntimeHost,
  type GameplayRuntimeSystemRegistration
} from "@web-hammer/gameplay-runtime";
import type { SceneSettings, Transform } from "@web-hammer/shared";
import type { ThreeRuntimeSceneInstance } from "@web-hammer/three-runtime";
import { Euler, Quaternion, type Object3D } from "three";
import type { RuntimePhysicsSession } from "./runtime-physics";

type StarterGameplayHostOptions = {
  runtimePhysics: Pick<RuntimePhysicsSession, "getBody">;
  runtimeScene: Pick<ThreeRuntimeSceneInstance, "nodesById">;
};

type KinematicPhysicsBody = NonNullable<ReturnType<RuntimePhysicsSession["getBody"]>>;

export function createDefaultGameplaySystems(
  sceneSettings: Pick<SceneSettings, "paths">
): GameplayRuntimeSystemRegistration[] {
  return [
    createTriggerSystemDefinition(),
    createSequenceSystemDefinition(),
    createOpenableSystemDefinition(),
    createMoverSystemDefinition(),
    createPathMoverSystemDefinition(createScenePathResolver(sceneSettings.paths ?? []))
  ];
}

export function mergeGameplaySystems(
  baseSystems: GameplayRuntimeSystemRegistration[],
  sceneSystems: GameplayRuntimeSystemRegistration[]
): GameplayRuntimeSystemRegistration[] {
  const merged = new Map<string, GameplayRuntimeSystemRegistration>();

  baseSystems.forEach((system) => {
    merged.set(system.id, system);
  });
  sceneSystems.forEach((system) => {
    merged.set(system.id, system);
  });

  return Array.from(merged.values());
}

export function createStarterGameplayHost(options: StarterGameplayHostOptions): GameplayRuntimeHost {
  return {
    applyNodeWorldTransform(nodeId, transform) {
      const object = options.runtimeScene.nodesById.get(nodeId);
      const body = options.runtimePhysics.getBody(nodeId);

      if (object) {
        applyTransform(object, transform);
      }

      if (body) {
        applyBodyTransform(body, transform);
      }
    }
  };
}

function applyTransform(object: Object3D, transform: Transform) {
  object.position.set(transform.position.x, transform.position.y, transform.position.z);
  object.rotation.set(transform.rotation.x, transform.rotation.y, transform.rotation.z);
  object.scale.set(transform.scale.x, transform.scale.y, transform.scale.z);
  object.updateMatrixWorld(true);
}

function applyBodyTransform(body: KinematicPhysicsBody, transform: Transform) {
  body.setNextKinematicTranslation(transform.position);
  body.setNextKinematicRotation(
    new Quaternion().setFromEuler(new Euler(transform.rotation.x, transform.rotation.y, transform.rotation.z))
  );
}
