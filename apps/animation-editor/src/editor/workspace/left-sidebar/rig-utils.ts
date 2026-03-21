import type { BoneMaskDefinition, SerializableRig } from "@ggez/anim-schema";

export type RigBoneEntry = {
  index: number;
  name: string;
  depth: number;
};

export function hashRigSignature(rig: SerializableRig): string {
  let hash = 5381;

  rig.boneNames.forEach((boneName, index) => {
    const token = `${boneName}:${rig.parentIndices[index] ?? -1}`;
    for (let charIndex = 0; charIndex < token.length; charIndex += 1) {
      hash = (hash * 33) ^ token.charCodeAt(charIndex);
    }
  });

  return Math.abs(hash >>> 0).toString(16).padStart(8, "0");
}

export function identifyRigFamily(rig: SerializableRig): string {
  const normalizedNames = rig.boneNames.map((boneName) => boneName.toLowerCase());
  const mixamoBones = normalizedNames.filter((boneName) => boneName.startsWith("mixamorig")).length;
  if (mixamoBones >= Math.max(6, Math.floor(rig.boneNames.length * 0.2))) {
    return "Mixamo-like";
  }

  const humanoidHints = ["hips", "spine", "head", "arm", "leg"];
  const matches = normalizedNames.filter((boneName) => humanoidHints.some((hint) => boneName.includes(hint))).length;
  if (matches >= Math.max(4, Math.floor(rig.boneNames.length * 0.15))) {
    return "Humanoid-like";
  }

  return "Custom";
}

export function buildRigBoneEntries(rig: SerializableRig | undefined): RigBoneEntry[] {
  if (!rig) {
    return [];
  }

  const resolvedRig = rig;

  const childrenByParent = new Map<number, number[]>();
  resolvedRig.parentIndices.forEach((parentIndex, boneIndex) => {
    const siblings = childrenByParent.get(parentIndex) ?? [];
    siblings.push(boneIndex);
    childrenByParent.set(parentIndex, siblings);
  });

  const ordered: RigBoneEntry[] = [];

  function visit(boneIndex: number, depth: number): void {
    ordered.push({
      index: boneIndex,
      name: resolvedRig.boneNames[boneIndex] ?? `bone-${boneIndex}`,
      depth,
    });

    (childrenByParent.get(boneIndex) ?? []).forEach((childIndex) => visit(childIndex, depth + 1));
  }

  const rootIndices = resolvedRig.parentIndices
    .map((parentIndex, boneIndex) => ({ parentIndex, boneIndex }))
    .filter((entry) => entry.parentIndex < 0)
    .map((entry) => entry.boneIndex);

  rootIndices.forEach((rootIndex) => visit(rootIndex, 0));

  return ordered;
}

export function collectBoneBranch(rig: SerializableRig, rootBoneName: string | undefined, includeChildren: boolean): Set<string> {
  if (!rootBoneName) {
    return new Set<string>();
  }

  const rootIndex = rig.boneNames.indexOf(rootBoneName);
  if (rootIndex < 0) {
    return new Set<string>();
  }

  if (!includeChildren) {
    return new Set([rootBoneName]);
  }

  const childrenByParent = new Map<number, number[]>();
  rig.parentIndices.forEach((parentIndex, boneIndex) => {
    const siblings = childrenByParent.get(parentIndex) ?? [];
    siblings.push(boneIndex);
    childrenByParent.set(parentIndex, siblings);
  });

  const names = new Set<string>();
  const queue = [rootIndex];
  while (queue.length > 0) {
    const current = queue.shift()!;
    names.add(rig.boneNames[current]!);
    queue.push(...(childrenByParent.get(current) ?? []));
  }

  return names;
}

export function getMaskExplicitWeight(mask: BoneMaskDefinition, boneName: string): number | undefined {
  return mask.weights.find((entry) => entry.boneName === boneName)?.weight;
}

export function getMaskEffectiveWeight(mask: BoneMaskDefinition, branchBones: Set<string>, boneName: string): number {
  const explicitWeight = getMaskExplicitWeight(mask, boneName);
  if (explicitWeight !== undefined) {
    return explicitWeight;
  }

  return branchBones.has(boneName) ? 1 : 0;
}

export function updateMaskWeight(mask: BoneMaskDefinition, boneName: string, weight: number): BoneMaskDefinition["weights"] {
  const nextWeights = mask.weights.filter((entry) => entry.boneName !== boneName);

  if (weight > 0.001) {
    nextWeights.push({
      boneName,
      weight: Number(weight.toFixed(2)),
    });
  }

  return nextWeights.sort((left, right) => left.boneName.localeCompare(right.boneName));
}
