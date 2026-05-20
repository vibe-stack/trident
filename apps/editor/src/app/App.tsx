import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSnapshot } from "valtio";
import {
  createReplaceNodesCommand,
  createSceneEditorAdapter,
  createSceneDocumentSnapshot,
  createSeedSceneDocument,
  createWorldEditorCore,
  type SceneSpatialAnalysis,
  type WorldPersistenceBundle
} from "@ggez/editor-core";
import { createDerivedRenderSceneCache, deriveRenderSceneCached } from "@ggez/render-pipeline";
import {
  createDerivedRenderSceneCache,
  deriveRenderSceneCached,
  gridSnapValues,
  type ViewportState
} from "@ggez/render-pipeline";
import {
  type BrushShape,
  type GeometryNode,
  isBrushNode,
  isInstancingNode,
  isLightNode,
  isMeshNode,
  isModelNode,
  isPrimitiveNode,
  makeTransform,
  type Material,
  type MeshNode,
  type ModelNode,
  type PrimitiveNodeData,
  snapVec3,
  vec2,
  vec3,
  type Brush,
  type EditableMesh,
  type Entity,
  type EntityType,
  type LightNodeData,
  type LightType,
  type TextureRecord,
  type Vec2,
  type Vec3,
  type SceneSettings
} from "@ggez/shared";
import type { PrimitiveShape } from "@ggez/shared";
import { createToolSession, defaultToolId, defaultTools, type ToolId } from "@ggez/tool-system";
import {
  createWorkerTaskManager,
  type WorkerJob
} from "@ggez/workers";
import {
  createWebHammerEngineBundleZip,
  isWebHammerEngineBundle
} from "@ggez/three-runtime";
import { slugifyProjectName, type EditorFileMetadata } from "@ggez/dev-sync";
import { toast } from "sonner";
import { EditorShell } from "@/components/EditorShell";
import { useGameConnection } from "@/app/hooks/useGameConnection";
import { uiStore, type RightPanelId } from "@/state/ui-store";
import type { Transform } from "@ggez/shared";
import type { MeshEditMode } from "@/viewport/editing";
import { useAppHotkeys } from "@/app/hooks/useAppHotkeys";
import { useCopilot } from "@/app/hooks/useCopilot";
import { GameConnectionControl } from "@/components/editor-shell/GameConnectionControl";
import { useEditorSubscriptions } from "@/app/hooks/useEditorSubscriptions";
import { useExportWorker } from "@/app/hooks/useExportWorker";
import { clampSnapSize, resolveViewportSnapSize } from "@/viewport/utils/snap";
import type { MeshEditToolbarActionRequest } from "@/viewport/types";
import {
  createDefaultEntity,
  createDefaultLightData,
  createDefaultPrimitiveTransform,
  createLightNodeLabel,
  createPrimitiveNodeData,
  createPrimitiveNodeLabel
} from "@/lib/authoring";
import type { ObjectGenerationResponse } from "@/lib/object-generation-contract";
import { convertPrimitiveNodeToMeshNode } from "@/lib/primitive-to-mesh";
import {
  analyzeModelSource,
  createAiModelPlaceholder,
  createModelAsset,
  readFileAsDataUrl,
  resolveModelFitScale,
  resolvePrimitiveNodeBounds
} from "@/lib/model-assets";
import { createEditableMeshFromPrimitiveData } from "@/lib/primitive-to-mesh";
import {
  focusViewportOnPoint,
  resolveVisibleViewportPaneIds,
  viewportPaneIds,
  type ViewModeId,
  type ViewportPaneId
} from "@/viewport/viewports";

