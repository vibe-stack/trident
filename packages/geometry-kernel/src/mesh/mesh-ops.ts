import type { Brush, EditableMesh, FaceID, Vec3, VertexID } from "@web-hammer/shared";
import {
  addVec3,
  averageVec3,
  crossVec3,
  dotVec3,
  lengthVec3,
  normalizeVec3,
  snapValue,
  scaleVec3,
  subVec3,
  vec3
} from "@web-hammer/shared";
import { reconstructBrushFaces } from "../brush/brush-kernel";
import { computePolygonNormal } from "../polygon/polygon-utils";
import {
  createEditableMeshFromPolygons,
  getFaceVertexIds,
  getFaceVertices,
  type EditableMeshPolygon
} from "./editable-mesh";

type MeshPolygonData = {
  center: Vec3;
  id: FaceID;
  normal: Vec3;
  positions: Vec3[];
  vertexIds: VertexID[];
};

type BevelCorner = {
  id: VertexID;
  position: Vec3;
};

type BevelFaceData = {
  corners: BevelCorner[];
  polygon: MeshPolygonData;
};

type BevelProfilePoint = {
  id: VertexID;
  position: Vec3;
};

type BevelVertexProfile = {
  edgeDirection: Vec3;
  faceIds: [FaceID, FaceID];
  points: BevelProfilePoint[];
  vertexId: VertexID;
};

export type EdgeBevelProfile = "flat" | "round";

type OrientedEditablePolygon = {
  id: FaceID;
  positions: Vec3[];
  expectedNormal?: Vec3;
  vertexIds?: VertexID[];
};

type FacePlanePoint = {
  u: number;
  v: number;
};

type ResolvedFaceCut = {
  end: Vec3;
  firstEdge: [VertexID, VertexID];
  firstEdgeIndex: number;
  firstPoint: Vec3;
  secondEdge: [VertexID, VertexID];
  secondEdgeIndex: number;
  secondPoint: Vec3;
  start: Vec3;
  target: MeshPolygonData;
};

export function convertBrushToEditableMesh(brush: Brush): EditableMesh | undefined {
  const rebuilt = reconstructBrushFaces(brush);

  if (!rebuilt.valid) {
    return undefined;
  }

  return createEditableMeshFromPolygons(
    rebuilt.faces.map((face) => ({
      id: face.id,
      positions: face.vertices.map((vertex) => vec3(vertex.position.x, vertex.position.y, vertex.position.z))
    }))
  );
}

export function invertEditableMeshNormals(mesh: EditableMesh, faceIds?: string[]): EditableMesh {
  const selectedFaceIds = faceIds ? new Set(faceIds) : undefined;
  const polygons = getMeshPolygons(mesh).map((polygon) => ({
    id: polygon.id,
    positions:
      !selectedFaceIds || selectedFaceIds.has(polygon.id)
        ? polygon.positions.slice().reverse()
        : polygon.positions.map((position) => vec3(position.x, position.y, position.z))
  }));

  return createEditableMeshFromPolygons(polygons);
}

