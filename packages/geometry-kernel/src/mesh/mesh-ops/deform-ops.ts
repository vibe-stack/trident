import type { EditableMesh, Vec3, VertexID } from "@web-hammer/shared";
import { addVec3, averageVec3, lengthVec3, normalizeVec3, scaleVec3, subVec3, vec3 } from "@web-hammer/shared";
import { computePolygonNormal } from "../../polygon/polygon-utils";
import { getFaceVertices } from "../editable-mesh";

export type SculptSample = {
  normal?: Vec3;
  point: Vec3;
};

export function buildEditableMeshVertexNormals(mesh: EditableMesh) {
  const normalsByVertexId = new Map<VertexID, Vec3>();

  mesh.faces.forEach((face) => {
    const vertices = getFaceVertices(mesh, face.id);

    if (vertices.length < 3) {
      return;
    }

    const normal = computePolygonNormal(vertices.map((vertex) => vertex.position));

    vertices.forEach((vertex) => {
      const current = normalsByVertexId.get(vertex.id) ?? vec3(0, 0, 0);
      normalsByVertexId.set(vertex.id, addVec3(current, normal));
    });
  });

  return normalsByVertexId;
}

export function inflateEditableMesh(mesh: EditableMesh, factor: number): EditableMesh {
  if (Math.abs(factor) <= 0.000001) {
    return {
      ...mesh,
      vertices: mesh.vertices.map((vertex) => ({
        ...vertex,
        position: vec3(vertex.position.x, vertex.position.y, vertex.position.z)
      }))
    };
  }

  const normalsByVertexId = buildEditableMeshVertexNormals(mesh);

  return {
    ...mesh,
    vertices: mesh.vertices.map((vertex) => {
      const averagedNormal = normalizeVec3(normalsByVertexId.get(vertex.id) ?? vec3(0, 0, 0));

      return {
        ...vertex,
        position: addVec3(vertex.position, scaleVec3(averagedNormal, factor))
      };
    })
  };
}

export function offsetEditableMeshTop(mesh: EditableMesh, amount: number, epsilon = 0.0001): EditableMesh {
  if (Math.abs(amount) <= epsilon) {
    return {
      ...mesh,
      vertices: mesh.vertices.map((vertex) => ({
        ...vertex,
        position: vec3(vertex.position.x, vertex.position.y, vertex.position.z)
      }))
    };
  }

  const maxY = mesh.vertices.reduce((currentMax, vertex) => Math.max(currentMax, vertex.position.y), Number.NEGATIVE_INFINITY);

  return {
    ...mesh,
    vertices: mesh.vertices.map((vertex) => ({
      ...vertex,
      position:
        Math.abs(vertex.position.y - maxY) <= epsilon
          ? vec3(vertex.position.x, vertex.position.y + amount, vertex.position.z)
          : vec3(vertex.position.x, vertex.position.y, vertex.position.z)
    }))
  };
}

export function sculptEditableMesh(
  mesh: EditableMesh,
  center: Vec3,
  radius: number,
  amount: number,
  brushNormal?: Vec3,
  epsilon = 0.0001
): EditableMesh {
  return sculptEditableMeshSamples(mesh, [{ normal: brushNormal, point: center }], radius, amount, epsilon);
}

export function sculptEditableMeshSamples(
  mesh: EditableMesh,
  samples: SculptSample[],
  radius: number,
  amount: number,
  epsilon = 0.0001,
  vertexNormals?: ReadonlyMap<VertexID, Vec3>
): EditableMesh {
  if (radius <= epsilon || Math.abs(amount) <= epsilon) {
    return {
      ...mesh,
      vertices: mesh.vertices.map((vertex) => ({
        ...vertex,
        position: vec3(vertex.position.x, vertex.position.y, vertex.position.z)
      }))
    };
  }

  const normalsByVertexId = vertexNormals ?? buildEditableMeshVertexNormals(mesh);
  const normalizedSamples = samples.map((sample) => ({
    normal:
      sample.normal && lengthVec3(sample.normal) > epsilon
        ? normalizeVec3(sample.normal)
        : undefined,
    point: sample.point
  }));
  return {
    ...mesh,
    vertices: mesh.vertices.map((vertex) => {
      const averagedNormal = normalizeVec3(normalsByVertexId.get(vertex.id) ?? vec3(0, 0, 0));
      let displacement = vec3(0, 0, 0);

      normalizedSamples.forEach((sample) => {
        const offset = subVec3(vertex.position, sample.point);
        const distance = lengthVec3(offset);

        if (distance >= radius) {
          return;
        }

        const falloff = smoothBrushFalloff(distance / radius);
        const direction =
          sample.normal && lengthVec3(averagedNormal) > epsilon
            ? normalizeVec3(averageVec3([averagedNormal, sample.normal]))
            : sample.normal ?? averagedNormal;

        if (lengthVec3(direction) <= epsilon) {
          return;
        }

        displacement = addVec3(displacement, scaleVec3(direction, amount * falloff));
      });

      if (lengthVec3(displacement) <= epsilon) {
        return vertex;
      }

      return {
        ...vertex,
        position: addVec3(vertex.position, displacement)
      };
    })
  };
}

function smoothBrushFalloff(distanceRatio: number) {
  const clamped = Math.max(0, Math.min(1, distanceRatio));
  const inverse = 1 - clamped;

  return inverse * inverse * (3 - 2 * inverse);
}
