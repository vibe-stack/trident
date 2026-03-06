import { useEffect, useState } from "react";
import type { Asset, GeometryNode, Material, Transform, Vec3 } from "@web-hammer/shared";
import type { ToolId } from "@web-hammer/tool-system";
import type { WorkerJob } from "@web-hammer/workers";
import { Button } from "@/components/ui/button";
import { DragInput } from "@/components/ui/drag-input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FloatingPanel } from "@/components/editor-shell/FloatingPanel";
import { cn } from "@/lib/utils";

type InspectorSidebarProps = {
  activeRightPanel: "inspector" | "materials";
  activeToolId: ToolId;
  assets: Asset[];
  jobs: WorkerJob[];
  materials: Material[];
  onAssignMaterial: (materialId: string) => void;
  onChangeRightPanel: (panel: "inspector" | "materials") => void;
  onClipSelection: (axis: "x" | "y" | "z") => void;
  onExtrudeSelection: (axis: "x" | "y" | "z", direction: -1 | 1) => void;
  onMeshInflate: (factor: number) => void;
  onMirrorSelection: (axis: "x" | "y" | "z") => void;
  onPlaceAsset: (position: Vec3) => void;
  onPlaceEntity: (type: "spawn" | "light") => void;
  onSelectAsset: (assetId: string) => void;
  onSelectMaterial: (materialId: string) => void;
  onTranslateSelection: (axis: "x" | "y" | "z", direction: -1 | 1) => void;
  onUpdateNodeTransform: (nodeId: string, transform: Transform) => void;
  selectedAssetId: string;
  selectedMaterialId: string;
  selectedNode?: GeometryNode;
  viewportTarget: Vec3;
};

const AXES = ["x", "y", "z"] as const;

