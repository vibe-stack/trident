import type { EditableMesh, FaceID, Vec3, VertexID } from "@ggez/shared";
import { addVec3, averageVec3, normalizeVec3, scaleVec3, vec3 } from "@ggez/shared";
import { computePolygonNormal } from "../../polygon/polygon-utils";
import { createEditableMeshFromPolygons, findEdgeIndex, getMeshPolygons, makeUndirectedEdgeKey, orientPolygonLoops } from "./shared";
import type { MeshPolygonData, OrientedEditablePolygon } from "./types";

export function extrudeEditableMeshFace(
  mesh: EditableMesh,
  faceId: FaceID,
  amount: number,
  epsilon = 0.0001
): EditableMesh | undefined {
  return extrudeEditableMeshFaces(mesh, [faceId], amount, epsilon);
}

export function extrudeEditableMeshFaces(
  mesh: EditableMesh,
  faceIds: FaceID[],
  amount: number,
  epsilon = 0.0001
): EditableMesh | undefined {
  const uniqueFaceIds = Array.from(new Set(faceIds));

  if (uniqueFaceIds.length === 0) {
    return undefined;
  }

  if (Math.abs(amount) <= epsilon) {
    return structuredClone(mesh);
  }

  const polygons = normalizeExtrudeSourcePolygons(mesh);
  const selectedFaceIds = new Set(uniqueFaceIds);
  const selectedPolygons = polygons.filter((polygon) => selectedFaceIds.has(polygon.id));

  if (selectedPolygons.length !== uniqueFaceIds.length) {
    return undefined;
  }

  const selectedEdgeFaces = new Map<string, FaceID[]>();

  selectedPolygons.forEach((polygon) => {
    polygon.vertexIds.forEach((vertexId, index) => {
      const nextVertexId = polygon.vertexIds[(index + 1) % polygon.vertexIds.length];
      const edgeKey = makeUndirectedEdgeKey(vertexId, nextVertexId);
      const edgeFaces = selectedEdgeFaces.get(edgeKey) ?? [];

      edgeFaces.push(polygon.id);
      selectedEdgeFaces.set(edgeKey, edgeFaces);
    });
  });

  const selectedFaceAdjacency = new Map<FaceID, Set<FaceID>>();

  selectedPolygons.forEach((polygon) => {
    selectedFaceAdjacency.set(polygon.id, new Set());
  });

  selectedEdgeFaces.forEach((edgeFaces) => {
    if (edgeFaces.length !== 2) {
      return;
    }

    selectedFaceAdjacency.get(edgeFaces[0])?.add(edgeFaces[1]);
    selectedFaceAdjacency.get(edgeFaces[1])?.add(edgeFaces[0]);
  });

  const selectedPolygonsById = new Map(selectedPolygons.map((polygon) => [polygon.id, polygon]));
  const components: MeshPolygonData[][] = [];
  const visited = new Set<FaceID>();

  uniqueFaceIds.forEach((faceId) => {
    if (visited.has(faceId)) {
      return;
    }

    const stack = [faceId];
    const component: MeshPolygonData[] = [];

    while (stack.length > 0) {
      const currentFaceId = stack.pop();

      if (!currentFaceId || visited.has(currentFaceId)) {
        continue;
      }

      visited.add(currentFaceId);
      const polygon = selectedPolygonsById.get(currentFaceId);

      if (!polygon) {
        continue;
      }

      component.push(polygon);
      (selectedFaceAdjacency.get(currentFaceId) ?? []).forEach((adjacentFaceId) => {
        if (!visited.has(adjacentFaceId)) {
          stack.push(adjacentFaceId);
        }
      });
    }

    if (component.length > 0) {
      components.push(component);
    }
  });

  const nextPolygons: OrientedEditablePolygon[] = polygons
    .filter((polygon) => !selectedFaceIds.has(polygon.id))
    .map(cloneExtrudePolygon);
  const occupiedVertexIds = new Set(polygons.flatMap((polygon) => polygon.vertexIds));
  const occupiedFaceIds = new Set(polygons.map((polygon) => polygon.id));

  for (const component of components) {
    const extrusionNormal = normalizeVec3(component[0].normal);

    if (
      component.some((polygon) => dotProductMagnitude(extrusionNormal, normalizeVec3(polygon.normal)) < 1 - epsilon * 10)
    ) {
      return undefined;
    }

    const offset = scaleVec3(extrusionNormal, amount);
    const componentEdgeCounts = new Map<string, number>();
    const extrudedVertexIds = new Map<VertexID, VertexID>();

    component.forEach((polygon) => {
      polygon.vertexIds.forEach((vertexId, index) => {
        const nextVertexId = polygon.vertexIds[(index + 1) % polygon.vertexIds.length];
        const edgeKey = makeUndirectedEdgeKey(vertexId, nextVertexId);

        componentEdgeCounts.set(edgeKey, (componentEdgeCounts.get(edgeKey) ?? 0) + 1);

        if (!extrudedVertexIds.has(vertexId)) {
          extrudedVertexIds.set(vertexId, buildUniqueId(`${vertexId}:extrude`, occupiedVertexIds));
        }
      });
    });

    component.forEach((polygon) => {
      const capPositions = polygon.positions.map((position) => addVec3(position, offset));

      nextPolygons.push({
        expectedNormal: polygon.normal,
        id: buildUniqueId(`${polygon.id}:extrude:cap`, occupiedFaceIds),
        materialId: polygon.materialId,
        positions: capPositions,
        uvScale: polygon.uvScale,
        vertexIds: polygon.vertexIds.map((vertexId) => extrudedVertexIds.get(vertexId) ?? vertexId)
      });

      polygon.positions.forEach((position, index) => {
        const nextIndex = (index + 1) % polygon.positions.length;
        const startId = polygon.vertexIds[index];
        const endId = polygon.vertexIds[nextIndex];
        const edgeKey = makeUndirectedEdgeKey(startId, endId);

        if ((componentEdgeCounts.get(edgeKey) ?? 0) !== 1) {
          return;
        }

        const sidePositions = [position, polygon.positions[nextIndex], capPositions[nextIndex], capPositions[index]];

        nextPolygons.push({
          expectedNormal: computePolygonNormal(sidePositions),
          id: buildUniqueId(`${polygon.id}:extrude:side:${index}`, occupiedFaceIds),
          materialId: polygon.materialId,
          positions: sidePositions,
          uvScale: polygon.uvScale,
          vertexIds: [
            startId,
            endId,
            extrudedVertexIds.get(endId) ?? endId,
            extrudedVertexIds.get(startId) ?? startId
          ]
        });
      });
    });
  }

  return createEditableMeshFromPolygons(orientPolygonLoops(nextPolygons));
}

