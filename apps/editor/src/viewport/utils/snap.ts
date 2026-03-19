import type { ViewportState } from "@ggez/render-pipeline";

export const MINIMUM_SNAP_SIZE = 0.05;

export function clampSnapSize(value: number) {
  if (!Number.isFinite(value)) {
    return MINIMUM_SNAP_SIZE;
  }

  return Math.max(MINIMUM_SNAP_SIZE, Number(value.toFixed(2)));
}

export function resolveViewportSnapSize(viewport: Pick<ViewportState, "grid">) {
  return viewport.grid.enabled ? clampSnapSize(viewport.grid.snapSize) : MINIMUM_SNAP_SIZE;
}

export function formatSnapValue(value: number) {
  const clamped = clampSnapSize(value);

  return Number.isInteger(clamped) ? String(clamped) : clamped.toFixed(2);
}