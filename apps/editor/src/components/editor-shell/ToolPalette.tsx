import type { GridSnapValue } from "@web-hammer/render-pipeline";
import type { ToolId } from "@web-hammer/tool-system";
import { MeshEditToolBars } from "@/components/editor-shell/MeshEditToolBars";
import { PrimaryToolBar } from "@/components/editor-shell/PrimaryToolBar";
import { SnapControl } from "@/components/editor-shell/SnapControl";
import { ViewModeControl } from "@/components/editor-shell/ViewModeControl";
import type { MeshEditMode } from "@/viewport/editing";
import type { ViewModeId } from "@/viewport/viewports";

type ToolPaletteProps = {
  activeToolId: ToolId;
  currentSnapSize: GridSnapValue;
  gridSnapValues: readonly GridSnapValue[];
  meshEditMode: MeshEditMode;
  onMeshEditToolbarAction: (action: "arc" | "bevel" | "cut" | "delete" | "extrude" | "fill-face" | "invert-normals" | "merge" | "subdivide") => void;
  onInvertSelectionNormals: () => void;
  onLowerTop: () => void;
  onMeshInflate: (factor: number) => void;
  onRaiseTop: () => void;
  onSetMeshEditMode: (mode: MeshEditMode) => void;
  onSetSnapEnabled: (enabled: boolean) => void;
  onSetSnapSize: (snapSize: GridSnapValue) => void;
  onSetToolId: (toolId: ToolId) => void;
  onSetTransformMode: (mode: "rotate" | "scale" | "translate") => void;
  onSetViewMode: (viewMode: ViewModeId) => void;
  selectedGeometry: boolean;
  selectedMesh: boolean;
  snapEnabled: boolean;
  tools: Array<{ id: ToolId; label: string }>;
  transformMode: "rotate" | "scale" | "translate";
  viewMode: ViewModeId;
};

export function ToolPalette({
  activeToolId,
  currentSnapSize,
  gridSnapValues,
  meshEditMode,
  onMeshEditToolbarAction,
  onInvertSelectionNormals,
  onLowerTop,
  onMeshInflate,
  onRaiseTop,
  onSetMeshEditMode,
  onSetSnapEnabled,
  onSetSnapSize,
  onSetToolId,
  onSetTransformMode,
  onSetViewMode,
  selectedGeometry,
  selectedMesh,
  snapEnabled,
  transformMode,
  tools,
  viewMode
}: ToolPaletteProps) {
  return (
    <div className="pointer-events-none absolute left-1/2 top-4 z-20 flex -translate-x-1/2 flex-col items-center gap-2">
      <div className="flex items-stretch gap-3">
        <ViewModeControl currentViewMode={viewMode} onSetViewMode={onSetViewMode} />
        <PrimaryToolBar activeToolId={activeToolId} onSetToolId={onSetToolId} tools={tools} />
        <SnapControl currentSnapSize={currentSnapSize} gridSnapValues={gridSnapValues} onSetSnapEnabled={onSetSnapEnabled} onSetSnapSize={onSetSnapSize} snapEnabled={snapEnabled} />
      </div>
      {activeToolId === "mesh-edit" ? (
        <MeshEditToolBars
          onArc={() => onMeshEditToolbarAction("arc")}
          onBevel={() => onMeshEditToolbarAction("bevel")}
          onCut={() => onMeshEditToolbarAction("cut")}
          onDelete={() => onMeshEditToolbarAction("delete")}
          onExtrude={() => onMeshEditToolbarAction("extrude")}
          meshEditMode={meshEditMode}
          onFillFace={() => onMeshEditToolbarAction("fill-face")}
          onDeflate={() => onMeshInflate(0.9)}
          onInflate={() => onMeshInflate(1.1)}
          onInvertNormals={() => onMeshEditToolbarAction("invert-normals")}
          onLowerTop={onLowerTop}
          onMerge={() => onMeshEditToolbarAction("merge")}
          onRaiseTop={onRaiseTop}
          onSetMeshEditMode={onSetMeshEditMode}
          onSubdivide={() => onMeshEditToolbarAction("subdivide")}
          onSetTransformMode={onSetTransformMode}
          selectedGeometry={selectedGeometry}
          selectedMesh={selectedMesh}
          transformMode={transformMode}
        />
      ) : null}
    </div>
  );
}
