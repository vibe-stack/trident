import type { RapierRigidBody } from "@react-three/rapier";
import type { GameplayRuntime } from "@web-hammer/gameplay-runtime";
import type { DerivedRenderScene } from "@web-hammer/render-pipeline";
import type { SceneSettings, Vec3 } from "@web-hammer/shared";
import type { Object3D } from "three";

export type AssetPathResolver = (path: string) => Promise<string> | string;

export type PlaybackPhysicsState = "paused" | "running" | "stopped";

export type PlayerActor = {
  height?: number;
  id: string;
  position: Vec3;
  radius?: number;
  tags: string[];
};

export type PlaybackSceneProps = {
  cameraMode: "fps" | "third-person" | "top-down";
  gameplayRuntime?: GameplayRuntime;
  onNodeObjectChange?: (nodeId: string, object: Object3D | null) => void;
  onNodePhysicsBodyChange?: (nodeId: string, body: RapierRigidBody | null) => void;
  onPlayerActorChange?: (actor: PlayerActor | null) => void;
  physicsPlayback: PlaybackPhysicsState;
  physicsRevision: number;
  renderScene: DerivedRenderScene;
  resolveAssetPath: AssetPathResolver;
  sceneSettings: SceneSettings;
};
