import type { GridSnapValue, ViewportState } from "@web-hammer/render-pipeline";
import type { GeometryNode } from "@web-hammer/shared";

type StatusBarProps = {
  activeToolLabel: string;
  gridSnapValues: readonly GridSnapValue[];
  selectedNode?: GeometryNode;
  viewport: ViewportState;
};

export function StatusBar({
  activeToolLabel,
  gridSnapValues,
  selectedNode,
  viewport
}: StatusBarProps) {
  const focusText = selectedNode
    ? `focus ${selectedNode.name} @ ${selectedNode.transform.position.x}, ${selectedNode.transform.position.y}, ${selectedNode.transform.position.z}`
    : "focus none";

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex h-8 items-center gap-2 overflow-hidden bg-[linear-gradient(180deg,rgba(5,11,10,0),rgba(5,11,10,0.82))] px-4 text-[10px] tracking-[0.06em] text-foreground/55">
      <span>tool {activeToolLabel.toLowerCase()}</span>
      <span className="text-foreground/25">/</span>
      <span>{viewport.projection} camera</span>
      <span className="text-foreground/25">/</span>
      <span>snap set {gridSnapValues.join(" / ")}</span>
      <span className="text-foreground/25">/</span>
      <span>grid {viewport.grid.size}u</span>
      <span className="text-foreground/25">/</span>
      <span>click select / double-click focus / Shift-drag marquee / empty click clear</span>
      <span className="text-foreground/25">/</span>
      <span className="truncate">{focusText}</span>
    </div>
  );
}
