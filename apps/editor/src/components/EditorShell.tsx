import type { EditorCore } from "@web-hammer/editor-core";
import type { TransformAxis } from "@web-hammer/editor-core";
import type { DerivedRenderScene, GridSnapValue, ViewportState } from "@web-hammer/render-pipeline";
import { toTuple } from "@web-hammer/shared";
import type { ToolId } from "@web-hammer/tool-system";
import type { WorkerJob } from "@web-hammer/workers";
import { SidebarPanel } from "./SidebarPanel";
import { ViewportCanvas } from "../viewport/ViewportCanvas";

type EditorShellProps = {
  activeLeftPanel: "scene" | "assets";
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
  onExtrudeSelection: (axis: TransformAxis, direction: -1 | 1) => void;
  onFocusNode: (nodeId: string) => void;
  onPlaceEntity: (type: "spawn" | "light") => void;
  onMeshInflate: (factor: number) => void;
  onMirrorSelection: (axis: TransformAxis) => void;
  onPlaceAsset: (position: { x: number; y: number; z: number }) => void;
  onRedo: () => void;
  onSelectAsset: (assetId: string) => void;
  onSelectMaterial: (materialId: string) => void;
  onSelectNodes: (nodeIds: string[]) => void;
  onSetSnapSize: (snapSize: GridSnapValue) => void;
  onSetToolId: (toolId: ToolId) => void;
  onSetLeftPanel: (panel: "scene" | "assets") => void;
  onSetRightPanel: (panel: "inspector" | "materials") => void;
  onTranslateSelection: (axis: TransformAxis, direction: -1 | 1) => void;
  onUndo: () => void;
  renderScene: DerivedRenderScene;
  selectedAssetId: string;
  selectedMaterialId: string;
  tools: Array<{ id: ToolId; label: string }>;
  toolCount: number;
  viewport: ViewportState;
};