export function extrudeEditableMeshEdge(
  mesh: EditableMesh,
  edge: [VertexID, VertexID],
  amount: number,
  overrideNormal?: Vec3,
  epsilon = 0.0001
): EditableMesh | undefined {
  if (Math.abs(amount) <= epsilon) {
    return structuredClone(mesh);
  }

  const polygons = normalizeExtrudeSourcePolygons(mesh);
  const adjacent = polygons.filter((polygon) => findEdgeIndex(polygon.vertexIds, edge) >= 0);

  if (adjacent.length !== 1) {
    return undefined;
  }

  const [target] = adjacent;
  const edgeIndex = findEdgeIndex(target.vertexIds, edge);

  if (edgeIndex < 0) {
    return undefined;
  }

  const nextIndex = (edgeIndex + 1) % target.vertexIds.length;
  const orientedEdge: [VertexID, VertexID] = [target.vertexIds[edgeIndex], target.vertexIds[nextIndex]];
  const startPosition = target.positions[edgeIndex];
  const endPosition = target.positions[nextIndex];
  const extrusionNormal = normalizeVec3(overrideNormal ?? averageVec3(adjacent.map((polygon) => polygon.normal)));

  if (Math.abs(extrusionNormal.x) <= epsilon && Math.abs(extrusionNormal.y) <= epsilon && Math.abs(extrusionNormal.z) <= epsilon) {
    return undefined;
  }

  const offset = scaleVec3(extrusionNormal, amount);
  const extrudedStart = addVec3(startPosition, offset);
  const extrudedEnd = addVec3(endPosition, offset);
  const edgeKey = makeUndirectedEdgeKey(edge[0], edge[1]);
  const occupiedVertexIds = new Set(polygons.flatMap((polygon) => polygon.vertexIds));
  const occupiedFaceIds = new Set(polygons.map((polygon) => polygon.id));
  const extrudedStartId = buildUniqueId(`extrude:${edgeKey}:start`, occupiedVertexIds);
  const extrudedEndId = buildUniqueId(`extrude:${edgeKey}:end`, occupiedVertexIds);
  const nextPolygons: OrientedEditablePolygon[] = polygons.map((polygon) => ({
    expectedNormal: polygon.normal,
    id: polygon.id,
    materialId: polygon.materialId,
    positions: polygon.positions.map((position) => vec3(position.x, position.y, position.z)),
    uvScale: polygon.uvScale,
    vertexIds: [...polygon.vertexIds]
  }));

  nextPolygons.push({
    expectedNormal: computePolygonNormal([
      vec3(startPosition.x, startPosition.y, startPosition.z),
      vec3(endPosition.x, endPosition.y, endPosition.z),
      vec3(extrudedEnd.x, extrudedEnd.y, extrudedEnd.z),
      vec3(extrudedStart.x, extrudedStart.y, extrudedStart.z)
    ]),
    id: buildUniqueId(`${target.id}:extrude:${edgeKey}`, occupiedFaceIds),
    materialId: target.materialId,
    positions: [
      vec3(startPosition.x, startPosition.y, startPosition.z),
      vec3(endPosition.x, endPosition.y, endPosition.z),
      vec3(extrudedEnd.x, extrudedEnd.y, extrudedEnd.z),
      vec3(extrudedStart.x, extrudedStart.y, extrudedStart.z)
    ],
    uvScale: target.uvScale,
    vertexIds: [orientedEdge[0], orientedEdge[1], extrudedEndId, extrudedStartId]
  });

  return createEditableMeshFromPolygons(orientPolygonLoops(nextPolygons));
}

