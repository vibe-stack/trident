import type { Brush, EditableMesh, FaceID, VertexID } from "@ggez/shared";
import { averageVec3, dotVec3, normalizeVec3, vec3 } from "@ggez/shared";
import { reconstructBrushFaces } from "../../brush/brush-kernel";
import { compactPolygonLoop, getMeshPolygons, makeUndirectedEdgeKey, orderBoundaryEdges, createEditableMeshFromPolygons } from "./shared";
import type { EdgeBevelProfile } from "./types";
import type { EditableMeshPolygon } from "../editable-mesh";

export function convertBrushToEditableMesh(brush: Brush): EditableMesh | undefined {
  const rebuilt = reconstructBrushFaces(brush);

  if (!rebuilt.valid) {
    return undefined;
  }

  return createEditableMeshFromPolygons(
    rebuilt.faces.map((face) => ({
      id: face.id,
      materialId: face.materialId,
      positions: face.vertices.map((vertex) => vec3(vertex.position.x, vertex.position.y, vertex.position.z))
      ,
      uvScale: face.uvScale
    }))
  );
}

export function invertEditableMeshNormals(mesh: EditableMesh, faceIds?: string[]): EditableMesh {
  const selectedFaceIds = faceIds ? new Set(faceIds) : undefined;
  const polygons = getMeshPolygons(mesh).map((polygon) => ({
    id: polygon.id,
    materialId: polygon.materialId,
    positions:
      !selectedFaceIds || selectedFaceIds.has(polygon.id)
        ? polygon.positions.slice().reverse()
        : polygon.positions.map((position) => vec3(position.x, position.y, position.z)),
    uvScale: polygon.uvScale,
    vertexIds:
      !selectedFaceIds || selectedFaceIds.has(polygon.id)
        ? polygon.vertexIds.slice().reverse()
        : [...polygon.vertexIds]
  }));

  return createEditableMeshFromPolygons(polygons);
}

export function deleteEditableMeshFaces(mesh: EditableMesh, faceIds: string[]): EditableMesh | undefined {
  const selectedFaceIds = new Set(faceIds);
  const polygons = getMeshPolygons(mesh)
    .filter((polygon) => !selectedFaceIds.has(polygon.id))
    .map((polygon) => ({
      id: polygon.id,
      materialId: polygon.materialId,
      positions: polygon.positions.map((position) => vec3(position.x, position.y, position.z)),
      uvScale: polygon.uvScale,
      vertexIds: [...polygon.vertexIds]
    }));

  if (polygons.length === 0) {
    return undefined;
  }

  return createEditableMeshFromPolygons(polygons);
}

export function mergeEditableMeshFaces(mesh: EditableMesh, faceIds: string[], epsilon = 0.0001): EditableMesh | undefined {
  if (faceIds.length < 2) {
    return undefined;
  }

  const polygons = getMeshPolygons(mesh);
  const selectedFaceIds = new Set(faceIds);
  const selected = polygons.filter((polygon) => selectedFaceIds.has(polygon.id));

  if (selected.length < 2) {
    return undefined;
  }

  const baseNormal = normalizeVec3(selected[0].normal);

  if (
    selected.some(
      (polygon) => Math.abs(Math.abs(dotVec3(baseNormal, normalizeVec3(polygon.normal))) - 1) > epsilon * 10
    )
  ) {
    return undefined;
  }

  const boundaryEdges = new Map<
    string,
    {
      count: number;
      endId: VertexID;
      endPosition: typeof selected[number]["positions"][number];
      startId: VertexID;
      startPosition: typeof selected[number]["positions"][number];
    }
  >();

  selected.forEach((polygon) => {
    polygon.vertexIds.forEach((vertexId, index) => {
      const nextIndex = (index + 1) % polygon.vertexIds.length;
      const nextId = polygon.vertexIds[nextIndex];
      const key = makeUndirectedEdgeKey(vertexId, nextId);
      const existing = boundaryEdges.get(key);

      if (existing) {
        existing.count += 1;
      } else {
        boundaryEdges.set(key, {
          count: 1,
          endId: nextId,
          endPosition: polygon.positions[nextIndex],
          startId: vertexId,
          startPosition: polygon.positions[index]
        });
      }
    });
  });

  const orderedBoundary = orderBoundaryEdges(Array.from(boundaryEdges.values()).filter((edge) => edge.count === 1));

  if (!orderedBoundary || orderedBoundary.length < 3) {
    return undefined;
  }

  const mergedPolygon: {
    id: FaceID;
    materialId: string | undefined;
    positions: typeof orderedBoundary[number]["startPosition"][];
    uvScale: typeof selected[0]["uvScale"];
    vertexIds: VertexID[];
  } = {
    id: selected[0].id,
    materialId: selected[0].materialId,
    positions: orderedBoundary.map((edge) => edge.startPosition),
    uvScale: selected[0].uvScale,
    vertexIds: orderedBoundary.map((edge) => edge.startId)
  };
  const nextPolygons = polygons
    .filter((polygon) => !selectedFaceIds.has(polygon.id))
    .map((polygon) => ({
      id: polygon.id,
      materialId: polygon.materialId,
      positions: polygon.positions.map((position) => vec3(position.x, position.y, position.z)),
      uvScale: polygon.uvScale,
      vertexIds: [...polygon.vertexIds]
    }));

  nextPolygons.push(mergedPolygon);
  return createEditableMeshFromPolygons(nextPolygons);
}

