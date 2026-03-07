import type { GridSnapValue, ViewportState } from "@web-hammer/render-pipeline";
import type { GeometryNode } from "@web-hammer/shared";
import type { WorkerJob } from "@web-hammer/workers";
import { JobStatus } from "@/components/editor-shell/JobStatus";
import type { MeshEditMode } from "@/viewport/editing";
import type { ViewportPaneId } from "@/viewport/viewports";

type StatusBarProps = {
  activeToolLabel: string;
  activeViewportId: ViewportPaneId;
  gridSnapValues: readonly GridSnapValue[];
  jobs: WorkerJob[];
  meshEditMode: MeshEditMode;
  selectedNode?: GeometryNode;
  viewModeLabel: string;
  viewport: ViewportState;
};

export function StatusBar({
  activeToolLabel,
  activeViewportId,
  gridSnapValues,
  jobs,
  meshEditMode,
  selectedNode,
  viewModeLabel,
  viewport
}: StatusBarProps) {
  const snapText = viewport.grid.enabled ? `snap ${viewport.grid.snapSize}` : `snap off (${viewport.grid.snapSize})`;
  const focusText = selectedNode
    ? `focus ${selectedNode.name} @ ${selectedNode.transform.position.x}, ${selectedNode.transform.position.y}, ${selectedNode.transform.position.z}`
    : "focus none";
  const interactionHint =
    activeToolLabel === "Brush"
      ? "click anchor / move for base / click lock / move for height / click commit / Esc cancel"
      : activeToolLabel === "Mesh Edit" && meshEditMode === "edge"
        ? "click select / Shift-drag marquee / A arc / drag radius / wheel segments / K cut / B bevel"
        : activeToolLabel === "Mesh Edit" && meshEditMode === "face"
          ? "click select / Shift-drag marquee / Delete faces / M merge / N invert normals"
      : "click select / double-click focus / Shift-drag marquee / empty click clear";

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex h-8 items-center justify-between gap-4 overflow-hidden bg-[linear-gradient(180deg,rgba(5,11,10,0),rgba(5,11,10,0.82))] px-4 text-[10px] tracking-[0.06em] text-foreground/55">
      <div className="flex min-w-0 items-center gap-2 overflow-hidden">
        <span>tool {activeToolLabel.toLowerCase()}</span>
        {activeToolLabel === "Mesh Edit" ? (
          <>
            <span className="text-foreground/25">/</span>
            <span>{meshEditMode} mode</span>
          </>
        ) : null}
        <span className="text-foreground/25">/</span>
        <span>{viewport.projection} camera</span>
        <span className="text-foreground/25">/</span>
        <span>{activeViewportId} pane</span>
        <span className="text-foreground/25">/</span>
        <span>{viewModeLabel.toLowerCase()}</span>
        <span className="text-foreground/25">/</span>
        <span>{snapText}</span>
        <span className="text-foreground/25">/</span>
        <span>presets {gridSnapValues.join(" / ")}</span>
        <span className="text-foreground/25">/</span>
        <span>grid {viewport.grid.size}u</span>
        <span className="text-foreground/25">/</span>
        <span>{interactionHint}</span>
        <span className="text-foreground/25">/</span>
        <span className="truncate">{focusText}</span>
      </div>
      <JobStatus jobs={jobs} />
    </div>
  );
}
