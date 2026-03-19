import { describe, expect, test } from "bun:test";
import { vec3 } from "@ggez/shared";
import { computePolygonNormal } from "../../polygon/polygon-utils";
import { createEditableMeshFromPolygons, getFaceVertexIds, getFaceVertices, validateEditableMesh } from "../editable-mesh";
import { extrudeEditableMeshEdge, extrudeEditableMeshFaces } from "./extrude-ops";

describe("extrudeEditableMeshFaces", () => {
  test("extrudes adjacent coplanar faces as one region", () => {
    const mesh = createEditableMeshFromPolygons([
      {
        id: "left",
        positions: [vec3(0, 0, 0), vec3(1, 0, 0), vec3(1, 1, 0), vec3(0, 1, 0)],
        vertexIds: ["a", "b", "e", "d"]
      },
      {
        id: "right",
        positions: [vec3(1, 0, 0), vec3(2, 0, 0), vec3(2, 1, 0), vec3(1, 1, 0)],
        vertexIds: ["b", "c", "f", "e"]
      }
    ]);
    const result = extrudeEditableMeshFaces(mesh, ["left", "right"], 1);

    expect(result).toBeDefined();
    expect(validateEditableMesh(result!).valid).toBe(true);
    expect(result!.faces).toHaveLength(8);
    expect(countFacesUsingEdge(result!, ["b", "e"])).toBe(0);
  });

  test("supports repeated region extrusion on the new cap faces", () => {
    const mesh = createEditableMeshFromPolygons([
      {
        id: "left",
        positions: [vec3(0, 0, 0), vec3(1, 0, 0), vec3(1, 1, 0), vec3(0, 1, 0)],
        vertexIds: ["a", "b", "e", "d"]
      },
      {
        id: "right",
        positions: [vec3(1, 0, 0), vec3(2, 0, 0), vec3(2, 1, 0), vec3(1, 1, 0)],
        vertexIds: ["b", "c", "f", "e"]
      }
    ]);
    const firstExtrusion = extrudeEditableMeshFaces(mesh, ["left", "right"], 1);

    expect(firstExtrusion).toBeDefined();

    const secondExtrusion = extrudeEditableMeshFaces(firstExtrusion!, ["left:extrude:cap", "right:extrude:cap"], 1);

    expect(secondExtrusion).toBeDefined();
    expect(validateEditableMesh(secondExtrusion!).valid).toBe(true);
  });

  test("does not reuse generated vertices when extruding an adjacent cube face", () => {
    const cube = createEditableMeshFromPolygons([
      {
        id: "back",
        positions: [vec3(0, 0, 0), vec3(0, 1, 0), vec3(1, 1, 0), vec3(1, 0, 0)],
        vertexIds: ["a", "d", "c", "b"]
      },
      {
        id: "front",
        positions: [vec3(0, 0, 1), vec3(1, 0, 1), vec3(1, 1, 1), vec3(0, 1, 1)],
        vertexIds: ["e", "f", "g", "h"]
      },
      {
        id: "left",
        positions: [vec3(0, 0, 0), vec3(0, 0, 1), vec3(0, 1, 1), vec3(0, 1, 0)],
        vertexIds: ["a", "e", "h", "d"]
      },
      {
        id: "right",
        positions: [vec3(1, 0, 0), vec3(1, 1, 0), vec3(1, 1, 1), vec3(1, 0, 1)],
        vertexIds: ["b", "c", "g", "f"]
      },
      {
        id: "bottom",
        positions: [vec3(0, 0, 0), vec3(1, 0, 0), vec3(1, 0, 1), vec3(0, 0, 1)],
        vertexIds: ["a", "b", "f", "e"]
      },
      {
        id: "top",
        positions: [vec3(0, 1, 0), vec3(0, 1, 1), vec3(1, 1, 1), vec3(1, 1, 0)],
        vertexIds: ["d", "h", "g", "c"]
      }
    ]);
    const firstExtrusion = extrudeEditableMeshFaces(cube, ["front"], 1);

    expect(firstExtrusion).toBeDefined();

    const frontCapVertexIds = getFaceVertexIds(firstExtrusion!, "front:extrude:cap");
    const secondExtrusion = extrudeEditableMeshFaces(firstExtrusion!, ["top"], 1);

    expect(secondExtrusion).toBeDefined();
    expect(validateEditableMesh(secondExtrusion!).valid).toBe(true);

    const topCapVertexIds = getFaceVertexIds(secondExtrusion!, "top:extrude:cap");
    const sharedVertexIds = topCapVertexIds.filter((vertexId) => frontCapVertexIds.includes(vertexId));

    expect(sharedVertexIds).toHaveLength(0);
  });

  test("preserves unrelated face winding instead of normalizing the whole mesh", () => {
    const mesh = createEditableMeshFromPolygons([
      {
        id: "back",
        positions: [vec3(1, 0, 0), vec3(1, 1, 0), vec3(0, 1, 0), vec3(0, 0, 0)],
        vertexIds: ["b", "c", "d", "a"]
      },
      {
        id: "front",
        positions: [vec3(0, 0, 1), vec3(1, 0, 1), vec3(1, 1, 1), vec3(0, 1, 1)],
        vertexIds: ["e", "f", "g", "h"]
      },
      {
        id: "left",
        positions: [vec3(0, 0, 0), vec3(0, 0, 1), vec3(0, 1, 1), vec3(0, 1, 0)],
        vertexIds: ["a", "e", "h", "d"]
      },
      {
        id: "right",
        positions: [vec3(1, 0, 0), vec3(1, 1, 0), vec3(1, 1, 1), vec3(1, 0, 1)],
        vertexIds: ["b", "c", "g", "f"]
      },
      {
        id: "bottom",
        positions: [vec3(0, 0, 0), vec3(1, 0, 0), vec3(1, 0, 1), vec3(0, 0, 1)],
        vertexIds: ["a", "b", "f", "e"]
      },
      {
        id: "top",
        positions: [vec3(0, 1, 0), vec3(0, 1, 1), vec3(1, 1, 1), vec3(1, 1, 0)],
        vertexIds: ["d", "h", "g", "c"]
      }
    ]);
    const backNormalBefore = computeFaceNormal(mesh, "back");
    const result = extrudeEditableMeshFaces(mesh, ["front"], 1);

    expect(result).toBeDefined();
    expect(computeFaceNormal(result!, "back")).toEqual(backNormalBefore);
  });
});