export function App() {
  const [editor] = useState(() => createEditorCore(createSeedSceneDocument()));
  const [activeToolId, setActiveToolId] = useState<ToolId>(defaultToolId);
  const [activeBrushShape, setActiveBrushShape] = useState<BrushShape>("cube");
  const [aiModelPlacementArmed, setAiModelPlacementArmed] = useState(false);
  const [aiModelDraft, setAiModelDraft] = useState<{
    error?: string;
    nodeId: string;
    prompt: string;
  } | null>(null);
  const [meshEditMode, setMeshEditMode] = useState<MeshEditMode>("vertex");
  const [meshEditToolbarAction, setMeshEditToolbarAction] = useState<MeshEditToolbarActionRequest>();
  const [physicsPlayback, setPhysicsPlayback] = useState<"paused" | "running" | "stopped">("stopped");
  const [physicsRevision, setPhysicsRevision] = useState(0);
  const [selectedMaterialFaceIds, setSelectedMaterialFaceIds] = useState<string[]>([]);
  const [transformMode, setTransformMode] = useState<"rotate" | "scale" | "translate">("translate");
  const [workerManager] = useState(() => createWorkerTaskManager());
  const [workerJobs, setWorkerJobs] = useState<WorkerJob[]>([]);
  const [sceneRevision, setSceneRevision] = useState(0);
  const [selectionRevision, setSelectionRevision] = useState(0);
  const [sculptMode, setSculptMode] = useState<"deflate" | "inflate" | null>(null);
  const [sculptBrushRadius, setSculptBrushRadius] = useState(3);
  const [sculptBrushStrength, setSculptBrushStrength] = useState(0.2);
  const [selectedScenePathId, setSelectedScenePathId] = useState<string>();
  const [projectName, setProjectName] = useState("Untitled Scene");
  const [projectSlug, setProjectSlug] = useState("untitled-scene");
  const [projectSlugDirty, setProjectSlugDirty] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const glbImportInputRef = useRef<HTMLInputElement | null>(null);
  const renderSceneCacheRef = useRef(createDerivedRenderSceneCache());
  const ui = useSnapshot(uiStore);
  const toolSession = useMemo(() => createToolSession(activeToolId), [activeToolId]);
  const { downloadBinaryFile, downloadTextFile, exportJobs, runWorkerRequest } = useExportWorker();
  const gameConnection = useGameConnection();
  const renderScene = useMemo(
    () =>
      deriveRenderSceneCached(
        editor.scene.nodes.values(),
        editor.scene.entities.values(),
        editor.scene.materials.values(),
        editor.scene.assets.values(),
        renderSceneCacheRef.current
      ),
    [editor, sceneRevision]
  );
  const spatialAnalysis = useMemo(() => analyzeSceneSpatialLayout(editor.scene), [editor, sceneRevision]);
  const resolvedProjectName = projectName.trim() || "Untitled Scene";
  const resolvedProjectSlug = slugifyProjectName(projectSlug.trim() || resolvedProjectName);

  useEditorSubscriptions(editor, setSceneRevision, setSelectionRevision);

  useEffect(() => workerManager.subscribe(setWorkerJobs), [workerManager]);

  useEffect(() => {
    if (!aiModelDraft) {
      return;
    }

    const node = editor.scene.getNode(aiModelDraft.nodeId);

    if (node && !isModelNode(node)) {
      return;
    }

    setAiModelDraft(null);
    setAiModelPlacementArmed(false);
  }, [aiModelDraft, editor, sceneRevision]);

  useEffect(() => {
    const scenePaths = editor.scene.settings.paths ?? [];

    if (scenePaths.length === 0) {
      setSelectedScenePathId(undefined);
      return;
    }

    if (!selectedScenePathId || !scenePaths.some((pathDefinition) => pathDefinition.id === selectedScenePathId)) {
      setSelectedScenePathId(scenePaths[0]?.id);
    }
  }, [editor, sceneRevision, selectedScenePathId]);

  const handleSelectNodes = (nodeIds: string[]) => {
    if (physicsPlayback !== "stopped") {
      return;
    }

    editor.select(nodeIds, "object");
  };

  const handleSetToolId = (toolId: ToolId) => {
    setActiveToolId(toolId);
  };

  useEffect(() => {
    if (activeToolId !== "mesh-edit") {
      setSculptMode(null);
      return;
    }

    const selectedNodeId = editor.selection.ids[0];
    const selectedNode = selectedNodeId ? editor.scene.getNode(selectedNodeId) : undefined;

    if (!selectedNode || !isPrimitiveNode(selectedNode) || selectedNode.data.role !== "prop") {
      return;
    }

    editor.execute(
      createReplaceNodesCommand(
        editor.scene,
        [convertPrimitiveNodeToMeshNode(selectedNode)],
        "promote prop to mesh"
      )
    );
  }, [activeToolId, editor, sceneRevision, selectionRevision]);

  const handleSetRightPanel = (panel: RightPanelId | null) => {
    uiStore.rightPanel = panel;
  };

  const handleActivateViewport = (viewportId: ViewportPaneId) => {
    uiStore.activeViewportId = viewportId;
  };

  const resolveViewportFocusPoint = () => {
    const selectedNodeId = editor.selection.ids[0];
    const selectedNode = selectedNodeId ? editor.scene.getNode(selectedNodeId) : undefined;
    const selectedEntity = !selectedNode && selectedNodeId ? editor.scene.getEntity(selectedNodeId) : undefined;

    if (selectedNode) {
      return renderScene.nodeTransforms.get(selectedNode.id)?.position ?? selectedNode.transform.position;
    }

    if (selectedEntity) {
      return renderScene.entityTransforms.get(selectedEntity.id)?.position ?? selectedEntity.transform.position;
    }

    return vec3(0, 0, 0);
  };

  const handleSetViewMode = (viewMode: ViewModeId) => {
    uiStore.viewMode = viewMode;

    const visiblePaneIds = resolveVisibleViewportPaneIds(viewMode);

    if (!visiblePaneIds.includes(uiStore.activeViewportId)) {
      uiStore.activeViewportId = "perspective";
    }

    if (viewMode === "3d-only") {
      return;
    }

    const focusPoint = resolveViewportFocusPoint();

    (["top", "front", "side"] as const).forEach((viewportId) => {
      focusViewportOnPoint(uiStore.viewports[viewportId], focusPoint);
    });
  };

  const handleUpdateViewport = (viewportId: ViewportPaneId, viewport: ViewportState) => {
    uiStore.viewports[viewportId].projection = viewport.projection;
    uiStore.viewports[viewportId].camera = viewport.camera;
  };

  const handleToggleViewportQuality = () => {
    uiStore.viewportQuality =
      uiStore.viewportQuality === 0.5
        ? 0.75
        : uiStore.viewportQuality === 0.75
          ? 1
          : uiStore.viewportQuality === 1
            ? 1.5
            : 0.5;
  };

  const handleClearSelection = () => {
    editor.clearSelection();
  };

  const handleFocusNode = (nodeId: string) => {
    const node = editor.scene.getNode(nodeId);

    if (!node) {
      const entity = editor.scene.getEntity(nodeId);

      if (!entity) {
        return;
      }

      viewportPaneIds.forEach((viewportId) => {
        focusViewportOnPoint(
          uiStore.viewports[viewportId],
          renderScene.entityTransforms.get(entity.id)?.position ?? entity.transform.position
        );
      });
      return;
    }

    viewportPaneIds.forEach((viewportId) => {
      focusViewportOnPoint(
        uiStore.viewports[viewportId],
        renderScene.nodeTransforms.get(node.id)?.position ?? node.transform.position
      );
    });
  };

  const handleSetSnapSize = (snapSize: number) => {
    const nextSnapSize = clampSnapSize(snapSize);

    viewportPaneIds.forEach((viewportId) => {
      uiStore.viewports[viewportId].grid.snapSize = nextSnapSize;
    });
  };

  const handleSetSnapEnabled = (enabled: boolean) => {
    viewportPaneIds.forEach((viewportId) => {
      uiStore.viewports[viewportId].grid.enabled = enabled;
    });
  };

  const handleMeshEditToolbarAction = (kind: MeshEditToolbarActionRequest["kind"]) => {
    setMeshEditToolbarAction((current) => ({
      id: (current?.id ?? 0) + 1,
      kind
    }));
  };

  const handleUpdateNodeTransform = (
    nodeId: string,
    transform: Parameters<typeof createSetNodeTransformCommand>[2],
    beforeTransform?: Parameters<typeof createSetNodeTransformCommand>[3]
  ) => {
    const node = editor.scene.getNode(nodeId);

    if (!node) {
      return;
    }

    editor.execute(createSetNodeTransformCommand(editor.scene, nodeId, transform, beforeTransform));
    enqueueWorkerJob(
      "Transform update",
      { task: node.kind === "brush" ? "brush-rebuild" : "triangulation", worker: "geometryWorker" },
      550
    );
  };

  const handleUpdateNode = (nodeId: string, nextNode: GeometryNode, beforeNode?: GeometryNode) => {
    const node = editor.scene.getNode(nodeId);

    if (!node) {
      return;
    }

    editor.execute(createSetNodeCommand(editor.scene, nodeId, nextNode, beforeNode));
  };

  const handlePreviewBrushData = (nodeId: string, brush: Brush) => {
    const node = editor.scene.getNode(nodeId);

    if (!node || !isBrushNode(node)) {
      return;
    }

    node.data = structuredClone(brush);
    editor.scene.touch();
    setSceneRevision((revision) => revision + 1);
  };

  const handleUpdateBrushData = (nodeId: string, brush: Brush, beforeBrush?: Brush) => {
    const node = editor.scene.getNode(nodeId);

    if (!node || !isBrushNode(node)) {
      return;
    }

    editor.execute(createSetBrushDataCommand(editor.scene, nodeId, brush, beforeBrush));
    enqueueWorkerJob("Brush edit", { task: "brush-rebuild", worker: "geometryWorker" }, 700);
  };

  const handleSplitBrushAtCoordinate = (nodeId: string, axis: TransformAxis, coordinate: number) => {
    const { command, splitIds } = createSplitBrushNodeAtCoordinateCommand(editor.scene, nodeId, axis, coordinate);

    if (splitIds.length === 0) {
      return;
    }

    editor.execute(command);
    editor.select(splitIds, "object");
    enqueueWorkerJob("Clip brush", { task: "clip", worker: "geometryWorker" }, 950);
  };

  const handlePreviewMeshData = (nodeId: string, mesh: EditableMesh) => {
    const node = editor.scene.getNode(nodeId);

    if (!node || !isMeshNode(node)) {
      return;
    }

    node.data = preserveMeshMetadata(mesh, node.data);
    editor.scene.touch();
    setSceneRevision((revision) => revision + 1);
  };

  const handleUpdateMeshData = (nodeId: string, mesh: EditableMesh, beforeMesh?: EditableMesh) => {
    const node = editor.scene.getNode(nodeId);

    if (!node || !isMeshNode(node)) {
      return;
    }

    editor.execute(
      createSetMeshDataCommand(
        editor.scene,
        nodeId,
        preserveMeshMetadata(mesh, node.data),
        beforeMesh
      )
    );
    enqueueWorkerJob("Mesh edit", { task: "triangulation", worker: "meshWorker" }, 800);
  };

  const handlePreviewNodeTransform = (nodeId: string, transform: Transform) => {
    const node = editor.scene.getNode(nodeId);

    if (!node) {
      return;
    }

    node.transform = isInstancingNode(node)
      ? {
          position: structuredClone(transform.position),
          rotation: structuredClone(transform.rotation),
          scale: structuredClone(transform.scale)
        }
      : structuredClone(transform);
    editor.scene.touch();
    setSceneRevision((revision) => revision + 1);
  };

  const handlePreviewEntityTransform = (entityId: string, transform: Transform) => {
    const entity = editor.scene.getEntity(entityId);

    if (!entity) {
      return;
    }

    entity.transform = structuredClone(transform);
    editor.scene.touch();
    setSceneRevision((revision) => revision + 1);
  };

  const handleUpdateEntity = (entityId: string, nextEntity: Entity, beforeEntity?: Entity) => {
    const entity = editor.scene.getEntity(entityId);

    if (!entity) {
      return;
    }

    editor.execute(createSetEntityCommand(editor.scene, entityId, nextEntity, beforeEntity));
    enqueueWorkerJob("Entity update", { task: "navmesh", worker: "navWorker" }, 450);
  };

  const handleUpdateEntityTransform = (entityId: string, transform: Transform, beforeTransform?: Transform) => {
    const entity = editor.scene.getEntity(entityId);

    if (!entity) {
      return;
    }

    handleUpdateEntity(
      entityId,
      {
        ...structuredClone(entity),
        transform: structuredClone(transform)
      },
      beforeTransform
        ? {
            ...structuredClone(entity),
            transform: structuredClone(beforeTransform)
          }
        : entity
    );
  };

  const handleUpdateEntityProperties = (
    entityId: string,
    properties: Entity["properties"],
    beforeProperties?: Entity["properties"]
  ) => {
    const entity = editor.scene.getEntity(entityId);

    if (!entity) {
      return;
    }

    handleUpdateEntity(
      entityId,
      {
        ...structuredClone(entity),
        properties: structuredClone(properties)
      },
      beforeProperties
        ? {
            ...structuredClone(entity),
            properties: structuredClone(beforeProperties)
          }
        : entity
    );
  };

  const handleUpdateNodeHooks = (
    nodeId: string,
    hooks: NonNullable<GeometryNode["hooks"]>,
    beforeHooks?: NonNullable<GeometryNode["hooks"]>
  ) => {
    const node = editor.scene.getNode(nodeId);

    if (!node) {
      return;
    }

    handleUpdateNode(
      nodeId,
      {
        ...structuredClone(node),
        hooks: structuredClone(hooks)
      },
      beforeHooks
        ? {
            ...structuredClone(node),
            hooks: structuredClone(beforeHooks)
          }
        : node
    );
  };

  const handleUpdateEntityHooks = (
    entityId: string,
    hooks: NonNullable<Entity["hooks"]>,
    beforeHooks?: NonNullable<Entity["hooks"]>
  ) => {
    const entity = editor.scene.getEntity(entityId);

    if (!entity) {
      return;
    }

    handleUpdateEntity(
      entityId,
      {
        ...structuredClone(entity),
        hooks: structuredClone(hooks)
      },
      beforeHooks
        ? {
            ...structuredClone(entity),
            hooks: structuredClone(beforeHooks)
          }
        : entity
    );
  };

  const enqueueWorkerJob = (label: string, task: Parameters<typeof workerManager.enqueue>[0], durationMs?: number) => {
    workerManager.enqueue(task, label, durationMs);
  };

  const resolveActiveViewportState = () => uiStore.viewports[uiStore.activeViewportId];

  const handleTranslateSelection = (axis: TransformAxis, direction: -1 | 1) => {
    if (editor.selection.ids.length === 0) {
      return;
    }

    const delta = axisDelta(axis, resolveViewportSnapSize(resolveActiveViewportState()) * direction);
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
      axisDelta("x", resolveViewportSnapSize(resolveActiveViewportState()))
    );

    editor.execute(command);
    editor.select(duplicateIds, "object");
    enqueueWorkerJob("Duplicate selection", { task: "triangulation", worker: "geometryWorker" }, 700);
  };

  const handleInstanceSelection = () => {
    if (editor.selection.ids.length === 0) {
      return;
    }

    const { command, instanceIds } = createInstanceNodesCommand(
      editor.scene,
      editor.selection.ids,
      axisDelta("x", resolveViewportSnapSize(resolveActiveViewportState()))
    );

    if (instanceIds.length === 0) {
      return;
    }

    editor.execute(command);
    editor.select(instanceIds, "object");
  };

  const handleGroupSelection = () => {
    if (editor.selection.ids.length === 0) {
      return;
    }

    const result = createGroupSelectionCommand(editor.scene, editor.selection.ids);

    if (!result) {
      return;
    }

    editor.execute(result.command);
    editor.select([result.groupId], "object");
    enqueueWorkerJob("Group selection", { task: "triangulation", worker: "geometryWorker" }, 550);
  };

  const handleDeleteSelection = () => {
    if (editor.selection.ids.length === 0) {
      return;
    }

    editor.execute(createDeleteSelectionCommand(editor.scene, editor.selection.ids));
    editor.clearSelection();
    enqueueWorkerJob("Delete selection", { task: "brush-rebuild", worker: "geometryWorker" }, 550);
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
          resolveViewportSnapSize(resolveActiveViewportState()),
          direction
        )
      );
      enqueueWorkerJob("Brush extrude", { task: "brush-rebuild", worker: "geometryWorker" }, 950);
      return;
    }

    if (selectedNode && isMeshNode(selectedNode) && axis === "y") {
      editor.execute(
        createMeshRaiseTopCommand(editor.scene, editor.selection.ids, resolveViewportSnapSize(resolveActiveViewportState()) * direction)
      );
      enqueueWorkerJob("Mesh triangulation", { task: "triangulation", worker: "meshWorker" }, 850);
    }
  };

  const handlePlaceAsset = (position: Vec3) => {
    const snapped = snapVec3(position, resolveViewportSnapSize(resolveActiveViewportState()));
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

  const handleImportGlb = () => {
    glbImportInputRef.current?.click();
  };

  const handleGlbFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    try {
      // Always read as data URL first for bounds analysis (Three.js needs it)
      const dataUrl = await readFileAsDataUrl(file);
      const bounds = await analyzeModelSource({
        format: "glb",
        path: dataUrl
      });

      let assetPath = dataUrl;

      // In Electron: save GLB to project disk and use trident:// URL
      const electronAPI = (window as any).electronAPI;
      if (electronAPI?.isElectron) {
        const projectPath = await electronAPI.getCurrentProject();
        if (projectPath) {
          const { saveBinaryToProject } = await import("@/lib/texture-fs");
          const arrayBuffer = await file.arrayBuffer();
          const safeName = (file.name.replace(/[^a-zA-Z0-9._-]/g, "_")) || "model.glb";
          const saved = await saveBinaryToProject(arrayBuffer, safeName, projectPath, "models");
          if (saved) {
            assetPath = saved.tridentUrl;
          }
        }
      }

      const name = file.name.replace(/\.[^.]+$/, "") || "Imported Model";
      const asset = createModelAsset({
        center: bounds.center,
        format: "glb",
        name,
        path: assetPath,
        size: bounds.size,
        source: "import"
      });
      const fitScale = resolveModelFitScale(vec3(2, 2, 2), bounds);
      const target = resolvePlacementTarget();
      const { command, nodeId } = createPlaceModelNodeCommand(
        editor.scene,
        {
          position: vec3(target.x, target.y + 1, target.z),
          rotation: vec3(0, 0, 0),
          scale: vec3(fitScale, fitScale, fitScale)
        },
        {
          data: {
            assetId: asset.id,
            path: asset.path
          },
          name
        }
      );

      editor.execute(createUpsertAssetCommand(editor.scene, asset));
      editor.execute(command);
      editor.select([nodeId], "object");
      uiStore.selectedAssetId = asset.id;
      enqueueWorkerJob("GLB import", { task: "triangulation", worker: "geometryWorker" }, 650);
    } finally {
      event.target.value = "";
    }
  };

  const resolvePlacementPosition = (size: Vec3) => {
    const activeViewportState = resolveActiveViewportState();
    const snappedTarget = snapVec3(activeViewportState.camera.target, resolveViewportSnapSize(activeViewportState));

    return vec3(snappedTarget.x, Math.max(size.y * 0.5, snappedTarget.y), snappedTarget.z);
  };
  isModelNode,
  isPrimitiveNode,
  type Asset,
  type GeometryNode,
  type TextureRecord,
} from "@ggez/shared";
import { createWorkerTaskManager, type WorkerJob } from "@ggez/workers";
import { slugifyProjectName } from "@ggez/dev-sync";
import { WorldEditorShell } from "@/components/WorldEditorShell";
import { EditorActionDomainsProvider } from "@/app/editor-action-domains";
import { useAppHotkeys } from "@/app/hooks/useAppHotkeys";
import { useAssetMaterialActions } from "@/app/hooks/useAssetMaterialActions";
import { useCopilot } from "@/app/hooks/useCopilot";
import { useEditorSubscriptions } from "@/app/hooks/useEditorSubscriptions";
import { useExportWorker } from "@/app/hooks/useExportWorker";
import { useGameConnection } from "@/app/hooks/useGameConnection";
import { useProjectTransferActions } from "@/app/hooks/useProjectTransferActions";
import { useSceneDraftPersistence } from "@/app/hooks/useSceneDraftPersistence";
import { useSceneMutationActions } from "@/app/hooks/useSceneMutationActions";
import { useWorldDocumentManagement } from "@/app/hooks/useWorldDocumentManagement";
import { GameConnectionControl } from "@/components/editor-shell/GameConnectionControl";
import { convertPrimitiveNodeToMeshNode } from "@/lib/primitive-to-mesh";
import { buildModelAssetLibrary } from "@/lib/model-assets";
import { resolveEffectiveSceneItemIds } from "@/lib/scene-hierarchy";
import { uiStore } from "@/state/ui-store";
import { projectSessionStore } from "@/state/project-session-store";
import { sceneSessionStore } from "@/state/scene-session-store";
import { toolSessionStore } from "@/state/tool-session-store";

