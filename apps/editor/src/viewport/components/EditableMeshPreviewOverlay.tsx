import { getFaceVertices, triangulateMeshFace } from "@ggez/geometry-kernel";
import { type EditableMesh, type GeometryNode, type Vec3 } from "@ggez/shared";
import { useEffect, useRef, useState } from "react";
import { BufferGeometry, DoubleSide, Float32BufferAttribute, Uint32BufferAttribute } from "three";
import { NodeTransformGroup } from "@/viewport/components/NodeTransformGroup";

export function EditableMeshPreviewOverlay({
  mesh,
  node,
  presentation = "overlay"
}: {
  mesh: EditableMesh;
  node: GeometryNode;
  presentation?: "overlay" | "solid";
}) {
  const geometryRef = useRef<BufferGeometry>(new BufferGeometry());
  const wireframeGeometryRef = useRef<BufferGeometry>(new BufferGeometry());
  const [hasSurfaceGeometry, setHasSurfaceGeometry] = useState(false);
  const [hasWireframeGeometry, setHasWireframeGeometry] = useState(false);

  useEffect(() => {
    const faceData = mesh.faces
      .map((face) => {
        const triangulated = triangulateMeshFace(mesh, face.id);

        if (!triangulated) {
          return undefined;
        }

        return {
          indices: triangulated.indices,
          positions: getFaceVertices(mesh, face.id).map((vertex) => vertex.position)
        };
      })
      .filter((face): face is { indices: number[]; positions: Vec3[] } => Boolean(face));

    if (faceData.length === 0) {
      clearGeometry(geometryRef.current);
      setHasSurfaceGeometry(false);
      return;
    }

    const positions: number[] = [];
    const indices: number[] = [];
    let vertexOffset = 0;

    faceData.forEach((face) => {
      face.positions.forEach((position) => {
        positions.push(position.x, position.y, position.z);
      });
      face.indices.forEach((index) => {
        indices.push(vertexOffset + index);
      });
      vertexOffset += face.positions.length;
    });

    syncIndexedGeometry(geometryRef.current, positions, indices);
    geometryRef.current.computeVertexNormals();
    geometryRef.current.computeBoundingBox();
    geometryRef.current.computeBoundingSphere();
    setHasSurfaceGeometry(true);
  }, [mesh]);

  useEffect(() => {
    const verticesById = new Map(mesh.vertices.map((vertex) => [vertex.id, vertex.position] as const));
    const halfEdgesById = new Map(mesh.halfEdges.map((halfEdge) => [halfEdge.id, halfEdge] as const));
    const segments: number[] = [];
    const seenEdges = new Set<string>();

    mesh.halfEdges.forEach((halfEdge) => {
      if (!halfEdge.next) {
        return;
      }

      const nextHalfEdge = halfEdgesById.get(halfEdge.next);

      if (!nextHalfEdge) {
        return;
      }

      const start = verticesById.get(halfEdge.vertex);
      const end = verticesById.get(nextHalfEdge.vertex);

      if (!start || !end) {
        return;
      }

      const edgeKey = halfEdge.vertex < nextHalfEdge.vertex
        ? `${halfEdge.vertex}|${nextHalfEdge.vertex}`
        : `${nextHalfEdge.vertex}|${halfEdge.vertex}`;

      if (seenEdges.has(edgeKey)) {
        return;
      }

      seenEdges.add(edgeKey);
      segments.push(start.x, start.y, start.z, end.x, end.y, end.z);
    });

    if (segments.length === 0) {
      clearGeometry(wireframeGeometryRef.current);
      setHasWireframeGeometry(false);
      return;
    }

    syncLineGeometry(wireframeGeometryRef.current, segments);
    wireframeGeometryRef.current.computeBoundingBox();
    wireframeGeometryRef.current.computeBoundingSphere();
    setHasWireframeGeometry(true);
  }, [mesh]);

  useEffect(
    () => () => {
      geometryRef.current.dispose();
      wireframeGeometryRef.current.dispose();
    },
    []
  );

  if (!hasSurfaceGeometry) {
    return null;
  }

  return (
    <NodeTransformGroup transform={node.transform}>
      <mesh geometry={geometryRef.current} renderOrder={11}>
        {presentation === "solid" ? (
          <meshStandardMaterial
            color="#78c4b7"
            depthWrite
            emissive="#1f6f63"
            emissiveIntensity={0.08}
            metalness={0.04}
            roughness={0.82}
            side={DoubleSide}
          />
        ) : (
          <meshStandardMaterial
            color="#8b5cf6"
            depthWrite={false}
            emissive="#6d28d9"
            emissiveIntensity={0.24}
            opacity={0.48}
            polygonOffset
            polygonOffsetFactor={-2}
            polygonOffsetUnits={-2}
            side={DoubleSide}
            transparent
          />
        )}
      </mesh>
      {hasWireframeGeometry && presentation === "overlay" ? (
        <lineSegments geometry={wireframeGeometryRef.current} renderOrder={12}>
          <lineBasicMaterial color="#f8fafc" depthWrite={false} opacity={0.95} toneMapped={false} transparent />
        </lineSegments>
      ) : null}
    </NodeTransformGroup>
  );
}

function clearGeometry(geometry: BufferGeometry) {
  geometry.deleteAttribute("position");
  geometry.deleteAttribute("normal");
  geometry.setIndex(null);
}

function syncIndexedGeometry(geometry: BufferGeometry, positions: number[], indices: number[]) {
  syncFloatAttribute(geometry, "position", positions, 3);
  geometry.setIndex(new Uint32BufferAttribute(indices, 1));
  geometry.deleteAttribute("normal");
}

function syncLineGeometry(geometry: BufferGeometry, positions: number[]) {
  syncFloatAttribute(geometry, "position", positions, 3);
}

function syncFloatAttribute(
  geometry: BufferGeometry,
  attributeName: string,
  values: number[],
  itemSize: number
) {
  const current = geometry.getAttribute(attributeName);

  if (!(current instanceof Float32BufferAttribute) || current.array.length !== values.length) {
    geometry.setAttribute(attributeName, new Float32BufferAttribute(values, itemSize));
    return;
  }

  current.array.set(values);
  current.needsUpdate = true;
}