export function EditorShell({
  activeLeftPanel,
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
  onExtrudeSelection,
  onFocusNode,
  onPlaceEntity,
  onMeshInflate,
  onMirrorSelection,
  onPlaceAsset,
  onRedo,
  onSelectAsset,
  onSelectMaterial,
  onSelectNodes,
  onSetSnapSize,
  onSetToolId,
  onSetLeftPanel,
  onSetRightPanel,
  onTranslateSelection,
  onUndo,
  renderScene,
  selectedAssetId,
  selectedMaterialId,
  tools,
  toolCount,
  viewport
}: EditorShellProps) {
  const nodes = Array.from(editor.scene.nodes.values());
  const entities = Array.from(editor.scene.entities.values());
  const assets = Array.from(editor.scene.assets.values());
  const materials = Array.from(editor.scene.materials.values());
  const selectedNodeId = editor.selection.ids[0];
  const selectedNode = selectedNodeId ? editor.scene.getNode(selectedNodeId) : undefined;
  const hasSelection = editor.selection.ids.length > 0;
  const selectedIsBrush = selectedNode ? selectedNode.kind === "brush" : false;
  const selectedIsMesh = selectedNode ? selectedNode.kind === "mesh" : false;

  return (
    <div className="editor-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">WEB HAMMER</p>
          <h1>Source-2-style web level editor scaffold</h1>
        </div>

        <div className="topbar-stats">
          <span>{nodes.length} nodes</span>
          <span>{entities.length} entities</span>
          <span>{renderScene.meshes.length} drawables</span>
          <span>{editor.selection.ids.length} selected</span>
          <span>{jobs.length} jobs</span>
          <span>{toolCount} tools</span>
          <span>snap {viewport.grid.snapSize}</span>
        </div>
      </header>

      <main className="workspace">
        <SidebarPanel title="Scene" badge={activeLeftPanel}>
          <div className="toolbar-group">
            <button
              className={`chip-button${activeLeftPanel === "scene" ? " is-active" : ""}`}
              onClick={() => onSetLeftPanel("scene")}
              type="button"
            >
              Scene
            </button>
            <button
              className={`chip-button${activeLeftPanel === "assets" ? " is-active" : ""}`}
              onClick={() => onSetLeftPanel("assets")}
              type="button"
            >
              Assets
            </button>
          </div>

          <div className="toolbar-group">
            {tools.map((tool) => (
              <button
                key={tool.id}
                className={`chip-button${activeToolId === tool.id ? " is-active" : ""}`}
                onClick={() => onSetToolId(tool.id)}
                type="button"
              >
                {tool.label}
              </button>
            ))}
          </div>

          {activeLeftPanel === "scene" ? (
            <>
              <ul className="list">
                {nodes.map((node) => (
                  <li key={node.id}>
                    <button
                      className={`scene-item${selectedNodeId === node.id ? " is-selected" : ""}`}
                      onClick={() => onSelectNodes([node.id])}
                      onDoubleClick={() => onFocusNode(node.id)}
                      type="button"
                    >
                      <strong>{node.name}</strong>
                      <span>{node.kind}</span>
                    </button>
                  </li>
                ))}
              </ul>

              <div className="toolbar-group">
                <button className="chip-button" onClick={() => onPlaceEntity("spawn")} type="button">
                  Add Spawn
                </button>
                <button className="chip-button" onClick={() => onPlaceEntity("light")} type="button">
                  Add Light
                </button>
              </div>

              <ul className="list compact-list">
                {entities.map((entity) => (
                  <li key={entity.id}>
                    <div className="list-card">
                      <strong>{entity.type}</strong>
                      <span>{entity.id}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <ul className="list">
              {assets.map((asset) => (
                <li key={asset.id}>
                  <button
                    className={`scene-item${selectedAssetId === asset.id ? " is-selected" : ""}`}
                    onClick={() => onSelectAsset(asset.id)}
                    type="button"
                  >
                    <strong>{asset.id.split(":").slice(-1)[0]}</strong>
                    <span>{asset.path}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <p className="panel-hint">Click objects or scene items to select. Double-click to focus. Shift-drag in the viewport for marquee selection.</p>
        </SidebarPanel>

        <section className="viewport-panel">
          <div className="viewport-toolbar">
            <span>tool {activeToolId}</span>
            <span>{viewport.projection} camera</span>
            <span>snap set {gridSnapValues.join(" / ")}</span>
            <span>grid {viewport.grid.size}u</span>
            <span>click select / double-click focus / Shift-drag marquee / empty click clear</span>
            {selectedNode ? (
              <span>
                focus {selectedNode.name} @ {toTuple(selectedNode.transform.position).join(", ")}
              </span>
            ) : null}
          </div>

          <div className="viewport-subtoolbar">
            <div className="toolbar-group">
              {gridSnapValues.map((snapValue) => (
                <button
                  key={snapValue}
                  className={`chip-button${viewport.grid.snapSize === snapValue ? " is-active" : ""}`}
                  onClick={() => onSetSnapSize(snapValue)}
                  type="button"
                >
                  snap {snapValue}
                </button>
              ))}
            </div>

            <div className="toolbar-group">
              <button className="chip-button" disabled={!canUndo} onClick={onUndo} type="button">
                Undo
              </button>
              <button className="chip-button" disabled={!canRedo} onClick={onRedo} type="button">
                Redo
              </button>
            </div>
          </div>

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
        </section>

        <SidebarPanel title="Inspector" badge={activeRightPanel}>
          <div className="toolbar-group">
            <button
              className={`chip-button${activeRightPanel === "inspector" ? " is-active" : ""}`}
              onClick={() => onSetRightPanel("inspector")}
              type="button"
            >
              Inspector
            </button>
            <button
              className={`chip-button${activeRightPanel === "materials" ? " is-active" : ""}`}
              onClick={() => onSetRightPanel("materials")}
              type="button"
            >
              Materials
            </button>
          </div>

          {activeRightPanel === "materials" ? (
            <>
              <ul className="list">
                {materials.map((material) => (
                  <li key={material.id}>
                    <button
                      className={`scene-item${selectedMaterialId === material.id ? " is-selected" : ""}`}
                      onClick={() => onSelectMaterial(material.id)}
                      type="button"
                    >
                      <strong>{material.name}</strong>
                      <span>{material.color}</span>
                    </button>
                  </li>
                ))}
              </ul>
              <div className="toolbar-group">
                <button className="chip-button" disabled={!selectedIsBrush} onClick={() => onAssignMaterial(selectedMaterialId)} type="button">
                  Apply To Brush
                </button>
              </div>
            </>
          ) : selectedNode ? (
            <div className="inspector-stack">
              <div>
                <p className="label">Node</p>
                <strong>{selectedNode.name}</strong>
              </div>
              <div>
                <p className="label">Kind</p>
                <strong>{selectedNode.kind}</strong>
              </div>
              <div>
                <p className="label">Position</p>
                <strong>{toTuple(selectedNode.transform.position).join(", ")}</strong>
              </div>
              <div>
                <p className="label">Scale</p>
                <strong>{toTuple(selectedNode.transform.scale).join(", ")}</strong>
              </div>
              <div>
                <p className="label">Camera Target</p>
                <strong>{toTuple(viewport.camera.target).join(", ")}</strong>
              </div>
              <div>
                <p className="label">Selection Mode</p>
                <strong>{editor.selection.mode}</strong>
              </div>

              {activeToolId === "transform" ? (
                <div className="inspector-actions">
                  <p className="label">Transform</p>
                  <div className="toolbar-group">
                    <button className="chip-button" disabled={!hasSelection} onClick={() => onTranslateSelection("x", -1)} type="button">
                      X-
                    </button>
                    <button className="chip-button" disabled={!hasSelection} onClick={() => onTranslateSelection("x", 1)} type="button">
                      X+
                    </button>
                    <button className="chip-button" disabled={!hasSelection} onClick={() => onTranslateSelection("y", -1)} type="button">
                      Y-
                    </button>
                    <button className="chip-button" disabled={!hasSelection} onClick={() => onTranslateSelection("y", 1)} type="button">
                      Y+
                    </button>
                    <button className="chip-button" disabled={!hasSelection} onClick={() => onTranslateSelection("z", -1)} type="button">
                      Z-
                    </button>
                    <button className="chip-button" disabled={!hasSelection} onClick={() => onTranslateSelection("z", 1)} type="button">
                      Z+
                    </button>
                  </div>
                  <div className="toolbar-group">
                    <button className="chip-button" disabled={!hasSelection} onClick={onDuplicateSelection} type="button">
                      Duplicate
                    </button>
                    <button className="chip-button" disabled={!hasSelection} onClick={() => onMirrorSelection("x")} type="button">
                      Mirror X
                    </button>
                    <button className="chip-button" disabled={!hasSelection} onClick={() => onMirrorSelection("y")} type="button">
                      Mirror Y
                    </button>
                    <button className="chip-button" disabled={!hasSelection} onClick={() => onMirrorSelection("z")} type="button">
                      Mirror Z
                    </button>
                  </div>
                  <p className="panel-hint">`2` activates transform mode. Arrow keys move in X/Z, `PageUp`/`PageDown` move Y, `Ctrl/Cmd+D` duplicates, `Ctrl/Cmd+Z` undoes.</p>
                </div>
              ) : null}

              {activeToolId === "clip" ? (
                <div className="inspector-actions">
                  <p className="label">Clip</p>
                  <div className="toolbar-group">
                    <button className="chip-button" disabled={!selectedIsBrush} onClick={() => onClipSelection("x")} type="button">
                      Split X
                    </button>
                    <button className="chip-button" disabled={!selectedIsBrush} onClick={() => onClipSelection("y")} type="button">
                      Split Y
                    </button>
                    <button className="chip-button" disabled={!selectedIsBrush} onClick={() => onClipSelection("z")} type="button">
                      Split Z
                    </button>
                  </div>
                  <p className="panel-hint">`3` activates clip mode. The current baseline splits axis-aligned box brushes through their center and keeps both halves.</p>
                </div>
              ) : null}

              {activeToolId === "extrude" ? (
                <div className="inspector-actions">
                  <p className="label">Extrude</p>
                  <div className="toolbar-group">
                    <button className="chip-button" disabled={!selectedIsBrush} onClick={() => onExtrudeSelection("x", -1)} type="button">
                      X-
                    </button>
                    <button className="chip-button" disabled={!selectedIsBrush} onClick={() => onExtrudeSelection("x", 1)} type="button">
                      X+
                    </button>
                    <button className="chip-button" disabled={!hasSelection} onClick={() => onExtrudeSelection("y", -1)} type="button">
                      Y-
                    </button>
                    <button className="chip-button" disabled={!hasSelection} onClick={() => onExtrudeSelection("y", 1)} type="button">
                      Y+
                    </button>
                    <button className="chip-button" disabled={!selectedIsBrush} onClick={() => onExtrudeSelection("z", -1)} type="button">
                      Z-
                    </button>
                    <button className="chip-button" disabled={!selectedIsBrush} onClick={() => onExtrudeSelection("z", 1)} type="button">
                      Z+
                    </button>
                  </div>
                  <p className="panel-hint">`4` activates extrude mode. Brushes extrude along the chosen axis; mesh objects currently raise their top vertices on Y.</p>
                </div>
              ) : null}

              {activeToolId === "mesh-edit" ? (
                <div className="inspector-actions">
                  <p className="label">Mesh Edit</p>
                  <div className="toolbar-group">
                    <button className="chip-button" disabled={!selectedIsMesh} onClick={() => onMeshInflate(1.1)} type="button">
                      Inflate
                    </button>
                    <button className="chip-button" disabled={!selectedIsMesh} onClick={() => onMeshInflate(0.9)} type="button">
                      Deflate
                    </button>
                    <button className="chip-button" disabled={!selectedIsMesh} onClick={() => onExtrudeSelection("y", 1)} type="button">
                      Raise Top
                    </button>
                    <button className="chip-button" disabled={!selectedIsMesh} onClick={() => onExtrudeSelection("y", -1)} type="button">
                      Lower Top
                    </button>
                  </div>
                  <p className="panel-hint">`5` activates mesh edit mode. The current baseline supports object-level inflate/deflate and top-vertex offset editing.</p>
                </div>
              ) : null}

              {activeToolId === "asset-place" ? (
                <div className="inspector-actions">
                  <p className="label">Asset Place</p>
                  <div className="toolbar-group">
                    <button
                      className="chip-button"
                      onClick={() =>
                        onPlaceAsset({
                          x: viewport.camera.target.x,
                          y: 0,
                          z: viewport.camera.target.z
                        })
                      }
                      type="button"
                    >
                      Place Crate
                    </button>
                  </div>
                  <p className="panel-hint">`6` activates asset place mode. Click the ground grid to drop a crate prop snapped to the current grid size.</p>
                </div>
              ) : null}

              {jobs.length > 0 ? (
                <div className="inspector-actions">
                  <p className="label">Worker Queue</p>
                  <ul className="list compact-list">
                    {jobs.map((job) => (
                      <li key={job.id}>
                        <div className="list-card">
                          <strong>{job.label}</strong>
                          <span>
                            {job.task.worker} / {job.status}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : (
            <p>No selection. Click a node in the scene list or viewport to start editing.</p>
          )}
        </SidebarPanel>
      </main>
    </div>
  );
}
