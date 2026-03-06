import { proxy } from "valtio";
import { createViewportState, type ViewportState } from "@web-hammer/render-pipeline";

type UiStore = {
  leftPanel: "scene" | "assets";
  rightPanel: "inspector" | "materials";
  selectedAssetId: string;
  selectedMaterialId: string;
  viewport: ViewportState;
};

export const uiStore = proxy<UiStore>({
  leftPanel: "scene",
  rightPanel: "inspector",
  selectedAssetId: "asset:model:crate",
  selectedMaterialId: "material:blockout:orange",
  viewport: createViewportState()
});