const EMPTY_SCENE_SPATIAL_ANALYSIS: SceneSpatialAnalysis = {
  connectorValidations: [],
  elevationBands: [],
  groups: [],
  issues: [],
  nodes: [],
  walkableSurfaces: []
};

const MODEL_ASSET_LIBRARY_NEUTRAL_REASONS = new Set([
  "command:assign material",
  "command:create material",
  "command:create texture",
  "command:delete material",
  "command:delete texture",
  "command:group selection",
  "command:paint instances",
  "command:set brush",
  "command:set entity",
  "command:set mesh",
  "command:set mesh material layers",
  "command:set scene settings",
  "command:set transform",
  "command:translate selection",
  "command:update material",
  "command:update texture"
]);

function isModelAssetLibraryNeutralChange(reason: string) {
  if (MODEL_ASSET_LIBRARY_NEUTRAL_REASONS.has(reason)) {
    return true;
  }

  if (reason.startsWith("command:clip ") || reason.startsWith("command:extrude ") || reason.startsWith("command:mirror ")) {
    return true;
  }

  return reason.startsWith("command:place ") && reason !== "command:place asset";
}

function createModelAssetLibrarySignature(assets: Iterable<Asset>, nodes: Iterable<GeometryNode>) {
  const parts: string[] = [];

  for (const asset of assets) {
    if (asset.type !== "model") {
      continue;
    }

    parts.push(
      asset.id,
      asset.path,
      typeof asset.metadata.modelFiles === "string" ? asset.metadata.modelFiles : "",
      typeof asset.metadata.modelFormat === "string" ? asset.metadata.modelFormat : "",
      typeof asset.metadata.name === "string" ? asset.metadata.name : "",
      typeof asset.metadata.source === "string" ? asset.metadata.source : ""
    );
  }

  parts.push("\u0000");

  for (const node of nodes) {
    if (!isModelNode(node)) {
      continue;
    }

    parts.push(node.id, node.data.assetId);
  }

  return parts.join("\u0001");
}

