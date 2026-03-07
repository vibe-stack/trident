import type { GridSnapValue } from "@web-hammer/render-pipeline";
import type { ToolId } from "@web-hammer/tool-system";
import { MeshEditToolBars } from "@/components/editor-shell/MeshEditToolBars";
import { PrimaryToolBar } from "@/components/editor-shell/PrimaryToolBar";
import { SnapControl } from "@/components/editor-shell/SnapControl";
import type { MeshEditMode } from "@/viewport/editing";

type ToolPaletteProps = {
  activeToolId: ToolId;
  currentSnapSize: GridSnapValue;
  gridSnapValues: readonly GridSnapValue[];
  meshEditMode: MeshEditMode;
  onInvertSelectionNormals: () => void;
  onLowerTop: () => void;
  onMeshInflate: (factor: number) => void;
  onRaiseTop: () => void;
  onSetMeshEditMode: (mode: MeshEditMode) => void;
  onSetSnapEnabled: (enabled: boolean) => void;
  onSetSnapSize: (snapSize: GridSnapValue) => void;
  onSetToolId: (toolId: ToolId) => void;
  onSetTransformMode: (mode: "rotate" | "scale" | "translate") => void;
  selectedGeometry: boolean;
  selectedMesh: boolean;
  snapEnabled: boolean;
  tools: Array<{ id: ToolId; label: string }>;
  transformMode: "rotate" | "scale" | "translate";
};

export function ToolPalette({
  activeToolId,
  currentSnapSize,
  gridSnapValues,
  meshEditMode,
  onInvertSelectionNormals,
  onLowerTop,
  onMeshInflate,
  onRaiseTop,
  onSetMeshEditMode,
  onSetSnapEnabled,
  onSetSnapSize,
  onSetToolId,
  onSetTransformMode,
  selectedGeometry,
  selectedMesh,
  snapEnabled,
  tools
  ,transformMode
}: ToolPaletteProps) {
  return (
    <div className="pointer-events-none absolute left-1/2 top-4 z-20 flex -translate-x-1/2 flex-col items-center gap-2">
      <div className="flex items-stretch gap-3">
        <PrimaryToolBar activeToolId={activeToolId} onSetToolId={onSetToolId} tools={tools} />
        <SnapControl currentSnapSize={currentSnapSize} gridSnapValues={gridSnapValues} onSetSnapEnabled={onSetSnapEnabled} onSetSnapSize={onSetSnapSize} snapEnabled={snapEnabled} />
      </div>
      {activeToolId === "mesh-edit" ? (
        <MeshEditToolBars
          meshEditMode={meshEditMode}
          onDeflate={() => onMeshInflate(0.9)}
          onInflate={() => onMeshInflate(1.1)}
          onInvertNormals={onInvertSelectionNormals}
          onLowerTop={onLowerTop}
          onRaiseTop={onRaiseTop}
          onSetMeshEditMode={onSetMeshEditMode}
          onSetTransformMode={onSetTransformMode}
          selectedGeometry={selectedGeometry}
          selectedMesh={selectedMesh}
          transformMode={transformMode}
        />
      ) : null}
    </div>
  );
}
