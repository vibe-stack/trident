import { dotVec3, scaleVec3, subVec3, vec3, type Vec3 } from "@ggez/shared";
import type { BrushEditHandle, MeshEditHandle } from "@/viewport/editing";
import type { ExtrudeGestureState } from "@/viewport/types";

export function resolveSubobjectSelection(currentIds: string[], targetId: string, additive: boolean) {
  if (!additive) {
    return [targetId];
  }

  return currentIds.includes(targetId)
    ? currentIds.filter((id) => id !== targetId)
    : [...currentIds, targetId];
}

export function resolveExtrudeDirection(state: ExtrudeGestureState): Vec3 {
  if (state.handle.kind === "face" || !state.axisLock) {
    return vec3(state.normal.x, state.normal.y, state.normal.z);
  }

  const axisVector =
    state.axisLock === "x"
      ? vec3(1, 0, 0)
      : state.axisLock === "y"
        ? vec3(0, 1, 0)
        : vec3(0, 0, 1);
  const alignment = dotVec3(state.normal, axisVector);
  const direction = alignment >= 0 ? axisVector : scaleVec3(axisVector, -1);

  return vec3(direction.x, direction.y, direction.z);
}

export function axisLockColor(axis: "x" | "y" | "z") {
  if (axis === "x") {
    return "#f87171";
  }

  if (axis === "y") {
    return "#4ade80";
  }

  return "#60a5fa";
}

export function makeUndirectedPairKey(pair: [string, string]) {
  return pair[0] < pair[1] ? `${pair[0]}:${pair[1]}` : `${pair[1]}:${pair[0]}`;
}

export function findMatchingMeshEdgePair(
  meshHandles: MeshEditHandle[],
  brushHandle: BrushEditHandle,
  epsilon = 0.001
) {
  if (!brushHandle.points || brushHandle.points.length !== 2) {
    return undefined;
  }

  return meshHandles
    .filter((handle) => handle.vertexIds.length === 2 && handle.points?.length === 2)
    .find((handle) => segmentsMatch(brushHandle.points!, handle.points!, epsilon))
    ?.vertexIds as [string, string] | undefined;
}

export function findMatchingBrushEdgeHandleId(
  brushHandles: BrushEditHandle[],
  meshHandle: MeshEditHandle,
  epsilon = 0.001
) {
  if (!meshHandle.points || meshHandle.points.length !== 2) {
    return undefined;
  }

  return brushHandles.find((handle) => handle.points?.length === 2 && segmentsMatch(handle.points, meshHandle.points!, epsilon))?.id;
}

export function rejectVec3FromAxis(vector: Vec3, axis: Vec3) {
  return subVec3(vector, {
    x: axis.x * dotVec3(vector, axis),
    y: axis.y * dotVec3(vector, axis),
    z: axis.z * dotVec3(vector, axis)
  });
}

export function vec3LengthSquared(vector: Vec3) {
  return vector.x * vector.x + vector.y * vector.y + vector.z * vector.z;
}

function segmentsMatch(left: Vec3[], right: Vec3[], epsilon: number) {
  return (
    (pointsMatch(left[0], right[0], epsilon) && pointsMatch(left[1], right[1], epsilon)) ||
    (pointsMatch(left[0], right[1], epsilon) && pointsMatch(left[1], right[0], epsilon))
  );
}

function pointsMatch(left: Vec3, right: Vec3, epsilon: number) {
  return (
    Math.abs(left.x - right.x) <= epsilon &&
    Math.abs(left.y - right.y) <= epsilon &&
    Math.abs(left.z - right.z) <= epsilon
  );
}
