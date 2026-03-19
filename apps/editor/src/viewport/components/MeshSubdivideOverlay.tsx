import { buildEditableMeshFaceSubdivisionPreview } from "@ggez/geometry-kernel";
import { type EditableMesh, type GeometryNode } from "@ggez/shared";
import { useMemo } from "react";
import { NodeTransformGroup } from "@/viewport/components/NodeTransformGroup";
import { BatchedHandleLineSegments, EditableFaceSelectionHitArea } from "@/viewport/components/SelectionVisuals";
import { createMeshEditHandles } from "@/viewport/editing";

export function MeshSubdivideOverlay({
  cuts,
  faceId,
  mesh,
  node,
  onCommitSubdivision
}: {
  cuts: number;
  faceId: string;
  mesh: EditableMesh;
  node: GeometryNode;
  onCommitSubdivision: () => void;
}) {
  const faceHandle = useMemo(
    () => createMeshEditHandles(mesh, "face").find((handle) => handle.id === faceId),
    [faceId, mesh]
  );
  const previewEdges = useMemo(
    () =>
      buildEditableMeshFaceSubdivisionPreview(mesh, faceId, cuts).map((edge, index) => ({
        id: `subdivide:${faceId}:${index}`,
        points: [edge.start, edge.end],
        position: edge.start,
        vertexIds: []
      })),
    [cuts, faceId, mesh]
  );

  if (!faceHandle?.points || faceHandle.points.length < 3) {
    return null;
  }

  return (
    <NodeTransformGroup transform={node.transform}>
      <EditableFaceSelectionHitArea
        normal={faceHandle.normal}
        onSelect={() => {}}
        onSelectPoint={() => {
          onCommitSubdivision();
        }}
        points={faceHandle.points}
        selected
      />
      <BatchedHandleLineSegments color="#ff4fd8" handles={previewEdges} />
    </NodeTransformGroup>
  );
}
