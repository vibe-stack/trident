import { useEffect, useMemo, useState } from "react";
import { useSnapshot } from "valtio";
import {
  axisDelta,
  createAssignMaterialToBrushesCommand,
  createExtrudeBrushNodesCommand,
  createDuplicateNodesCommand,
  createEditorCore,
  createPlaceEntityCommand,
  createMeshInflateCommand,
  createMeshRaiseTopCommand,
  createMirrorNodesCommand,
  createPlaceModelNodeCommand,
  createSeedSceneDocument,
  createSplitBrushNodesCommand,
  createTranslateNodesCommand,
  type TransformAxis
} from "@web-hammer/editor-core";
import { deriveRenderScene, gridSnapValues } from "@web-hammer/render-pipeline";
import { addVec3, isBrushNode, isMeshNode, makeTransform, snapVec3, subVec3, vec3, type Vec3 } from "@web-hammer/shared";
import { createToolSession, defaultToolId, defaultTools, type ToolId } from "@web-hammer/tool-system";
import { createWorkerTaskManager, type WorkerJob } from "@web-hammer/workers";
import { EditorShell } from "../components/EditorShell";
import { uiStore } from "../state/ui-store";

export function App() {
  const [editor] = useState(() => createEditorCore(createSeedSceneDocument()));
  const [activeToolId, setActiveToolId] = useState<ToolId>(defaultToolId);
  const [workerManager] = useState(() => createWorkerTaskManager());
  const [workerJobs, setWorkerJobs] = useState<WorkerJob[]>([]);
  const [, setRevision] = useState(0);
  const ui = useSnapshot(uiStore);
  const toolSession = useMemo(() => createToolSession(activeToolId), [activeToolId]);
  const renderScene = deriveRenderScene(
    editor.scene.nodes.values(),
    editor.scene.entities.values(),
    editor.scene.materials.values(),
    editor.scene.assets.values()
  );

  useEffect(() => {
    const unsubscribeScene = editor.events.on("scene:changed", () => {
      setRevision((revision) => revision + 1);
    });
    const unsubscribeSelection = editor.events.on("selection:changed", () => {
      setRevision((revision) => revision + 1);
    });

    if (editor.selection.ids.length === 0) {
      const firstNode = editor.scene.nodes.values().next().value;

      if (firstNode) {
        editor.select([firstNode.id], "object");
      }
    }

    return () => {
      unsubscribeScene();
      unsubscribeSelection();
    };
  }, [editor]);

  useEffect(() => workerManager.subscribe(setWorkerJobs), [workerManager]);

  const handleSelectNodes = (nodeIds: string[]) => {
    editor.select(nodeIds, "object");
  };

  const handleSetToolId = (toolId: ToolId) => {
    setActiveToolId(toolId);
  };

  const handleSetLeftPanel = (panel: "scene" | "assets") => {
    uiStore.leftPanel = panel;
  };

  const handleSetRightPanel = (panel: "inspector" | "materials") => {
    uiStore.rightPanel = panel;
  };

  const handleClearSelection = () => {
    editor.clearSelection();
  };

  const handleFocusNode = (nodeId: string) => {
    const node = editor.scene.getNode(nodeId);

    if (!node) {
      return;
    }

    const currentTarget = uiStore.viewport.camera.target;
    const currentPosition = uiStore.viewport.camera.position;
    const orbitOffset = subVec3(currentPosition, currentTarget);

    uiStore.viewport.camera.target = vec3(
      node.transform.position.x,
      node.transform.position.y,
      node.transform.position.z
    );
    uiStore.viewport.camera.position = addVec3(node.transform.position, orbitOffset);
  };

  const handleSetSnapSize = (snapSize: (typeof gridSnapValues)[number]) => {
    uiStore.viewport.grid.snapSize = snapSize;
  };

  const enqueueWorkerJob = (label: string, task: Parameters<typeof workerManager.enqueue>[0], durationMs?: number) => {
    workerManager.enqueue(task, label, durationMs);
  };

  const handleTranslateSelection = (axis: TransformAxis, direction: -1 | 1) => {
    if (editor.selection.ids.length === 0) {
      return;
    }

    const delta = axisDelta(axis, uiStore.viewport.grid.snapSize * direction);
    editor.execute(createTranslateNodesCommand(editor.selection.ids, delta));
    enqueueWorkerJob("Geometry rebuild", { task: "brush-rebuild", worker: "geometryWorker" }, 700);
  };

  const handleDuplicateSelection = () => {
    if (editor.selection.ids.length === 0) {
      return;
    }

    const { command, duplicateIds } = createDuplicateNodesCommand(
      editor.scene,
      editor.selection.ids,
      axisDelta("x", uiStore.viewport.grid.snapSize)
    );

    editor.execute(command);
    editor.select(duplicateIds, "object");
    enqueueWorkerJob("Duplicate selection", { task: "triangulation", worker: "geometryWorker" }, 700);
  };

  const handleMirrorSelection = (axis: TransformAxis) => {
    if (editor.selection.ids.length === 0) {
      return;
    }

    editor.execute(createMirrorNodesCommand(editor.selection.ids, axis));
    enqueueWorkerJob("Mirror selection", { task: "triangulation", worker: "geometryWorker" }, 700);
  };

  const handleClipSelection = (axis: TransformAxis) => {
    const { command, splitIds } = createSplitBrushNodesCommand(editor.scene, editor.selection.ids, axis);

    if (splitIds.length === 0) {
      return;
    }

    editor.execute(command);
    editor.select(splitIds, "object");
    enqueueWorkerJob("Clip brush", { task: "clip", worker: "geometryWorker" }, 950);
  };

  const handleExtrudeSelection = (axis: TransformAxis, direction: -1 | 1) => {
    if (editor.selection.ids.length === 0) {
      return;
    }

    const selectedNode = editor.scene.getNode(editor.selection.ids[0]);

    if (selectedNode && isBrushNode(selectedNode)) {
      editor.execute(
        createExtrudeBrushNodesCommand(
          editor.scene,
          editor.selection.ids,
          axis,
          uiStore.viewport.grid.snapSize,
          direction
        )
      );
      enqueueWorkerJob("Brush extrude", { task: "brush-rebuild", worker: "geometryWorker" }, 950);
      return;
    }

    if (selectedNode && isMeshNode(selectedNode) && axis === "y") {
      editor.execute(
        createMeshRaiseTopCommand(editor.scene, editor.selection.ids, uiStore.viewport.grid.snapSize * direction)
      );
      enqueueWorkerJob("Mesh triangulation", { task: "triangulation", worker: "meshWorker" }, 850);
    }
  };

  const handleMeshInflate = (factor: number) => {
    if (editor.selection.ids.length === 0) {
      return;
    }

    editor.execute(createMeshInflateCommand(editor.scene, editor.selection.ids, factor));
    enqueueWorkerJob("Mesh edit", { task: "bevel", worker: "meshWorker" }, 850);
  };

  const handlePlaceAsset = (position: Vec3) => {
    const snapped = snapVec3(position, uiStore.viewport.grid.snapSize);
    const asset = editor.scene.assets.get(uiStore.selectedAssetId);

    if (!asset || asset.type !== "model") {
      return;
    }

    const label = asset.id.endsWith("barrel") ? "Barrel Prop" : "Crate Prop";
    const { command, nodeId } = createPlaceModelNodeCommand(editor.scene, vec3(snapped.x, 1.1, snapped.z), {
      data: {
        assetId: asset.id,
        path: asset.path
      },
      name: label
    });

    editor.execute(command);
    editor.select([nodeId], "object");
    enqueueWorkerJob("Asset placement", { task: "triangulation", worker: "geometryWorker" }, 650);
  };

  const handleAssignMaterial = (materialId: string) => {
    if (editor.selection.ids.length === 0) {
      return;
    }

    uiStore.selectedMaterialId = materialId;
    editor.execute(createAssignMaterialToBrushesCommand(editor.scene, editor.selection.ids, materialId));
    enqueueWorkerJob("Material preview rebuild", { task: "triangulation", worker: "geometryWorker" }, 600);
  };

  const handleSelectAsset = (assetId: string) => {
    uiStore.selectedAssetId = assetId;
  };

  const handleSelectMaterial = (materialId: string) => {
    uiStore.selectedMaterialId = materialId;
  };

  const handlePlaceEntity = (type: "spawn" | "light") => {
    const position = vec3(
      uiStore.viewport.camera.target.x,
      type === "light" ? 3 : 1,
      uiStore.viewport.camera.target.z
    );
    const entityId = `entity:${type}:${editor.scene.entities.size + 1}`;
    editor.execute(
      createPlaceEntityCommand({
        id: entityId,
        properties:
          type === "light"
            ? { color: "#ffd089", enabled: true, intensity: 500 }
            : { enabled: true, team: "player" },
        transform: makeTransform(position),
        type
      })
    );
    enqueueWorkerJob("Entity authoring", { task: "navmesh", worker: "navWorker" }, 800);
  };

  const handleUndo = () => {
    editor.undo();
  };

  const handleRedo = () => {
    editor.redo();
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target;

      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }

      const modifier = event.metaKey || event.ctrlKey;

      if (modifier && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
        return;
      }

      if (modifier && event.key.toLowerCase() === "d") {
        event.preventDefault();
        handleDuplicateSelection();
        return;
      }

      if (event.key === "1") {
        handleSetToolId("select");
        return;
      }

      if (event.key === "2") {
        handleSetToolId("transform");
        return;
      }

      if (event.key === "3") {
        handleSetToolId("clip");
        return;
      }

      if (event.key === "4") {
        handleSetToolId("extrude");
        return;
      }

      if (event.key === "5") {
        handleSetToolId("mesh-edit");
        return;
      }

      if (event.key === "6") {
        handleSetToolId("asset-place");
        return;
      }

      if (activeToolId !== "transform") {
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        handleTranslateSelection("x", -1);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        handleTranslateSelection("x", 1);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        handleTranslateSelection("z", -1);
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        handleTranslateSelection("z", 1);
      } else if (event.key === "PageUp") {
        event.preventDefault();
        handleTranslateSelection("y", 1);
      } else if (event.key === "PageDown") {
        event.preventDefault();
        handleTranslateSelection("y", -1);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeToolId, editor]);

  return (
    <EditorShell
      activeLeftPanel={ui.leftPanel}
      activeRightPanel={ui.rightPanel}
      activeToolId={toolSession.toolId}
      canRedo={editor.commands.canRedo()}
      canUndo={editor.commands.canUndo()}
      editor={editor}
      gridSnapValues={gridSnapValues}
      jobs={workerJobs}
      onAssignMaterial={handleAssignMaterial}
      onClipSelection={handleClipSelection}
      onDuplicateSelection={handleDuplicateSelection}
      onClearSelection={handleClearSelection}
      onExtrudeSelection={handleExtrudeSelection}
      onFocusNode={handleFocusNode}
      onPlaceEntity={handlePlaceEntity}
      onMeshInflate={handleMeshInflate}
      onMirrorSelection={handleMirrorSelection}
      onPlaceAsset={handlePlaceAsset}
      onRedo={handleRedo}
      onSelectAsset={handleSelectAsset}
      onSelectMaterial={handleSelectMaterial}
      onSelectNodes={handleSelectNodes}
      onSetSnapSize={handleSetSnapSize}
      onSetToolId={handleSetToolId}
      onSetLeftPanel={handleSetLeftPanel}
      onSetRightPanel={handleSetRightPanel}
      onTranslateSelection={handleTranslateSelection}
      onUndo={handleUndo}
      renderScene={renderScene}
      selectedAssetId={ui.selectedAssetId}
      selectedMaterialId={ui.selectedMaterialId}
      viewport={ui.viewport}
      tools={defaultTools}
      toolCount={defaultTools.length}
    />
  );
}
