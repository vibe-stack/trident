import { proxy } from "valtio";
import { createViewportState, type ViewportState } from "@web-hammer/render-pipeline";

type UiStore = {
  rightPanel: "inspector" | "materials";
  selectedAssetId: string;
  selectedMaterialId: string;
  viewport: ViewportState;
};

export const uiStore = proxy<UiStore>({
  rightPanel: "inspector",
  selectedAssetId: "asset:model:crate",
  selectedMaterialId: "material:blockout:orange",
  viewport: createViewportState()
});
