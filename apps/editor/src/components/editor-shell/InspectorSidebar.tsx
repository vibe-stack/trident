import { useState } from "react";
import { BellRing, Cable, FolderTree, Globe2, Package, SlidersHorizontal, SwatchBook, User } from "lucide-react";
import {
  type EditableMesh,
  type Entity,
  type GeometryNode,
  type LightNodeData,
  type Material,
  type ModelReference,
  type ModelLodLevel,
  type PrimitiveNodeData,
  type SceneSettings,
  type TextureRecord,
  type Transform,
  type Vec3
} from "@ggez/shared";
import type { ToolId } from "@ggez/tool-system";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FloatingPanel } from "@/components/editor-shell/FloatingPanel";
import { EventsPanel, HooksPanel, PathsPanel } from "@/components/editor-shell/GameplayPanels";
import { MaterialLibraryPanel } from "@/components/editor-shell/MaterialLibraryPanel";
import { ModelAssetBrowserPanel } from "@/components/editor-shell/ModelAssetBrowserPanel";
import { SceneHierarchyPanel } from "@/components/editor-shell/SceneHierarchyPanel";
import { rebaseTransformPivot } from "@/viewport/utils/geometry";
import { readFileAsDataUrl } from "@/lib/model-assets";
import { saveTextureFileToProject, isElectronMode, getProjectPath } from "@/lib/texture-fs";
import type { ModelAssetLibraryItem } from "@/lib/model-assets";
import { cn } from "@/lib/utils";
import type { MeshEditMode } from "@/viewport/editing";
import type { MeshEditToolbarActionRequest } from "@/viewport/types";
import type { RightPanelId } from "@/state/ui-store";
import { InspectPanel } from "./inspector/InspectPanel";
import { PlayerSettingsPanel } from "./inspector/PlayerSettingsPanel";
import { WorldSettingsPanel } from "./inspector/WorldSettingsPanel";

type InspectorSidebarProps = {
  activeRightPanel: RightPanelId | null;
  activeToolId: ToolId;
  effectiveHiddenSceneItemIds: string[];
  effectiveLockedSceneItemIds: string[];
  entities: Entity[];
  hiddenSceneItemIds: string[];
  lockedSceneItemIds: string[];
  materials: Material[];
  meshEditMode: MeshEditMode;
  modelAssets: ModelAssetLibraryItem[];
  nodes: GeometryNode[];
  onApplyMaterial: (materialId: string, scope: "faces" | "object", faceIds: string[]) => void;
  onChangeRightPanel: (panel: RightPanelId | null) => void;
  onClipSelection: (axis: "x" | "y" | "z") => void;
  onAssignAssetLod: (assetId: string, level: ModelLodLevel) => void;
  onClearAssetLod: (assetId: string, level: ModelLodLevel) => void;
  onDeleteAsset: (assetId: string) => void;
  onDeleteMaterial: (materialId: string) => void;
  onDeleteTexture: (textureId: string) => void;
  onExtrudeSelection: (axis: "x" | "y" | "z", direction: -1 | 1) => void;
  onFocusAssetNodes: (assetId: string) => void;
  onFocusNode: (nodeId: string) => void;
  onImportAsset: () => void;
  onInsertAsset: (assetId: string) => void;
  onMeshEditToolbarAction: (action: MeshEditToolbarActionRequest["kind"]) => void;
  onMirrorSelection: (axis: "x" | "y" | "z") => void;
  onPlaceAsset: (position: Vec3) => void;
  onSelectAsset: (assetId: string) => void;
  onSelectMaterial: (materialId: string) => void;
  onSelectScenePath: (pathId: string | undefined) => void;
  onSelectNodes: (nodeIds: string[]) => void;
  onSetToolId: (toolId: ToolId) => void;
  onToggleSceneItemLock: (itemId: string) => void;
  onToggleSceneItemVisibility: (itemId: string) => void;
  onSetUvOffset: (scope: "faces" | "object", faceIds: string[], uvOffset: { x: number; y: number }) => void;
  onSetUvRotation: (scope: "faces" | "object", faceIds: string[], uvRotation: number) => void;
  onSetUvScale: (scope: "faces" | "object", faceIds: string[], uvScale: { x: number; y: number }) => void;
  onUpdateMeshData: (nodeId: string, mesh: EditableMesh, beforeMesh?: EditableMesh) => void;
  onTranslateSelection: (axis: "x" | "y" | "z", direction: -1 | 1) => void;
  onUpsertMaterial: (material: Material) => void;
  onUpsertTexture: (texture: TextureRecord) => void;
  onUpdateEntityProperties: (entityId: string, properties: Entity["properties"]) => void;
  onUpdateEntityHooks: (entityId: string, hooks: NonNullable<Entity["hooks"]>, beforeHooks?: NonNullable<Entity["hooks"]>) => void;
  onUpdateEntityTransform: (entityId: string, transform: Transform, beforeTransform?: Transform) => void;
  onUpdateNodeData: (nodeId: string, data: PrimitiveNodeData | LightNodeData | ModelReference) => void;
  onUpdateNodeHooks: (nodeId: string, hooks: NonNullable<GeometryNode["hooks"]>, beforeHooks?: NonNullable<GeometryNode["hooks"]>) => void;
  onUpdateNodeTransform: (nodeId: string, transform: Transform, beforeTransform?: Transform) => void;
  onUpdateSceneSettings: (settings: SceneSettings, beforeSettings?: SceneSettings) => void;
  sceneSettings: SceneSettings;
  selectedScenePathId?: string;
  selectionEnabled: boolean;
  selectedAssetId: string;
  selectedEntity?: Entity;
  selectedFaceIds: string[];
  selectedMaterialId: string;
  selectedNode?: GeometryNode;
  selectedNodeIds: string[];
  textures: TextureRecord[];
  viewportTarget: Vec3;
};