export function mergeEditableMeshVertices(mesh: EditableMesh, vertexIds: VertexID[]): EditableMesh | undefined {
  const selectedVertexIds = Array.from(new Set(vertexIds));

  if (selectedVertexIds.length < 2) {
    return undefined;
  }

  const verticesById = new Map(mesh.vertices.map((vertex) => [vertex.id, vertex]));
  const selectedVertices = selectedVertexIds
    .map((vertexId) => verticesById.get(vertexId))
    .filter((vertex): vertex is NonNullable<typeof vertex> => Boolean(vertex));

  if (selectedVertices.length < 2) {
    return undefined;
  }

  const mergedPosition = averageVec3(selectedVertices.map((vertex) => vertex.position));
  const mergedVertexId = selectedVertices[0].id;
  const replacements = new Map(
    selectedVertices.map((vertex) => [
      vertex.id,
      {
        id: mergedVertexId,
        position: mergedPosition
      }
    ])
  );

  return rebuildMeshWithMergedVertices(mesh, replacements);
}

export function mergeEditableMeshEdges(
  mesh: EditableMesh,
  edges: Array<[VertexID, VertexID]>
): EditableMesh | undefined {
  if (edges.length === 0) {
    return undefined;
  }

  const verticesById = new Map(mesh.vertices.map((vertex) => [vertex.id, vertex]));
  const adjacency = new Map<VertexID, Set<VertexID>>();

  edges.forEach(([startId, endId]) => {
    if (!verticesById.has(startId) || !verticesById.has(endId)) {
      return;
    }

    const startNeighbors = adjacency.get(startId) ?? new Set<VertexID>();
    const endNeighbors = adjacency.get(endId) ?? new Set<VertexID>();

    startNeighbors.add(endId);
    endNeighbors.add(startId);
    adjacency.set(startId, startNeighbors);
    adjacency.set(endId, endNeighbors);
  });

  if (adjacency.size === 0) {
    return undefined;
  }

  const visited = new Set<VertexID>();
  const replacements = new Map<VertexID, { id: VertexID; position: ReturnType<typeof vec3> }>();

  adjacency.forEach((_, startId) => {
    if (visited.has(startId)) {
      return;
    }

    const stack = [startId];
    const component: VertexID[] = [];

    while (stack.length > 0) {
      const currentId = stack.pop();

      if (!currentId || visited.has(currentId)) {
        continue;
      }

      visited.add(currentId);
      component.push(currentId);

      (adjacency.get(currentId) ?? []).forEach((neighborId) => {
        if (!visited.has(neighborId)) {
          stack.push(neighborId);
        }
      });
    }

    if (component.length < 2) {
      return;
    }

    const mergedPosition = averageVec3(
      component
        .map((vertexId) => verticesById.get(vertexId)?.position)
        .filter((position): position is NonNullable<typeof position> => Boolean(position))
    );
    const mergedVertexId = component[0];

    component.forEach((vertexId) => {
      replacements.set(vertexId, {
        id: mergedVertexId,
        position: mergedPosition
      });
    });
  });

  if (replacements.size === 0) {
    return undefined;
  }

  return rebuildMeshWithMergedVertices(mesh, replacements);
}

function rebuildMeshWithMergedVertices(
  mesh: EditableMesh,
  replacements: Map<VertexID, { id: VertexID; position: ReturnType<typeof vec3> }>
): EditableMesh | undefined {
  const nextPolygons = getMeshPolygons(mesh).flatMap((polygon) => {
    const positions = polygon.positions.map((position, index) => {
      const replacement = replacements.get(polygon.vertexIds[index]);

      return replacement ? replacement.position : vec3(position.x, position.y, position.z);
    });
    const vertexIds = polygon.vertexIds.map((vertexId) => replacements.get(vertexId)?.id ?? vertexId);
    const compacted = compactPolygonLoop(positions, vertexIds);

    if (!compacted || !compacted.vertexIds) {
      return [];
    }

    return [{
      id: polygon.id,
      materialId: polygon.materialId,
      positions: compacted.positions,
      uvScale: polygon.uvScale,
      vertexIds: compacted.vertexIds
    }];
  });

  if (nextPolygons.length === 0) {
    return undefined;
  }

  return createEditableMeshFromPolygons(nextPolygons);
}