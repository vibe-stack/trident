import { reconstructBrushFaces, triangulateEditableMesh } from "@web-hammer/geometry-kernel";
import type { Asset, AssetID, GeometryNode, Material, MaterialID, NodeID, Vec3 } from "@web-hammer/shared";
import { isBrushNode, isMeshNode, isModelNode } from "@web-hammer/shared";

export type RenderPrimitive =
  | {
      kind: "box";
      size: Vec3;
    }
  | {
      kind: "icosahedron";
      radius: number;
      detail: number;
    }
  | {
      kind: "cylinder";
      radiusTop: number;
      radiusBottom: number;
      height: number;
      radialSegments: number;
    };

export type RenderMaterial = {
  color: string;
  flatShaded: boolean;
  wireframe: boolean;
};

export type DerivedSurfaceGeometry = {
  positions: number[];
  indices: number[];
};

export type DerivedRenderMesh = {
  nodeId: NodeID;
  sourceKind: GeometryNode["kind"];
  dirty: boolean;
  bvhEnabled: boolean;
  label: string;
  position: Vec3;
  rotation: Vec3;
  scale: Vec3;
  primitive?: RenderPrimitive;
  surface?: DerivedSurfaceGeometry;
  material: RenderMaterial;
};

export function createDerivedRenderMesh(
  node: GeometryNode,
  materialsById = new Map<MaterialID, Material>(),
  assetsById = new Map<AssetID, Asset>()
): DerivedRenderMesh {
  const appearance = getRenderAppearance(node, materialsById, assetsById);
  const surface = isBrushNode(node)
    ? createBrushSurface(node.data)
    : isMeshNode(node)
      ? createEditableMeshSurface(node.data)
      : undefined;

  return {
    nodeId: node.id,
    sourceKind: node.kind,
    dirty: false,
    bvhEnabled: true,
    label: `${node.name} (${appearance.primitiveLabel})`,
    position: node.transform.position,
    rotation: node.transform.rotation,
    scale: node.transform.scale,
    primitive: isModelNode(node)
      ? {
            kind: "cylinder",
            radiusTop: 0.65,
            radiusBottom: 0.65,
            height: 2.2,
            radialSegments: 12
          }
      : undefined,
    surface,
    material: {
      color: appearance.color,
      flatShaded: appearance.flatShaded,
      wireframe: appearance.wireframe
    }
  };
}

function getRenderAppearance(
  node: GeometryNode,
  materialsById: Map<MaterialID, Material>,
  assetsById: Map<AssetID, Asset>
): {
  color: string;
  flatShaded: boolean;
  wireframe: boolean;
  primitiveLabel: string;
} {
  if (isBrushNode(node)) {
    const materialId = node.data.faces[0]?.materialId;
    const materialColor = materialId ? materialsById.get(materialId)?.color : undefined;

    return {
      color: materialColor ?? "#f69036",
      flatShaded: true,
      wireframe: false,
      primitiveLabel: "box"
    };
  }

  if (isMeshNode(node)) {
    return {
      color: "#6ed5c0",
      flatShaded: true,
      wireframe: true,
      primitiveLabel: "poly"
    };
  }

  if (isModelNode(node)) {
    const previewColor = assetsById.get(node.data.assetId)?.metadata.previewColor;

    return {
      color: typeof previewColor === "string" ? previewColor : "#7f8ea3",
      flatShaded: false,
      wireframe: false,
      primitiveLabel: "model"
    };
  }

  return {
    color: "#ffffff",
    flatShaded: false,
    wireframe: false,
    primitiveLabel: "mesh"
  };
}

function createBrushSurface(node: Extract<GeometryNode, { kind: "brush" }>["data"]): DerivedSurfaceGeometry | undefined {
  const rebuilt = reconstructBrushFaces(node);

  if (!rebuilt.valid || rebuilt.faces.length === 0) {
    return undefined;
  }

  const positions: number[] = [];
  const indices: number[] = [];
  let vertexOffset = 0;

  rebuilt.faces.forEach((face) => {
    face.vertices.forEach((vertex) => {
      positions.push(vertex.position.x, vertex.position.y, vertex.position.z);
    });

    face.triangleIndices.forEach((index) => {
      indices.push(vertexOffset + index);
    });

    vertexOffset += face.vertices.length;
  });

  return {
    positions,
    indices
  };
}

function createEditableMeshSurface(node: Extract<GeometryNode, { kind: "mesh" }>["data"]): DerivedSurfaceGeometry | undefined {
  const triangulated = triangulateEditableMesh(node);

  if (!triangulated.valid) {
    return undefined;
  }

  return {
    positions: triangulated.positions,
    indices: triangulated.indices
  };
}