export function App() {
  const [worldEditor] = useState(() => createWorldEditorCore(createSceneDocumentSnapshot(createSeedSceneDocument())));
  const [editor] = useState(() => createSceneEditorAdapter(worldEditor));
  const [workerManager] = useState(() => createWorkerTaskManager());
  const [workerJobs, setWorkerJobs] = useState<WorkerJob[]>([]);
  const [committedSceneRevision, setCommittedSceneRevision] = useState(0);
  const [modelAssetRevision, setModelAssetRevision] = useState(0);
  const [sceneRevision, setSceneRevision] = useState(0);
  const [selectionRevision, setSelectionRevision] = useState(0);
  const [worldRevision, setWorldRevision] = useState(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const sceneDocumentInputRef = useRef<HTMLInputElement | null>(null);
  const glbImportInputRef = useRef<HTMLInputElement | null>(null);
  const modelLodInputRef = useRef<HTMLInputElement | null>(null);
  const renderSceneCacheRef = useRef(createDerivedRenderSceneCache());
  const modelAssetSignatureRef = useRef("");
  const toolSessionSnapshot = useSnapshot(toolSessionStore);
  const projectSessionSnapshot = useSnapshot(projectSessionStore);
  const sceneSessionSnapshot = useSnapshot(sceneSessionStore);
  const activeToolId = toolSessionSnapshot.activeToolId;
  const aiModelDraft = toolSessionSnapshot.aiModelDraft;
  const physicsPlayback = toolSessionSnapshot.physicsPlayback;
  const projectName = projectSessionSnapshot.projectName;
  const projectSlug = projectSessionSnapshot.projectSlug;
  const projectSlugDirty = projectSessionSnapshot.projectSlugDirty;
  const hiddenSceneItemIds = sceneSessionSnapshot.hiddenSceneItemIds;
  const lockedSceneItemIds = sceneSessionSnapshot.lockedSceneItemIds;
  const selectedScenePathId = sceneSessionSnapshot.selectedScenePathId;
  const { downloadBinaryFile, downloadTextFile, exportJobs, runWorkerRequest } = useExportWorker();
  const gameConnection = useGameConnection();
  const workingSet = useMemo(() => worldEditor.getWorkingSet(), [worldEditor, worldRevision]);
  const activeWorldDocumentId = workingSet.activeDocumentId;
  const flattenedWorldSnapshot = useMemo(
    () =>
      workingSet.mode === "world"
        ? worldEditor.getFlattenedSceneSnapshot({
            activeDocumentId: activeWorldDocumentId,
            activeDocumentOverride: editor.scene,
            includeLoadedOnly: true
          })
        : null,
    [activeWorldDocumentId, editor, sceneRevision, worldEditor, workingSet.mode, worldRevision]
  );
  const renderScene = useMemo(
    () =>
      deriveRenderSceneCached(
        workingSet.mode === "world" && flattenedWorldSnapshot
          ? flattenedWorldSnapshot.nodes
          : editor.scene.nodes.values(),
        workingSet.mode === "world" && flattenedWorldSnapshot
          ? flattenedWorldSnapshot.entities
          : editor.scene.entities.values(),
        workingSet.mode === "world" && flattenedWorldSnapshot
          ? flattenedWorldSnapshot.materials
          : editor.scene.materials.values(),
        workingSet.mode === "world" && flattenedWorldSnapshot
          ? flattenedWorldSnapshot.assets
          : editor.scene.assets.values(),
        renderSceneCacheRef.current,
        workingSet.mode === "world" && flattenedWorldSnapshot
          ? flattenedWorldSnapshot.textures
          : editor.scene.textures.values()
      ),
    [editor, flattenedWorldSnapshot, sceneRevision, workingSet.mode]
  );
  const spatialAnalysis = EMPTY_SCENE_SPATIAL_ANALYSIS;
  const sceneNodes = useMemo(() => Array.from(editor.scene.nodes.values()), [editor, committedSceneRevision]);
  const sceneEntities = useMemo(() => Array.from(editor.scene.entities.values()), [editor, committedSceneRevision]);
  const modelAssets = useMemo(
    () => buildModelAssetLibrary(editor.scene.assets.values(), editor.scene.nodes.values()),
    [editor, modelAssetRevision]
  );
  const sceneItemIdSet = useMemo(
    () => new Set<string>([...sceneNodes.map((node) => node.id), ...sceneEntities.map((entity) => entity.id)]),
    [sceneEntities, sceneNodes]
  );
  const effectiveHiddenSceneItemIds = useMemo(
    () => resolveEffectiveSceneItemIds(sceneNodes, sceneEntities, hiddenSceneItemIds),
    [hiddenSceneItemIds, sceneEntities, sceneNodes]
  );
  const effectiveLockedSceneItemIds = useMemo(
    () => resolveEffectiveSceneItemIds(sceneNodes, sceneEntities, lockedSceneItemIds),
    [lockedSceneItemIds, sceneEntities, sceneNodes]
  );
  const blockedSceneItemIdSet = useMemo(
    () => new Set<string>([...effectiveHiddenSceneItemIds, ...effectiveLockedSceneItemIds]),
    [effectiveHiddenSceneItemIds, effectiveLockedSceneItemIds]
  );
  const resolvedProjectName = projectName.trim() || "Untitled Scene";
  const resolvedProjectSlug = slugifyProjectName(projectSlug.trim() || resolvedProjectName);
  const texturesRef = useRef<TextureRecord[]>([]);

  if (modelAssetSignatureRef.current.length === 0) {
    modelAssetSignatureRef.current = createModelAssetLibrarySignature(editor.scene.assets.values(), editor.scene.nodes.values());
  }

  useEditorSubscriptions(editor, setSceneRevision, setCommittedSceneRevision, setSelectionRevision);

  useEffect(() => {
    const unsubscribeScene = editor.events.on("scene:changed", ({ reason }) => {
      if (isModelAssetLibraryNeutralChange(reason)) {
        return;
      }

      const nextSignature = createModelAssetLibrarySignature(editor.scene.assets.values(), editor.scene.nodes.values());

      if (nextSignature === modelAssetSignatureRef.current) {
        return;
      }

      modelAssetSignatureRef.current = nextSignature;
      setModelAssetRevision((revision) => revision + 1);
    });

    return unsubscribeScene;
  }, [editor]);

  useEffect(() => workerManager.subscribe(setWorkerJobs), [workerManager]);

  useEffect(() => worldEditor.events.on("world:changed", () => setWorldRevision((revision) => revision + 1)), [worldEditor]);

  useEffect(() => {
    const filterValidIds = (currentIds: string[]) => {
      const nextIds = currentIds.filter((id) => sceneItemIdSet.has(id));
      return nextIds.length === currentIds.length ? currentIds : nextIds;
    };

    sceneSessionStore.hiddenSceneItemIds = filterValidIds(sceneSessionStore.hiddenSceneItemIds);
    sceneSessionStore.lockedSceneItemIds = filterValidIds(sceneSessionStore.lockedSceneItemIds);
  }, [sceneItemIdSet]);

  useEffect(() => {
    if (editor.selection.ids.length === 0) {
      return;
    }

    const nextSelection = editor.selection.ids.filter((id) => !blockedSceneItemIdSet.has(id));

    if (nextSelection.length === editor.selection.ids.length) {
      return;
    }

    editor.select(nextSelection, "object");
  }, [blockedSceneItemIdSet, editor, selectionRevision]);

  useEffect(() => {
    if (!aiModelDraft) {
      return;
    }

    const node = editor.scene.getNode(aiModelDraft.nodeId);

    if (node && !isModelNode(node)) {
      return;
    }

    toolSessionStore.aiModelDraft = null;
    toolSessionStore.aiModelPlacementArmed = false;
  }, [aiModelDraft, committedSceneRevision, editor]);

  useEffect(() => {
    if (uiStore.selectedAssetId && !editor.scene.assets.has(uiStore.selectedAssetId)) {
      uiStore.selectedAssetId = "";
    }
  }, [committedSceneRevision, editor]);

  useEffect(() => {
    const scenePaths = editor.scene.settings.paths ?? [];

    if (scenePaths.length === 0) {
      sceneSessionStore.selectedScenePathId = undefined;
      return;
    }

    if (!selectedScenePathId || !scenePaths.some((pathDefinition) => pathDefinition.id === selectedScenePathId)) {
      sceneSessionStore.selectedScenePathId = scenePaths[0]?.id;
    }
  }, [committedSceneRevision, editor, selectedScenePathId]);

  const syncEditorFromWorld = (reason: string) => {
    editor.syncFromWorld(reason);
    const nextModelAssetSignature = createModelAssetLibrarySignature(editor.scene.assets.values(), editor.scene.nodes.values());

    if (nextModelAssetSignature !== modelAssetSignatureRef.current) {
      modelAssetSignatureRef.current = nextModelAssetSignature;
      setModelAssetRevision((revision) => revision + 1);
    }

    setWorldRevision((revision) => revision + 1);
    setSceneRevision((revision) => revision + 1);
    setCommittedSceneRevision((revision) => revision + 1);
    setSelectionRevision((revision) => revision + 1);
  };

  const enqueueWorkerJob = (label: string, task: WorkerJob["task"], durationMs?: number) => {
    workerManager.enqueue(task, label, durationMs);
  };

  useEffect(() => {
    if (activeToolId !== "mesh-edit") {
      toolSessionStore.sculptMode = null;
      return;
    }

    const selectedNodeId = editor.selection.ids[0];
    const selectedNode = selectedNodeId ? editor.scene.getNode(selectedNodeId) : undefined;

    if (!selectedNode || !isPrimitiveNode(selectedNode) || selectedNode.data.role !== "prop") {
      return;
    }

    editor.execute(
      createReplaceNodesCommand(
        editor.scene,
        [convertPrimitiveNodeToMeshNode(selectedNode)],
        "promote prop to mesh"
      )
    );
  }, [activeToolId, committedSceneRevision, editor, selectionRevision]);

  const buildActiveSceneSnapshot = () => ({
    ...editor.exportSnapshot(),
    metadata: {
      projectName: resolvedProjectName,
      projectSlug: resolvedProjectSlug
    }
  });

  const applyProjectMetadata = (metadata?: EditorFileMetadata) => {
    if (!metadata?.projectName && !metadata?.projectSlug) {
      return;
    }

    const nextProjectName = metadata.projectName?.trim() || resolvedProjectName;
    const nextProjectSlug = slugifyProjectName(metadata.projectSlug?.trim() || nextProjectName);
    setProjectName(nextProjectName);
    setProjectSlug(nextProjectSlug);
    setProjectSlugDirty(Boolean(metadata.projectSlug));
  };

  const handleProjectNameChange = (value: string) => {
    const previousAutoSlug = slugifyProjectName(projectName);
    setProjectName(value);

    if (!projectSlugDirty || projectSlug === previousAutoSlug) {
      setProjectSlug(slugifyProjectName(value));
      setProjectSlugDirty(false);
    }
  };

  const handleProjectSlugChange = (value: string) => {
    setProjectSlug(slugifyProjectName(value));
    setProjectSlugDirty(true);
  };

  const handleSaveWhmap = async () => {
    const payload = await runWorkerRequest(
      {
        kind: "whmap-save",
        snapshot: buildEditorSnapshot()
      },
      "Save .whmap"
    );

    if (typeof payload === "string") {
      const electronAPI = (window as any).electronAPI;
      if (electronAPI?.isElectron) {
        const projectPath = await electronAPI.getCurrentProject();
        if (projectPath) {
          const scenesDir = `${projectPath}/src/scenes/main`;
          await electronAPI.mkdir(scenesDir);
          const filePath = `${scenesDir}/${resolvedProjectSlug}.whmap`;
          await electronAPI.writeFile(filePath, payload);
          toast.success("Scene Saved Successfully", { description: filePath });
          console.log(`[Save] .whmap saved to ${filePath}`);
          return;
        }
      }
      downloadTextFile(`${resolvedProjectSlug}.whmap`, payload, "application/json");
    }
  };

  const handleLoadWhmap = () => {
    fileInputRef.current?.click();
  };

  const handleLoadWhmapFromString = async (text: string) => {
    const payload = await runWorkerRequest(
      {
        kind: "whmap-load",
        text
      },
      "Load .whmap"
    );

    if (typeof payload !== "string" && !isWebHammerEngineBundle(payload)) {
      applyProjectMetadata(payload.metadata);
      editor.importSnapshot(payload, "scene:load-whmap");
    }
  };

  const handleWhmapFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const text = await file.text();
    const payload = await runWorkerRequest(
      {
        kind: "whmap-load",
        text
      },
      "Load .whmap"
    );

    if (typeof payload !== "string" && !isWebHammerEngineBundle(payload)) {
      applyProjectMetadata(payload.metadata);
      editor.importSnapshot(payload, "scene:load-whmap");
    }

    event.target.value = "";
  const buildWorldBundle = (): WorldPersistenceBundle => {
    const bundle = worldEditor.getBundleRef();

    return {
      ...bundle,
      manifest: {
        ...bundle.manifest,
        activeDocumentId: worldEditor.getWorkingSet().activeDocumentId,
        metadata: {
          projectName: resolvedProjectName,
          projectSlug: resolvedProjectSlug
        }
      }
    };
  };

  const buildSceneDraftPayload = () => ({
    projectName: resolvedProjectName,
    projectSlug: resolvedProjectSlug,
    projectSlugDirty,
    snapshot: buildWorldBundle(),
    updatedAt: Date.now(),
    version: 2 as const
  });

  const draftHydrated = useSceneDraftPersistence({
    buildDraft: buildSceneDraftPayload,
    onRestoreDraft: (draft) => {
      worldEditor.importBundle(draft.snapshot, "world:restore-draft");
      syncEditorFromWorld("world:restore-draft");
      projectSessionStore.projectName = draft.projectName || "Untitled Scene";
      projectSessionStore.projectSlug = slugifyProjectName(draft.projectSlug || draft.projectName || "Untitled Scene");
      projectSessionStore.projectSlugDirty = draft.projectSlugDirty;
    },
    saveKey: `${committedSceneRevision}:${projectSlugDirty ? 1 : 0}:${resolvedProjectName}:${resolvedProjectSlug}`
  }).draftHydrated;

  const {
    createBrush,
    instanceSelection,
    physicsActions,
    placementActions: scenePlacementActions,
    sceneActions,
    selectionActions
  } = useSceneMutationActions({
    activeWorldDocumentId,
    blockedSceneItemIdSet,
    bumpSceneRevision: () => {
      setSceneRevision((revision) => revision + 1);
    },
    editor,
    enqueueWorkerJob,
    renderScene,
    syncEditorFromWorld,
    workingSet,
    worldEditor
  });

  const {
    aiActions,
    assetActions,
    fileInputHandlers: assetFileInputHandlers,
    placementActions: assetPlacementActions
  } = useAssetMaterialActions({
    editor,
    enqueueWorkerJob,
    focusNode: selectionActions.focusNode,
    glbImportInputRef,
    modelAssets,
    modelLodInputRef,
    runWorkerRequest
  });

    if (isWebHammerEngineBundle(payload)) {
      const electronAPI = (window as any).electronAPI;
      if (electronAPI?.isElectron) {
        const projectPath = await electronAPI.getCurrentProject();
        if (projectPath) {
          const scenesDir = `${projectPath}/src/scenes/main`;
          await electronAPI.mkdir(scenesDir);

          // Write the manifest
          const manifestJson = JSON.stringify(payload.manifest, null, 2);
          await electronAPI.writeFile(`${scenesDir}/scene.runtime.json`, manifestJson);

          // Write each bundled asset file
          for (const file of payload.files) {
            const filePath = `${scenesDir}/${file.path}`;
            // Ensure subdirectories exist (e.g. assets/textures/)
            const dirPath = filePath.substring(0, filePath.lastIndexOf("/"));
            if (dirPath !== scenesDir) {
              await electronAPI.mkdir(dirPath);
            }
            // Convert Uint8Array to base64 for binary write
            const base64 = btoa(String.fromCharCode(...file.bytes));
            await electronAPI.writeFile(filePath, { base64 });
          }

          toast.success("Runtime Bundle Exported", { description: scenesDir });
          console.log(`[Export] Runtime scene exported to ${scenesDir}`);
          return;
        }
      }
      const zip = createWebHammerEngineBundleZip(payload);
      downloadBinaryFile(`${resolvedProjectSlug}.runtime.zip`, zip, "application/zip");
    }
  };
  const {
    fileActions: baseFileActions,
    fileInputHandlers: projectFileInputHandlers,
    gameSyncActions
  } = useProjectTransferActions({
    buildActiveSceneSnapshot,
    buildWorldBundle,
    createBrush,
    downloadBinaryFile,
    downloadTextFile,
    editor,
    fileInputRef,
    gameConnection,
    resolvedProjectName,
    resolvedProjectSlug,
    runWorkerRequest,
    sceneDocumentInputRef,
    syncEditorFromWorld,
    workingSet,
    worldEditor
  });

  const handleUndo = () => {
    editor.undo();
  };

  const handleRedo = () => {
    editor.redo();
  };

  const requestScenePush = useEventCallback((options?: Parameters<typeof gameSyncActions.handlePushSceneToGame>[0]) => {
    void gameSyncActions.handlePushSceneToGame(options).catch(() => {});
  });
  const handleProjectNameChange = useEventCallback(gameSyncActions.handleProjectNameChange);
  const handleProjectSlugChange = useEventCallback(gameSyncActions.handleProjectSlugChange);
  const handleRefreshGames = useEventCallback(gameConnection.refresh);
  const handleSelectGame = useEventCallback(gameConnection.setSelectedGameId);
  const handlePushScene = useCallback((forceSwitch?: boolean) => {
    requestScenePush({ forceSwitch });
  }, [requestScenePush]);
  const copilotToolContext = useMemo(
    () => ({
      requestScenePush
    }),
    [requestScenePush]
  );
  const copilot = useCopilot(editor, copilotToolContext);

  const handleToggleCopilot = () => {
    uiStore.copilotPanelOpen = !uiStore.copilotPanelOpen;
  };

  const handleToggleLogicViewer = () => {
    uiStore.logicViewerOpen = !uiStore.logicViewerOpen;
  };

  const {
    handleCreateWorldDocument,
    handleLoadWorldDocument,
    handlePinWorldDocument,
    handleSetActiveWorldDocument,
    handleSetWorldDocumentPosition,
    handleSetWorldMode,
    handleUnloadWorldDocument,
    handleUnpinWorldDocument,
    worldDocuments
  } = useWorldDocumentManagement({
    buildWorldBundle,
    syncEditorFromWorld,
    workingSet,
    worldEditor,
    worldRevision
  });

  useAppHotkeys({
    activeToolId,
    editor,
    enabled: physicsPlayback === "stopped",
    handleDeleteSelection: selectionActions.deleteSelection,
    handleDuplicateSelection: selectionActions.duplicateSelection,
    handleInstanceSelection: instanceSelection,
    handleGroupSelection: selectionActions.groupSelection,
    handleInvertSelectionNormals: selectionActions.invertSelectionNormals,
    handleRedo,
    handleToggleCopilot,
    handleToggleLogicViewer,
    handleTranslateSelection: selectionActions.translateSelection,
    handleUndo,
    setActiveToolId: (toolId) => {
      toolSessionStore.activeToolId = toolId;
    },
    setMeshEditMode: (mode) => {
      toolSessionStore.meshEditMode = mode;
    },
    setTransformMode: (mode) => {
      toolSessionStore.transformMode = mode;
    }
  });

  const history = {
    canRedo: editor.commands.canRedo(),
    canUndo: editor.commands.canUndo(),
    redo: handleRedo,
    undo: handleUndo
  };
  const placementActions = {
    ...scenePlacementActions,
    ...assetPlacementActions
  };
  const fileActions = {
    ...baseFileActions,
    importGlb: assetActions.importAsset
  };
  const actionDomains = useMemo(
    () => ({
      aiActions,
      assetActions,
      fileActions,
      history,
      physicsActions,
      placementActions,
      sceneActions,
      selectionActions
    }),
    [aiActions, assetActions, fileActions, history, physicsActions, placementActions, sceneActions, selectionActions]
  );
  const jobs = useMemo(() => [...workerJobs, ...exportJobs], [exportJobs, workerJobs]);
  const textures = useMemo(() => {
    const nextTextures = Array.from(editor.scene.textures.values());
    const previousTextures = texturesRef.current;

    if (areTextureArraysEqual(previousTextures, nextTextures)) {
      return previousTextures;
    }

    texturesRef.current = nextTextures;
    return nextTextures;
  }, [committedSceneRevision, editor]);
  const gameConnectionControl = useMemo(
    () => (
      <GameConnectionControl
        activeGame={gameConnection.activeGame}
        error={gameConnection.error}
        games={gameConnection.games}
        isLoading={gameConnection.isLoading}
        isPushing={gameConnection.isPushing}
        lastPush={gameConnection.lastPush}
        onProjectNameChange={handleProjectNameChange}
        onProjectSlugChange={handleProjectSlugChange}
        onPushScene={handlePushScene}
        onRefresh={handleRefreshGames}
        onSelectGame={handleSelectGame}
        projectName={projectName}
        projectSlug={resolvedProjectSlug}
        selectedGameId={gameConnection.selectedGameId}
      />
    ),
    [
      gameConnection.activeGame,
      gameConnection.error,
      gameConnection.games,
      gameConnection.isLoading,
      gameConnection.isPushing,
      gameConnection.lastPush,
      gameConnection.selectedGameId,
      handleProjectNameChange,
      handleProjectSlugChange,
      handlePushScene,
      handleRefreshGames,
      handleSelectGame,
      projectName,
      resolvedProjectSlug
    ]
  );
  const world = {
    actions: {
      createDocument: handleCreateWorldDocument,
      loadDocument: handleLoadWorldDocument,
      pinDocument: handlePinWorldDocument,
      setActiveDocument: handleSetActiveWorldDocument,
      setDocumentPosition: handleSetWorldDocumentPosition,
      setWorldMode: handleSetWorldMode,
      unloadDocument: handleUnloadWorldDocument,
      unpinDocument: handleUnpinWorldDocument
    },
    documents: worldDocuments,
    validationIssues: worldEditor.world.validation
  };

  return (
    <>
      <EditorShell
        analysis={spatialAnalysis}
        activeRightPanel={ui.rightPanel}
        activeToolId={toolSession.toolId}
        activeBrushShape={activeBrushShape}
        copilot={copilot}
        copilotPanelOpen={ui.copilotPanelOpen}
        gameConnectionControl={
          <GameConnectionControl
            activeGame={gameConnection.activeGame}
            error={gameConnection.error}
            games={gameConnection.games}
            isLoading={gameConnection.isLoading}
            isPushing={gameConnection.isPushing}
            lastPush={gameConnection.lastPush}
            onProjectNameChange={handleProjectNameChange}
            onProjectSlugChange={handleProjectSlugChange}
            onPushScene={(forceSwitch) => {
              void handlePushSceneToGame({ forceSwitch });
            }}
            onRefresh={gameConnection.refresh}
            onSelectGame={gameConnection.setSelectedGameId}
            projectName={projectName}
            projectSlug={resolvedProjectSlug}
            selectedGameId={gameConnection.selectedGameId}
          />
        }
        logicViewerOpen={ui.logicViewerOpen}
        onToggleCopilot={handleToggleCopilot}
        onToggleLogicViewer={handleToggleLogicViewer}
        aiModelPlacementActive={Boolean(aiModelDraft)}
        aiModelPlacementArmed={aiModelPlacementArmed}
        aiModelPrompt={aiModelDraft?.prompt ?? ""}
        aiModelPromptBusy={false}
        aiModelPromptError={aiModelDraft?.error}
        activeViewportId={ui.activeViewportId}
        canRedo={editor.commands.canRedo()}
        canUndo={editor.commands.canUndo()}
        editor={editor}
        gridSnapValues={gridSnapValues}
        jobs={[...workerJobs, ...exportJobs]}
        meshEditToolbarAction={meshEditToolbarAction}
        onActivateViewport={handleActivateViewport}
        onInvertSelectionNormals={handleInvertSelectionNormals}
        onApplyMaterial={handleApplyMaterial}
        onClipSelection={handleClipSelection}
        onCreateBrush={handleCreateBrush}
        onDeleteSelection={handleDeleteSelection}
        onDuplicateSelection={handleDuplicateSelection}
        onClearSelection={handleClearSelection}
        onCommitMeshTopology={handleCommitMeshTopology}
        onDeleteMaterial={handleDeleteMaterial}
        onExportEngine={handleExportEngine}
        onExportGltf={handleExportGltf}
        onExtrudeSelection={handleExtrudeSelection}
        onFocusNode={handleFocusNode}
        onGroupSelection={handleGroupSelection}
        onGenerateAiModel={handleGenerateAiModel}
        onImportGlb={handleImportGlb}
        onLoadWhmap={handleLoadWhmap}
        onLoadWhmapFromString={handleLoadWhmapFromString}
        onPausePhysics={handlePausePhysics}
        onMeshEditToolbarAction={handleMeshEditToolbarAction}
        onMirrorSelection={handleMirrorSelection}
        onCancelAiModelPlacement={handleCancelAiModelPlacement}
        onPlaceAsset={handlePlaceAsset}
        onPlaceAiModelPlaceholder={handlePlaceAiModelPlaceholder}
        onPlaceBrush={handlePlaceBrush}
        onPlaceMeshNode={handlePlaceMeshNode}
        onPlaceBlockoutOpenRoom={() => handlePlaceBlockoutRoom(["south"])}
        onPlaceBlockoutPlatform={handlePlaceBlockoutPlatform}
        onPlaceBlockoutRoom={() => handlePlaceBlockoutRoom()}
        onPlaceBlockoutStairs={handlePlaceBlockoutStairs}
        onPlaceEntity={handlePlaceEntity}
        onPlaceLight={handlePlaceLight}
        onPlacePrimitiveNode={handlePlacePrimitiveNode}
        onPlaceProp={handlePlaceProp}
        onPlayPhysics={handlePlayPhysics}
        onPreviewBrushData={handlePreviewBrushData}
        onPreviewEntityTransform={handlePreviewEntityTransform}
        onPreviewMeshData={handlePreviewMeshData}
        onPreviewNodeTransform={handlePreviewNodeTransform}
        onSculptModeChange={setSculptMode}
        onRedo={handleRedo}
        onSaveWhmap={handleSaveWhmap}
        onSelectAsset={handleSelectAsset}
        onSelectMaterialFaces={setSelectedMaterialFaceIds}
        onSelectMaterial={handleSelectMaterial}
        onSelectScenePath={setSelectedScenePathId}
        onStartAiModelPlacement={handleArmAiModelPlacement}
        onSetUvOffset={handleSetMaterialUvOffset}
        onSetUvScale={handleSetMaterialUvScale}
        onSelectNodes={handleSelectNodes}
        onSetMeshEditMode={setMeshEditMode}
        onSetSculptBrushRadius={setSculptBrushRadius}
        onSetSculptBrushStrength={setSculptBrushStrength}
        onSetRightPanel={handleSetRightPanel}
        onSetActiveBrushShape={setActiveBrushShape}
        onSetSnapEnabled={handleSetSnapEnabled}
        onSetSnapSize={handleSetSnapSize}
        onStopPhysics={handleStopPhysics}
        onSetTransformMode={setTransformMode}
        onSetToolId={handleSetToolId}
        onToggleViewportQuality={handleToggleViewportQuality}
        onSetViewMode={handleSetViewMode}
        onSplitBrushAtCoordinate={handleSplitBrushAtCoordinate}
        onTranslateSelection={handleTranslateSelection}
        onUndo={handleUndo}
        onUpdateEntityProperties={handleUpdateEntityProperties}
        onUpdateEntityHooks={handleUpdateEntityHooks}
        onUpdateEntityTransform={handleUpdateEntityTransform}
        onUpdateNodeData={handleUpdateNodeData}
        onUpdateNodeHooks={handleUpdateNodeHooks}
        onUpdateAiModelPrompt={handleUpdateAiModelPrompt}
        onUpdateSceneSettings={handleUpdateSceneSettings}
        onUpdateViewport={handleUpdateViewport}
        onUpsertMaterial={handleUpsertMaterial}
        onDeleteTexture={handleDeleteTexture}
        onUpsertTexture={handleUpsertTexture}
        onUpdateBrushData={handleUpdateBrushData}
        onUpdateMeshData={handleUpdateMeshData}
        onUpdateNodeTransform={handleUpdateNodeTransform}
        meshEditMode={meshEditMode}
        sculptMode={sculptMode}
        sculptBrushRadius={sculptBrushRadius}
        sculptBrushStrength={sculptBrushStrength}
        physicsPlayback={physicsPlayback}
        physicsRevision={physicsRevision}
        renderScene={renderScene}
        sceneSettings={editor.scene.settings}
        selectedScenePathId={selectedScenePathId}
        selectedAssetId={ui.selectedAssetId}
        selectedFaceIds={selectedMaterialFaceIds}
        selectedMaterialId={ui.selectedMaterialId}
        transformMode={transformMode}
        textures={Array.from(editor.scene.textures.values())}
        tools={defaultTools}
        viewMode={ui.viewMode}
        viewportQuality={ui.viewportQuality}
        viewports={ui.viewports}
      />
      <EditorActionDomainsProvider value={actionDomains}>
        <WorldEditorShell
          analysis={spatialAnalysis}
          copilot={copilot}
          gameConnectionControl={gameConnectionControl}
          effectiveHiddenSceneItemIds={effectiveHiddenSceneItemIds}
          effectiveLockedSceneItemIds={effectiveLockedSceneItemIds}
          editor={editor}
          jobs={jobs}
          modelAssets={modelAssets}
          renderScene={renderScene}
          sceneSettings={editor.scene.settings}
          textures={textures}
          workingSet={workingSet}
          world={world}
        />
      </EditorActionDomainsProvider>
      <input
        accept=".whmap,.json"
        hidden
        onChange={projectFileInputHandlers.handleWhmapFileChange}
        ref={fileInputRef}
        type="file"
      />
      <input
        accept=".whdoc,.json"
        hidden
        multiple
        onChange={projectFileInputHandlers.handleSceneDocumentFileChange}
        ref={sceneDocumentInputRef}
        type="file"
      />
      <input
        accept=".glb,.gltf,.obj,model/gltf-binary,model/gltf+json"
        hidden
        multiple
        onChange={assetFileInputHandlers.handleGlbFileChange}
        ref={glbImportInputRef}
        type="file"
      />
      <input
        accept=".glb,.gltf,.obj,model/gltf-binary,model/gltf+json"
        hidden
        onChange={assetFileInputHandlers.handleAssetLodFileChange}
        ref={modelLodInputRef}
        type="file"
      />
    </>
  );
}

function useEventCallback<T extends (...args: any[]) => unknown>(callback: T): T {
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  return useCallback(((...args: Parameters<T>) => callbackRef.current(...args)) as T, []);
}

function areTextureArraysEqual(previous: TextureRecord[], next: TextureRecord[]) {
  if (previous === next) {
    return true;
  }

  if (previous.length !== next.length) {
    return false;
  }

  return previous.every((texture, index) => {
    const nextTexture = next[index];

    return (
      texture === nextTexture ||
      (texture.id === nextTexture.id &&
        texture.name === nextTexture.name &&
        texture.kind === nextTexture.kind &&
        texture.dataUrl === nextTexture.dataUrl &&
        texture.mimeType === nextTexture.mimeType &&
        texture.source === nextTexture.source &&
        texture.prompt === nextTexture.prompt &&
        texture.model === nextTexture.model &&
        texture.createdAt === nextTexture.createdAt &&
        texture.size === nextTexture.size)
    );
  });
}
