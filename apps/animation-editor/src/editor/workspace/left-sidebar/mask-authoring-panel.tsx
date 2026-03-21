import type { AnimationEditorStore } from "@ggez/anim-editor-core";
import type { BoneMaskDefinition, SerializableRig } from "@ggez/anim-schema";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { editorInputClassName, sectionHintClassName } from "../shared";
import { buildRigBoneEntries, collectBoneBranch, getMaskEffectiveWeight, getMaskExplicitWeight, updateMaskWeight } from "./rig-utils";

export function MaskAuthoringPanel(props: {
  store: AnimationEditorStore;
  rig: SerializableRig | undefined;
  mask: BoneMaskDefinition | undefined;
}) {
  const { mask, rig, store } = props;
  const boneEntries = useMemo(() => buildRigBoneEntries(rig), [rig]);
  const branchBones = useMemo(() => (rig && mask ? collectBoneBranch(rig, mask.rootBoneName, mask.includeChildren) : new Set<string>()), [mask, rig]);

  if (!mask) {
    return <div className={sectionHintClassName}>Select a mask to paint per-bone weights and choose a branch root.</div>;
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-2">
        <Input value={mask.name} onChange={(event) => store.updateMask(mask.id, { name: event.target.value })} className={editorInputClassName} />
        <Input
          value={mask.rootBoneName ?? ""}
          onChange={(event) => store.updateMask(mask.id, { rootBoneName: event.target.value || undefined })}
          placeholder="Root bone"
          className={editorInputClassName}
        />
        <label className="flex h-9 items-center gap-2 rounded-xl bg-white/7 px-3 text-[12px] text-zinc-200">
          <Checkbox checked={mask.includeChildren} onCheckedChange={(checked) => store.updateMask(mask.id, { includeChildren: Boolean(checked) })} />
          <span>{mask.includeChildren ? "Include descendants from the root branch" : "Only include the root bone unless explicitly painted"}</span>
        </label>
      </div>

      {!rig ? <div className={sectionHintClassName}>Import a rig to paint masks against a concrete bone hierarchy.</div> : null}

      {rig ? (
        <div className="space-y-2 rounded-[22px] bg-black/20 p-3">
          <div className="flex items-center justify-between text-[12px] font-medium text-zinc-300">
            <span>Bone Hierarchy</span>
            <Button variant="ghost" size="xs" onClick={() => store.updateMask(mask.id, { rootBoneName: undefined, weights: [] })}>
              Clear
            </Button>
          </div>
          <div className="max-h-96 space-y-2 overflow-auto pr-1">
            {boneEntries.map((bone) => {
              const explicitWeight = getMaskExplicitWeight(mask, bone.name);
              const effectiveWeight = getMaskEffectiveWeight(mask, branchBones, bone.name);
              const active = effectiveWeight > 0.001;

              return (
                <div key={bone.name} className="rounded-2xl bg-white/4 p-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0" style={{ paddingLeft: `${bone.depth * 14}px` }}>
                      <div className="truncate text-[12px] font-medium text-zinc-100">{bone.name}</div>
                      <div className="text-[10px] text-zinc-500">{explicitWeight !== undefined ? `Explicit ${Math.round(explicitWeight * 100)}%` : active ? "Inherited from branch root" : "Not included"}</div>
                    </div>
                    <div className="shrink-0 rounded-full px-2 py-1 text-[10px] font-medium text-zinc-200 ring-1 ring-white/10">{Math.round(effectiveWeight * 100)}%</div>
                  </div>

                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={effectiveWeight}
                      onChange={(event) => store.updateMask(mask.id, { weights: updateMaskWeight(mask, bone.name, Number(event.target.value)) })}
                      className="h-2 w-full accent-emerald-400"
                    />
                    <Button variant="ghost" size="xs" onClick={() => store.updateMask(mask.id, { rootBoneName: bone.name, includeChildren: true })}>
                      Root
                    </Button>
                    <Button variant="ghost" size="xs" onClick={() => store.updateMask(mask.id, { rootBoneName: bone.name, includeChildren: false })}>
                      Solo
                    </Button>
                    {explicitWeight !== undefined ? (
                      <Button variant="ghost" size="xs" onClick={() => store.updateMask(mask.id, { weights: mask.weights.filter((entry) => entry.boneName !== bone.name) })}>
                        Reset
                      </Button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