describe("extrudeEditableMeshEdge", () => {
  test("extrudes a boundary edge without corrupting topology", () => {
    const mesh = createEditableMeshFromPolygons([
      {
        id: "quad",
        positions: [vec3(0, 0, 0), vec3(1, 0, 0), vec3(1, 1, 0), vec3(0, 1, 0)],
        vertexIds: ["a", "b", "c", "d"]
      }
    ]);
    const result = extrudeEditableMeshEdge(mesh, ["a", "b"], 1, vec3(0, 0, 1));

    expect(result).toBeDefined();
    expect(validateEditableMesh(result!).valid).toBe(true);
    expect(result!.faces).toHaveLength(2);
  });

  test("rejects interior edge extrusion instead of producing disconnected geometry", () => {
    const mesh = createEditableMeshFromPolygons([
      {
        id: "left",
        positions: [vec3(0, 0, 0), vec3(1, 0, 0), vec3(1, 1, 0), vec3(0, 1, 0)],
        vertexIds: ["a", "b", "e", "d"]
      },
      {
        id: "right",
        positions: [vec3(1, 0, 0), vec3(2, 0, 0), vec3(2, 1, 0), vec3(1, 1, 0)],
        vertexIds: ["b", "c", "f", "e"]
      }
    ]);

    expect(extrudeEditableMeshEdge(mesh, ["b", "e"], 1, vec3(0, 0, 1))).toBeUndefined();
  });
});

function countFacesUsingEdge(mesh: Parameters<typeof validateEditableMesh>[0], edge: [string, string]) {
  const edgeKey = makeEdgeKey(edge[0], edge[1]);

  return mesh.faces.filter((face) => {
    const vertexIds = getFaceVertexIds(mesh, face.id);

    return vertexIds.some((vertexId, index) => {
      const nextVertexId = vertexIds[(index + 1) % vertexIds.length];
      return makeEdgeKey(vertexId, nextVertexId) === edgeKey;
    });
  }).length;
}

function computeFaceNormal(mesh: Parameters<typeof validateEditableMesh>[0], faceId: string) {
  return computePolygonNormal(getFaceVertices(mesh, faceId).map((vertex) => vertex.position));
}

function makeEdgeKey(startId: string, endId: string) {
  return startId < endId ? `${startId}|${endId}` : `${endId}|${startId}`;
}
