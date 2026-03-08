import {
  createEditableMeshFromPolygons,
  type EditableMeshPolygon
} from "@web-hammer/geometry-kernel";
import {
  vec3,
  type MeshNode,
  type PrimitiveNode
} from "@web-hammer/shared";
import {
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  SphereGeometry
} from "three";

export function convertPrimitiveNodeToMeshNode(node: PrimitiveNode): MeshNode {
  return {
    id: node.id,
    kind: "mesh",
    name: node.name,
    transform: structuredClone(node.transform),
    data: createEditableMeshFromPrimitive(node)
  };
}

function createEditableMeshFromPrimitive(node: PrimitiveNode) {
  if (node.data.shape === "cube") {
    return attachPropMetadata(
      createEditableMeshFromPolygons(
        createBoxPolygons(node)
      ),
      node
    );
  }

  const geometry =
    node.data.shape === "sphere"
      ? new SphereGeometry(
          Math.max(Math.abs(node.data.size.x), Math.abs(node.data.size.z)) * 0.5,
          Math.max(8, node.data.radialSegments ?? 24),
          Math.max(6, Math.floor((node.data.radialSegments ?? 24) * 0.75))
        )
      : node.data.shape === "cylinder"
        ? new CylinderGeometry(
            Math.max(Math.abs(node.data.size.x), Math.abs(node.data.size.z)) * 0.5,
            Math.max(Math.abs(node.data.size.x), Math.abs(node.data.size.z)) * 0.5,
            Math.abs(node.data.size.y),
            Math.max(8, node.data.radialSegments ?? 24)
          )
        : new ConeGeometry(
            Math.max(Math.abs(node.data.size.x), Math.abs(node.data.size.z)) * 0.5,
            Math.abs(node.data.size.y),
            Math.max(8, node.data.radialSegments ?? 24)
          );

  try {
    return attachPropMetadata(
      createEditableMeshFromPolygons(
        createTrianglePolygons(node, geometry)
      ),
      node
    );
  } finally {
    geometry.dispose();
  }
}

function createBoxPolygons(node: PrimitiveNode): EditableMeshPolygon[] {
  const halfX = Math.abs(node.data.size.x) * 0.5;
  const halfY = Math.abs(node.data.size.y) * 0.5;
  const halfZ = Math.abs(node.data.size.z) * 0.5;
  const materialId = node.data.materialId;

  return [
    {
      id: `${node.id}:face:right`,
      materialId,
      positions: [
        vec3(halfX, -halfY, -halfZ),
        vec3(halfX, -halfY, halfZ),
        vec3(halfX, halfY, halfZ),
        vec3(halfX, halfY, -halfZ)
      ]
    },
    {
      id: `${node.id}:face:left`,
      materialId,
      positions: [
        vec3(-halfX, -halfY, halfZ),
        vec3(-halfX, -halfY, -halfZ),
        vec3(-halfX, halfY, -halfZ),
        vec3(-halfX, halfY, halfZ)
      ]
    },
    {
      id: `${node.id}:face:top`,
      materialId,
      positions: [
        vec3(-halfX, halfY, -halfZ),
        vec3(halfX, halfY, -halfZ),
        vec3(halfX, halfY, halfZ),
        vec3(-halfX, halfY, halfZ)
      ]
    },
    {
      id: `${node.id}:face:bottom`,
      materialId,
      positions: [
        vec3(-halfX, -halfY, halfZ),
        vec3(halfX, -halfY, halfZ),
        vec3(halfX, -halfY, -halfZ),
        vec3(-halfX, -halfY, -halfZ)
      ]
    },
    {
      id: `${node.id}:face:front`,
      materialId,
      positions: [
        vec3(-halfX, -halfY, halfZ),
        vec3(-halfX, halfY, halfZ),
        vec3(halfX, halfY, halfZ),
        vec3(halfX, -halfY, halfZ)
      ]
    },
    {
      id: `${node.id}:face:back`,
      materialId,
      positions: [
        vec3(halfX, -halfY, -halfZ),
        vec3(halfX, halfY, -halfZ),
        vec3(-halfX, halfY, -halfZ),
        vec3(-halfX, -halfY, -halfZ)
      ]
    }
  ];
}

function createTrianglePolygons(
  node: PrimitiveNode,
  geometry: BoxGeometry | ConeGeometry | CylinderGeometry | SphereGeometry
): EditableMeshPolygon[] {
  const nonIndexed = geometry.toNonIndexed();
  const positions = nonIndexed.getAttribute("position");
  const polygons: EditableMeshPolygon[] = [];

  for (let index = 0; index < positions.count; index += 3) {
    polygons.push({
      id: `${node.id}:face:${index / 3}`,
      materialId: node.data.materialId,
      positions: [
        vec3(
          positions.getX(index),
          positions.getY(index),
          positions.getZ(index)
        ),
        vec3(
          positions.getX(index + 1),
          positions.getY(index + 1),
          positions.getZ(index + 1)
        ),
        vec3(
          positions.getX(index + 2),
          positions.getY(index + 2),
          positions.getZ(index + 2)
        )
      ]
    });
  }

  nonIndexed.dispose();

  return polygons;
}

function attachPropMetadata(
  mesh: MeshNode["data"],
  node: PrimitiveNode
) {
  if (node.data.role !== "prop") {
    return mesh;
  }

  return {
    ...mesh,
    physics: structuredClone(node.data.physics),
    role: node.data.role
  };
}
