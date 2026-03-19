import type { EditableMesh, Vec3, VertexID } from "@ggez/shared";
import {
  addVec3,
  averageVec3,
  crossVec3,
  dotVec3,
  lengthVec3,
  normalizeVec3,
  scaleVec3,
  subVec3,
  vec3
} from "@ggez/shared";
import {
  createEditableMeshFromPolygons,
  findEdgeIndex,
  getMeshPolygons,
  insertPointsOnPolygonEdge,
  makeUndirectedEdgeKey,
  orientPolygonLoops
} from "./shared";
import type { MeshPolygonData } from "./types";

export function arcEditableMeshEdge(
  mesh: EditableMesh,
  edge: [VertexID, VertexID],
  offset: number,
  segments: number,
  referenceDirection?: Vec3,
  epsilon = 0.0001
): EditableMesh | undefined {
  if (Math.abs(offset) <= epsilon) {
    return structuredClone(mesh);
  }

  const polygons = getMeshPolygons(mesh);
  const touchingPolygons = polygons.filter((polygon) => findEdgeIndex(polygon.vertexIds, edge) >= 0);

  if (touchingPolygons.length === 0) {
    return undefined;
  }

  const insertedPoints = buildArcInsertedPoints(touchingPolygons, edge, offset, segments, referenceDirection, epsilon);

  if (!insertedPoints || insertedPoints.length === 0) {
    return structuredClone(mesh);
  }

  const nextPolygons = polygons.map((polygon) =>
    findEdgeIndex(polygon.vertexIds, edge) >= 0
      ? insertPointsOnPolygonEdge(
          {
            expectedNormal: polygon.normal,
            id: polygon.id,
            materialId: polygon.materialId,
            positions: polygon.positions,
            uvScale: polygon.uvScale,
            vertexIds: polygon.vertexIds
          },
          edge,
          insertedPoints
        )
      : {
          expectedNormal: polygon.normal,
          id: polygon.id,
          materialId: polygon.materialId,
          positions: polygon.positions.map((position) => vec3(position.x, position.y, position.z)),
          uvScale: polygon.uvScale,
          vertexIds: [...polygon.vertexIds]
        }
  );

  return createEditableMeshFromPolygons(orientPolygonLoops(nextPolygons));
}

export function arcEditableMeshEdges(
  mesh: EditableMesh,
  edges: Array<[VertexID, VertexID]>,
  offset: number,
  segments: number,
  referenceDirection?: Vec3,
  epsilon = 0.0001
): EditableMesh | undefined {
  const edgeKeys = Array.from(new Set(edges.map((edge) => makeUndirectedEdgeKey(edge[0], edge[1]))));

  if (edgeKeys.length === 0) {
    return undefined;
  }

  if (Math.abs(offset) <= epsilon) {
    return structuredClone(mesh);
  }

  let currentMesh = structuredClone(mesh);

  for (const edgeKey of edgeKeys) {
    const edge = edges.find((candidate) => makeUndirectedEdgeKey(candidate[0], candidate[1]) === edgeKey);

    if (!edge) {
      continue;
    }

    const nextMesh = arcEditableMeshEdge(currentMesh, edge, offset, segments, referenceDirection, epsilon);

    if (!nextMesh) {
      return undefined;
    }

    currentMesh = nextMesh;
  }

  return currentMesh;
}