export function deleteEditableMeshFaces(mesh: EditableMesh, faceIds: string[]): EditableMesh | undefined {
  const selectedFaceIds = new Set(faceIds);
  const polygons = getMeshPolygons(mesh)
    .filter((polygon) => !selectedFaceIds.has(polygon.id))
    .map((polygon) => ({
      id: polygon.id,
      positions: polygon.positions.map((position) => vec3(position.x, position.y, position.z))
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
      (polygon) =>
        Math.abs(Math.abs(dotVec3(baseNormal, normalizeVec3(polygon.normal))) - 1) > epsilon * 10
    )
  ) {
    return undefined;
  }

  const boundaryEdges = new Map<
    string,
    {
      count: number;
      endId: VertexID;
      endPosition: Vec3;
      startId: VertexID;
      startPosition: Vec3;
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

  const orderedBoundary = orderBoundaryEdges(
    Array.from(boundaryEdges.values()).filter((edge) => edge.count === 1)
  );

  if (!orderedBoundary || orderedBoundary.length < 3) {
    return undefined;
  }

  const mergedPolygon: EditableMeshPolygon & { id: FaceID } = {
    id: selected[0].id,
    positions: orderedBoundary.map((edge) => edge.startPosition)
  };
  const nextPolygons = polygons
    .filter((polygon) => !selectedFaceIds.has(polygon.id))
    .map((polygon) => ({
      id: polygon.id,
      positions: polygon.positions.map((position) => vec3(position.x, position.y, position.z))
    }));

  nextPolygons.push(mergedPolygon);
  return createEditableMeshFromPolygons(nextPolygons);
}

export function fillEditableMeshFaceFromVertices(
  mesh: EditableMesh,
  vertexIds: VertexID[],
  epsilon = 0.0001
): EditableMesh | undefined {
  if (vertexIds.length < 3) {
    return undefined;
  }

  const selectedVertexIds = new Set(vertexIds);
  const boundaryEdges = collectFillBoundaryEdges(mesh).filter(
    (edge) => selectedVertexIds.has(edge.startId) && selectedVertexIds.has(edge.endId)
  );

  if (boundaryEdges.length < 3) {
    return undefined;
  }

  const boundaryVertexIds = new Set(boundaryEdges.flatMap((edge) => [edge.startId, edge.endId]));

  if (
    boundaryVertexIds.size !== selectedVertexIds.size ||
    Array.from(selectedVertexIds).some((vertexId) => !boundaryVertexIds.has(vertexId))
  ) {
    return undefined;
  }

  return fillEditableMeshFaceFromBoundaryEdges(mesh, boundaryEdges, epsilon);
}

export function fillEditableMeshFaceFromEdges(
  mesh: EditableMesh,
  edges: Array<[VertexID, VertexID]>,
  epsilon = 0.0001
): EditableMesh | undefined {
  if (edges.length < 3) {
    return undefined;
  }

  const selectedEdgeKeys = new Set(edges.map((edge) => makeUndirectedEdgeKey(edge[0], edge[1])));
  const boundaryEdges = collectFillBoundaryEdges(mesh).filter((edge) => selectedEdgeKeys.has(edge.key));

  if (boundaryEdges.length !== selectedEdgeKeys.size || boundaryEdges.length < 3) {
    return undefined;
  }

  return fillEditableMeshFaceFromBoundaryEdges(mesh, boundaryEdges, epsilon);
}

export function cutEditableMeshBetweenEdges(
  mesh: EditableMesh,
  edges: Array<[VertexID, VertexID]>
): EditableMesh | undefined {
  if (edges.length !== 2) {
    return undefined;
  }

  const polygons = getMeshPolygons(mesh);
  const target = polygons.find((polygon) => edges.every((edge) => findEdgeIndex(polygon.vertexIds, edge) >= 0));

  if (!target) {
    return undefined;
  }

  const firstIndex = findEdgeIndex(target.vertexIds, edges[0]);
  const secondIndex = findEdgeIndex(target.vertexIds, edges[1]);

  if (firstIndex < 0 || secondIndex < 0 || areAdjacentEdgeIndices(target.vertexIds.length, firstIndex, secondIndex)) {
    return undefined;
  }

  const firstMidpoint = midpoint(target.positions[firstIndex], target.positions[(firstIndex + 1) % target.positions.length]);
  const secondMidpoint = midpoint(target.positions[secondIndex], target.positions[(secondIndex + 1) % target.positions.length]);

  const expanded = expandPolygonWithInsertedMidpoints(target, [
    { edgeIndex: firstIndex, id: "__cut_a__", position: firstMidpoint },
    { edgeIndex: secondIndex, id: "__cut_b__", position: secondMidpoint }
  ]);
  const cutAIndex = expanded.vertexIds.indexOf("__cut_a__");
  const cutBIndex = expanded.vertexIds.indexOf("__cut_b__");

  if (cutAIndex < 0 || cutBIndex < 0) {
    return undefined;
  }

  const firstPolygon = ringSlice(expanded.positions, cutAIndex, cutBIndex);
  const secondPolygon = ringSlice(expanded.positions, cutBIndex, cutAIndex);

  if (firstPolygon.length < 3 || secondPolygon.length < 3) {
    return undefined;
  }

  const nextPolygons = polygons
    .filter((polygon) => polygon.id !== target.id)
    .map((polygon) => {
      const containsFirstEdge = findEdgeIndex(polygon.vertexIds, edges[0]) >= 0;
      const containsSecondEdge = findEdgeIndex(polygon.vertexIds, edges[1]) >= 0;
      const firstPassPolygon = containsFirstEdge ? getMeshPolygonWithInsertedPoint(polygon, edges[0], firstMidpoint) : polygon;
      const secondPassPolygon = containsSecondEdge
        ? getMeshPolygonWithInsertedPoint(firstPassPolygon, edges[1], secondMidpoint)
        : firstPassPolygon;

      return {
        id: secondPassPolygon.id,
        positions: secondPassPolygon.positions.map((position) => vec3(position.x, position.y, position.z))
      };
    });

  nextPolygons.push(
    { id: `${target.id}:cut:1`, positions: firstPolygon },
    { id: `${target.id}:cut:2`, positions: secondPolygon }
  );

  return createEditableMeshFromPolygons(nextPolygons);
}

export function buildEditableMeshFaceCutPreview(
  mesh: EditableMesh,
  faceId: FaceID,
  point: Vec3,
  snapSize: number,
  epsilon = 0.0001
): { end: Vec3; start: Vec3 } | undefined {
  const resolvedCut = resolveEditableMeshFaceCut(mesh, faceId, point, snapSize, epsilon);

  if (!resolvedCut) {
    return undefined;
  }

  return {
    end: resolvedCut.end,
    start: resolvedCut.start
  };
}

export function cutEditableMeshFace(
  mesh: EditableMesh,
  faceId: FaceID,
  point: Vec3,
  snapSize: number,
  epsilon = 0.0001
): EditableMesh | undefined {
  const resolvedCut = resolveEditableMeshFaceCut(mesh, faceId, point, snapSize, epsilon);

  if (!resolvedCut) {
    return undefined;
  }

  const expanded = expandPolygonWithInsertedMidpoints(resolvedCut.target, [
    {
      edgeIndex: resolvedCut.firstEdgeIndex,
      id: "__cut_a__",
      position: resolvedCut.firstPoint
    },
    {
      edgeIndex: resolvedCut.secondEdgeIndex,
      id: "__cut_b__",
      position: resolvedCut.secondPoint
    }
  ]);
  const cutAIndex = expanded.vertexIds.indexOf("__cut_a__");
  const cutBIndex = expanded.vertexIds.indexOf("__cut_b__");

  if (cutAIndex < 0 || cutBIndex < 0) {
    return undefined;
  }

  const firstPolygon = ringSlice(expanded.positions, cutAIndex, cutBIndex);
  const secondPolygon = ringSlice(expanded.positions, cutBIndex, cutAIndex);

  if (firstPolygon.length < 3 || secondPolygon.length < 3) {
    return undefined;
  }

  const nextPolygons: OrientedEditablePolygon[] = getMeshPolygons(mesh)
    .filter((polygon) => polygon.id !== resolvedCut.target.id)
    .map((polygon) => {
      const containsFirstEdge = findEdgeIndex(polygon.vertexIds, resolvedCut.firstEdge) >= 0;
      const containsSecondEdge = findEdgeIndex(polygon.vertexIds, resolvedCut.secondEdge) >= 0;
      const firstPassPolygon = containsFirstEdge
        ? getMeshPolygonWithInsertedPoint(polygon, resolvedCut.firstEdge, resolvedCut.firstPoint)
        : polygon;
      const secondPassPolygon = containsSecondEdge
        ? getMeshPolygonWithInsertedPoint(firstPassPolygon, resolvedCut.secondEdge, resolvedCut.secondPoint)
        : firstPassPolygon;

      return {
        expectedNormal: polygon.normal,
        id: secondPassPolygon.id,
        positions: secondPassPolygon.positions.map((position) => vec3(position.x, position.y, position.z))
      };
    });

  nextPolygons.push(
    {
      expectedNormal: resolvedCut.target.normal,
      id: `${resolvedCut.target.id}:cut:1`,
      positions: firstPolygon
    },
    {
      expectedNormal: resolvedCut.target.normal,
      id: `${resolvedCut.target.id}:cut:2`,
      positions: secondPolygon
    }
  );

  return createEditableMeshFromPolygons(orientPolygonLoops(nextPolygons));
}

export function subdivideEditableMeshFace(
  mesh: EditableMesh,
  faceId: FaceID,
  cuts: number
): EditableMesh | undefined {
  const targetCuts = Math.max(1, Math.round(cuts));
  const target = getMeshPolygons(mesh).find((polygon) => polygon.id === faceId);

  if (!target || target.positions.length < 3) {
    return undefined;
  }

  const nextPolygons: Array<OrientedEditablePolygon & { vertexIds: VertexID[] }> = getMeshPolygons(mesh)
    .filter((polygon) => polygon.id !== faceId)
    .map((polygon) => ({
      expectedNormal: polygon.normal,
      id: polygon.id,
      positions: polygon.positions.map((position) => vec3(position.x, position.y, position.z)),
      vertexIds: [...polygon.vertexIds]
    }));

  const boundarySamples = createSubdivisionBoundarySamples(target, targetCuts + 1);
  const stitchedPolygons = stitchBoundarySubdivisionIntoNeighbors(nextPolygons, target, boundarySamples);
  const subdividedPolygons =
    target.positions.length === 4
      ? buildQuadSubdivisionPolygons(target, boundarySamples, targetCuts + 1)
      : buildRadialSubdivisionPolygons(target, boundarySamples, targetCuts + 1);

  if (subdividedPolygons.length === 0) {
    return undefined;
  }

  return createEditableMeshFromPolygons(orientPolygonLoops([...stitchedPolygons, ...subdividedPolygons]));
}

export function bevelEditableMeshEdge(
  mesh: EditableMesh,
  edge: [VertexID, VertexID],
  width: number,
  steps: number,
  profile: EdgeBevelProfile = "flat",
  epsilon = 0.0001
): EditableMesh | undefined {
  if (Math.abs(width) <= epsilon) {
    return structuredClone(mesh);
  }

  const polygons = getMeshPolygons(mesh);
  const adjacent = polygons.filter((polygon) => findEdgeIndex(polygon.vertexIds, edge) >= 0);

  if (adjacent.length !== 2) {
    return undefined;
  }

  const [firstFace, secondFace] = adjacent;
  const firstEdgeIndex = findEdgeIndex(firstFace.vertexIds, edge);
  const secondEdgeIndex = findEdgeIndex(secondFace.vertexIds, edge);

  if (firstEdgeIndex < 0 || secondEdgeIndex < 0) {
    return undefined;
  }

  const orientedEdgeStartId = firstFace.vertexIds[firstEdgeIndex];
  const orientedEdgeEndId = firstFace.vertexIds[(firstEdgeIndex + 1) % firstFace.vertexIds.length];
  const firstFaceOrientedEdge: [VertexID, VertexID] = [
    orientedEdgeStartId,
    orientedEdgeEndId
  ];
  const secondFaceOrientedEdge: [VertexID, VertexID] = [
    secondFace.vertexIds[secondEdgeIndex],
    secondFace.vertexIds[(secondEdgeIndex + 1) % secondFace.vertexIds.length]
  ];
  const firstVertex = firstFace.positions[firstEdgeIndex];
  const secondVertex = firstFace.positions[(firstEdgeIndex + 1) % firstFace.positions.length];
  const axis = normalizeVec3(subVec3(secondVertex, firstVertex));
  const edgeCenter = averageVec3([firstVertex, secondVertex]);
  const firstInsetDirection = computeInsetDirection(firstFace, edgeCenter, axis);
  const secondInsetDirection = computeInsetDirection(secondFace, edgeCenter, axis);

  if (!firstInsetDirection || !secondInsetDirection) {
    return undefined;
  }

  const stepCount = Math.max(1, Math.round(steps));
  const signedWidth = width;
  const angle = Math.atan2(
    dotVec3(axis, crossVec3(firstInsetDirection, secondInsetDirection)),
    dotVec3(firstInsetDirection, secondInsetDirection)
  );
  const firstOffset = scaleVec3(firstInsetDirection, signedWidth);
  const secondOffset = scaleVec3(secondInsetDirection, signedWidth);
  const railCount = stepCount + 1;
  const rails =
    profile === "round" && Math.abs(angle) > epsilon
      ? Array.from({ length: railCount }, (_, index) => {
          const t = railCount === 1 ? 0 : index / (railCount - 1);
          const direction = rotateAroundAxis(firstInsetDirection, axis, angle * t);
          const offset = scaleVec3(direction, signedWidth);

          return [
            addVec3(firstVertex, offset),
            addVec3(secondVertex, offset)
          ] as const;
        })
      : Array.from({ length: railCount }, (_, index) => {
          const t = railCount === 1 ? 0 : index / (railCount - 1);
          const offset = lerpVec3(firstOffset, secondOffset, t);

          return [
            addVec3(firstVertex, offset),
            addVec3(secondVertex, offset)
          ] as const;
        });

  const nextPolygons = polygons
    .filter((polygon) => polygon.id !== firstFace.id && polygon.id !== secondFace.id)
    .map((polygon) => ({
      expectedNormal: polygon.normal,
      id: polygon.id,
      positions: polygon.positions.map((position) => vec3(position.x, position.y, position.z)),
      vertexIds: [...polygon.vertexIds]
    }));

  const firstReplacement = replacePolygonEdge(firstFace, firstFaceOrientedEdge, rails[0][0], rails[0][1]);
  const secondFaceMatchesFirstOrientation =
    secondFaceOrientedEdge[0] === firstFaceOrientedEdge[0] &&
    secondFaceOrientedEdge[1] === firstFaceOrientedEdge[1];
  const secondReplacement = replacePolygonEdge(
    secondFace,
    secondFaceOrientedEdge,
    secondFaceMatchesFirstOrientation ? rails[rails.length - 1][0] : rails[rails.length - 1][1],
    secondFaceMatchesFirstOrientation ? rails[rails.length - 1][1] : rails[rails.length - 1][0]
  );

  if (!firstReplacement || !secondReplacement) {
    return undefined;
  }

  const firstEndpointFaces = nextPolygons.map((polygon) =>
    polygon.vertexIds.includes(orientedEdgeStartId)
      ? replacePolygonVertexWithBevelPoints(
          polygon,
          orientedEdgeStartId,
          firstFace,
          secondFace,
          rails[0][0],
          rails[rails.length - 1][0]
        )
      : polygon
  );
  const nextEndpointFaces = firstEndpointFaces.map((polygon) =>
    polygon.vertexIds.includes(orientedEdgeEndId)
      ? replacePolygonVertexWithBevelPoints(
          polygon,
          orientedEdgeEndId,
          firstFace,
          secondFace,
          rails[0][1],
          rails[rails.length - 1][1]
        )
      : polygon
  );

  const beveledPolygons: OrientedEditablePolygon[] = [
    ...nextEndpointFaces.map((polygon) => ({
      expectedNormal: polygon.expectedNormal,
      id: polygon.id,
      positions: polygon.positions
    })),
    {
      expectedNormal: firstFace.normal,
      id: firstReplacement.id,
      positions: firstReplacement.positions
    },
    {
      expectedNormal: secondFace.normal,
      id: secondReplacement.id,
      positions: secondReplacement.positions
    }
  ];

  for (let index = 0; index < rails.length - 1; index += 1) {
    const stripPositions = [rails[index][0], rails[index][1], rails[index + 1][1], rails[index + 1][0]];

    beveledPolygons.push({
      expectedNormal: computePolygonNormal(stripPositions),
      id: `${firstFace.id}:bevel:${index}`,
      positions: stripPositions
    });
  }

  return createEditableMeshFromPolygons(orientPolygonLoops(beveledPolygons));
}

export function bevelEditableMeshEdges(
  mesh: EditableMesh,
  edges: Array<[VertexID, VertexID]>,
  width: number,
  steps: number,
  profile: EdgeBevelProfile = "flat",
  epsilon = 0.0001
): EditableMesh | undefined {
  const edgeKeys = Array.from(new Set(edges.map((edge) => makeUndirectedEdgeKey(edge[0], edge[1]))));

  if (edgeKeys.length === 0) {
    return undefined;
  }

  if (Math.abs(width) <= epsilon) {
    return structuredClone(mesh);
  }

  if (edgeKeys.length === 1) {
    return bevelEditableMeshEdge(mesh, edges[0], width, steps, profile, epsilon);
  }

  const polygons = getMeshPolygons(mesh);
  const edgeData = edgeKeys.map((edgeKey) => {
    const adjacentFaces = polygons.filter((polygon) =>
      polygon.vertexIds.some((vertexId, index) => {
        const nextVertexId = polygon.vertexIds[(index + 1) % polygon.vertexIds.length];
        return makeUndirectedEdgeKey(vertexId, nextVertexId) === edgeKey;
      })
    );

    if (adjacentFaces.length !== 2) {
      return undefined;
    }

    const firstFace = adjacentFaces[0];
    const secondFace = adjacentFaces[1];
    const firstEdgeIndex = firstFace.vertexIds.findIndex((vertexId, index) => {
      const nextVertexId = firstFace.vertexIds[(index + 1) % firstFace.vertexIds.length];
      return makeUndirectedEdgeKey(vertexId, nextVertexId) === edgeKey;
    });
    const secondEdgeIndex = secondFace.vertexIds.findIndex((vertexId, index) => {
      const nextVertexId = secondFace.vertexIds[(index + 1) % secondFace.vertexIds.length];
      return makeUndirectedEdgeKey(vertexId, nextVertexId) === edgeKey;
    });

    if (firstEdgeIndex < 0 || secondEdgeIndex < 0) {
      return undefined;
    }

    const orientedEdge: [VertexID, VertexID] = [
      firstFace.vertexIds[firstEdgeIndex],
      firstFace.vertexIds[(firstEdgeIndex + 1) % firstFace.vertexIds.length]
    ];

    return {
      edge: orientedEdge,
      edgeKey,
      firstEdgeIndex,
      firstFace,
      secondEdgeIndex,
      secondFace
    };
  });

  if (edgeData.some((entry) => !entry)) {
    return undefined;
  }

  const selectedEdgeKeys = new Set(edgeKeys);
  const touchedVertexIds = new Set(edgeData.flatMap((entry) => (entry ? entry.edge : [])));
  const faceDataById = new Map(
    polygons.map((polygon) => {
      const corners = polygon.vertexIds.map((vertexId, index) => {
        const prevEdgeIndex = (index - 1 + polygon.vertexIds.length) % polygon.vertexIds.length;
        const nextEdgeIndex = index;
        const prevSelected = selectedEdgeKeys.has(
          makeUndirectedEdgeKey(polygon.vertexIds[prevEdgeIndex], polygon.vertexIds[index])
        );
        const nextSelected = selectedEdgeKeys.has(
          makeUndirectedEdgeKey(polygon.vertexIds[index], polygon.vertexIds[(index + 1) % polygon.vertexIds.length])
        );

        if (!prevSelected && !nextSelected) {
          return {
            id: vertexId,
            position: vec3(
              polygon.positions[index].x,
              polygon.positions[index].y,
              polygon.positions[index].z
            )
          };
        }

        const prevRail =
          prevSelected
            ? createOffsetRailForFaceEdge(polygon, prevEdgeIndex, width)
            : undefined;
        const nextRail =
          nextSelected
            ? createOffsetRailForFaceEdge(polygon, nextEdgeIndex, width)
            : undefined;

        if ((prevSelected && !prevRail) || (nextSelected && !nextRail)) {
          return undefined;
        }

        if (prevRail && nextRail) {
          return {
            id: `${polygon.id}:bevel:corner:${vertexId}`,
            position: intersectBevelRailsOnFace(
              polygon,
              prevRail.start,
              prevRail.end,
              nextRail.start,
              nextRail.end
            )
          };
        }

        if (nextRail) {
          const previousIndex = (index - 1 + polygon.positions.length) % polygon.positions.length;

          return {
            id: makeBevelBoundaryCornerId(vertexId, polygon.vertexIds[previousIndex]),
            position: intersectBevelRailsOnFace(
              polygon,
              polygon.positions[previousIndex],
              polygon.positions[index],
              nextRail.start,
              nextRail.end
            )
          };
        }

        const nextVertexId = polygon.vertexIds[(index + 1) % polygon.vertexIds.length];

        return {
          id: makeBevelBoundaryCornerId(vertexId, nextVertexId),
          position: intersectBevelRailsOnFace(
            polygon,
            prevRail!.start,
            prevRail!.end,
            polygon.positions[index],
            polygon.positions[(index + 1) % polygon.positions.length]
          )
        };
      });

      return [
        polygon.id,
        corners.some((corner) => !corner)
          ? undefined
          : {
              corners: corners as BevelCorner[],
              polygon
            }
      ] as const;
    })
  );

  if (Array.from(faceDataById.values()).some((faceData) => !faceData)) {
    return undefined;
  }

  const nextPolygons = Array.from(faceDataById.values()).reduce<Array<OrientedEditablePolygon & { vertexIds?: VertexID[] }>>((collection, faceData) => {
    if (!faceData) {
      return collection;
    }

    const polygon = createOrientedPolygon(
      faceData.polygon.id,
      faceData.corners.map((corner) => corner.position),
      faceData.polygon.normal,
      faceData.corners.map((corner) => corner.id)
    );

    if (polygon) {
      collection.push(polygon);
    }

    return collection;
  }, []);

  if (nextPolygons.length !== polygons.length) {
    return undefined;
  }

  const nextPolygonById = new Map(nextPolygons.map((polygon) => [polygon.id, polygon] as const));
  const vertexProfiles = new Map<VertexID, BevelVertexProfile[]>();

  edgeData.forEach((entry, edgeIndex) => {
    if (!entry) {
      return;
    }

    const firstFaceData = faceDataById.get(entry.firstFace.id);
    const secondFaceData = faceDataById.get(entry.secondFace.id);

    if (!firstFaceData || !secondFaceData) {
      return;
    }

    const rails = buildBevelRailsForSelectedEdge(
      entry.firstFace,
      entry.firstEdgeIndex,
      firstFaceData,
      entry.secondFace,
      entry.secondEdgeIndex,
      secondFaceData,
      steps,
      profile,
      epsilon
    );

    rails.forEach((rail, railIndex) => {
      if (railIndex === rails.length - 1) {
        return;
      }

      const nextRail = rails[railIndex + 1];
      const polygon = createOrientedPolygon(
        `${entry.edgeKey}:bevel:${edgeIndex}:${railIndex}`,
        [rail.start, rail.end, nextRail.end, nextRail.start],
        normalizeVec3(averageVec3([entry.firstFace.normal, entry.secondFace.normal])),
        [rail.startId, rail.endId, nextRail.endId, nextRail.startId]
      );

      if (polygon) {
        nextPolygons.push(polygon);
      }
    });

    registerBevelVertexProfile(vertexProfiles, {
      edgeDirection: normalizeVec3(
        subVec3(
          entry.firstFace.positions[(entry.firstEdgeIndex + 1) % entry.firstFace.positions.length],
          entry.firstFace.positions[entry.firstEdgeIndex]
        )
      ),
      faceIds: [entry.firstFace.id, entry.secondFace.id],
      points: rails.map((rail) => ({
        id: rail.startId,
        position: vec3(rail.start.x, rail.start.y, rail.start.z)
      })),
      vertexId: entry.edge[0]
    });
    registerBevelVertexProfile(vertexProfiles, {
      edgeDirection: normalizeVec3(
        subVec3(
          entry.firstFace.positions[entry.firstEdgeIndex],
          entry.firstFace.positions[(entry.firstEdgeIndex + 1) % entry.firstFace.positions.length]
        )
      ),
      faceIds: [entry.firstFace.id, entry.secondFace.id],
      points: rails.map((rail) => ({
        id: rail.endId,
        position: vec3(rail.end.x, rail.end.y, rail.end.z)
      })),
      vertexId: entry.edge[1]
    });
  });

  touchedVertexIds.forEach((vertexId) => {
    const profiles = vertexProfiles.get(vertexId) ?? [];

    if (profiles.length === 0) {
      return;
    }

    const incidentFaces = collectOrderedIncidentFacesAtVertex(vertexId, polygons);

    if (profiles.length === 1) {
      applyEndpointBevelHostClipping(vertexId, incidentFaces, profiles[0], nextPolygons, nextPolygonById);
      return;
    }

    if (profiles.length === 2 && weldCollinearBevelProfiles(vertexId, profiles, nextPolygons, nextPolygonById)) {
      return;
    }

    createBevelVertexTransitionPolygons(vertexId, incidentFaces, profiles).forEach((polygon) => {
      nextPolygons.push(polygon);
    });
  });

  return createEditableMeshFromPolygons(orientPolygonLoops(nextPolygons));
}

export function extrudeEditableMeshFace(
  mesh: EditableMesh,
  faceId: FaceID,
  amount: number,
  epsilon = 0.0001
): EditableMesh | undefined {
  if (amount <= epsilon) {
    return structuredClone(mesh);
  }

  const polygons = getMeshPolygons(mesh);
  const target = polygons.find((polygon) => polygon.id === faceId);

  if (!target) {
    return undefined;
  }

  const offset = scaleVec3(normalizeVec3(target.normal), amount);
  const capPositions = target.positions.map((position) => addVec3(position, offset));
  const extrudedPolygons: OrientedEditablePolygon[] = polygons
    .filter((polygon) => polygon.id !== target.id)
    .map((polygon) => ({
      expectedNormal: polygon.normal,
      id: polygon.id,
      positions: polygon.positions.map((position) => vec3(position.x, position.y, position.z))
    }));

  extrudedPolygons.push({
    expectedNormal: target.normal,
    id: `${target.id}:extrude:cap`,
    positions: capPositions
  });

  target.positions.forEach((position, index) => {
    const nextIndex = (index + 1) % target.positions.length;
    const sidePositions = [position, target.positions[nextIndex], capPositions[nextIndex], capPositions[index]];

    extrudedPolygons.push({
      expectedNormal: computePolygonNormal(sidePositions),
      id: `${target.id}:extrude:side:${index}`,
      positions: sidePositions
    });
  });

  return createEditableMeshFromPolygons(orientPolygonLoops(extrudedPolygons));
}

export function extrudeEditableMeshEdge(
  mesh: EditableMesh,
  edge: [VertexID, VertexID],
  amount: number,
  overrideNormal?: Vec3,
  epsilon = 0.0001
): EditableMesh | undefined {
  if (amount <= epsilon) {
    return structuredClone(mesh);
  }

  const polygons = getMeshPolygons(mesh);
  const adjacent = polygons.filter((polygon) => findEdgeIndex(polygon.vertexIds, edge) >= 0);

  if (adjacent.length === 0 || adjacent.length > 2) {
    return undefined;
  }

  const [target] = adjacent;
  const edgeIndex = findEdgeIndex(target.vertexIds, edge);

  if (edgeIndex < 0) {
    return undefined;
  }

  const nextIndex = (edgeIndex + 1) % target.vertexIds.length;
  const orientedEdge: [VertexID, VertexID] = [
    target.vertexIds[edgeIndex],
    target.vertexIds[nextIndex]
  ];
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
  const extrudedStartId = `extrude:${edgeKey}:start`;
  const extrudedEndId = `extrude:${edgeKey}:end`;
  const nextPolygons: OrientedEditablePolygon[] = polygons
    .map((polygon) => ({
      expectedNormal: polygon.normal,
      id: polygon.id,
      positions: polygon.positions.map((position) => vec3(position.x, position.y, position.z)),
      vertexIds: [...polygon.vertexIds]
    }));

  if (adjacent.length === 2) {
    adjacent.forEach((polygon, polygonIndex) => {
      const polygonEdgeIndex = findEdgeIndex(polygon.vertexIds, orientedEdge);

      if (polygonEdgeIndex < 0) {
        return;
      }

      const polygonNextIndex = (polygonEdgeIndex + 1) % polygon.vertexIds.length;
      const localStartId = polygon.vertexIds[polygonEdgeIndex];
      const localEndId = polygon.vertexIds[polygonNextIndex];
      const localStartExtruded = localStartId === orientedEdge[0] ? extrudedStart : extrudedEnd;
      const localEndExtruded = localEndId === orientedEdge[1] ? extrudedEnd : extrudedStart;
      const localStartExtrudedId = localStartId === orientedEdge[0] ? extrudedStartId : extrudedEndId;
      const localEndExtrudedId = localEndId === orientedEdge[1] ? extrudedEndId : extrudedStartId;

      nextPolygons.push(
        {
          expectedNormal: computePolygonNormal([
            polygon.positions[polygonEdgeIndex],
            polygon.positions[polygonNextIndex],
            localEndExtruded,
            localStartExtruded
          ]),
          id: `${polygon.id}:extrude:side:${polygonIndex}`,
          positions: [
            polygon.positions[polygonEdgeIndex],
            polygon.positions[polygonNextIndex],
            localEndExtruded,
            localStartExtruded
          ],
          vertexIds: [
            `${polygon.id}:extrude:${edgeKey}:start`,
            `${polygon.id}:extrude:${edgeKey}:end`,
            localEndExtrudedId,
            localStartExtrudedId
          ]
        }
      );
    });

    return createEditableMeshFromPolygons(orientPolygonLoops(nextPolygons));
  }

  nextPolygons.push({
    expectedNormal: computePolygonNormal([
      vec3(startPosition.x, startPosition.y, startPosition.z),
      vec3(endPosition.x, endPosition.y, endPosition.z),
      vec3(extrudedEnd.x, extrudedEnd.y, extrudedEnd.z),
      vec3(extrudedStart.x, extrudedStart.y, extrudedStart.z)
    ]),
    id: `${target.id}:extrude:${edgeKey}`,
    positions: [
      vec3(startPosition.x, startPosition.y, startPosition.z),
      vec3(endPosition.x, endPosition.y, endPosition.z),
      vec3(extrudedEnd.x, extrudedEnd.y, extrudedEnd.z),
      vec3(extrudedStart.x, extrudedStart.y, extrudedStart.z)
    ],
    vertexIds: [
      orientedEdge[0],
      orientedEdge[1],
      extrudedEndId,
      extrudedStartId
    ]
  });

  return createEditableMeshFromPolygons(orientPolygonLoops(nextPolygons));
}

export function inflateEditableMesh(mesh: EditableMesh, factor: number): EditableMesh {
  if (Math.abs(factor) <= 0.000001) {
    return structuredClone(mesh);
  }

  const polygons = getMeshPolygons(mesh);
  const normalsByVertexId = new Map<VertexID, Vec3[]>();

  polygons.forEach((polygon) => {
    polygon.vertexIds.forEach((vertexId) => {
      const normals = normalsByVertexId.get(vertexId) ?? [];
      normals.push(polygon.normal);
      normalsByVertexId.set(vertexId, normals);
    });
  });

  return {
    ...structuredClone(mesh),
    vertices: mesh.vertices.map((vertex) => {
      const averagedNormal = normalizeVec3(averageVec3(normalsByVertexId.get(vertex.id) ?? []));

      return {
        ...structuredClone(vertex),
        position: addVec3(vertex.position, scaleVec3(averagedNormal, factor))
      };
    })
  };
}

export function offsetEditableMeshTop(mesh: EditableMesh, amount: number, epsilon = 0.0001): EditableMesh {
  if (Math.abs(amount) <= epsilon) {
    return structuredClone(mesh);
  }

  const maxY = mesh.vertices.reduce((currentMax, vertex) => Math.max(currentMax, vertex.position.y), Number.NEGATIVE_INFINITY);

  return {
    ...structuredClone(mesh),
    vertices: mesh.vertices.map((vertex) => ({
      ...structuredClone(vertex),
      position:
        Math.abs(vertex.position.y - maxY) <= epsilon
          ? vec3(vertex.position.x, vertex.position.y + amount, vertex.position.z)
          : vec3(vertex.position.x, vertex.position.y, vertex.position.z)
    }))
  };
}

function getMeshPolygons(mesh: EditableMesh): MeshPolygonData[] {
  return mesh.faces
    .map((face) => {
      const positions = getFaceVertices(mesh, face.id).map((vertex) => vec3(vertex.position.x, vertex.position.y, vertex.position.z));
      const vertexIds = getFaceVertexIds(mesh, face.id);

      if (positions.length < 3 || vertexIds.length < 3) {
        return undefined;
      }

      return {
        center: averageVec3(positions),
        id: face.id,
        normal: computePolygonNormal(positions),
        positions,
        vertexIds
      };
    })
    .filter((polygon): polygon is MeshPolygonData => Boolean(polygon));
}

function fillEditableMeshFaceFromBoundaryEdges(
  mesh: EditableMesh,
  boundaryEdges: Array<{
    endId: VertexID;
    endPosition: Vec3;
    key: string;
    startId: VertexID;
    startPosition: Vec3;
  }>,
  epsilon: number
) {
  const orderedBoundary = orderBoundaryEdges(boundaryEdges);

  if (!orderedBoundary || orderedBoundary.length < 3) {
    return undefined;
  }

  const orderedPositions = orderedBoundary.map((edge) => edge.startPosition);
  const fillNormal = computePolygonNormal(orderedPositions);

  if (lengthVec3(fillNormal) <= epsilon) {
    return undefined;
  }

  const nextPolygons: OrientedEditablePolygon[] = getMeshPolygons(mesh).map((polygon) => ({
    expectedNormal: polygon.normal,
    id: polygon.id,
    positions: polygon.positions.map((position) => vec3(position.x, position.y, position.z)),
    vertexIds: [...polygon.vertexIds]
  }));
  const faceId = `face:fill:${orderedBoundary.map((edge) => edge.key).join("|")}`;

  nextPolygons.push({
    expectedNormal: fillNormal,
    id: faceId,
    positions: orderedPositions.map((position) => vec3(position.x, position.y, position.z)),
    vertexIds: orderedBoundary.map((edge) => edge.startId)
  });

  return createEditableMeshFromPolygons(orientPolygonLoops(nextPolygons));
}

function collectFillBoundaryEdges(mesh: EditableMesh) {
  const polygons = getMeshPolygons(mesh);
  const edgeCounts = polygons.reduce<Map<string, number>>((counts, polygon) => {
    polygon.vertexIds.forEach((vertexId, index) => {
      const nextVertexId = polygon.vertexIds[(index + 1) % polygon.vertexIds.length];
      const key = makeUndirectedEdgeKey(vertexId, nextVertexId);

      counts.set(key, (counts.get(key) ?? 0) + 1);
    });

    return counts;
  }, new Map());

  return polygons.flatMap((polygon) =>
    polygon.vertexIds.flatMap((vertexId, index) => {
      const nextIndex = (index + 1) % polygon.vertexIds.length;
      const nextVertexId = polygon.vertexIds[nextIndex];
      const key = makeUndirectedEdgeKey(vertexId, nextVertexId);

      if ((edgeCounts.get(key) ?? 0) !== 1) {
        return [];
      }

      return [
        {
          endId: vertexId,
          endPosition: polygon.positions[index],
          key,
          startId: nextVertexId,
          startPosition: polygon.positions[nextIndex]
        }
      ];
    })
  );
}

function orderBoundaryEdges(
  edges: Array<{
    endId: VertexID;
    endPosition: Vec3;
    key?: string;
    startId: VertexID;
    startPosition: Vec3;
  }>
) {
  if (edges.length === 0) {
    return undefined;
  }

  const edgesByStart = new Map(edges.map((edge) => [edge.startId, edge]));
  const ordered = [edges[0]];

  while (ordered.length < edges.length) {
    const current = ordered[ordered.length - 1];
    const next = edgesByStart.get(current.endId);

    if (!next || ordered.includes(next)) {
      return undefined;
    }

    ordered.push(next);
  }

  return ordered[ordered.length - 1].endId === ordered[0].startId ? ordered : undefined;
}

function makeUndirectedEdgeKey(left: VertexID, right: VertexID) {
  return left < right ? `${left}|${right}` : `${right}|${left}`;
}

function findEdgeIndex(vertexIds: VertexID[], edge: [VertexID, VertexID]) {
  return vertexIds.findIndex((vertexId, index) => {
    const nextId = vertexIds[(index + 1) % vertexIds.length];
    return makeUndirectedEdgeKey(vertexId, nextId) === makeUndirectedEdgeKey(edge[0], edge[1]);
  });
}

function areAdjacentEdgeIndices(length: number, left: number, right: number) {
  return Math.abs(left - right) === 1 || Math.abs(left - right) === length - 1;
}

function midpoint(left: Vec3, right: Vec3) {
  return vec3((left.x + right.x) * 0.5, (left.y + right.y) * 0.5, (left.z + right.z) * 0.5);
}

function makeBevelBoundaryCornerId(vertexId: VertexID, neighborId: VertexID) {
  return `${makeUndirectedEdgeKey(vertexId, neighborId)}:bevel:corner:${vertexId}`;
}

function createSubdivisionBoundarySamples(polygon: MeshPolygonData, segments: number) {
  return polygon.vertexIds.map((vertexId, edgeIndex) => {
    const nextIndex = (edgeIndex + 1) % polygon.vertexIds.length;
    const edge: [VertexID, VertexID] = [vertexId, polygon.vertexIds[nextIndex]];
    const points = Array.from({ length: Math.max(0, segments - 1) }, (_, sampleIndex) => {
      const step = sampleIndex + 1;
      const t = step / segments;

      return {
        id: `${polygon.id}:subdiv:edge:${edgeIndex}:${step}`,
        position: lerpVec3(polygon.positions[edgeIndex], polygon.positions[nextIndex], t)
      };
    });

    return {
      edge,
      edgeIndex,
      points
    };
  });
}

function stitchBoundarySubdivisionIntoNeighbors(
  polygons: Array<OrientedEditablePolygon & { vertexIds: VertexID[] }>,
  _target: MeshPolygonData,
  boundarySamples: Array<{
    edge: [VertexID, VertexID];
    edgeIndex: number;
    points: Array<{ id: VertexID; position: Vec3 }>;
  }>
) {
  return boundarySamples.reduce(
    (currentPolygons, boundary) =>
      currentPolygons.map((polygon) => insertPointsOnPolygonEdge(polygon, boundary.edge, boundary.points)),
    polygons
  );
}

function buildQuadSubdivisionPolygons(
  target: MeshPolygonData,
  boundarySamples: Array<{
    edge: [VertexID, VertexID];
    edgeIndex: number;
    points: Array<{ id: VertexID; position: Vec3 }>;
  }>,
  segments: number
) {
  const [corner0, corner1, corner2, corner3] = target.positions;
  const gridPointAt = (column: number, row: number) => {
    const u = column / segments;
    const v = row / segments;
    const bottom = lerpVec3(corner0, corner1, u);
    const top = lerpVec3(corner3, corner2, u);

    return lerpVec3(bottom, top, v);
  };
  const gridVertexIdAt = (column: number, row: number): VertexID => {
    if (row === 0) {
      if (column === 0) {
        return target.vertexIds[0];
      }

      if (column === segments) {
        return target.vertexIds[1];
      }

      return boundarySamples[0].points[column - 1].id;
    }

    if (column === segments) {
      if (row === segments) {
        return target.vertexIds[2];
      }

      return boundarySamples[1].points[row - 1].id;
    }

    if (row === segments) {
      if (column === 0) {
        return target.vertexIds[3];
      }

      return boundarySamples[2].points[segments - column - 1].id;
    }

    if (column === 0) {
      return boundarySamples[3].points[segments - row - 1].id;
    }

    return `${target.id}:subdiv:inner:${column}:${row}`;
  };
  const polygons: OrientedEditablePolygon[] = [];

  for (let row = 0; row < segments; row += 1) {
    for (let column = 0; column < segments; column += 1) {
      polygons.push({
        expectedNormal: target.normal,
        id: `${target.id}:subdiv:${column}:${row}`,
        positions: [
          gridPointAt(column, row),
          gridPointAt(column + 1, row),
          gridPointAt(column + 1, row + 1),
          gridPointAt(column, row + 1)
        ],
        vertexIds: [
          gridVertexIdAt(column, row),
          gridVertexIdAt(column + 1, row),
          gridVertexIdAt(column + 1, row + 1),
          gridVertexIdAt(column, row + 1)
        ]
      });
    }
  }

  return polygons;
}

function buildRadialSubdivisionPolygons(
  target: MeshPolygonData,
  boundarySamples: Array<{
    edge: [VertexID, VertexID];
    edgeIndex: number;
    points: Array<{ id: VertexID; position: Vec3 }>;
  }>,
  segments: number
) {
  const boundaryLoop = buildSubdivisionBoundaryLoop(target, boundarySamples);
  const rings = Array.from({ length: segments }, (_, ringIndex) => {
    if (ringIndex === 0) {
      return {
        points: boundaryLoop.map((sample) => sample.position),
        vertexIds: boundaryLoop.map((sample) => sample.id)
      };
    }

    const t = 1 - ringIndex / segments;

    return {
      points: boundaryLoop.map((sample) => lerpVec3(target.center, sample.position, t)),
      vertexIds: boundaryLoop.map((_, pointIndex) => `${target.id}:subdiv:ring:${ringIndex}:${pointIndex}`)
    };
  });
  const polygons: OrientedEditablePolygon[] = [];

  for (let ringIndex = 0; ringIndex < rings.length - 1; ringIndex += 1) {
    const outerRing = rings[ringIndex];
    const innerRing = rings[ringIndex + 1];

    for (let pointIndex = 0; pointIndex < outerRing.points.length; pointIndex += 1) {
      const nextPointIndex = (pointIndex + 1) % outerRing.points.length;

      polygons.push({
        expectedNormal: target.normal,
        id: `${target.id}:subdiv:ring:${ringIndex}:cell:${pointIndex}`,
        positions: [
          outerRing.points[pointIndex],
          outerRing.points[nextPointIndex],
          innerRing.points[nextPointIndex],
          innerRing.points[pointIndex]
        ],
        vertexIds: [
          outerRing.vertexIds[pointIndex],
          outerRing.vertexIds[nextPointIndex],
          innerRing.vertexIds[nextPointIndex],
          innerRing.vertexIds[pointIndex]
        ]
      });
    }
  }

  const innerRing = rings[rings.length - 1];

  polygons.push({
    expectedNormal: target.normal,
    id: `${target.id}:subdiv:center`,
    positions: innerRing.points,
    vertexIds: innerRing.vertexIds
  });

  return polygons;
}

function buildSubdivisionBoundaryLoop(
  target: MeshPolygonData,
  boundarySamples: Array<{
    edge: [VertexID, VertexID];
    edgeIndex: number;
    points: Array<{ id: VertexID; position: Vec3 }>;
  }>
) {
  return target.vertexIds.flatMap((vertexId, edgeIndex) => {
    const vertex = {
      id: vertexId,
      position: target.positions[edgeIndex]
    };

    return [vertex, ...boundarySamples[edgeIndex].points];
  });
}

function resolveEditableMeshFaceCut(
  mesh: EditableMesh,
  faceId: FaceID,
  point: Vec3,
  snapSize: number,
  epsilon: number
): ResolvedFaceCut | undefined {
  const target = getMeshPolygons(mesh).find((polygon) => polygon.id === faceId);

  if (!target || target.positions.length < 3) {
    return undefined;
  }

  const basis = createFacePlaneBasis(target.normal);
  const projectedPoint = projectFacePoint(point, target.center, basis);
  const axis = Math.abs(projectedPoint.u) >= Math.abs(projectedPoint.v) ? "u" : "v";
  const otherAxis = axis === "u" ? "v" : "u";
  const coordinate = snapValue(projectedPoint[axis], snapSize);
  const projectedPositions = target.positions.map((position) => projectFacePoint(position, target.center, basis));
  const bounds = projectedPositions.reduce(
    (current, candidate) => ({
      max: Math.max(current.max, candidate[axis]),
      min: Math.min(current.min, candidate[axis])
    }),
    {
      max: Number.NEGATIVE_INFINITY,
      min: Number.POSITIVE_INFINITY
    }
  );

  if (coordinate <= bounds.min + epsilon || coordinate >= bounds.max - epsilon) {
    return undefined;
  }

  const intersections = projectedPositions
    .map((position, edgeIndex) => {
      const nextIndex = (edgeIndex + 1) % projectedPositions.length;
      const next = projectedPositions[nextIndex];
      const delta = next[axis] - position[axis];

      if (Math.abs(delta) <= epsilon) {
        return undefined;
      }

      const t = (coordinate - position[axis]) / delta;

      if (t <= epsilon || t >= 1 - epsilon) {
        return undefined;
      }

      if (coordinate < Math.min(position[axis], next[axis]) - epsilon || coordinate > Math.max(position[axis], next[axis]) + epsilon) {
        return undefined;
      }

      return {
        edge: [target.vertexIds[edgeIndex], target.vertexIds[nextIndex]] as [VertexID, VertexID],
        edgeIndex,
        point: lerpVec3(target.positions[edgeIndex], target.positions[nextIndex], t),
        projected: {
          [axis]: coordinate,
          [otherAxis]: position[otherAxis] + (next[otherAxis] - position[otherAxis]) * t
        } as FacePlanePoint
      };
    })
    .filter(
      (
        intersection
      ): intersection is {
        edge: [VertexID, VertexID];
        edgeIndex: number;
        point: Vec3;
        projected: FacePlanePoint;
      } => Boolean(intersection)
    )
    .filter(
      (intersection, index, collection) =>
        collection.findIndex(
          (candidate) =>
            candidate.edgeIndex === intersection.edgeIndex ||
            (
              Math.abs(candidate.point.x - intersection.point.x) <= epsilon &&
              Math.abs(candidate.point.y - intersection.point.y) <= epsilon &&
              Math.abs(candidate.point.z - intersection.point.z) <= epsilon
            )
        ) === index
    )
    .sort((left, right) => left.projected[otherAxis] - right.projected[otherAxis]);

  if (intersections.length !== 2) {
    return undefined;
  }

  const [firstIntersection, secondIntersection] = intersections;

  return {
    end: secondIntersection.point,
    firstEdge: firstIntersection.edge,
    firstEdgeIndex: firstIntersection.edgeIndex,
    firstPoint: firstIntersection.point,
    secondEdge: secondIntersection.edge,
    secondEdgeIndex: secondIntersection.edgeIndex,
    secondPoint: secondIntersection.point,
    start: firstIntersection.point,
    target
  };
}

function createFacePlaneBasis(normal: Vec3) {
  const normalizedNormal = normalizeVec3(normal);
  const reference = Math.abs(normalizedNormal.y) < 0.99 ? vec3(0, 1, 0) : vec3(1, 0, 0);
  const u = normalizeVec3(crossVec3(reference, normalizedNormal));
  const v = normalizeVec3(crossVec3(normalizedNormal, u));

  return { u, v };
}

function projectFacePoint(point: Vec3, origin: Vec3, basis: { u: Vec3; v: Vec3 }): FacePlanePoint {
  const offset = subVec3(point, origin);

  return {
    u: dotVec3(offset, basis.u),
    v: dotVec3(offset, basis.v)
  };
}

function expandPolygonWithInsertedMidpoints(
  polygon: MeshPolygonData,
  inserted: Array<{ edgeIndex: number; id: string; position: Vec3 }>
) {
  const orderedInserted = inserted.slice().sort((left, right) => left.edgeIndex - right.edgeIndex);
  const vertexIds: VertexID[] = [];
  const positions: Vec3[] = [];

  polygon.vertexIds.forEach((vertexId, index) => {
    vertexIds.push(vertexId);
    positions.push(polygon.positions[index]);

    orderedInserted
      .filter((item) => item.edgeIndex === index)
      .forEach((item) => {
        vertexIds.push(item.id);
        positions.push(item.position);
      });
  });

  return { positions, vertexIds };
}

function ringSlice(points: Vec3[], startIndex: number, endIndex: number) {
  const loop: Vec3[] = [];
  let index = startIndex;

  while (true) {
    loop.push(points[index]);

    if (index === endIndex) {
      break;
    }

    index = (index + 1) % points.length;
  }

  return loop;
}

function computeInsetDirection(face: MeshPolygonData, edgeCenter: Vec3, axis: Vec3) {
  const perpendicular = normalizeVec3(crossVec3(face.normal, axis));
  const projectedCenter = projectOntoPlane(subVec3(face.center, edgeCenter), axis);

  if (lengthVec3(perpendicular) <= 0.000001) {
    return perpendicular;
  }

  return dotVec3(perpendicular, projectedCenter) >= 0
    ? perpendicular
    : scaleVec3(perpendicular, -1);
}

function projectOntoPlane(vector: Vec3, normal: Vec3) {
  return subVec3(vector, scaleVec3(normal, dotVec3(vector, normal)));
}

function createOffsetRailForFaceEdge(
  face: MeshPolygonData,
  edgeIndex: number,
  width: number
) {
  const nextIndex = (edgeIndex + 1) % face.positions.length;
  const start = face.positions[edgeIndex];
  const end = face.positions[nextIndex];
  const axis = normalizeVec3(subVec3(end, start));
  const insetDirection = computeInsetDirection(face, averageVec3([start, end]), axis);

  if (lengthVec3(insetDirection) <= 0.000001) {
    return undefined;
  }

  const offset = scaleVec3(insetDirection, width);

  return {
    end: addVec3(end, offset),
    start: addVec3(start, offset)
  };
}

function intersectBevelRailsOnFace(
  face: MeshPolygonData,
  firstStart: Vec3,
  firstEnd: Vec3,
  secondStart: Vec3,
  secondEnd: Vec3
) {
  const basis = createFacePlaneBasis(face.normal);
  const firstStart2D = projectFacePoint(firstStart, face.center, basis);
  const firstEnd2D = projectFacePoint(firstEnd, face.center, basis);
  const secondStart2D = projectFacePoint(secondStart, face.center, basis);
  const secondEnd2D = projectFacePoint(secondEnd, face.center, basis);
  const denominator =
    (firstStart2D.u - firstEnd2D.u) * (secondStart2D.v - secondEnd2D.v) -
    (firstStart2D.v - firstEnd2D.v) * (secondStart2D.u - secondEnd2D.u);

  if (Math.abs(denominator) <= 0.000001) {
    return midpoint(firstEnd, secondStart);
  }

  const determinantFirst = firstStart2D.u * firstEnd2D.v - firstStart2D.v * firstEnd2D.u;
  const determinantSecond = secondStart2D.u * secondEnd2D.v - secondStart2D.v * secondEnd2D.u;
  const u =
    (determinantFirst * (secondStart2D.u - secondEnd2D.u) -
      (firstStart2D.u - firstEnd2D.u) * determinantSecond) /
    denominator;
  const v =
    (determinantFirst * (secondStart2D.v - secondEnd2D.v) -
      (firstStart2D.v - firstEnd2D.v) * determinantSecond) /
    denominator;

  return addVec3(
    addVec3(face.center, scaleVec3(basis.u, u)),
    scaleVec3(basis.v, v)
  );
}

function createOrientedPolygon(
  id: FaceID,
  positions: Vec3[],
  expectedNormal?: Vec3,
  vertexIds?: VertexID[]
) {
  const compacted = compactPolygonLoop(positions, vertexIds);

  if (!compacted || compacted.positions.length < 3) {
    return undefined;
  }

  return {
    expectedNormal,
    id,
    positions: compacted.positions,
    vertexIds: compacted.vertexIds
  };
}

function compactPolygonLoop(positions: Vec3[], vertexIds?: VertexID[]) {
  const compactedPositions: Vec3[] = [];
  const compactedVertexIds: VertexID[] = [];

  positions.forEach((position, index) => {
    const previous = compactedPositions[compactedPositions.length - 1];

    if (
      previous &&
      lengthVec3(subVec3(position, previous)) <= 0.000001
    ) {
      return;
    }

    compactedPositions.push(vec3(position.x, position.y, position.z));

    if (vertexIds) {
      compactedVertexIds.push(vertexIds[index]);
    }
  });

  if (
    compactedPositions.length > 1 &&
    lengthVec3(subVec3(compactedPositions[0], compactedPositions[compactedPositions.length - 1])) <= 0.000001
  ) {
    compactedPositions.pop();
    compactedVertexIds.pop();
  }

  return compactedPositions.length >= 3
    ? {
        positions: compactedPositions,
        vertexIds: vertexIds ? compactedVertexIds : undefined
      }
    : undefined;
}

function buildBevelRailsForSelectedEdge(
  firstFace: MeshPolygonData,
  firstEdgeIndex: number,
  firstFaceData: BevelFaceData,
  secondFace: MeshPolygonData,
  secondEdgeIndex: number,
  secondFaceData: BevelFaceData,
  steps: number,
  profile: EdgeBevelProfile,
  epsilon: number
) {
  const stepCount = Math.max(1, Math.round(steps));
  const railCount = stepCount + 1;
  const startVertexId = firstFace.vertexIds[firstEdgeIndex];
  const endVertexId = firstFace.vertexIds[(firstEdgeIndex + 1) % firstFace.vertexIds.length];
  const firstRail = {
    end: firstFaceData.corners[(firstEdgeIndex + 1) % firstFaceData.corners.length],
    start: firstFaceData.corners[firstEdgeIndex]
  };
  const secondEdgeStartId = secondFace.vertexIds[secondEdgeIndex];
  const secondEdgeEndId = secondFace.vertexIds[(secondEdgeIndex + 1) % secondFace.vertexIds.length];
  const secondMatchesOrientation =
    secondEdgeStartId === startVertexId && secondEdgeEndId === endVertexId;
  const secondRail = secondMatchesOrientation
    ? {
        end: secondFaceData.corners[(secondEdgeIndex + 1) % secondFaceData.corners.length],
        start: secondFaceData.corners[secondEdgeIndex]
      }
    : {
        end: secondFaceData.corners[secondEdgeIndex],
        start: secondFaceData.corners[(secondEdgeIndex + 1) % secondFaceData.corners.length]
      };
  const edgeStart = firstFace.positions[firstEdgeIndex];
  const edgeEnd = firstFace.positions[(firstEdgeIndex + 1) % firstFace.positions.length];
  const axis = normalizeVec3(subVec3(edgeEnd, edgeStart));
  const startOffsetA = subVec3(firstRail.start.position, edgeStart);
  const startOffsetB = subVec3(secondRail.start.position, edgeStart);
  const endOffsetA = subVec3(firstRail.end.position, edgeEnd);
  const endOffsetB = subVec3(secondRail.end.position, edgeEnd);
  const startDirA = normalizeVec3(startOffsetA);
  const startDirB = normalizeVec3(startOffsetB);
  const endDirA = normalizeVec3(endOffsetA);
  const endDirB = normalizeVec3(endOffsetB);
  const startAngle = Math.atan2(dotVec3(axis, crossVec3(startDirA, startDirB)), dotVec3(startDirA, startDirB));
  const endAngle = Math.atan2(dotVec3(axis, crossVec3(endDirA, endDirB)), dotVec3(endDirA, endDirB));
  const startLengthA = lengthVec3(startOffsetA);
  const startLengthB = lengthVec3(startOffsetB);
  const endLengthA = lengthVec3(endOffsetA);
  const endLengthB = lengthVec3(endOffsetB);

  return Array.from({ length: railCount }, (_, index) => {
    const t = railCount === 1 ? 0 : index / (railCount - 1);
    const useRound =
      profile === "round" &&
      startLengthA > epsilon &&
      startLengthB > epsilon &&
      endLengthA > epsilon &&
      endLengthB > epsilon;
    const startPosition = useRound
      ? addVec3(
          edgeStart,
          scaleVec3(
            rotateAroundAxis(startDirA, axis, startAngle * t),
            startLengthA + (startLengthB - startLengthA) * t
          )
        )
      : lerpVec3(firstRail.start.position, secondRail.start.position, t);
    const endPosition = useRound
      ? addVec3(
          edgeEnd,
          scaleVec3(
            rotateAroundAxis(endDirA, axis, endAngle * t),
            endLengthA + (endLengthB - endLengthA) * t
          )
        )
      : lerpVec3(firstRail.end.position, secondRail.end.position, t);

    return {
      end: endPosition,
      endId:
        index === 0
          ? firstRail.end.id
          : index === railCount - 1
            ? secondRail.end.id
            : `${makeUndirectedEdgeKey(startVertexId, endVertexId)}:bevel:${index}:end`,
      start: startPosition,
      startId:
        index === 0
          ? firstRail.start.id
          : index === railCount - 1
            ? secondRail.start.id
            : `${makeUndirectedEdgeKey(startVertexId, endVertexId)}:bevel:${index}:start`
    };
  });
}

function registerBevelVertexProfile(
  registry: Map<VertexID, BevelVertexProfile[]>,
  profile: BevelVertexProfile
) {
  const profiles = registry.get(profile.vertexId) ?? [];

  profiles.push(profile);
  registry.set(profile.vertexId, profiles);
}

function collectOrderedIncidentFacesAtVertex(vertexId: VertexID, polygons: MeshPolygonData[]) {
  const incidentFaces = polygons.filter((polygon) => polygon.vertexIds.includes(vertexId));

  if (incidentFaces.length <= 1) {
    return incidentFaces;
  }

  const vertexPosition = incidentFaces
    .flatMap((polygon) =>
      polygon.vertexIds.map((candidateId, index) => ({
        candidateId,
        position: polygon.positions[index]
      }))
    )
    .find((entry) => entry.candidateId === vertexId)?.position;

  if (!vertexPosition) {
    return incidentFaces;
  }

  const averageNormal = normalizeVec3(averageVec3(incidentFaces.map((polygon) => polygon.normal)));
  const basis = createFacePlaneBasis(averageNormal);

  return incidentFaces.slice().sort((left, right) => {
    const leftProjected = projectFacePoint(left.center, vertexPosition, basis);
    const rightProjected = projectFacePoint(right.center, vertexPosition, basis);

    return Math.atan2(leftProjected.v, leftProjected.u) - Math.atan2(rightProjected.v, rightProjected.u);
  });
}

function applyEndpointBevelHostClipping(
  vertexId: VertexID,
  incidentFaces: MeshPolygonData[],
  profile: BevelVertexProfile,
  nextPolygons: Array<OrientedEditablePolygon & { vertexIds?: VertexID[] }>,
  nextPolygonById: Map<FaceID, OrientedEditablePolygon & { vertexIds?: VertexID[] }>
) {
  const selectedFaceIds = new Set(profile.faceIds);
  const selectedFaces = incidentFaces.filter((face) => selectedFaceIds.has(face.id));
  const hostFaces = incidentFaces.filter((face) => !selectedFaceIds.has(face.id));
  const firstBoundaryPoint = profile.points[0];
  const secondBoundaryPoint = profile.points[profile.points.length - 1];

  if (selectedFaces.length !== 2 || !firstBoundaryPoint || !secondBoundaryPoint || hostFaces.length === 0) {
    return;
  }

  if (hostFaces.length === 1) {
    const polygon = nextPolygonById.get(hostFaces[0].id);
    const orientedBoundary = orientBevelProfileBoundaryForFace(hostFaces[0], vertexId, [
      firstBoundaryPoint,
      secondBoundaryPoint
    ]);

    if (orientedBoundary && polygon?.vertexIds) {
      replacePolygonInCollection(
        nextPolygons,
        nextPolygonById,
        replacePolygonVertexWithSequence(
          polygon as OrientedEditablePolygon & { vertexIds: VertexID[] },
          vertexId,
          orientedBoundary
        )
      );
    }

    return;
  }

  const boundaryPoints = [firstBoundaryPoint, secondBoundaryPoint];

  hostFaces.forEach((hostFace) => {
    const polygon = nextPolygonById.get(hostFace.id);

    if (!polygon?.vertexIds) {
      return;
    }

    for (const point of boundaryPoints) {
      let clippedHostFace:
        | (OrientedEditablePolygon & { vertexIds: VertexID[] })
        | undefined;

      for (const selectedFace of selectedFaces) {
        clippedHostFace = insertEndpointBoundaryPointOnHostFace(
          polygon as OrientedEditablePolygon & { vertexIds: VertexID[] },
          hostFace,
          vertexId,
          selectedFace,
          point
        );

        if (clippedHostFace) {
          replacePolygonInCollection(nextPolygons, nextPolygonById, clippedHostFace);
          break;
        }
      }

      if (clippedHostFace) {
        break;
      }
    }
  });
}

function replacePolygonInCollection(
  nextPolygons: Array<OrientedEditablePolygon & { vertexIds?: VertexID[] }>,
  nextPolygonById: Map<FaceID, OrientedEditablePolygon & { vertexIds?: VertexID[] }>,
  polygon: OrientedEditablePolygon & { vertexIds?: VertexID[] }
) {
  const polygonIndex = nextPolygons.findIndex((candidate) => candidate.id === polygon.id);

  if (polygonIndex < 0) {
    return;
  }

  nextPolygons[polygonIndex] = polygon;
  nextPolygonById.set(polygon.id, polygon);
}

function orientBevelProfileBoundaryForFace(
  face: MeshPolygonData,
  vertexId: VertexID,
  boundaryPoints: BevelProfilePoint[]
) {
  const targetIndex = face.vertexIds.indexOf(vertexId);

  if (targetIndex < 0 || boundaryPoints.length < 2) {
    return undefined;
  }

  const previousPosition = face.positions[(targetIndex - 1 + face.positions.length) % face.positions.length];
  const currentPosition = face.positions[targetIndex];
  const nextPosition = face.positions[(targetIndex + 1) % face.positions.length];
  const firstOnPrevious = pointLiesOnSegment(boundaryPoints[0].position, previousPosition, currentPosition);
  const firstOnNext = pointLiesOnSegment(boundaryPoints[0].position, currentPosition, nextPosition);
  const lastOnPrevious = pointLiesOnSegment(boundaryPoints[boundaryPoints.length - 1].position, previousPosition, currentPosition);
  const lastOnNext = pointLiesOnSegment(boundaryPoints[boundaryPoints.length - 1].position, currentPosition, nextPosition);

  if (firstOnPrevious && lastOnNext) {
    return boundaryPoints.map((point) => ({
      id: point.id,
      position: vec3(point.position.x, point.position.y, point.position.z)
    }));
  }

  if (firstOnNext && lastOnPrevious) {
    return boundaryPoints.slice().reverse().map((point) => ({
      id: point.id,
      position: vec3(point.position.x, point.position.y, point.position.z)
    }));
  }

  return undefined;
}

function insertEndpointBoundaryPointOnHostFace(
  polygon: OrientedEditablePolygon & { vertexIds: VertexID[] },
  hostFace: MeshPolygonData,
  vertexId: VertexID,
  selectedFace: MeshPolygonData,
  point: BevelProfilePoint
) {
  const targetIndex = polygon.vertexIds.indexOf(vertexId);
  const hostTargetIndex = hostFace.vertexIds.indexOf(vertexId);

  if (targetIndex < 0 || hostTargetIndex < 0) {
    return undefined;
  }

  const previousIndex = (hostTargetIndex - 1 + hostFace.vertexIds.length) % hostFace.vertexIds.length;
  const nextIndex = (hostTargetIndex + 1) % hostFace.vertexIds.length;
  const previousVertexId = hostFace.vertexIds[previousIndex];
  const nextVertexId = hostFace.vertexIds[nextIndex];
  const currentPosition = polygon.positions[targetIndex];
  const previousPosition = hostFace.positions[previousIndex];
  const nextPosition = hostFace.positions[nextIndex];
  const hostCurrentPosition = hostFace.positions[hostTargetIndex];
  const sharesPreviousEdge =
    findEdgeIndex(hostFace.vertexIds, [previousVertexId, vertexId]) >= 0 &&
    findEdgeIndex(selectedFace.vertexIds, [previousVertexId, vertexId]) >= 0;
  const sharesNextEdge =
    findEdgeIndex(hostFace.vertexIds, [vertexId, nextVertexId]) >= 0 &&
    findEdgeIndex(selectedFace.vertexIds, [vertexId, nextVertexId]) >= 0;

  if (sharesPreviousEdge && pointLiesOnSegment(point.position, previousPosition, hostCurrentPosition)) {
    return replacePolygonVertexWithSequence(polygon, vertexId, [
      {
        id: point.id,
        position: vec3(point.position.x, point.position.y, point.position.z)
      },
      {
        id: vertexId,
        position: vec3(currentPosition.x, currentPosition.y, currentPosition.z)
      }
    ]);
  }

  if (sharesNextEdge && pointLiesOnSegment(point.position, hostCurrentPosition, nextPosition)) {
    return replacePolygonVertexWithSequence(polygon, vertexId, [
      {
        id: vertexId,
        position: vec3(currentPosition.x, currentPosition.y, currentPosition.z)
      },
      {
        id: point.id,
        position: vec3(point.position.x, point.position.y, point.position.z)
      }
    ]);
  }

  return undefined;
}

function weldCollinearBevelProfiles(
  vertexId: VertexID,
  profiles: BevelVertexProfile[],
  nextPolygons: Array<OrientedEditablePolygon & { vertexIds?: VertexID[] }>,
  nextPolygonById: Map<FaceID, OrientedEditablePolygon & { vertexIds?: VertexID[] }>,
  epsilon = 0.0001
) {
  if (profiles.length !== 2) {
    return false;
  }

  const firstPoints = profiles[0].points.map((point) => ({
    id: point.id,
    position: vec3(point.position.x, point.position.y, point.position.z)
  }));
  const secondPointsForward = profiles[1].points.map((point) => ({
    id: point.id,
    position: vec3(point.position.x, point.position.y, point.position.z)
  }));
  const secondPointsReverse = profiles[1].points.slice().reverse().map((point) => ({
    id: point.id,
    position: vec3(point.position.x, point.position.y, point.position.z)
  }));
  const forwardAlignment = measureProfileAlignment(firstPoints, secondPointsForward);
  const reverseAlignment = measureProfileAlignment(firstPoints, secondPointsReverse);
  const secondPoints =
    forwardAlignment.totalDistance <= reverseAlignment.totalDistance
      ? secondPointsForward
      : secondPointsReverse;
  const alignment =
    forwardAlignment.totalDistance <= reverseAlignment.totalDistance
      ? forwardAlignment
      : reverseAlignment;

  if (firstPoints.length !== secondPoints.length) {
    return false;
  }

  const profileSpan = Math.max(
    firstPoints.length > 1
      ? lengthVec3(subVec3(firstPoints[0].position, firstPoints[firstPoints.length - 1].position))
      : 0,
    secondPoints.length > 1
      ? lengthVec3(subVec3(secondPoints[0].position, secondPoints[secondPoints.length - 1].position))
      : 0,
    epsilon
  );

  if (
    alignment.maxDistance > Math.max(epsilon * 20, profileSpan * 0.35) &&
    dotVec3(profiles[0].edgeDirection, profiles[1].edgeDirection) > -0.5
  ) {
    return false;
  }

  const replacements = new Map<VertexID, BevelProfilePoint>();

  firstPoints.forEach((point, index) => {
    const otherPoint = secondPoints[index];
    const canonicalId = `${vertexId}:bevel:chain:${index}`;
    const canonicalPosition = midpoint(point.position, otherPoint.position);

    replacements.set(point.id, {
      id: canonicalId,
      position: canonicalPosition
    });
    replacements.set(otherPoint.id, {
      id: canonicalId,
      position: canonicalPosition
    });
  });

  if (replacements.size === 0) {
    return false;
  }

  nextPolygons.forEach((polygon, polygonIndex) => {
    if (!polygon.vertexIds) {
      return;
    }

    let changed = false;
    const positions = polygon.positions.map((position) => vec3(position.x, position.y, position.z));
    const vertexIds = [...polygon.vertexIds];

    vertexIds.forEach((vertexId, index) => {
      const replacement = replacements.get(vertexId);

      if (!replacement) {
        return;
      }

      changed = true;
      vertexIds[index] = replacement.id;
      positions[index] = vec3(
        replacement.position.x,
        replacement.position.y,
        replacement.position.z
      );
    });

    if (!changed) {
      return;
    }

    const nextPolygon = {
      expectedNormal: polygon.expectedNormal,
      id: polygon.id,
      positions,
      vertexIds
    };

    nextPolygons[polygonIndex] = nextPolygon;
    nextPolygonById.set(nextPolygon.id, nextPolygon);
  });

  return true;
}

function measureProfileAlignmentDistance(left: BevelProfilePoint[], right: BevelProfilePoint[]) {
  return measureProfileAlignment(left, right).totalDistance;
}

function measureProfileAlignment(left: BevelProfilePoint[], right: BevelProfilePoint[]) {
  if (left.length !== right.length) {
    return {
      maxDistance: Number.POSITIVE_INFINITY,
      totalDistance: Number.POSITIVE_INFINITY
    };
  }

  return left.reduce(
    (result, point, index) => {
      const distance = lengthVec3(subVec3(point.position, right[index].position));

      return {
        maxDistance: Math.max(result.maxDistance, distance),
        totalDistance: result.totalDistance + distance
      };
    },
    {
      maxDistance: 0,
      totalDistance: 0
    }
  );
}

function createBevelVertexTransitionPolygons(
  vertexId: VertexID,
  incidentFaces: MeshPolygonData[],
  profiles: BevelVertexProfile[]
) {
  if (incidentFaces.length === 0 || profiles.length < 2) {
    return [];
  }

  const vertexPosition = incidentFaces
    .flatMap((polygon) =>
      polygon.vertexIds.map((candidateId, index) => ({
        candidateId,
        position: polygon.positions[index]
      }))
    )
    .find((entry) => entry.candidateId === vertexId)?.position;

  if (!vertexPosition) {
    return [];
  }

  const averageNormal = normalizeVec3(averageVec3(incidentFaces.map((polygon) => polygon.normal)));
  const faceIndexById = new Map(incidentFaces.map((face, index) => [face.id, index]));
  const orderedProfiles = profiles
    .map((profile) =>
      orientBevelVertexProfile(profile, faceIndexById, incidentFaces.length, vertexPosition, averageNormal)
    )
    .sort((left, right) => left.sortKey - right.sortKey);
  const polygons: OrientedEditablePolygon[] = [];

  for (let profileIndex = 0; profileIndex < orderedProfiles.length - 1; profileIndex += 1) {
    const currentProfile = compactBevelProfilePoints(orderedProfiles[profileIndex].points);
    const nextProfile = compactBevelProfilePoints(orderedProfiles[profileIndex + 1].points);
    const stepCount = Math.min(currentProfile.length, nextProfile.length);

    if (stepCount < 2) {
      continue;
    }

    for (let stepIndex = 0; stepIndex < stepCount - 1; stepIndex += 1) {
      const firstTriangle = createOrientedPolygon(
        `${vertexId}:bevel:corner:${profileIndex}:${stepIndex}:a`,
        [
          currentProfile[stepIndex].position,
          currentProfile[stepIndex + 1].position,
          nextProfile[stepIndex].position
        ],
        averageNormal,
        [
          currentProfile[stepIndex].id,
          currentProfile[stepIndex + 1].id,
          nextProfile[stepIndex].id
        ]
      );
      const secondTriangle = createOrientedPolygon(
        `${vertexId}:bevel:corner:${profileIndex}:${stepIndex}:b`,
        [
          currentProfile[stepIndex + 1].position,
          nextProfile[stepIndex + 1].position,
          nextProfile[stepIndex].position
        ],
        averageNormal,
        [
          currentProfile[stepIndex + 1].id,
          nextProfile[stepIndex + 1].id,
          nextProfile[stepIndex].id
        ]
      );

      if (firstTriangle) {
        polygons.push(firstTriangle);
      }

      if (secondTriangle) {
        polygons.push(secondTriangle);
      }
    }
  }

  return polygons;
}

function orientBevelVertexProfile(
  profile: BevelVertexProfile,
  faceIndexById: Map<FaceID, number>,
  faceCount: number,
  vertexPosition: Vec3,
  averageNormal: Vec3
) {
  const firstFaceIndex = faceIndexById.get(profile.faceIds[0]);
  const secondFaceIndex = faceIndexById.get(profile.faceIds[1]);

  if (firstFaceIndex !== undefined && secondFaceIndex !== undefined) {
    if ((firstFaceIndex + 1) % faceCount === secondFaceIndex) {
      return {
        points: profile.points.map((point) => ({
          id: point.id,
          position: vec3(point.position.x, point.position.y, point.position.z)
        })),
        sortKey: firstFaceIndex
      };
    }

    if ((secondFaceIndex + 1) % faceCount === firstFaceIndex) {
      return {
        points: profile.points.slice().reverse().map((point) => ({
          id: point.id,
          position: vec3(point.position.x, point.position.y, point.position.z)
        })),
        sortKey: secondFaceIndex
      };
    }
  }

  const basis = createFacePlaneBasis(averageNormal);
  const midpoint = averageVec3(profile.points.map((point) => point.position));
  const projected = projectFacePoint(midpoint, vertexPosition, basis);

  return {
    points: profile.points.map((point) => ({
      id: point.id,
      position: vec3(point.position.x, point.position.y, point.position.z)
    })),
    sortKey: Math.atan2(projected.v, projected.u)
  };
}

function compactBevelProfilePoints(points: BevelProfilePoint[]) {
  const compacted: BevelProfilePoint[] = [];

  points.forEach((point) => {
    const previous = compacted[compacted.length - 1];

    if (previous && sameBevelProfilePoint(previous, point)) {
      return;
    }

    compacted.push({
      id: point.id,
      position: vec3(point.position.x, point.position.y, point.position.z)
    });
  });

  if (compacted.length > 1 && sameBevelProfilePoint(compacted[0], compacted[compacted.length - 1])) {
    compacted.pop();
  }

  return compacted;
}

function sameBevelProfilePoint(left: BevelProfilePoint, right: BevelProfilePoint) {
  return (
    left.id === right.id ||
    lengthVec3(subVec3(left.position, right.position)) <= 0.000001
  );
}

function pointLiesOnSegment(point: Vec3, start: Vec3, end: Vec3, epsilon = 0.0001) {
  const segment = subVec3(end, start);
  const pointOffset = subVec3(point, start);
  const segmentLengthSquared = dotVec3(segment, segment);

  if (segmentLengthSquared <= epsilon * epsilon) {
    return lengthVec3(subVec3(point, start)) <= epsilon;
  }

  const t = dotVec3(pointOffset, segment) / segmentLengthSquared;

  if (t < -epsilon || t > 1 + epsilon) {
    return false;
  }

  const closestPoint = addVec3(start, scaleVec3(segment, Math.max(0, Math.min(1, t))));
  return lengthVec3(subVec3(point, closestPoint)) <= epsilon;
}

function replacePolygonEdge(
  polygon: MeshPolygonData,
  edge: [VertexID, VertexID],
  firstReplacement: Vec3,
  secondReplacement: Vec3
): (EditableMeshPolygon & { id: FaceID }) | undefined {
  const edgeIndex = findEdgeIndex(polygon.vertexIds, edge);

  if (edgeIndex < 0) {
    return undefined;
  }

  const nextIndex = (edgeIndex + 1) % polygon.vertexIds.length;
  const sameOrientation =
    polygon.vertexIds[edgeIndex] === edge[0] && polygon.vertexIds[nextIndex] === edge[1];
  const positions = polygon.positions.map((position) => vec3(position.x, position.y, position.z));

  positions[edgeIndex] = sameOrientation ? firstReplacement : secondReplacement;
  positions[nextIndex] = sameOrientation ? secondReplacement : firstReplacement;

  return {
    id: polygon.id,
    positions
  };
}

function replacePolygonVertexWithSequence(
  polygon: OrientedEditablePolygon & { vertexIds: VertexID[] },
  targetVertexId: VertexID,
  replacementPoints: BevelProfilePoint[]
) {
  const targetIndex = polygon.vertexIds.indexOf(targetVertexId);

  if (targetIndex < 0 || replacementPoints.length === 0) {
    return {
      expectedNormal: polygon.expectedNormal,
      id: polygon.id,
      positions: polygon.positions.map((position) => vec3(position.x, position.y, position.z)),
      vertexIds: [...polygon.vertexIds]
    };
  }

  const positions: Vec3[] = [];
  const vertexIds: VertexID[] = [];

  polygon.vertexIds.forEach((vertexId, index) => {
    if (index !== targetIndex) {
      positions.push(vec3(polygon.positions[index].x, polygon.positions[index].y, polygon.positions[index].z));
      vertexIds.push(vertexId);
      return;
    }

    replacementPoints.forEach((point) => {
      positions.push(vec3(point.position.x, point.position.y, point.position.z));
      vertexIds.push(point.id);
    });
  });

  return {
    expectedNormal: polygon.expectedNormal,
    id: polygon.id,
    positions,
    vertexIds
  };
}

function replacePolygonVertexWithBevelPoints(
  polygon: MeshPolygonData | OrientedEditablePolygon,
  targetVertexId: VertexID,
  firstFace: MeshPolygonData,
  secondFace: MeshPolygonData,
  firstPoint: Vec3,
  secondPoint: Vec3
): OrientedEditablePolygon & { vertexIds: VertexID[] } {
  const vertexIds = "vertexIds" in polygon && polygon.vertexIds ? [...polygon.vertexIds] : [];
  const expectedNormal =
    ("expectedNormal" in polygon ? polygon.expectedNormal : undefined) ??
    ("normal" in polygon ? polygon.normal : undefined);
  const targetIndex = vertexIds.indexOf(targetVertexId);

  if (targetIndex < 0) {
    return {
      expectedNormal,
      id: polygon.id,
      positions: polygon.positions.map((position) => vec3(position.x, position.y, position.z)),
      vertexIds
    };
  }

  const previousVertexId = vertexIds[(targetIndex - 1 + vertexIds.length) % vertexIds.length];
  const nextVertexId = vertexIds[(targetIndex + 1) % vertexIds.length];
  const previousUsesFirstFace = findEdgeIndex(firstFace.vertexIds, [previousVertexId, targetVertexId]) >= 0;
  const previousUsesSecondFace = findEdgeIndex(secondFace.vertexIds, [previousVertexId, targetVertexId]) >= 0;
  const nextUsesFirstFace = findEdgeIndex(firstFace.vertexIds, [targetVertexId, nextVertexId]) >= 0;
  const nextUsesSecondFace = findEdgeIndex(secondFace.vertexIds, [targetVertexId, nextVertexId]) >= 0;
  const previousReplacement = previousUsesFirstFace ? firstPoint : previousUsesSecondFace ? secondPoint : firstPoint;
  const nextReplacement = nextUsesFirstFace ? firstPoint : nextUsesSecondFace ? secondPoint : secondPoint;
  const positions: Vec3[] = [];
  const nextVertexIds: VertexID[] = [];

  vertexIds.forEach((vertexId, index) => {
    if (index !== targetIndex) {
      positions.push(vec3(polygon.positions[index].x, polygon.positions[index].y, polygon.positions[index].z));
      nextVertexIds.push(vertexId);
      return;
    }

    positions.push(vec3(previousReplacement.x, previousReplacement.y, previousReplacement.z));
    positions.push(vec3(nextReplacement.x, nextReplacement.y, nextReplacement.z));
    nextVertexIds.push(`${targetVertexId}:bevel:start`, `${targetVertexId}:bevel:end`);
  });

  return {
    expectedNormal,
    id: polygon.id,
    positions,
    vertexIds: nextVertexIds
  };
}

function orientPolygonLoops(polygons: OrientedEditablePolygon[]) {
  const allPoints = polygons.flatMap((polygon) => polygon.positions);

  if (allPoints.length === 0) {
    return polygons;
  }

  const center = averageVec3(allPoints);

  return polygons.map((polygon) => {
    const normal = computePolygonNormal(polygon.positions);
    const alignedWithExpected =
      polygon.expectedNormal && dotVec3(normal, polygon.expectedNormal) >= 0;

    if (alignedWithExpected) {
      return polygon;
    }

    if (polygon.expectedNormal && dotVec3(normal, polygon.expectedNormal) < 0) {
      return {
        ...polygon,
        positions: polygon.positions.slice().reverse(),
        vertexIds: polygon.vertexIds?.slice().reverse()
      };
    }

    const polygonCenter = averageVec3(polygon.positions);

    return dotVec3(normal, subVec3(polygonCenter, center)) >= 0
      ? polygon
      : {
          ...polygon,
          positions: polygon.positions.slice().reverse(),
          vertexIds: polygon.vertexIds?.slice().reverse()
        };
  });
}

function getMeshPolygonWithInsertedPoint(
  polygon: MeshPolygonData,
  edge: [VertexID, VertexID],
  insertedPoint: Vec3
): MeshPolygonData {
  const insertedPolygon = insertPointsOnPolygonEdge(
    {
      expectedNormal: polygon.normal,
      id: polygon.id,
      positions: polygon.positions,
      vertexIds: polygon.vertexIds
    },
    edge,
    [
      {
        id: `inserted:${polygon.id}:${edge[0]}:${edge[1]}`,
        position: insertedPoint
      }
    ]
  );

  return {
    center: averageVec3(insertedPolygon.positions),
    id: insertedPolygon.id,
    normal: polygon.normal,
    positions: insertedPolygon.positions,
    vertexIds: insertedPolygon.vertexIds ?? polygon.vertexIds
  };
}

function insertPointsOnPolygonEdge(
  polygon: OrientedEditablePolygon & { vertexIds: VertexID[] },
  edge: [VertexID, VertexID],
  insertedPoints: Array<{ id: VertexID; position: Vec3 }>
): OrientedEditablePolygon & { vertexIds: VertexID[] } {
  const edgeIndex = findEdgeIndex(polygon.vertexIds, edge);

  if (edgeIndex < 0 || insertedPoints.length === 0) {
    return {
      ...polygon,
      positions: polygon.positions.map((position) => vec3(position.x, position.y, position.z)),
      vertexIds: [...polygon.vertexIds]
    };
  }

  const nextIndex = (edgeIndex + 1) % polygon.vertexIds.length;
  const sameOrientation =
    polygon.vertexIds[edgeIndex] === edge[0] && polygon.vertexIds[nextIndex] === edge[1];
  const orderedInsertions = sameOrientation ? insertedPoints : insertedPoints.slice().reverse();
  const positions: Vec3[] = [];
  const vertexIds: VertexID[] = [];

  polygon.vertexIds.forEach((vertexId, index) => {
    vertexIds.push(vertexId);
    positions.push(vec3(polygon.positions[index].x, polygon.positions[index].y, polygon.positions[index].z));

    if (index === edgeIndex) {
      orderedInsertions.forEach((inserted) => {
        vertexIds.push(inserted.id);
        positions.push(vec3(inserted.position.x, inserted.position.y, inserted.position.z));
      });
    }
  });

  return {
    expectedNormal: polygon.expectedNormal,
    id: polygon.id,
    positions,
    vertexIds
  };
}

function rotateAroundAxis(vector: Vec3, axis: Vec3, angle: number): Vec3 {
  const normalizedAxis = normalizeVec3(axis);
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);

  return addVec3(
    addVec3(scaleVec3(vector, cosine), scaleVec3(crossVec3(normalizedAxis, vector), sine)),
    scaleVec3(normalizedAxis, dotVec3(normalizedAxis, vector) * (1 - cosine))
  );
}

function lerpVec3(left: Vec3, right: Vec3, t: number): Vec3 {
  return vec3(
    left.x + (right.x - left.x) * t,
    left.y + (right.y - left.y) * t,
    left.z + (right.z - left.z) * t
  );
}