export function InspectorSidebar({
  activeRightPanel,
  activeToolId,
  assets,
  jobs,
  materials,
  onAssignMaterial,
  onChangeRightPanel,
  onClipSelection,
  onExtrudeSelection,
  onMeshInflate,
  onMirrorSelection,
  onPlaceAsset,
  onPlaceEntity,
  onSelectAsset,
  onSelectMaterial,
  onTranslateSelection,
  onUpdateNodeTransform,
  selectedAssetId,
  selectedMaterialId,
  selectedNode,
  viewportTarget
}: InspectorSidebarProps) {
  const [draftTransform, setDraftTransform] = useState<Transform | undefined>(() =>
    selectedNode ? structuredClone(selectedNode.transform) : undefined
  );

  useEffect(() => {
    setDraftTransform(selectedNode ? structuredClone(selectedNode.transform) : undefined);
  }, [
    selectedNode?.id,
    selectedNode?.transform.position.x,
    selectedNode?.transform.position.y,
    selectedNode?.transform.position.z,
    selectedNode?.transform.rotation.x,
    selectedNode?.transform.rotation.y,
    selectedNode?.transform.rotation.z,
    selectedNode?.transform.scale.x,
    selectedNode?.transform.scale.y,
    selectedNode?.transform.scale.z
  ]);

  const selectedAsset = assets.find((asset) => asset.id === selectedAssetId);
  const selectedMaterial = materials.find((material) => material.id === selectedMaterialId);
  const selectedIsBrush = selectedNode?.kind === "brush";
  const selectedIsMesh = selectedNode?.kind === "mesh";

  const updateDraftAxis = (
    group: "position" | "rotation" | "scale",
    axis: (typeof AXES)[number],
    value: number
  ) => {
    setDraftTransform((current) => {
      if (!current) {
        return current;
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
    if (!selectedNode || !draftTransform) {
      return;
    }

    onUpdateNodeTransform(selectedNode.id, draftTransform);
  };

  return (
    <div className="pointer-events-none absolute inset-y-4 right-4 z-20 flex w-80">
      <FloatingPanel className="flex min-h-0 w-full flex-col overflow-hidden">
        <Tabs
          className="flex min-h-0 flex-1 flex-col gap-0"
          onValueChange={(value) => onChangeRightPanel(value as "inspector" | "materials")}
          value={activeRightPanel}
        >
          <div className="px-3 pt-3 pb-2">
            <TabsList className="grid w-full grid-cols-2 rounded-xl bg-white/5 p-1" variant="default">
              <TabsTrigger className="rounded-lg text-[11px]" value="inspector">
                Inspector
              </TabsTrigger>
              <TabsTrigger className="rounded-lg text-[11px]" value="materials">
                Materials
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent className="min-h-0 px-3 pb-3" value="inspector">
            <div className="flex h-full min-h-0 flex-col gap-3">
              {selectedNode ? (
                <>
                  <div className="space-y-1 px-1">
                    <div className="text-[10px] font-medium tracking-[0.18em] text-foreground/42 uppercase">
                      {selectedNode.kind}
                    </div>
                    <div className="text-sm font-medium text-foreground">{selectedNode.name}</div>
                  </div>

                  {draftTransform ? (
                    <div className="space-y-3">
                      <TransformGroup
                        label="Position"
                        onCommit={commitDraftTransform}
                        onUpdate={(axis, value) => updateDraftAxis("position", axis, value)}
                        precision={2}
                        step={0.05}
                        values={draftTransform.position}
                      />
                      <TransformGroup
                        label="Rotation"
                        onCommit={commitDraftTransform}
                        onUpdate={(axis, value) => updateDraftAxis("rotation", axis, value)}
                        precision={1}
                        step={0.25}
                        values={draftTransform.rotation}
                      />
                      <TransformGroup
                        label="Scale"
                        onCommit={commitDraftTransform}
                        onUpdate={(axis, value) => updateDraftAxis("scale", axis, value)}
                        precision={2}
                        step={0.05}
                        values={draftTransform.scale}
                      />
                    </div>
                  ) : null}

                  <div className="space-y-2">
                    <SectionTitle>Quick Actions</SectionTitle>
                    <div className="flex flex-wrap gap-1.5">
                      <Button onClick={() => onTranslateSelection("x", -1)} size="xs" variant="ghost">
                        X-
                      </Button>
                      <Button onClick={() => onTranslateSelection("x", 1)} size="xs" variant="ghost">
                        X+
                      </Button>
                      <Button onClick={() => onTranslateSelection("y", -1)} size="xs" variant="ghost">
                        Y-
                      </Button>
                      <Button onClick={() => onTranslateSelection("y", 1)} size="xs" variant="ghost">
                        Y+
                      </Button>
                      <Button onClick={() => onTranslateSelection("z", -1)} size="xs" variant="ghost">
                        Z-
                      </Button>
                      <Button onClick={() => onTranslateSelection("z", 1)} size="xs" variant="ghost">
                        Z+
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <Button onClick={() => onMirrorSelection("x")} size="xs" variant="ghost">
                        Mirror X
                      </Button>
                      <Button onClick={() => onMirrorSelection("y")} size="xs" variant="ghost">
                        Mirror Y
                      </Button>
                      <Button onClick={() => onMirrorSelection("z")} size="xs" variant="ghost">
                        Mirror Z
                      </Button>
                    </div>
                  </div>

                  {activeToolId === "clip" ? (
                    <ToolSection title="Clip">
                      <div className="flex flex-wrap gap-1.5">
                        <Button disabled={!selectedIsBrush} onClick={() => onClipSelection("x")} size="xs" variant="ghost">
                          Split X
                        </Button>
                        <Button disabled={!selectedIsBrush} onClick={() => onClipSelection("y")} size="xs" variant="ghost">
                          Split Y
                        </Button>
                        <Button disabled={!selectedIsBrush} onClick={() => onClipSelection("z")} size="xs" variant="ghost">
                          Split Z
                        </Button>
                      </div>
                    </ToolSection>
                  ) : null}

                  {activeToolId === "extrude" ? (
                    <ToolSection title="Extrude">
                      <div className="flex flex-wrap gap-1.5">
                        <Button disabled={!selectedIsBrush} onClick={() => onExtrudeSelection("x", -1)} size="xs" variant="ghost">
                          X-
                        </Button>
                        <Button disabled={!selectedIsBrush} onClick={() => onExtrudeSelection("x", 1)} size="xs" variant="ghost">
                          X+
                        </Button>
                        <Button onClick={() => onExtrudeSelection("y", -1)} size="xs" variant="ghost">
                          Y-
                        </Button>
                        <Button onClick={() => onExtrudeSelection("y", 1)} size="xs" variant="ghost">
                          Y+
                        </Button>
                        <Button disabled={!selectedIsBrush} onClick={() => onExtrudeSelection("z", -1)} size="xs" variant="ghost">
                          Z-
                        </Button>
                        <Button disabled={!selectedIsBrush} onClick={() => onExtrudeSelection("z", 1)} size="xs" variant="ghost">
                          Z+
                        </Button>
                      </div>
                    </ToolSection>
                  ) : null}

                  {activeToolId === "mesh-edit" ? (
                    <ToolSection title="Mesh Edit">
                      <div className="flex flex-wrap gap-1.5">
                        <Button disabled={!selectedIsMesh} onClick={() => onMeshInflate(1.1)} size="xs" variant="ghost">
                          Inflate
                        </Button>
                        <Button disabled={!selectedIsMesh} onClick={() => onMeshInflate(0.9)} size="xs" variant="ghost">
                          Deflate
                        </Button>
                        <Button disabled={!selectedIsMesh} onClick={() => onExtrudeSelection("y", 1)} size="xs" variant="ghost">
                          Raise Top
                        </Button>
                        <Button disabled={!selectedIsMesh} onClick={() => onExtrudeSelection("y", -1)} size="xs" variant="ghost">
                          Lower Top
                        </Button>
                      </div>
                    </ToolSection>
                  ) : null}
                </>
              ) : (
                <div className="px-1 pt-1 text-xs text-foreground/48">Select an object to inspect or edit it.</div>
              )}

              <ToolSection title="Assets">
                <div className="space-y-1">
                  {assets.map((asset) => (
                    <button
                      className={cn(
                        "flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left text-[12px] text-foreground/62 transition-colors hover:bg-white/5 hover:text-foreground",
                        selectedAssetId === asset.id && "bg-emerald-500/14 text-emerald-200"
                      )}
                      key={asset.id}
                      onClick={() => onSelectAsset(asset.id)}
                      type="button"
                    >
                      <span className="truncate font-medium">{asset.id.split(":").at(-1)}</span>
                      <span className="ml-2 text-[10px] text-foreground/35">{asset.type}</span>
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Button
                    onClick={() => onPlaceAsset({ x: viewportTarget.x, y: 0, z: viewportTarget.z })}
                    size="xs"
                    variant="ghost"
                  >
                    Place {selectedAsset?.id.split(":").at(-1) ?? "asset"}
                  </Button>
                  <Button onClick={() => onPlaceEntity("spawn")} size="xs" variant="ghost">
                    Add Spawn
                  </Button>
                  <Button onClick={() => onPlaceEntity("light")} size="xs" variant="ghost">
                    Add Light
                  </Button>
                </div>
              </ToolSection>

              {jobs.length > 0 ? (
                <ToolSection title="Jobs">
                  <div className="space-y-1">
                    {jobs.slice(0, 5).map((job) => (
                      <div
                        className="flex items-center justify-between rounded-xl bg-white/4 px-2.5 py-1.5 text-[11px] text-foreground/56"
                        key={job.id}
                      >
                        <span className="truncate">{job.label}</span>
                        <span className="ml-3 shrink-0 capitalize text-foreground/36">{job.status}</span>
                      </div>
                    ))}
                  </div>
                </ToolSection>
              ) : null}
            </div>
          </TabsContent>

          <TabsContent className="min-h-0 px-3 pb-3" value="materials">
            <div className="space-y-2">
              {materials.map((material) => (
                <button
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left text-[12px] text-foreground/62 transition-colors hover:bg-white/5 hover:text-foreground",
                    selectedMaterialId === material.id && "bg-emerald-500/14 text-emerald-200"
                  )}
                  key={material.id}
                  onClick={() => onSelectMaterial(material.id)}
                  type="button"
                >
                  <span
                    className="size-3 rounded-full"
                    style={{ backgroundColor: material.color }}
                  />
                  <span className="truncate font-medium">{material.name}</span>
                </button>
              ))}
              <Button
                className="w-full justify-center text-emerald-200"
                disabled={!selectedNode || selectedNode.kind !== "brush"}
                onClick={() => onAssignMaterial(selectedMaterialId)}
                size="sm"
                variant="ghost"
              >
                Apply {selectedMaterial?.name ?? "material"}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </FloatingPanel>
    </div>
  );
}

function SectionTitle({ children }: { children: string }) {
  return <div className="px-1 text-[10px] font-medium tracking-[0.18em] text-foreground/42 uppercase">{children}</div>;
}

function ToolSection({
  children,
  title
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <div className="space-y-2">
      <SectionTitle>{title}</SectionTitle>
      {children}
    </div>
  );
}

function TransformGroup({
  label,
  onCommit,
  onUpdate,
  precision,
  step,
  values
}: {
  label: string;
  onCommit: () => void;
  onUpdate: (axis: (typeof AXES)[number], value: number) => void;
  precision: number;
  step: number;
  values: Vec3;
}) {
  return (
    <div className="space-y-2">
      <SectionTitle>{label}</SectionTitle>
      <div className="grid grid-cols-3 gap-1.5">
        {AXES.map((axis) => (
          <DragInput
            className="min-w-0"
            compact
            key={axis}
            label={axis.toUpperCase()}
            onChange={(value) => onUpdate(axis, value)}
            onValueCommit={onCommit}
            precision={precision}
            step={step}
            value={values[axis]}
          />
        ))}
      </div>
    </div>
  );
}