function buildArcInsertedPoints(
  polygons: MeshPolygonData[],
  edge: [VertexID, VertexID],
  offset: number,
  segments: number,
  referenceDirection?: Vec3,
  epsilon = 0.0001
) {
  const primaryPolygon = polygons[0];
  const edgeIndex = findEdgeIndex(primaryPolygon.vertexIds, edge);

  if (edgeIndex < 0) {
    return undefined;
  }

  const nextIndex = (edgeIndex + 1) % primaryPolygon.positions.length;
  const start = primaryPolygon.positions[edgeIndex];
  const end = primaryPolygon.positions[nextIndex];
  const axisVector = subVec3(end, start);
  const chordLength = lengthVec3(axisVector);

  if (chordLength <= epsilon) {
    return undefined;
  }

  const axis = scaleVec3(axisVector, 1 / chordLength);
  const midpoint = averageVec3([start, end]);
  const offsetDirection = resolveArcOffsetDirection(axis, referenceDirection, epsilon);

  if (lengthVec3(offsetDirection) <= epsilon) {
    return undefined;
  }

  const segmentCount = Math.max(2, Math.round(segments));
  const edgeKey = makeUndirectedEdgeKey(edge[0], edge[1]);

  return Array.from({ length: segmentCount - 1 }, (_, index) => ({
    id: `arc:${edgeKey}:${index + 1}`,
    position: sampleArcPoint(start, end, midpoint, axis, offsetDirection, offset, (index + 1) / segmentCount)
  }));
}

function resolveArcOffsetDirection(
  axis: Vec3,
  referenceDirection?: Vec3,
  epsilon = 0.0001
) {
  const worldUpDirection = rejectVec3FromAxis(vec3(0, 1, 0), axis);
  const averagedDirection =
    lengthVec3(worldUpDirection) > epsilon
      ? normalizeVec3(worldUpDirection)
      : createPerpendicularDirection(axis, epsilon);

  if (!referenceDirection || lengthVec3(referenceDirection) <= epsilon) {
    return averagedDirection;
  }

  return dotVec3(averagedDirection, referenceDirection) < 0
    ? scaleVec3(averagedDirection, -1)
    : averagedDirection;
}

function sampleArcPoint(
  start: Vec3,
  end: Vec3,
  midpoint: Vec3,
  axis: Vec3,
  direction: Vec3,
  offset: number,
  t: number
) {
  const halfChord = lengthVec3(subVec3(end, start)) * 0.5;
  const centerOffset = (offset * offset - halfChord * halfChord) / (2 * offset);
  const radius = Math.sqrt(halfChord * halfChord + centerOffset * centerOffset);
  const center = addVec3(midpoint, scaleVec3(direction, centerOffset));
  const startAngle = Math.atan2(-centerOffset, -halfChord);
  const endAngle = Math.atan2(-centerOffset, halfChord);
  let sweep = normalizeArcSweep(endAngle - startAngle);
  const midpointSample = addVec3(
    center,
    addVec3(
      scaleVec3(axis, Math.cos(startAngle + sweep * 0.5) * radius),
      scaleVec3(direction, Math.sin(startAngle + sweep * 0.5) * radius)
    )
  );

  if (dotVec3(subVec3(midpointSample, midpoint), direction) * offset < 0) {
    sweep = sweep > 0 ? sweep - Math.PI * 2 : sweep + Math.PI * 2;
  }

  const angle = startAngle + sweep * t;

  return addVec3(
    center,
    addVec3(scaleVec3(axis, Math.cos(angle) * radius), scaleVec3(direction, Math.sin(angle) * radius))
  );
}

function normalizeArcSweep(angle: number) {
  let normalized = angle;

  while (normalized <= -Math.PI) {
    normalized += Math.PI * 2;
  }

  while (normalized > Math.PI) {
    normalized -= Math.PI * 2;
  }

  return normalized;
}

function rejectVec3FromAxis(vector: Vec3, axis: Vec3) {
  return subVec3(vector, scaleVec3(axis, dotVec3(vector, axis)));
}

function createPerpendicularDirection(axis: Vec3, epsilon = 0.0001) {
  const primaryReference = Math.abs(axis.y) < 0.99 ? vec3(0, 1, 0) : vec3(1, 0, 0);
  const primaryDirection = crossVec3(axis, primaryReference);

  if (lengthVec3(primaryDirection) > epsilon) {
    return normalizeVec3(primaryDirection);
  }

  return normalizeVec3(crossVec3(axis, vec3(0, 0, 1)));
}