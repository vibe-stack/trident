import type { EditorCore, TransformAxis } from "@web-hammer/editor-core";
import type { GridSnapValue, DerivedRenderScene, ViewportState } from "@web-hammer/render-pipeline";
import type { Transform } from "@web-hammer/shared";
import type { ToolId } from "@web-hammer/tool-system";
import type { WorkerJob } from "@web-hammer/workers";
import { EditorMenuBar } from "@/components/editor-shell/EditorMenuBar";
import { InspectorSidebar } from "@/components/editor-shell/InspectorSidebar";
import { SceneSidebar } from "@/components/editor-shell/SceneSidebar";
import { StatusBar } from "@/components/editor-shell/StatusBar";
import { ToolPalette } from "@/components/editor-shell/ToolPalette";
import { ViewportCanvas } from "@/viewport/ViewportCanvas";

type EditorShellProps = {
  activeRightPanel: "inspector" | "materials";
  activeToolId: ToolId;
  canRedo: boolean;
  canUndo: boolean;
  editor: EditorCore;
  gridSnapValues: readonly GridSnapValue[];
  jobs: WorkerJob[];
  onAssignMaterial: (materialId: string) => void;
  onClipSelection: (axis: TransformAxis) => void;
  onDuplicateSelection: () => void;
  onClearSelection: () => void;
  onExportEngine: () => void;
  onExportGltf: () => void;
  onExtrudeSelection: (axis: TransformAxis, direction: -1 | 1) => void;
  onFocusNode: (nodeId: string) => void;
  onLoadWhmap: () => void;
  onPlaceEntity: (type: "spawn" | "light") => void;
  onMeshInflate: (factor: number) => void;
  onMirrorSelection: (axis: TransformAxis) => void;
  onPlaceAsset: (position: { x: number; y: number; z: number }) => void;
  onRedo: () => void;
  onSaveWhmap: () => void;
  onSelectAsset: (assetId: string) => void;
  onSelectMaterial: (materialId: string) => void;
  onSelectNodes: (nodeIds: string[]) => void;
  onSetRightPanel: (panel: "inspector" | "materials") => void;
  onSetSnapSize: (snapSize: GridSnapValue) => void;
  onSetToolId: (toolId: ToolId) => void;
  onTranslateSelection: (axis: TransformAxis, direction: -1 | 1) => void;
  onUndo: () => void;
  onUpdateNodeTransform: (nodeId: string, transform: Transform) => void;
  renderScene: DerivedRenderScene;
  selectedAssetId: string;
  selectedMaterialId: string;
  tools: Array<{ id: ToolId; label: string }>;
  viewport: ViewportState;
};

export function EditorShell({
  activeRightPanel,
  activeToolId,
  canRedo,
  canUndo,
  editor,
  gridSnapValues,
  jobs,
  onAssignMaterial,
  onClipSelection,
  onDuplicateSelection,
  onClearSelection,
  onExportEngine,
  onExportGltf,
  onExtrudeSelection,
  onFocusNode,
  onLoadWhmap,
  onPlaceEntity,
  onMeshInflate,
  onMirrorSelection,
  onPlaceAsset,
  onRedo,
  onSaveWhmap,
  onSelectAsset,
  onSelectMaterial,
  onSelectNodes,
  onSetRightPanel,
  onSetSnapSize,
  onSetToolId,
  onTranslateSelection,
  onUndo,
  onUpdateNodeTransform,
  renderScene,
  selectedAssetId,
  selectedMaterialId,
  tools,
  viewport
}: EditorShellProps) {
  const nodes = Array.from(editor.scene.nodes.values());
  const materials = Array.from(editor.scene.materials.values());
  const assets = Array.from(editor.scene.assets.values());
  const selectedNodeId = editor.selection.ids[0];
  const selectedNode = selectedNodeId ? editor.scene.getNode(selectedNodeId) : undefined;
  const activeToolLabel = tools.find((tool) => tool.id === activeToolId)?.label ?? activeToolId;

  return (
    <div className="flex h-screen flex-col bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.08),transparent_24%),linear-gradient(180deg,#08100d_0%,#050807_100%)] text-foreground">
      <header className="shrink-0 bg-black/18 backdrop-blur-xl">
        <EditorMenuBar
          canRedo={canRedo}
          canUndo={canUndo}
          onClearSelection={onClearSelection}
          onDuplicateSelection={onDuplicateSelection}
          onExportEngine={onExportEngine}
          onExportGltf={onExportGltf}
          onFocusSelection={() => {
            if (selectedNodeId) {
              onFocusNode(selectedNodeId);
            }
          }}
          onLoadWhmap={onLoadWhmap}
          onRedo={onRedo}
          onSaveWhmap={onSaveWhmap}
          onUndo={onUndo}
        />
      </header>

      <main className="relative min-h-0 flex-1">
        <ViewportCanvas
          activeToolId={activeToolId}
          onClearSelection={onClearSelection}
          onFocusNode={onFocusNode}
          onPlaceAsset={onPlaceAsset}
          onSelectNodes={onSelectNodes}
          renderScene={renderScene}
          selectedNodeIds={editor.selection.ids}
          viewport={viewport}
        />

        <ToolPalette
          activeToolId={activeToolId}
          currentSnapSize={viewport.grid.snapSize}
          gridSnapValues={gridSnapValues}
          onSetSnapSize={onSetSnapSize}
          onSetToolId={onSetToolId}
          tools={tools}
        />

        <SceneSidebar
          nodes={nodes}
          onFocusNode={onFocusNode}
          onSelectNodes={onSelectNodes}
          selectedNodeId={selectedNodeId}
        />

        <InspectorSidebar
          activeRightPanel={activeRightPanel}
          activeToolId={activeToolId}
          assets={assets}
          jobs={jobs}
          materials={materials}
          onAssignMaterial={onAssignMaterial}
          onChangeRightPanel={onSetRightPanel}
          onClipSelection={onClipSelection}
          onExtrudeSelection={onExtrudeSelection}
          onMeshInflate={onMeshInflate}
          onMirrorSelection={onMirrorSelection}
          onPlaceAsset={onPlaceAsset}
          onPlaceEntity={onPlaceEntity}
          onSelectAsset={onSelectAsset}
          onSelectMaterial={onSelectMaterial}
          onTranslateSelection={onTranslateSelection}
          onUpdateNodeTransform={onUpdateNodeTransform}
          selectedAssetId={selectedAssetId}
          selectedMaterialId={selectedMaterialId}
          selectedNode={selectedNode}
          viewportTarget={viewport.camera.target}
        />

        <StatusBar
          activeToolLabel={activeToolLabel}
          gridSnapValues={gridSnapValues}
          selectedNode={selectedNode}
          viewport={viewport}
        />
      </main>
    </div>
  );
}