const TAB_TRIGGER =
  "!h-12 !gap-0.5 !px-0 !py-1 !text-foreground/70 data-active:!bg-emerald-500/14 data-active:!text-emerald-300 [&_svg]:size-3.5 [&_svg]:shrink-0 data-active:[&_svg]:!text-emerald-300";
const TAB_LABEL =
  "!text-[7px] !leading-none !font-medium !tracking-normal !text-foreground/50 data-active:!text-emerald-300";

export function InspectorSidebar({
  activeRightPanel,
  activeToolId,
  effectiveHiddenSceneItemIds,
  effectiveLockedSceneItemIds,
  entities,
  hiddenSceneItemIds,
  lockedSceneItemIds,
  materials,
  meshEditMode,
  modelAssets,
  nodes,
  onApplyMaterial,
  onChangeRightPanel,
  onClipSelection,
  onDeleteAsset,
  onAssignAssetLod,
  onClearAssetLod,
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
  onSelectScenePath,
  onSelectNodes,
  onSetToolId,
  onToggleSceneItemLock,
  onToggleSceneItemVisibility,
  onSetUvOffset,
  onSetUvRotation,
  onSetUvScale,
  onTranslateSelection,
  onUpsertMaterial,
  onUpsertTexture,
  onUpdateEntityProperties,
  onUpdateEntityHooks,
  onUpdateEntityTransform,
  onUpdateMeshData,
  onUpdateNodeData,
  onUpdateNodeHooks,
  onUpdateNodeTransform,
  onUpdateSceneSettings,
  sceneSettings,
  selectedScenePathId,
  selectionEnabled,
  selectedAssetId,
  selectedEntity,
  selectedFaceIds,
  selectedMaterialId,
  selectedNode,
  selectedNodeIds,
  textures,
  viewportTarget
}: InspectorSidebarProps) {
  const [sceneSection, setSceneSection] = useState<"hierarchy" | "paths">("hierarchy");
  const [draftWorldSettings, setDraftWorldSettings] = useState(() => structuredClone(sceneSettings.world));
  const [draftPlayerSettings, setDraftPlayerSettings] = useState(() => structuredClone(sceneSettings.player));

  useEffect(() => {
    setDraftTransform(selectedTarget ? structuredClone(selectedTarget.transform) : undefined);
  }, [
    selectedTarget?.id,
    selectedTarget?.transform.position.x,
    selectedTarget?.transform.position.y,
    selectedTarget?.transform.position.z,
    selectedTarget?.transform.rotation.x,
    selectedTarget?.transform.rotation.y,
    selectedTarget?.transform.rotation.z,
    selectedTarget?.transform.scale.x,
    selectedTarget?.transform.scale.y,
    selectedTarget?.transform.scale.z,
    selectedTarget?.transform.pivot?.x,
    selectedTarget?.transform.pivot?.y,
    selectedTarget?.transform.pivot?.z
  ]);

  useEffect(() => {
    setDraftWorldSettings(structuredClone(sceneSettings.world));
    setDraftPlayerSettings(structuredClone(sceneSettings.player));
  }, [sceneSettings]);

  const selectedIsBrush = selectedNode?.kind === "brush";
  const selectedIsInstancing = selectedNode ? isInstancingNode(selectedNode) : false;
  const selectedIsMesh = selectedNode?.kind === "mesh";
  const selectedMeshNode = selectedNode?.kind === "mesh" ? selectedNode : undefined;
  const selectedInstancingNode = selectedNode && isInstancingNode(selectedNode) ? selectedNode : undefined;
  const selectedPrimitive = selectedNode && isPrimitiveNode(selectedNode) ? selectedNode : undefined;
  const selectedLight = selectedNode && isLightNode(selectedNode) ? selectedNode : undefined;

  const updateDraftAxis = (
    group: "position" | "pivot" | "rotation" | "scale",
    axis: (typeof AXES)[number],
    value: number
  ) => {
    setDraftTransform((current) => {
      if (!current) {
        return current;
      }

      if (group === "pivot") {
        const currentPivot = current.pivot ?? vec3(0, 0, 0);

        return rebaseTransformPivot(current, {
          ...currentPivot,
          [axis]: value
        });
      }

      return {
        ...current,
        [group]: {
          ...current[group],
          [axis]: value
        }
      };
    });
  };

  const commitDraftTransform = () => {
    if (!selectedTarget || !draftTransform) {
      return;
    }

    if (selectedNode) {
      onUpdateNodeTransform(
        selectedNode.id,
        selectedIsInstancing
          ? {
              position: structuredClone(draftTransform.position),
              rotation: structuredClone(draftTransform.rotation),
              scale: structuredClone(draftTransform.scale)
            }
          : draftTransform
      );
      return;
    }

    if (selectedEntity) {
      onUpdateEntityTransform(selectedEntity.id, draftTransform, selectedEntity.transform);
    }
  };

  const commitWorldSettings = () => {
    onUpdateSceneSettings(
      {
        ...sceneSettings,
        world: structuredClone(draftWorldSettings)
      },
      sceneSettings
    );
  };

  const commitWorldSettingsDraft = (nextWorldSettings: SceneSettings["world"]) => {
    setDraftWorldSettings(nextWorldSettings);
    onUpdateSceneSettings(
      {
        ...sceneSettings,
        world: structuredClone(nextWorldSettings)
      },
      sceneSettings
    );
  };

  const handleSkyboxFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    let nextSource: string;

    // In Electron: save to project disk and use trident:// URL
    const projectPath = await getProjectPath();
    if (isElectronMode() && projectPath) {
      const saved = await saveTextureFileToProject(file, projectPath);
      nextSource = saved ? saved.tridentUrl : await readFileAsDataUrl(file);
    } else {
      nextSource = await readFileAsDataUrl(file);
    }

    const nextWorldSettings = {
      ...draftWorldSettings,
      skybox: {
        ...draftWorldSettings.skybox,
        enabled: true,
        format: inferSkyboxFormat(file),
        name: file.name,
        source: nextSource
      }
    };

    commitWorldSettingsDraft(nextWorldSettings);
  };

  const handleRemoveSkybox = () => {
    commitWorldSettingsDraft({
      ...draftWorldSettings,
      skybox: {
        ...draftWorldSettings.skybox,
        enabled: false,
        name: "",
        source: ""
      }
    });
  };

  const commitPlayerSettings = () => {
    onUpdateSceneSettings(
      {
        ...sceneSettings,
        player: structuredClone(draftPlayerSettings)
      },
      sceneSettings
    );
  };
  const collapsed = activeRightPanel === null;

  const handleTabClick = (panel: RightPanelId) => {
    onChangeRightPanel(activeRightPanel === panel ? null : panel);
  };

  return (
    <div
      className={cn(
        "pointer-events-none absolute right-4 top-4 z-20 flex w-88 max-h-[calc(100%-7rem)]",
        collapsed ? "h-auto" : "h-[clamp(26rem,58vh,42rem)]"
      )}
    >
      <FloatingPanel className="flex min-h-0 w-full flex-col overflow-hidden">
        <Tabs
          className="flex min-h-0 flex-1 flex-col gap-0"
          onValueChange={(value) => onChangeRightPanel(value as RightPanelId)}
          value={activeRightPanel ?? ""}
        >
          <div className={cn("px-3 pt-3", collapsed ? "pb-3" : "pb-2")}>
            <TabsList
              className="grid h-12! w-full grid-cols-8 items-stretch rounded-xl bg-white/5 p-0.5"
              variant="default"
            >
              <TabsTrigger
                className={cn(TAB_TRIGGER, "flex-col")}
                onClick={() => handleTabClick("scene")}
                value="scene"
              >
                <FolderTree />
                <span className={TAB_LABEL}>Scene</span>
              </TabsTrigger>
              <TabsTrigger
                className={cn(TAB_TRIGGER, "flex-col")}
                onClick={() => handleTabClick("world")}
                value="world"
              >
                <Globe2 />
                <span className={TAB_LABEL}>World</span>
              </TabsTrigger>
              <TabsTrigger
                className={cn(TAB_TRIGGER, "flex-col")}
                onClick={() => handleTabClick("player")}
                value="player"
              >
                <User />
                <span className={TAB_LABEL}>Player</span>
              </TabsTrigger>
              <TabsTrigger
                className={cn(TAB_TRIGGER, "flex-col")}
                onClick={() => handleTabClick("inspector")}
                value="inspector"
              >
                <SlidersHorizontal />
                <span className={TAB_LABEL}>Inspect</span>
              </TabsTrigger>
              <TabsTrigger
                className={cn(TAB_TRIGGER, "flex-col")}
                onClick={() => handleTabClick("hooks")}
                value="hooks"
              >
                <Cable />
                <span className={TAB_LABEL}>Hooks</span>
              </TabsTrigger>
              <TabsTrigger
                className={cn(TAB_TRIGGER, "flex-col")}
                onClick={() => handleTabClick("events")}
                value="events"
              >
                <BellRing />
                <span className={TAB_LABEL}>Events</span>
              </TabsTrigger>
              <TabsTrigger
                className={cn(TAB_TRIGGER, "flex-col")}
                onClick={() => handleTabClick("assets")}
                value="assets"
              >
                <Package />
                <span className={TAB_LABEL}>Assets</span>
              </TabsTrigger>
              <TabsTrigger
                className={cn(TAB_TRIGGER, "flex-col")}
                onClick={() => handleTabClick("materials")}
                value="materials"
              >
                <SwatchBook />
                <span className={TAB_LABEL}>Mats</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent className="min-h-0 flex-1 px-3 pb-3" value="scene">
            <div className="flex h-full min-h-0 flex-col gap-3">
              <div className="grid grid-cols-2 gap-1.5 px-1">
                <Button
                  className={cn(sceneSection === "hierarchy" && "bg-emerald-500/18 text-emerald-200")}
                  onClick={() => setSceneSection("hierarchy")}
                  size="xs"
                  variant="ghost"
                >
                  Hierarchy
                </Button>
                <Button
                  className={cn(sceneSection === "paths" && "bg-emerald-500/18 text-emerald-200")}
                  onClick={() => setSceneSection("paths")}
                  size="xs"
                  variant="ghost"
                >
                  Paths
                </Button>
              </div>
              {sceneSection === "hierarchy" ? (
                <div className="min-h-0 flex-1">
                  <SceneHierarchyPanel
                    effectiveHiddenSceneItemIds={effectiveHiddenSceneItemIds}
                    effectiveLockedSceneItemIds={effectiveLockedSceneItemIds}
                    entities={entities}
                    hiddenSceneItemIds={hiddenSceneItemIds}
                    interactive={selectionEnabled}
                    lockedSceneItemIds={lockedSceneItemIds}
                    nodes={nodes}
                    onFocusNode={onFocusNode}
                    onSelectNodes={onSelectNodes}
                    onToggleSceneItemLock={onToggleSceneItemLock}
                    onToggleSceneItemVisibility={onToggleSceneItemVisibility}
                    selectedNodeIds={selectedNodeIds}
                  />
                </div>
              ) : (
                <ScrollArea className="h-full pr-1">
                  <PathsPanel
                    activeToolId={activeToolId}
                    onSelectScenePath={onSelectScenePath}
                    onSetToolId={onSetToolId}
                    onUpdateSceneSettings={onUpdateSceneSettings}
                    sceneSettings={sceneSettings}
                    selectedPathId={selectedScenePathId}
                  />
                </ScrollArea>
              )}
            </div>
          </TabsContent>

          <TabsContent className="min-h-0 flex-1 px-3 pb-3" value="world">
            <WorldSettingsPanel
              onUpdateSceneSettings={onUpdateSceneSettings}
              sceneSettings={sceneSettings}
            />
          </TabsContent>

          <TabsContent className="min-h-0 flex-1 px-3 pb-3" value="player">
            <PlayerSettingsPanel
              onUpdateSceneSettings={onUpdateSceneSettings}
              sceneSettings={sceneSettings}
            />
          </TabsContent>

          <TabsContent className="min-h-0 flex-1 px-3 pb-3" value="inspector">
            <InspectPanel
              activeToolId={activeToolId}
              meshEditMode={meshEditMode}
              onClipSelection={onClipSelection}
              onExtrudeSelection={onExtrudeSelection}
              onMeshEditToolbarAction={onMeshEditToolbarAction}
              onMirrorSelection={onMirrorSelection}
              onTranslateSelection={onTranslateSelection}
              onUpdateEntityHooks={onUpdateEntityHooks}
              onUpdateEntityProperties={onUpdateEntityProperties}
              onUpdateEntityTransform={onUpdateEntityTransform}
              onUpdateMeshData={onUpdateMeshData}
              onUpdateNodeData={onUpdateNodeData}
              onUpdateNodeHooks={onUpdateNodeHooks}
              onUpdateNodeTransform={onUpdateNodeTransform}
              selectedEntity={selectedEntity}
              selectedFaceIds={selectedFaceIds}
              selectedNode={selectedNode}
              selectedNodeIds={selectedNodeIds}
              viewportTarget={viewportTarget}
            />
          </TabsContent>

          <TabsContent className="min-h-0 flex-1 px-3 pb-3" value="hooks">
            <ScrollArea className="h-full pr-1">
              <HooksPanel
                entities={entities}
                nodes={nodes}
                onUpdateEntityHooks={onUpdateEntityHooks}
                onUpdateNodeHooks={onUpdateNodeHooks}
                sceneSettings={sceneSettings}
                selectedEntity={selectedEntity}
                selectedNode={selectedNode}
              />
            </ScrollArea>
          </TabsContent>

          <TabsContent className="min-h-0 flex-1 px-3 pb-3" value="events">
            <ScrollArea className="h-full pr-1">
              <EventsPanel
                onUpdateSceneSettings={onUpdateSceneSettings}
                sceneSettings={sceneSettings}
              />
            </ScrollArea>
          </TabsContent>

          <TabsContent className="min-h-0 flex-1 px-3 pb-3" value="assets">
            <ModelAssetBrowserPanel
              items={modelAssets}
              lodLevels={sceneSettings.world.lod.levels}
              onAssignAssetLod={onAssignAssetLod}
              onClearAssetLod={onClearAssetLod}
              onDeleteAsset={onDeleteAsset}
              onFocusAssetNodes={onFocusAssetNodes}
              onImportAsset={onImportAsset}
              onInsertAsset={onInsertAsset}
              onSelectAsset={onSelectAsset}
              selectedAssetId={selectedAssetId}
            />
          </TabsContent>

          <TabsContent className="flex min-h-0 flex-1 px-3 pb-3" value="materials">
            <MaterialLibraryPanel
              materials={materials}
              onApplyMaterial={onApplyMaterial}
              onDeleteMaterial={onDeleteMaterial}
              onDeleteTexture={onDeleteTexture}
              onSelectMaterial={onSelectMaterial}
              onSetUvOffset={onSetUvOffset}
              onSetUvRotation={onSetUvRotation}
              onSetUvScale={onSetUvScale}
              onUpdateMeshData={onUpdateMeshData}
              onUpsertMaterial={onUpsertMaterial}
              onUpsertTexture={onUpsertTexture}
              selectedFaceIds={
                activeToolId === "mesh-edit" && meshEditMode === "face" ? selectedFaceIds : []
              }
              selectedMaterialId={selectedMaterialId}
              selectedNode={selectedNode}
              textures={textures}
            />
          </TabsContent>
        </Tabs>
      </FloatingPanel>
    </div>
  );
}
