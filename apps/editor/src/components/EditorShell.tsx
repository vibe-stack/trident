import type { EditorCore, SceneSpatialAnalysis } from "@ggez/editor-core";
import { gridSnapValues, type DerivedRenderScene } from "@ggez/render-pipeline";
import { isInstancingSourceNode } from "@ggez/shared";
import type {
  SceneSettings,
  TextureRecord,
} from "@ggez/shared";
import { defaultTools } from "@ggez/tool-system";
import type { WorkerJob } from "@ggez/workers";
import { useState, useCallback, useEffect, type ReactNode } from "react";
import { useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from "react";
import { useSnapshot } from "valtio";
import type { CopilotSession } from "@/lib/copilot/types";
import { useEditorActionDomains } from "@/app/editor-action-domains";
import { AiModelPromptBar } from "@/components/editor-shell/AiModelPromptBar";
import { CopilotPanel } from "@/components/editor-shell/CopilotPanel";
import { EditorMenuBar } from "@/components/editor-shell/EditorMenuBar";
import { FileBrowserPanel } from "@/components/editor-shell/FileBrowserPanel";
import { MonacoEditorPanel, resolveLanguage, type OpenFile } from "@/components/editor-shell/MonacoEditorPanel";
import { WelcomeScreen, addRecentProject, getRecentProjects } from "@/components/editor-shell/WelcomeScreen";
import { InspectorSidebar } from "@/components/editor-shell/InspectorSidebar";
import { StatusBar } from "@/components/editor-shell/StatusBar";
import { ToolPaletteContainer } from "@/components/editor-shell/ToolPaletteContainer";
import { LogicViewerSheet } from "@/components/editor-shell/logic-viewer/LogicViewerSheet";
import { TerminalPanel } from "@/components/editor-shell/TerminalPanel";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { ViewportCanvas } from "@/viewport/ViewportCanvas";
import type { MeshEditMode } from "@/viewport/editing";
import type { MeshEditToolbarActionRequest } from "@/viewport/types";
import { uiStore, type RightPanelId, type ViewportQuality } from "@/state/ui-store";
import type { ModelAssetLibraryItem } from "@/lib/model-assets";
import { ConnectedViewportCanvas } from "@/viewport/ConnectedViewportCanvas";
import { projectSessionStore } from "@/state/project-session-store";
import { sceneSessionStore } from "@/state/scene-session-store";
import { toolSessionStore } from "@/state/tool-session-store";
import { uiStore, type ViewportQuality } from "@/state/ui-store";
import {
  getViewModePreset,
  viewportPaneDefinitions,
  type ViewModeId,
  type ViewportPaneId,
} from "@/viewport/viewports";
import { cn } from "@/lib/utils";

type EditorShellProps = {
  copilot: {
    session: CopilotSession;
    sendMessage: (prompt: string) => void;
    abort: () => void;
    clearHistory: () => void;
    isConfigured: boolean;
    refreshConfigured: () => void;
  };
  gameConnectionControl?: ReactNode;
  analysis: SceneSpatialAnalysis;
  editor: EditorCore;
  effectiveHiddenSceneItemIds: string[];
  effectiveLockedSceneItemIds: string[];
  jobs: WorkerJob[];
  meshEditMode: MeshEditMode;
  meshEditToolbarAction?: MeshEditToolbarActionRequest;
  sculptMode?: "deflate" | "inflate" | null;
  sculptBrushRadius: number;
  sculptBrushStrength: number;
  onActivateViewport: (viewportId: ViewportPaneId) => void;
  onApplyMaterial: (materialId: string, scope: "faces" | "object", faceIds: string[]) => void;
  onClipSelection: (axis: TransformAxis) => void;
  onCommitMeshTopology: (nodeId: string, mesh: EditableMesh) => void;
  onCreateBrush: () => void;
  onDeleteSelection: () => void;
  onDuplicateSelection: () => void;
  onGroupSelection: () => void;
  onClearSelection: () => void;
  onExportEngine: () => void;
  onExportGltf: () => void;
  onExtrudeSelection: (axis: TransformAxis, direction: -1 | 1) => void;
  onFocusNode: (nodeId: string) => void;
  onDeleteMaterial: (materialId: string) => void;
  onDeleteTexture: (textureId: string) => void;
  onCancelAiModelPlacement: () => void;
  onLoadWhmap: () => void;
  onLoadWhmapFromString?: (text: string) => Promise<void>;
  onInvertSelectionNormals: () => void;
  onPausePhysics: () => void;
  onMeshEditToolbarAction: (action: MeshEditToolbarActionRequest["kind"]) => void;
  onPlaceEntity: (type: EntityType) => void;
  onPlaceLight: (type: LightType) => void;
  onPlaceBlockoutOpenRoom: () => void;
  onPlaceBlockoutPlatform: () => void;
  onPlaceBlockoutRoom: () => void;
  onPlaceBlockoutStairs: () => void;
  onMirrorSelection: (axis: TransformAxis) => void;
  onGenerateAiModel: () => void;
  onImportGlb: () => void;
  onPlaceAsset: (position: { x: number; y: number; z: number }) => void;
  onPlaceAiModelPlaceholder: (position: { x: number; y: number; z: number }) => void;
  onPlaceBrush: (brush: Brush, transform: Transform) => void;
  onPlaceMeshNode: (mesh: EditableMesh, transform: Transform, name: string) => void;
  onPlacePrimitiveNode: (data: PrimitiveNodeData, transform: Transform, name: string) => void;
  onPlaceProp: (shape: PrimitiveShape) => void;
  onPlayPhysics: () => void;
  onPreviewBrushData: (nodeId: string, brush: Brush) => void;
  onPreviewEntityTransform: (entityId: string, transform: Transform) => void;
  onPreviewMeshData: (nodeId: string, mesh: EditableMesh) => void;
  onSculptModeChange: (mode: "deflate" | "inflate" | null) => void;
  onRedo: () => void;
  onSaveWhmap: () => void;
  onSelectAsset: (assetId: string) => void;
  onSelectMaterialFaces: (faceIds: string[]) => void;
  onSelectMaterial: (materialId: string) => void;
  onSelectScenePath: (pathId: string | undefined) => void;
  onStartAiModelPlacement: () => void;
  onSetUvOffset: (scope: "faces" | "object", faceIds: string[], uvOffset: Vec2) => void;
  onSetUvScale: (scope: "faces" | "object", faceIds: string[], uvScale: Vec2) => void;
  onSelectNodes: (nodeIds: string[]) => void;
  onSetActiveBrushShape: (shape: BrushShape) => void;
  onSetMeshEditMode: (mode: MeshEditMode) => void;
  onSetSculptBrushRadius: (value: number) => void;
  onSetSculptBrushStrength: (value: number) => void;
  onSetRightPanel: (panel: RightPanelId | null) => void;
  onSetSnapEnabled: (enabled: boolean) => void;
  onSetSnapSize: (snapSize: GridSnapValue) => void;
  onStopPhysics: () => void;
  onSetTransformMode: (mode: "rotate" | "scale" | "translate") => void;
  onSetToolId: (toolId: ToolId) => void;
  onToggleCopilot: () => void;
  onToggleLogicViewer: () => void;
  onToggleViewportQuality: () => void;
  onSetViewMode: (viewMode: ViewModeId) => void;
  onSplitBrushAtCoordinate: (nodeId: string, axis: TransformAxis, coordinate: number) => void;
  onPreviewNodeTransform: (nodeId: string, transform: Transform) => void;
  onTranslateSelection: (axis: TransformAxis, direction: -1 | 1) => void;
  onUndo: () => void;
  onUpdateEntityProperties: (entityId: string, properties: Record<string, string | number | boolean>) => void;
  onUpdateEntityHooks: (entityId: string, hooks: NonNullable<Entity["hooks"]>, beforeHooks?: NonNullable<Entity["hooks"]>) => void;
  onUpdateEntityTransform: (entityId: string, transform: Transform, beforeTransform?: Transform) => void;
  onUpdateMeshData: (nodeId: string, mesh: EditableMesh, beforeMesh?: EditableMesh) => void;
  onUpdateNodeData: (nodeId: string, data: PrimitiveNodeData | LightNodeData) => void;
  onUpdateNodeHooks: (nodeId: string, hooks: NonNullable<GeometryNode["hooks"]>, beforeHooks?: NonNullable<GeometryNode["hooks"]>) => void;
  onUpdateAiModelPrompt: (prompt: string) => void;
  onUpdateSceneSettings: (settings: SceneSettings, beforeSettings?: SceneSettings) => void;
  onUpdateViewport: (viewportId: ViewportPaneId, viewport: ViewportState) => void;
  onUpsertMaterial: (material: Material) => void;
  onUpsertTexture: (texture: TextureRecord) => void;
  onUpdateBrushData: (nodeId: string, brush: Brush, beforeBrush?: Brush) => void;
  onUpdateNodeTransform: (nodeId: string, transform: Transform, beforeTransform?: Transform) => void;
  physicsPlayback: "paused" | "running" | "stopped";
  physicsRevision: number;
  modelAssets: ModelAssetLibraryItem[];
  renderScene: DerivedRenderScene;
  sceneSettings: SceneSettings;
  textures: TextureRecord[];
  workingSet: {
    activeDocumentId?: string;
    loadedDocumentIds: string[];
    mode: "scene" | "world";
    pinnedDocumentIds: string[];
  };
};

export function EditorShell({
  copilot,
  gameConnectionControl,
  analysis,
  editor,
  effectiveHiddenSceneItemIds,
  effectiveLockedSceneItemIds,
  jobs,
  meshEditMode,
  meshEditToolbarAction,
  sculptMode,
  sculptBrushRadius,
  sculptBrushStrength,
  onActivateViewport,
  onApplyMaterial,
  onClipSelection,
  onCommitMeshTopology,
  onCreateBrush,
  onDeleteSelection,
  onDuplicateSelection,
  onGroupSelection,
  onClearSelection,
  onExportEngine,
  onExportGltf,
  onExtrudeSelection,
  onFocusNode,
  onDeleteMaterial,
  onDeleteTexture,
  onCancelAiModelPlacement,
  onLoadWhmap,
  onLoadWhmapFromString,
  onInvertSelectionNormals,
  onPausePhysics,
  onMeshEditToolbarAction,
  onPlaceEntity,
  onPlaceLight,
  onPlaceBlockoutOpenRoom,
  onPlaceBlockoutPlatform,
  onPlaceBlockoutRoom,
  onPlaceBlockoutStairs,
  onMirrorSelection,
  onGenerateAiModel,
  onImportGlb,
  onPlaceAsset,
  onPlaceAiModelPlaceholder,
  onPlaceBrush,
  onPlaceMeshNode,
  onPlacePrimitiveNode,
  onPlaceProp,
  onPlayPhysics,
  onPreviewBrushData,
  onPreviewEntityTransform,
  onPreviewMeshData,
  onSculptModeChange,
  onRedo,
  onSaveWhmap,
  onSelectAsset,
  onSelectMaterialFaces,
  onSelectMaterial,
  onSelectScenePath,
  onStartAiModelPlacement,
  onSetUvOffset,
  onSetUvScale,
  onSelectNodes,
  onSetActiveBrushShape,
  onSetMeshEditMode,
  onSetSculptBrushRadius,
  onSetSculptBrushStrength,
  onSetRightPanel,
  onSetSnapEnabled,
  onSetSnapSize,
  onStopPhysics,
  onSetTransformMode,
  onSetToolId,
  onToggleCopilot,
  onToggleLogicViewer,
  onToggleViewportQuality,
  onSetViewMode,
  onSplitBrushAtCoordinate,
  onPreviewNodeTransform,
  onTranslateSelection,
  onUndo,
  onUpdateEntityProperties,
  onUpdateEntityHooks,
  onUpdateEntityTransform,
  onUpdateNodeData,
  onUpdateNodeHooks,
  onUpdateAiModelPrompt,
  onUpdateSceneSettings,
  onUpdateViewport,
  onUpsertMaterial,
  onUpsertTexture,
  onUpdateBrushData,
  onUpdateMeshData,
  onUpdateNodeTransform,
  physicsPlayback,
  physicsRevision,
  modelAssets,
  renderScene,
  sceneSettings,
  textures,
  workingSet
}: EditorShellProps) {
  const ui = useSnapshot(uiStore);
  void analysis;
  const {
    aiActions,
    assetActions,
    fileActions,
    history,
    placementActions,
    sceneActions,
    selectionActions
  } = useEditorActionDomains();
  const { canRedo, canUndo, redo: onRedo, undo: onUndo } = history;
  const {
    cancelPlacement: onCancelAiModelPlacement,
    generateModel: onGenerateAiModel,
    updatePrompt: onUpdateAiModelPrompt
  } = aiActions;
  const {
    applyMaterial: onApplyMaterial,
    assignAssetLod: onAssignAssetLod,
    clearAssetLod: onClearAssetLod,
    deleteAsset: onDeleteAsset,
    deleteMaterial: onDeleteMaterial,
    deleteTexture: onDeleteTexture,
    dropImportGlb: onDropImportGlb,
    focusAssetNodes: onFocusAssetNodes,
    importAsset: onImportAsset,
    insertAsset: onInsertAsset,
    selectAsset: onSelectAsset,
    selectMaterial: onSelectMaterial,
    setUvOffset: onSetUvOffset,
    setUvRotation: onSetUvRotation,
    setUvScale: onSetUvScale,
    upsertMaterial: onUpsertMaterial,
    upsertTexture: onUpsertTexture
  } = assetActions;
  const {
    createBrush: onCreateBrush,
    exportEngine: onExportEngine,
    exportGltf: onExportGltf,
    exportSceneDocument: onExportSceneDocument,
    importSceneDocument: onImportSceneDocument,
    loadWhmap: onLoadWhmap,
    newFile: onNewFile,
    saveWhmap: onSaveWhmap
  } = fileActions;
  const {
    placeAsset: onPlaceAsset,
  } = placementActions;
  const {
    meshEditToolbarAction: onMeshEditToolbarAction,
    updateEntityHooks: onUpdateEntityHooks,
    updateEntityProperties: onUpdateEntityProperties,
    updateEntityTransform: onUpdateEntityTransform,
    updateMeshData: onUpdateMeshData,
    updateNodeData: onUpdateNodeData,
    updateNodeHooks: onUpdateNodeHooks,
    updateNodeTransform: onUpdateNodeTransform,
    updateSceneSettings: onUpdateSceneSettings
  } = sceneActions;
  const {
    clearSelection: onClearSelection,
    clipSelection: onClipSelection,
    deleteSelection: onDeleteSelection,
    duplicateSelection: onDuplicateSelection,
    extrudeSelection: onExtrudeSelection,
    focusNode: onFocusNode,
    groupSelection: onGroupSelection,
    mirrorSelection: onMirrorSelection,
    selectNodes: onSelectNodes,
    toggleSceneItemLock: onToggleSceneItemLock,
    toggleSceneItemVisibility: onToggleSceneItemVisibility,
    translateSelection: onTranslateSelection
  } = selectionActions;
  const ui = useSnapshot(uiStore);
  const toolSession = useSnapshot(toolSessionStore);
  const projectSession = useSnapshot(projectSessionStore);
  const sceneSession = useSnapshot(sceneSessionStore);
  const {
    activeBrushShape,
    activeToolId,
    aiModelDraft,
    aiModelPlacementArmed,
    brushToolMode,
    instanceBrushAlignToNormal,
    instanceBrushAverageNormal,
    instanceBrushDensity,
    instanceBrushRandomness,
    instanceBrushSize,
    instanceBrushSourceNodeId,
    instanceBrushSourceNodeIds,
    instanceBrushYOffsetMin,
    instanceBrushYOffsetMax,
    instanceBrushScaleMin,
    instanceBrushScaleMax,
    materialPaintBrushOpacity,
    materialPaintMode,
    meshEditMode,
    meshEditToolbarAction,
    physicsPlayback,
    physicsRevision,
    sculptBrushRadius,
    sculptBrushStrength,
    sculptMode,
    transformMode
  } = toolSession;
  const activeRightPanel = ui.rightPanel;
  const activeViewportId = ui.activeViewportId;
  const renderMode = ui.renderMode;
  const selectedAssetId = ui.selectedAssetId;
  const selectedMaterialId = ui.selectedMaterialId;
  const viewMode = ui.viewMode;
  const viewportQuality = ui.viewportQuality;
  const viewports = ui.viewports;
  const hiddenSceneItemIds = sceneSession.hiddenSceneItemIds;
  const lockedSceneItemIds = sceneSession.lockedSceneItemIds;
  const selectedFaceIds = sceneSession.selectedMaterialFaceIds;
  const selectedScenePathId = sceneSession.selectedScenePathId;
  const selectionEnabled = physicsPlayback === "stopped";
  const nodes = Array.from(editor.scene.nodes.values());
  const entities = Array.from(editor.scene.entities.values());
  const materials = Array.from(editor.scene.materials.values());
  const selectedObjectId = selectionEnabled ? editor.selection.ids[0] : undefined;
  const selectedNodeId = selectedObjectId && editor.scene.getNode(selectedObjectId) ? selectedObjectId : undefined;
  const selectedNode = selectedNodeId ? editor.scene.getNode(selectedNodeId) : undefined;
  const selectedEntity = !selectedNodeId && selectedObjectId ? editor.scene.getEntity(selectedObjectId) : undefined;
  const selectedNodeIds = selectionEnabled ? editor.selection.ids : [];
  const selectedNodes = selectedNodeIds
    .map((nodeId) => editor.scene.getNode(nodeId))
    .filter((node): node is NonNullable<typeof node> => Boolean(node));
  const activeToolLabel = defaultTools.find((tool) => tool.id === activeToolId)?.label ?? activeToolId;
  const activeViewport = viewports[activeViewportId];
  const aiModelPlacementActive = Boolean(aiModelDraft);
  const aiModelPrompt = aiModelDraft?.prompt ?? "";
  const aiModelPromptError = aiModelDraft?.error;
  const instanceBrushSourceNode = useMemo(
    () => nodes.find((node) => node.id === instanceBrushSourceNodeId && isInstancingSourceNode(node)),
    [instanceBrushSourceNodeId, nodes]
  );
  const instanceBrushSourceTransform = useMemo(() => {
    if (!instanceBrushSourceNode) {
      return undefined;
    }

    return (
      renderScene.nodeTransforms.get(instanceBrushSourceNode.id) ??
      (workingSet.mode === "world" && workingSet.activeDocumentId
        ? renderScene.nodeTransforms.get(`${workingSet.activeDocumentId}::${instanceBrushSourceNode.id}`)
        : undefined) ??
      instanceBrushSourceNode.transform
    );
  }, [instanceBrushSourceNode, renderScene.nodeTransforms, workingSet.activeDocumentId, workingSet.mode]);

  const viewportAreaRef = useRef<HTMLDivElement | null>(null);
  const [glbDragOver, setGlbDragOver] = useState(false);

  const handleViewportDragOver = (event: DragEvent<HTMLDivElement>) => {
    const hasGlb = Array.from(event.dataTransfer.items).some(
      (item) =>
        item.kind === "file" &&
        (item.type === "model/gltf-binary" ||
          item.type === "model/gltf+json" ||
          item.type === "") // browsers often report empty type for binary files
    );

    if (hasGlb || event.dataTransfer.types.includes("Files")) {
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
      setGlbDragOver(true);
    }
  };

  const handleViewportDragLeave = (event: DragEvent<HTMLDivElement>) => {
    if (!viewportAreaRef.current?.contains(event.relatedTarget as Node)) {
      setGlbDragOver(false);
    }
  };

  const handleViewportDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setGlbDragOver(false);

    const files = Array.from(event.dataTransfer.files).filter((file) => {
      const lower = file.name.toLowerCase();
      return lower.endsWith(".glb") || lower.endsWith(".gltf") || lower.endsWith(".obj");
    });

    if (files.length === 0) {
      return;
    }

    const canvasRect = viewportAreaRef.current?.getBoundingClientRect();

    if (!canvasRect) {
      return;
    }

    void onDropImportGlb(files, event.clientX, event.clientY, canvasRect);
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

  const handleToggleCopilot = () => {
    uiStore.copilotPanelOpen = !uiStore.copilotPanelOpen;
  };

  const handleToggleLogicViewer = () => {
    uiStore.logicViewerOpen = !uiStore.logicViewerOpen;
  };

  const editorMenuActions = {
    onClearSelection,
    onCreateBrush,
    onDeleteSelection,
    onDuplicateSelection,
    onExportEngine,
    onExportGltf,
    onExportSceneDocument,
    onGroupSelection,
    onImportSceneDocument,
    onLoadWhmap,
    onNewFile,
    onRedo,
    onSaveWhmap,
    onToggleCopilot: handleToggleCopilot,
    onToggleLogicViewer: handleToggleLogicViewer,
    onToggleViewportQuality: handleToggleViewportQuality,
    onUndo
  };
  const inspectorActions = {
    onApplyMaterial,
    onAssignAssetLod,
    onChangeRightPanel: (panel: typeof activeRightPanel) => {
      uiStore.rightPanel = panel;
    },
    onClearAssetLod,
    onClipSelection,
    onDeleteAsset,
    onDeleteMaterial,
    onDeleteTexture,
    onExtrudeSelection,
    onFocusAssetNodes,
    onFocusNode,
    onImportAsset,
    onInsertAsset,
    onMeshEditToolbarAction,
    onMirrorSelection,
    onPlaceAsset,
    onSelectAsset,
    onSelectMaterial,
    onSelectNodes,
    onSetUvOffset,
    onSetUvRotation,
    onSetUvScale,
    onToggleSceneItemLock,
    onToggleSceneItemVisibility,
    onTranslateSelection,
    onUpdateEntityHooks,
    onUpdateEntityProperties,
    onUpdateEntityTransform,
    onUpdateMeshData,
    onUpdateNodeData,
    onUpdateNodeHooks,
    onUpdateNodeTransform,
    onUpdateSceneSettings,
    onUpsertMaterial,
    onUpsertTexture
  };
  const logicViewerActions = {
    onClose: handleToggleLogicViewer,
    onUpdateEntityHooks,
    onUpdateNodeHooks
  };

  // ── File Browser + Monaco Editor State ──────────────────────────

  const [openFiles, setOpenFiles] = useState<OpenFile[]>([]);
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null);
  const [editorFullscreen, setEditorFullscreen] = useState(false);
  const terminalOpen = ui.terminalOpen;
  const api = (window as any).electronAPI;
  const isElectron = !!api?.isElectron;

  // Listen for Electron project:opened events
  useEffect(() => {
    if (!isElectron) return;
    const unsub = api.onProjectOpened?.((projectPath: string) => {
      uiStore.projectPath = projectPath;
      uiStore.fileBrowserOpen = true;
      addRecentProject(projectPath);
    });
    return unsub;
  }, [isElectron]);

  // Auto-load last opened project on boot
  useEffect(() => {
    if (!isElectron || uiStore.projectPath) return;
    const recents = getRecentProjects();
    if (recents.length > 0 && api.openRecentProject) {
      api.openRecentProject(recents[0].path).catch(console.error);
    }
  }, [isElectron, api]);

  // Listen for menu events to toggle file browser
  useEffect(() => {
    if (!isElectron) return;
    const unsubOpen = api.onOpenProject?.(() => api.openProject());
    const unsubCreate = api.onCreateProject?.(() => api.createProject());
    const unsubSave = api.onSave?.(onSaveWhmap);
    return () => { unsubOpen?.(); unsubCreate?.(); unsubSave?.(); };
  }, [isElectron, api, onSaveWhmap]);

  const handleFileOpen = useCallback(async (filePath: string) => {
    // Don't open binary files in Monaco
    const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
    const binaryExts = ["png", "jpg", "jpeg", "gif", "webp", "glb", "gltf", "hdr", "exr", "mp3", "wav", "ogg", "mp4", "webm", "fbx", "obj", "zip"];
    if (binaryExts.includes(ext)) return;

    // Check if file is already open
    const existing = openFiles.find((f) => f.path === filePath);
    if (existing) {
      setActiveFilePath(filePath);
      return;
    }

    if (!isElectron) return;

    try {
      const content = await api.readFile(filePath, "utf8");
      const name = filePath.split(/[\\/]/).pop() ?? "file";
      const newFile: OpenFile = {
        path: filePath,
        name,
        content: typeof content === "string" ? content : "",
        language: resolveLanguage(name),
        isDirty: false,
      };
      setOpenFiles((prev) => [...prev, newFile]);
      setActiveFilePath(filePath);
    } catch (err) {
      console.error("Failed to open file:", err);
    }
  }, [openFiles, isElectron]);

  const handleFileDoubleClick = useCallback(async (filePath: string) => {
    if (!isElectron) return;
    if (filePath.endsWith(".whmap")) {
      try {
        const content = await api.readFile(filePath, "utf8");
        if (onLoadWhmapFromString) {
          await onLoadWhmapFromString(content);
        }
      } catch (err) {
        console.error("Failed to load .whmap via double click:", err);
      }
    }
  }, [isElectron, onLoadWhmapFromString]);

  const handleCloseFile = useCallback((path: string) => {
    setOpenFiles((prev) => prev.filter((f) => f.path !== path));
    setActiveFilePath((current) => {
      if (current !== path) return current;
      const remaining = openFiles.filter((f) => f.path !== path);
      return remaining.length > 0 ? remaining[remaining.length - 1].path : null;
    });
  }, [openFiles]);

  const handleCloseAllFiles = useCallback(() => {
    setOpenFiles([]);
    setActiveFilePath(null);
  }, []);

  const handleContentChange = useCallback((path: string, content: string) => {
    setOpenFiles((prev) =>
      prev.map((f) => (f.path === path ? { ...f, content, isDirty: true } : f))
    );
  }, []);

  const handleSaveFile = useCallback(async (path: string, content: string) => {
    if (!isElectron) return;
    try {
      await api.writeFile(path, content);
      setOpenFiles((prev) =>
        prev.map((f) => (f.path === path ? { ...f, isDirty: false } : f))
      );
    } catch (err) {
      console.error("Failed to save file:", err);
    }
  }, [isElectron]);

  const handleToggleFileBrowser = useCallback(() => {
    uiStore.fileBrowserOpen = !uiStore.fileBrowserOpen;
  }, []);

  // ── Project Management Actions ───────────────────────────────────

  const handleOpenProject = useCallback(async () => {
    if (!isElectron) return;
    const projectPath = await api.openProject();
    if (projectPath) {
      uiStore.projectPath = projectPath;
      uiStore.fileBrowserOpen = true;
    }
  }, [isElectron]);

  const handleCreateProject = useCallback(async () => {
    if (!isElectron) return;
    const projectPath = await api.createProject();
    if (projectPath) {
      uiStore.projectPath = projectPath;
      uiStore.fileBrowserOpen = true;
    }
  }, [isElectron]);

  const handleOpenRecentProject = useCallback(async (projectPath: string) => {
    if (!isElectron) return;
    try {
      if (api.openRecentProject) {
        const openedPath = await api.openRecentProject(projectPath);
        if (openedPath) {
          uiStore.projectPath = openedPath;
          uiStore.fileBrowserOpen = true;
        }
      } else {
        uiStore.projectPath = projectPath;
        uiStore.fileBrowserOpen = true;
      }
    } catch {
      console.error("Failed to open recent project", projectPath);
    }
  }, [isElectron, api]);

  const handleOpenAnimationStudio = useCallback(async () => {
    if (!isElectron) return;
    try {
      if (api.openAnimationStudio) {
        await api.openAnimationStudio();
      }
    } catch {
      console.error("Failed to open Animation Studio");
    }
  }, [isElectron, api]);

  // Keyboard shortcuts for project management
  useEffect(() => {
    if (!isElectron) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey) {
        if (e.key === "o" || e.key === "O") {
          e.preventDefault();
          void handleOpenProject();
        } else if (e.key === "n" || e.key === "N") {
          e.preventDefault();
          void handleCreateProject();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isElectron, handleOpenProject, handleCreateProject]);

  const renderViewportPane = (viewportId: ViewportPaneId) => {
    const definition = viewportPaneDefinitions[viewportId];

    return (
      <ViewportPaneFrame
        key={viewportId}
        label={definition.shortLabel}
      >
        <ViewportCanvas
          activeBrushShape={activeBrushShape}
          aiModelPlacementArmed={aiModelPlacementArmed}
          activeToolId={activeToolId}
          dprScale={resolveViewportDprScale(viewportQuality)}
          isActiveViewport={activeViewportId === viewportId}
          meshEditMode={meshEditMode}
          meshEditToolbarAction={meshEditToolbarAction}
          sculptBrushRadius={sculptBrushRadius}
          sculptBrushStrength={sculptBrushStrength}
          onActivateViewport={onActivateViewport}
          onClearSelection={onClearSelection}
          onCommitMeshTopology={onCommitMeshTopology}
          onFocusNode={onFocusNode}
          onPlaceAsset={onPlaceAsset}
          onPlaceAiModelPlaceholder={onPlaceAiModelPlaceholder}
          onPlaceBrush={onPlaceBrush}
          onPlaceMeshNode={onPlaceMeshNode}
          onPlacePrimitiveNode={onPlacePrimitiveNode}
          onPreviewBrushData={onPreviewBrushData}
          onPreviewEntityTransform={onPreviewEntityTransform}
          onPreviewMeshData={onPreviewMeshData}
          onPreviewNodeTransform={onPreviewNodeTransform}
          onSculptModeChange={activeViewportId === viewportId ? onSculptModeChange : () => { }}
          onSelectMaterialFaces={onSelectMaterialFaces}
          onSelectScenePath={onSelectScenePath}
          onSelectNodes={onSelectNodes}
          onSetToolId={onSetToolId}
          onSplitBrushAtCoordinate={onSplitBrushAtCoordinate}
          onUpdateBrushData={onUpdateBrushData}
          onUpdateEntityTransform={onUpdateEntityTransform}
          onUpdateMeshData={onUpdateMeshData}
          onUpdateNodeTransform={onUpdateNodeTransform}
          onUpdateSceneSettings={onUpdateSceneSettings}
          onViewportChange={onUpdateViewport}
          physicsPlayback={physicsPlayback}
          physicsRevision={physicsRevision}
          renderMode={definition.renderMode}
        <ConnectedViewportCanvas
          hiddenSceneItemIds={effectiveHiddenSceneItemIds}
          instanceBrushSourceTransform={instanceBrushSourceTransform}
          renderScene={renderScene}
          sceneSettings={sceneSettings}
          selectedEntity={selectedEntity}
          selectedNode={selectedNode}
          selectedNodeIds={selectedNodeIds}
          selectedNodes={selectedNodes}
          viewportId={viewportId}
          viewportPlane={definition.plane}
        />
      </ViewportPaneFrame>
    );
  };

  // ── Electron: Show WelcomeScreen overlay when no project is open ────────


  return (
    <div className="flex h-screen flex-col bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.08),transparent_24%),linear-gradient(180deg,#08100d_0%,#050807_100%)] text-foreground">
      <header className="shrink-0 bg-black/18 backdrop-blur-xl">
        <EditorMenuBar
          {...editorMenuActions}
          canRedo={canRedo}
          canUndo={canUndo}
          copilotOpen={copilotPanelOpen}
          fileBrowserOpen={ui.fileBrowserOpen}
          gameConnectionControl={gameConnectionControl}
          isElectron={isElectron}
          logicViewerOpen={logicViewerOpen}
          onClearSelection={onClearSelection}
          onCreateBrush={onCreateBrush}
          onCreateProject={handleCreateProject}
          onDeleteSelection={onDeleteSelection}
          onDuplicateSelection={onDuplicateSelection}
          onGroupSelection={onGroupSelection}
          onExportEngine={onExportEngine}
          onExportGltf={onExportGltf}
          copilotOpen={ui.copilotPanelOpen}
          gameConnectionControl={gameConnectionControl}
          logicViewerOpen={ui.logicViewerOpen}
          onFocusSelection={() => {
            if (selectedObjectId) {
              onFocusNode(selectedObjectId);
            }
          }}
          onLoadWhmap={onLoadWhmap}
          onOpenProject={handleOpenProject}
          onOpenAnimationStudio={handleOpenAnimationStudio}
          onRedo={onRedo}
          onSaveWhmap={onSaveWhmap}
          onToggleCopilot={onToggleCopilot}
          onToggleFileBrowser={() => { uiStore.fileBrowserOpen = !uiStore.fileBrowserOpen; }}
          onToggleLogicViewer={() => { uiStore.logicViewerOpen = !uiStore.logicViewerOpen; }}
          onToggleTerminal={() => { uiStore.terminalOpen = !uiStore.terminalOpen; }}
          terminalOpen={terminalOpen}
          onToggleViewportQuality={onToggleViewportQuality}
          onUndo={onUndo}
          projectName={ui.projectPath?.split(/[\\/]/).pop() ?? null}
          viewportQuality={viewportQuality}
        />
      </header>

      <main className="relative min-h-0 flex-1">
        <ResizablePanelGroup orientation="horizontal">
          {/* Left: Left Sidebar (File Browser) */}
          {ui.fileBrowserOpen && (
            <>
              <ResizablePanel defaultSize={300} minSize={300} className="relative flex flex-col h-full w-full">
                <div className="flex-1 min-h-0">
                  <FileBrowserPanel
                    projectPath={ui.projectPath}
                    onFileOpen={handleFileOpen}
                    onFileDoubleClick={handleFileDoubleClick}
                    onClose={handleToggleFileBrowser}
                  />
                </div>
              </ResizablePanel>
              <ResizableHandle withHandle className="bg-white/5 hover:bg-emerald-400/50 transition-colors" />
            </>
          )}

          {/* Center: Viewport + Bottom Docks */}
          <ResizablePanel
            className="relative flex flex-col h-full w-full min-w-0"
          >
            <ResizablePanelGroup orientation="vertical">
              {/* Viewport + Overlays */}
              <ResizablePanel defaultSize={openFiles.length > 0 || (isElectron && terminalOpen) ? 70 : 100} className="relative z-0 flex flex-col h-full w-full min-h-[300px]">
                <div className="absolute inset-0">
                  <ViewportLayout renderViewportPane={renderViewportPane} viewMode={viewMode} />
                </div>

                <ToolPalette
                  activeBrushShape={activeBrushShape}
                  aiModelPlacementActive={aiModelPlacementActive || aiModelPlacementArmed}
                  activeToolId={activeToolId}
                  currentSnapSize={activeViewport.grid.snapSize}
                  gridSnapValues={gridSnapValues}
                  meshEditMode={meshEditMode}
                  onInvertSelectionNormals={onInvertSelectionNormals}
                  onLowerTop={() => onExtrudeSelection("y", -1)}
                  onPausePhysics={onPausePhysics}
                  onMeshEditToolbarAction={onMeshEditToolbarAction}
                  onImportGlb={onImportGlb}
                  onPlaceEntity={onPlaceEntity}
                  onPlaceLight={onPlaceLight}
                  onPlaceBlockoutOpenRoom={onPlaceBlockoutOpenRoom}
                  onPlaceBlockoutPlatform={onPlaceBlockoutPlatform}
                  onPlaceBlockoutRoom={onPlaceBlockoutRoom}
                  onPlaceBlockoutStairs={onPlaceBlockoutStairs}
                  onPlaceProp={onPlaceProp}
                  onPlayPhysics={onPlayPhysics}
                  onRaiseTop={() => onExtrudeSelection("y", 1)}
                  onSetSculptBrushRadius={onSetSculptBrushRadius}
                  onSetSculptBrushStrength={onSetSculptBrushStrength}
                  onStartAiModelPlacement={onStartAiModelPlacement}
                  onSelectBrushShape={(shape) => {
                    onSetActiveBrushShape(shape);
                    onSetToolId("brush");
                  }}
                  onSetMeshEditMode={onSetMeshEditMode}
                  onSetSnapEnabled={onSetSnapEnabled}
                  onSetSnapSize={onSetSnapSize}
                  onStopPhysics={onStopPhysics}
                  onSetTransformMode={onSetTransformMode}
                  onSetToolId={onSetToolId}
                  onSetViewMode={onSetViewMode}
                  physicsPlayback={physicsPlayback}
                  sculptMode={sculptMode}
                  sculptBrushRadius={sculptBrushRadius}
                  sculptBrushStrength={sculptBrushStrength}
                  selectedGeometry={selectedIsGeometry}
                  selectedMesh={selectedIsMesh}
                  snapEnabled={activeViewport.grid.enabled}
                  tools={tools}
                  transformMode={transformMode}
                  viewMode={viewMode}
                />

                <AiModelPromptBar
                  active={aiModelPlacementActive}
                  armed={aiModelPlacementArmed}
                  busy={aiModelPromptBusy}
                  error={aiModelPromptError}
                  onCancel={onCancelAiModelPlacement}
                  onChangePrompt={onUpdateAiModelPrompt}
                  onSubmit={onGenerateAiModel}
                  prompt={aiModelPrompt}
                />

                {/* <SpatialAnalysisPanel analysis={analysis} /> */}

                <StatusBar
                  activeBrushShape={activeBrushShape}
                  activeToolLabel={activeToolLabel}
                  activeViewportId={activeViewportId}
                  gridSnapValues={gridSnapValues}
                  jobs={jobs}
                  meshEditMode={meshEditMode}
                  selectedNode={selectedNode}
                  viewModeLabel={getViewModePreset(viewMode).shortLabel}
                  viewport={activeViewport}
                />

                {logicViewerOpen && (
                  <LogicViewerSheet
                    entities={entities}
                    nodes={nodes}
                    onClose={onToggleLogicViewer}
                    onNodeClick={(objectId) => {
                      onSelectNodes([objectId]);
                      if (editor.scene.getNode(objectId)) {
                        onFocusNode(objectId);
                      }
                    }}
                    onUpdateEntityHooks={onUpdateEntityHooks}
                    onUpdateNodeHooks={onUpdateNodeHooks}
                  />
                )}

                <InspectorSidebar
                  activeRightPanel={activeRightPanel}
                  activeToolId={activeToolId}
                  assets={assets}
                  entities={entities}
                  materials={materials}
                  meshEditMode={meshEditMode}
                  nodes={nodes}
                  onApplyMaterial={onApplyMaterial}
                  onChangeRightPanel={onSetRightPanel}
                  onClipSelection={onClipSelection}
                  onDeleteMaterial={onDeleteMaterial}
                  onDeleteTexture={onDeleteTexture}
                  onExtrudeSelection={onExtrudeSelection}
                  onFocusNode={onFocusNode}
                  onMeshEditToolbarAction={onMeshEditToolbarAction}
                  onMirrorSelection={onMirrorSelection}
                  onPlaceAsset={onPlaceAsset}
                  onSelectAsset={onSelectAsset}
                  onSelectMaterial={onSelectMaterial}
                  onSelectScenePath={onSelectScenePath}
                  onSelectNodes={onSelectNodes}
                  onSetToolId={onSetToolId}
                  onSetUvOffset={onSetUvOffset}
                  onSetUvScale={onSetUvScale}
                  onTranslateSelection={onTranslateSelection}
                  onUpsertMaterial={onUpsertMaterial}
                  onUpsertTexture={onUpsertTexture}
                  onUpdateEntityProperties={onUpdateEntityProperties}
                  onUpdateEntityHooks={onUpdateEntityHooks}
                  onUpdateEntityTransform={onUpdateEntityTransform}
                  onUpdateMeshData={onUpdateMeshData}
                  onUpdateNodeData={onUpdateNodeData}
                  onUpdateNodeHooks={onUpdateNodeHooks}
                  onUpdateSceneSettings={onUpdateSceneSettings}
                  onUpdateNodeTransform={onUpdateNodeTransform}
                  sceneSettings={sceneSettings}
                  selectedScenePathId={selectedScenePathId}
                  selectionEnabled={selectionEnabled}
                  selectedEntity={selectedEntity}
                  selectedAssetId={selectedAssetId}
                  selectedFaceIds={selectedFaceIds}
                  selectedMaterialId={selectedMaterialId}
                  selectedNode={selectedNode}
                  selectedNodeIds={selectedNodeIds}
                  textures={textures}
                  viewportTarget={activeViewport.camera.target}
                />
              </ResizablePanel>

              {/* Bottom Panels (Monaco / Terminal) */}
              {(openFiles.length > 0 || (isElectron && terminalOpen)) && (
                <>
                  <ResizableHandle withHandle className="bg-white/5 hover:bg-emerald-400/50 transition-colors relative z-50" />
                  <ResizablePanel defaultSize="30%" minSize="10%" className="relative z-10 flex flex-col h-full w-full bg-[#1e1e1e] shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
                    <ResizablePanelGroup orientation="horizontal">
                      {openFiles.length > 0 && (
                        <ResizablePanel defaultSize={isElectron && terminalOpen ? "60%" : "100%"} minSize="20%" className="relative flex flex-col h-full w-full">
                          <MonacoEditorPanel
                            files={openFiles}
                            activeFilePath={activeFilePath}
                            onSelectFile={setActiveFilePath}
                            onCloseFile={handleCloseFile}
                            onSaveFile={handleSaveFile}
                            onContentChange={handleContentChange}
                            onCloseAll={handleCloseAllFiles}
                            isFullscreen={editorFullscreen}
                            onToggleFullscreen={() => setEditorFullscreen((v) => !v)}
                          />
                        </ResizablePanel>
                      )}
                      {isElectron && terminalOpen && openFiles.length > 0 && (
                        <ResizableHandle withHandle className="bg-white/5 hover:bg-emerald-400/50 transition-colors" />
                      )}
                      {isElectron && terminalOpen && (
                        <ResizablePanel defaultSize={openFiles.length > 0 ? "40%" : "100%"} minSize="20%" className="relative flex flex-col h-full w-full">
                          <TerminalPanel projectPath={ui.projectPath} />
                        </ResizablePanel>
                      )}
                    </ResizablePanelGroup>
                  </ResizablePanel>
                </>
              )}
            </ResizablePanelGroup>
          </ResizablePanel>

          {/* Right Sidebar (Copilot) */}
          {copilotPanelOpen && (
            <>
              <ResizableHandle withHandle className="bg-white/5 hover:bg-emerald-400/50 transition-colors" />
              <ResizablePanel defaultSize={450} minSize={300} className="relative flex flex-col h-full w-full">
                <CopilotPanel
                  onAbort={copilot.abort}
                  onClearHistory={copilot.clearHistory}
                  isConfigured={copilot.isConfigured}
                  onClose={onToggleCopilot}
                  onSettingsChanged={copilot.refreshConfigured}
                  onSendMessage={copilot.sendMessage}
                  session={copilot.session}
                />
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>
        
        {/* Welcome Screen Overlay */}
        {isElectron && !ui.projectPath && (
          <WelcomeScreen
            onCreateProject={handleCreateProject}
            onOpenProject={handleOpenProject}
            onOpenRecentProject={handleOpenRecentProject}
          />
        )}
      <main className="relative min-h-0 flex-1 flex">
        <div
          className="relative min-w-0 flex-1"
          onDragLeave={handleViewportDragLeave}
          onDragOver={handleViewportDragOver}
          onDrop={handleViewportDrop}
          ref={viewportAreaRef}
        >
          <div className="absolute inset-0">
            <ViewportLayout renderViewportPane={renderViewportPane} viewMode={viewMode} />
          </div>

          {glbDragOver && (
            <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center rounded-sm border-2 border-dashed border-emerald-400/60 bg-emerald-500/8">
              <div className="rounded-2xl bg-black/60 px-6 py-4 text-center backdrop-blur-sm">
                <div className="text-sm font-medium text-emerald-200">Drop GLB to place in scene</div>
                <div className="mt-1 text-xs text-emerald-300/60">Natural scale — placed at cursor position</div>
              </div>
            </div>
          )}

        <ToolPaletteContainer editor={editor} />

        <AiModelPromptBar
          active={aiModelPlacementActive}
          armed={aiModelPlacementArmed}
          busy={false}
          error={aiModelPromptError}
          onCancel={onCancelAiModelPlacement}
          onChangePrompt={onUpdateAiModelPrompt}
          onSubmit={onGenerateAiModel}
          prompt={aiModelPrompt}
        />

        {/* <SpatialAnalysisPanel analysis={analysis} /> */}
        <InspectorSidebar
          {...inspectorActions}
          activeRightPanel={activeRightPanel}
          activeToolId={activeToolId}
          effectiveHiddenSceneItemIds={effectiveHiddenSceneItemIds}
          effectiveLockedSceneItemIds={effectiveLockedSceneItemIds}
          entities={entities}
          hiddenSceneItemIds={[...hiddenSceneItemIds]}
          lockedSceneItemIds={[...lockedSceneItemIds]}
          materials={materials}
          meshEditMode={meshEditMode}
          modelAssets={modelAssets}
          nodes={nodes}
          onSelectScenePath={(pathId) => {
            sceneSessionStore.selectedScenePathId = pathId;
          }}
          onSetToolId={(toolId) => {
            toolSessionStore.activeToolId = toolId;
          }}
          sceneSettings={sceneSettings}
          selectedScenePathId={selectedScenePathId}
          selectionEnabled={selectionEnabled}
          selectedEntity={selectedEntity}
          selectedAssetId={selectedAssetId}
          selectedFaceIds={[...selectedFaceIds]}
          selectedMaterialId={selectedMaterialId}
          selectedNode={selectedNode}
          selectedNodeIds={selectedNodeIds}
          textures={textures}
          viewportTarget={activeViewport.camera.target}
        />

        <StatusBar
          activeBrushShape={activeBrushShape}
          activeToolLabel={activeToolLabel}
          activeViewportId={activeViewportId}
          gridSnapValues={gridSnapValues}
          jobs={jobs}
          meshEditMode={meshEditMode}
          runtimeSyncDebugLabel={projectSession.runtimeSyncDebugLabel}
          selectedNode={selectedNode}
          viewModeLabel={getViewModePreset(viewMode).shortLabel}
          viewport={activeViewport}
        />

        {ui.logicViewerOpen && (
          <LogicViewerSheet
            {...logicViewerActions}
            entities={entities}
            nodes={nodes}
            onNodeClick={(objectId) => {
              onSelectNodes([objectId]);
              if (editor.scene.getNode(objectId)) {
                onFocusNode(objectId);
              }
            }}
          />
        )}
        </div>

        {ui.copilotPanelOpen && (
          <div className="w-80 shrink-0">
            <CopilotPanel
              isConfigured={copilot.isConfigured}
              onAbort={copilot.abort}
              onClearHistory={copilot.clearHistory}
              onClose={handleToggleCopilot}
              onSendMessage={copilot.sendMessage}
              onSettingsChanged={copilot.refreshConfigured}
              session={copilot.session}
            />
          </div>
        )}
      </main>
    </div>
  );
}

function ViewportLayout({
  renderViewportPane,
  viewMode
}: {
  renderViewportPane: (viewportId: ViewportPaneId) => ReactNode;
  viewMode: ViewModeId;
}) {
  const preset = getViewModePreset(viewMode);

  if (preset.layout === "single") {
    return <div className="size-full">{renderViewportPane("perspective")}</div>;
  }

  if (preset.layout === "split") {
    return (
      <ResizablePanelGroup className="size-full" orientation="horizontal">
        <ResizablePanel defaultSize={62} minSize={35}>
          {renderViewportPane("perspective")}
        </ResizablePanel>
        <ViewportSplitHandle />
        <ResizablePanel defaultSize={38} minSize={20}>
          {renderViewportPane(preset.secondaryPaneId)}
        </ResizablePanel>
      </ResizablePanelGroup>
    );
  }

  return (
    <ResizablePanelGroup className="size-full" orientation="horizontal">
      <ResizablePanel defaultSize={50} minSize={32}>
        <ResizablePanelGroup className="size-full" orientation="vertical">
          <ResizablePanel defaultSize={50} minSize={24}>
            {renderViewportPane("top")}
          </ResizablePanel>
          <ViewportSplitHandle direction="horizontal" />
          <ResizablePanel defaultSize={50} minSize={24}>
            {renderViewportPane("perspective")}
          </ResizablePanel>
        </ResizablePanelGroup>
      </ResizablePanel>
      <ViewportSplitHandle />
      <ResizablePanel defaultSize={50} minSize={32}>
        <ResizablePanelGroup className="size-full" orientation="vertical">
          <ResizablePanel defaultSize={50} minSize={24}>
            {renderViewportPane("front")}
          </ResizablePanel>
          <ViewportSplitHandle direction="horizontal" />
          <ResizablePanel defaultSize={50} minSize={24}>
            {renderViewportPane("side")}
          </ResizablePanel>
        </ResizablePanelGroup>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}

function ViewportPaneFrame({
  children,
  label
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <div
      className={cn("relative size-full overflow-hidden bg-[#071016]")}
    >
      <div className="pointer-events-none absolute left-3 top-3 z-20 rounded-full bg-black/36 px-2.5 py-1 text-[10px] font-medium tracking-[0.18em] text-foreground/72 uppercase">
        {label}
      </div>
      {children}
    </div>
  );
}

function ViewportSplitHandle({ direction = "vertical" }: { direction?: "horizontal" | "vertical" }) {
  return (
    <ResizableHandle
      className="bg-white/8 after:bg-transparent hover:bg-emerald-400/22 data-dragging:bg-emerald-400/28"
      withHandle={direction === "vertical"}
    />
  );
}
