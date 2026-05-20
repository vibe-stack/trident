import { proxy } from "valtio";
import type { ViewportState } from "@ggez/render-pipeline";
import { createEditorViewports, type ViewModeId, type ViewportPaneId, type ViewportRenderMode } from "@/viewport/viewports";

export type ViewportQuality = 0.5 | 0.75 | 1 | 1.5;
export type RightPanelId = "assets" | "events" | "hooks" | "inspector" | "materials" | "player" | "scene" | "world";

type UiStore = {
  activeViewportId: ViewportPaneId;
  copilotPanelOpen: boolean;
  fileBrowserOpen: boolean;
  logicViewerOpen: boolean;
  projectPath: string | null;
  rightPanel: RightPanelId | null;
  renderMode: ViewportRenderMode;
  selectedAssetId: string;
  selectedMaterialId: string;
  terminalOpen: boolean;
  pendingTerminalCommands: Array<{ id: string, name: string, command: string }>;
  viewMode: ViewModeId;
  viewportQuality: ViewportQuality;
  viewports: Record<ViewportPaneId, ViewportState>;
};

export const uiStore = proxy<UiStore>({
  activeViewportId: "perspective",
  copilotPanelOpen: false,
  fileBrowserOpen: false,
  logicViewerOpen: false,
  projectPath: null,
  rightPanel: null,
  renderMode: "preview",
  selectedAssetId: "",
  selectedMaterialId: "material:blockout:concrete",
  terminalOpen: false,
  pendingTerminalCommands: [],
  viewMode: "3d-only",
  viewportQuality: 0.5,
  viewports: createEditorViewports()
});

export function dispatchTerminalCommand(name: string, command: string) {
  uiStore.pendingTerminalCommands.push({ id: Math.random().toString(), name, command });
  uiStore.terminalOpen = true;
}

