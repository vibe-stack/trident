import type { MeshEditMode } from "@/viewport/editing";
import { FloatingPanel } from "@/components/editor-shell/FloatingPanel";
import {
  DeflateIcon,
  EdgeModeIcon,
  FaceModeIcon,
  FlipNormalsIcon,
  InflateIcon,
  LowerTopIcon,
  RaiseTopIcon,
  RotateModeIcon,
  ScaleModeIcon,
  TranslateModeIcon,
  VertexModeIcon
} from "@/components/editor-shell/icons";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export function MeshEditToolBars({
  meshEditMode,
  onDeflate,
  onInflate,
  onInvertNormals,
  onLowerTop,
  onRaiseTop,
  onSetMeshEditMode,
  onSetTransformMode,
  selectedGeometry,
  selectedMesh,
  transformMode
}: {
  meshEditMode: MeshEditMode;
  onDeflate: () => void;
  onInflate: () => void;
  onInvertNormals: () => void;
  onLowerTop: () => void;
  onRaiseTop: () => void;
  onSetMeshEditMode: (mode: MeshEditMode) => void;
  onSetTransformMode: (mode: "rotate" | "scale" | "translate") => void;
  selectedGeometry: boolean;
  selectedMesh: boolean;
  transformMode: "rotate" | "scale" | "translate";
}) {
  return (
    <div className="flex items-stretch gap-2">
      <FloatingPanel className="flex h-10 items-center gap-1 p-1.5">
        <MeshBarButton active={meshEditMode === "vertex"} icon={VertexModeIcon} onClick={() => onSetMeshEditMode("vertex")} tooltip="Vertex mode" />
        <MeshBarButton active={meshEditMode === "edge"} icon={EdgeModeIcon} onClick={() => onSetMeshEditMode("edge")} tooltip="Edge mode" />
        <MeshBarButton active={meshEditMode === "face"} icon={FaceModeIcon} onClick={() => onSetMeshEditMode("face")} tooltip="Face mode" />
      </FloatingPanel>
      <FloatingPanel className="flex h-10 items-center gap-1 p-1.5">
        <MeshBarButton active={transformMode === "translate"} disabled={!selectedGeometry} icon={TranslateModeIcon} onClick={() => onSetTransformMode("translate")} tooltip="Translate" />
        <MeshBarButton active={transformMode === "rotate"} disabled={!selectedGeometry} icon={RotateModeIcon} onClick={() => onSetTransformMode("rotate")} tooltip="Rotate" />
        <MeshBarButton active={transformMode === "scale"} disabled={!selectedGeometry} icon={ScaleModeIcon} onClick={() => onSetTransformMode("scale")} tooltip="Scale" />
        <div className="mx-0.5 h-5 w-px bg-white/8" />
        <MeshBarButton disabled={!selectedMesh} icon={InflateIcon} onClick={onInflate} tooltip="Inflate" />
        <MeshBarButton disabled={!selectedMesh} icon={DeflateIcon} onClick={onDeflate} tooltip="Deflate" />
        <MeshBarButton disabled={!selectedMesh} icon={RaiseTopIcon} onClick={onRaiseTop} tooltip="Raise top" />
        <MeshBarButton disabled={!selectedMesh} icon={LowerTopIcon} onClick={onLowerTop} tooltip="Lower top" />
        <MeshBarButton disabled={!selectedGeometry} icon={FlipNormalsIcon} onClick={onInvertNormals} tooltip="Invert normals" />
      </FloatingPanel>
    </div>
  );
}

function MeshBarButton({
  active = false,
  disabled = false,
  icon: Icon,
  onClick,
  tooltip
}: {
  active?: boolean;
  disabled?: boolean;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  tooltip: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            className={cn(
              "size-7 rounded-xl text-foreground/58 transition-colors hover:text-foreground",
              active && "bg-emerald-500/18 text-emerald-300 shadow-[inset_0_0_0_1px_rgba(52,211,153,0.18)]"
            )}
            disabled={disabled}
            onClick={onClick}
            size="icon-sm"
            variant="ghost"
          />
        }
      >
        <Icon className="size-4" />
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}