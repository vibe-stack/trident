import { buildEditableMeshFaceCutPreview, cutEditableMeshFace } from "@ggez/geometry-kernel";
import { type EditableMesh, type GeometryNode, type Vec3 } from "@ggez/shared";
import { useEffect, useMemo, useState } from "react";
import type { ViewportState } from "@ggez/render-pipeline";
import { NodeTransformGroup } from "@/viewport/components/NodeTransformGroup";
import { createMeshEditHandles } from "@/viewport/editing";
import { EditableFaceSelectionHitArea, PreviewLine } from "@/viewport/components/SelectionVisuals";
import { resolveViewportSnapSize } from "@/viewport/utils/snap";

export function MeshCutOverlay({
  faceId,
  mesh,
  node,
  onCommitCut,
  viewport
}: {
  faceId: string;
  mesh: EditableMesh;
  node: GeometryNode;
  onCommitCut: (mesh: EditableMesh) => void;
  viewport: ViewportState;
}) {
  const faceHandle = useMemo(
    () => createMeshEditHandles(mesh, "face").find((handle) => handle.id === faceId),
    [faceId, mesh]
  );
  const [preview, setPreview] = useState<{ end: Vec3; start: Vec3 }>();
  const snapSize = resolveViewportSnapSize(viewport);

  useEffect(() => {
    setPreview(undefined);
  }, [faceHandle?.id, mesh, node.id, snapSize]);

  if (!faceHandle?.points || faceHandle.points.length < 3) {
    return null;
  }

  return (
    <NodeTransformGroup transform={node.transform}>
      <EditableFaceSelectionHitArea
        normal={faceHandle.normal}
        onHover={(point) => {
          setPreview(buildEditableMeshFaceCutPreview(mesh, faceId, point, snapSize));
        }}
        onHoverEnd={() => setPreview(undefined)}
        onSelect={() => {}}
        onSelectPoint={(point) => {
          const nextMesh = cutEditableMeshFace(mesh, faceId, point, snapSize);

          if (nextMesh) {
            onCommitCut(nextMesh);
          }
        }}
        points={faceHandle.points}
        selected
      />
      {preview ? <PreviewLine color="#7dd3fc" end={preview.end} start={preview.start} /> : null}
    </NodeTransformGroup>
  );
}
