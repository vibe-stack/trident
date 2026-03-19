import { vec3 } from "@ggez/shared";

export const gridSnapValues = [1, 2, 4, 8, 16, 32, 64, 128] as const;

export type GridSnapValue = number;

export type ViewportProjection = "perspective" | "orthographic";

export type PerspectiveCameraState = {
  position: ReturnType<typeof vec3>;
  target: ReturnType<typeof vec3>;
  fov: number;
  near: number;
  far: number;
  minDistance: number;
  maxDistance: number;
};

export type OrthographicCameraState = {
  position: ReturnType<typeof vec3>;
  target: ReturnType<typeof vec3>;
  up: ReturnType<typeof vec3>;
  zoom: number;
  near: number;
  far: number;
  minZoom: number;
  maxZoom: number;
};

export type EditorCameraState = PerspectiveCameraState | OrthographicCameraState;

export type ConstructionGridState = {
  visible: boolean;
  size: number;
  minorDivisions: number;
  majorLineEvery: number;
  elevation: number;
  enabled: boolean;
  snapSize: GridSnapValue;
};

export type PerspectiveViewportState = {
  projection: "perspective";
  camera: PerspectiveCameraState;
  grid: ConstructionGridState;
};

export type OrthographicViewportState = {
  projection: "orthographic";
  camera: OrthographicCameraState;
  grid: ConstructionGridState;
};

export type ViewportState = PerspectiveViewportState | OrthographicViewportState;

function createGridState(snapSize: GridSnapValue): ConstructionGridState {
  return {
    visible: true,
    size: 256,
    minorDivisions: 64,
    majorLineEvery: 8,
    elevation: 0,
    enabled: true,
    snapSize
  };
}

export function createViewportState(snapSize: GridSnapValue = 2): PerspectiveViewportState {
  return {
    projection: "perspective",
    camera: {
      position: vec3(18, 14, 18),
      target: vec3(0, 1.5, 0),
      fov: 50,
      near: 0.1,
      far: 500,
      minDistance: 3,
      maxDistance: 180
    },
    grid: createGridState(snapSize)
  };
}

export function createOrthographicViewportState(
  camera: Pick<OrthographicCameraState, "position" | "target" | "up" | "zoom">,
  snapSize: GridSnapValue = 2
): OrthographicViewportState {
  return {
    projection: "orthographic",
    camera: {
      far: 500,
      maxZoom: 48,
      minZoom: 3,
      near: 0.1,
      position: camera.position,
      target: camera.target,
      up: camera.up,
      zoom: camera.zoom
    },
    grid: createGridState(snapSize)
  };
}