function normalizeExtrudeSourcePolygons(mesh: EditableMesh) {
  return getMeshPolygons(mesh).map((polygon): MeshPolygonData => ({
    center: averageVec3(polygon.positions),
    id: polygon.id,
    materialId: polygon.materialId,
    normal: polygon.normal,
    positions: polygon.positions.map((position) => vec3(position.x, position.y, position.z)),
    uvScale: polygon.uvScale,
    vertexIds: [...polygon.vertexIds]
  }));
}

function cloneExtrudePolygon(polygon: MeshPolygonData): OrientedEditablePolygon {
  return {
    expectedNormal: polygon.normal,
    id: polygon.id,
    materialId: polygon.materialId,
    positions: polygon.positions.map((position) => vec3(position.x, position.y, position.z)),
    uvScale: polygon.uvScale,
    vertexIds: [...polygon.vertexIds]
  };
}

function dotProductMagnitude(left: Vec3, right: Vec3) {
  return left.x * right.x + left.y * right.y + left.z * right.z;
}

function buildUniqueId(baseId: string, occupiedIds: Set<string>) {
  let nextId = baseId;
  let suffix = 1;

  while (occupiedIds.has(nextId)) {
    nextId = `${baseId}:${suffix}`;
    suffix += 1;
  }

  occupiedIds.add(nextId);
  return nextId;
}
