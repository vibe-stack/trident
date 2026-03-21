import type { SerializableRig } from "@ggez/anim-schema";
import { sectionHintClassName } from "../shared";
import { hashRigSignature, identifyRigFamily } from "./rig-utils";

export function RigSummary(props: { rig: SerializableRig | undefined; characterFileName?: string }) {
  if (!props.rig) {
    return <div className={sectionHintClassName}>Import a rigged character to unlock rig-aware masks, diagnostics, and preview authoring.</div>;
  }

  const rootBoneName = props.rig.boneNames[props.rig.rootBoneIndex] ?? "unknown";

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-2xl bg-black/20 p-3">
          <div className="text-[10px] uppercase tracking-[0.08em] text-zinc-500">Family</div>
          <div className="mt-1 text-[13px] font-medium text-zinc-100">{identifyRigFamily(props.rig)}</div>
        </div>
        <div className="rounded-2xl bg-black/20 p-3">
          <div className="text-[10px] uppercase tracking-[0.08em] text-zinc-500">Bones</div>
          <div className="mt-1 text-[13px] font-medium text-zinc-100">{props.rig.boneNames.length}</div>
        </div>
      </div>
      <div className="rounded-2xl bg-black/20 p-3 text-[12px] text-zinc-300">
        <div className="flex items-center justify-between gap-2">
          <span className="text-zinc-500">Root</span>
          <span className="font-medium text-zinc-100">{rootBoneName}</span>
        </div>
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="text-zinc-500">Signature</span>
          <code className="rounded bg-white/6 px-2 py-0.5 text-[11px] text-emerald-200">rig-{hashRigSignature(props.rig)}</code>
        </div>
        {props.characterFileName ? (
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="text-zinc-500">Source</span>
            <span className="truncate text-right text-zinc-100">{props.characterFileName}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
