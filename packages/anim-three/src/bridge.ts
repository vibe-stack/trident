import type { AnimationClipAsset, PoseBuffer } from "@ggez/anim-core";
import { createRigDefinition } from "@ggez/anim-core";
import type { AnimatorInstance } from "@ggez/anim-runtime";
import {
  AnimationClip,
  Bone,
  QuaternionKeyframeTrack,
  Skeleton,
  VectorKeyframeTrack
} from "three";

function resolveTrackBoneName(trackName: string): string | undefined {
  const bracketMatch = trackName.match(/\.bones\[(.+?)\]\.(position|quaternion|scale)$/);
  if (bracketMatch) {
    return bracketMatch[1];
  }

  const simpleMatch = trackName.match(/^(.+)\.(position|quaternion|scale)$/);
  return simpleMatch?.[1];
}

function getBoneDepth(skeleton: Skeleton, boneIndex: number): number {
  let depth = 0;
  let current = skeleton.bones[boneIndex];
  while (current?.parent instanceof Bone) {
    depth += 1;
    current = current.parent;
  }
  return depth;
}

function scoreRootMotionBoneName(name: string): number {
  const normalized = name.toLowerCase();

  if (normalized.includes("hips")) {
    return 400;
  }
  if (normalized.includes("pelvis")) {
    return 320;
  }
  if (normalized === "root") {
    return 240;
  }
  if (normalized.includes("root")) {
    return 180;
  }
  if (normalized.includes("armature")) {
    return 60;
  }
  return 0;
}

function estimateTranslationTravel(values: Float32Array | undefined): number {
  if (!values || values.length < 6) {
    return 0;
  }

  let maxDistance = 0;
  const startX = values[0] ?? 0;
  const startY = values[1] ?? 0;
  const startZ = values[2] ?? 0;

  for (let index = 3; index < values.length; index += 3) {
    const dx = (values[index] ?? 0) - startX;
    const dy = (values[index + 1] ?? 0) - startY;
    const dz = (values[index + 2] ?? 0) - startZ;
    maxDistance = Math.max(maxDistance, Math.hypot(dx, dy, dz));
  }

  return maxDistance;
}

function inferClipRootBoneIndex(
  skeleton: Skeleton,
  tracksByBone: Map<number, AnimationClipAsset["tracks"][number]>
): number | undefined {
  const candidates = Array.from(tracksByBone.values()).filter(
    (track) => track.translationTimes && track.translationValues && track.translationValues.length >= 3
  );

  if (candidates.length === 0) {
    return undefined;
  }

  const rankedCandidates = candidates
    .map((track) => {
      const bone = skeleton.bones[track.boneIndex];
      const name = bone?.name || "";
      return {
        boneIndex: track.boneIndex,
        nameScore: scoreRootMotionBoneName(name),
        travel: estimateTranslationTravel(track.translationValues),
        depth: getBoneDepth(skeleton, track.boneIndex)
      };
    })
    .sort((left, right) => {
      if (left.nameScore !== right.nameScore) {
        return right.nameScore - left.nameScore;
      }
      if (left.travel !== right.travel) {
        return right.travel - left.travel;
      }
      if (left.depth !== right.depth) {
        return left.depth - right.depth;
      }
      return left.boneIndex - right.boneIndex;
    });

  return rankedCandidates[0]?.boneIndex;
}

export function createRigFromSkeleton(skeleton: Skeleton) {
  const boneNames = skeleton.bones.map((bone) => bone.name || `bone-${bone.id}`);
  const parentIndices = skeleton.bones.map((bone) => {
    const parentBone = bone.parent instanceof Bone ? bone.parent : null;
    if (!parentBone) {
      return -1;
    }

    return skeleton.bones.indexOf(parentBone);
  });
  const rootBoneIndex = parentIndices.findIndex((parentIndex) => parentIndex < 0);
  const bindTranslations = skeleton.bones.flatMap((bone) => [bone.position.x, bone.position.y, bone.position.z]);
  const bindRotations = skeleton.bones.flatMap((bone) => [bone.quaternion.x, bone.quaternion.y, bone.quaternion.z, bone.quaternion.w]);
  const bindScales = skeleton.bones.flatMap((bone) => [bone.scale.x, bone.scale.y, bone.scale.z]);

  return createRigDefinition({
    boneNames,
    parentIndices,
    rootBoneIndex: Math.max(0, rootBoneIndex),
    bindTranslations,
    bindRotations,
    bindScales
  });
}

export function createClipAssetFromThreeClip(clip: AnimationClip, skeleton: Skeleton): AnimationClipAsset {
  const boneIndexByName = new Map(skeleton.bones.map((bone, index) => [bone.name, index]));
  const tracksByBone = new Map<number, AnimationClipAsset["tracks"][number]>();

  function ensureBoneTrack(boneIndex: number) {
    let track = tracksByBone.get(boneIndex);
    if (!track) {
      track = { boneIndex };
      tracksByBone.set(boneIndex, track);
    }
    return track;
  }

  clip.tracks.forEach((track) => {
    const boneName = resolveTrackBoneName(track.name);
    if (!boneName) {
      return;
    }

    const boneIndex = boneIndexByName.get(boneName);
    if (boneIndex === undefined) {
      return;
    }

    const boneTrack = ensureBoneTrack(boneIndex);
    if (track instanceof VectorKeyframeTrack) {
      if (track.name.endsWith(".position")) {
        boneTrack.translationTimes = Float32Array.from(track.times);
        boneTrack.translationValues = Float32Array.from(track.values);
      } else if (track.name.endsWith(".scale")) {
        boneTrack.scaleTimes = Float32Array.from(track.times);
        boneTrack.scaleValues = Float32Array.from(track.values);
      }
    } else if (track instanceof QuaternionKeyframeTrack) {
      boneTrack.rotationTimes = Float32Array.from(track.times);
      boneTrack.rotationValues = Float32Array.from(track.values);
    }
  });

  return {
    id: clip.name,
    name: clip.name,
    duration: clip.duration,
    rootBoneIndex: inferClipRootBoneIndex(skeleton, tracksByBone),
    tracks: Array.from(tracksByBone.values()).sort((left, right) => left.boneIndex - right.boneIndex)
  };
}

export function applyPoseBufferToSkeleton(pose: PoseBuffer, skeleton: Skeleton): void {
  skeleton.bones.forEach((bone, boneIndex) => {
    const vectorOffset = boneIndex * 3;
    const quaternionOffset = boneIndex * 4;
    bone.position.set(
      pose.translations[vectorOffset]!,
      pose.translations[vectorOffset + 1]!,
      pose.translations[vectorOffset + 2]!
    );
    bone.quaternion.set(
      pose.rotations[quaternionOffset]!,
      pose.rotations[quaternionOffset + 1]!,
      pose.rotations[quaternionOffset + 2]!,
      pose.rotations[quaternionOffset + 3]!
    );
    bone.scale.set(
      pose.scales[vectorOffset]!,
      pose.scales[vectorOffset + 1]!,
      pose.scales[vectorOffset + 2]!
    );
    bone.updateMatrix();
  });

  const rootBone = skeleton.bones.find((bone) => !(bone.parent instanceof Bone));
  rootBone?.updateMatrixWorld(true);
  skeleton.update();
}

export function applyPoseToSkeleton(animator: AnimatorInstance, skeleton: Skeleton): void {
  applyPoseBufferToSkeleton(animator.outputPose, skeleton);
}

export function createThreeAnimatorBridge(animator: AnimatorInstance, skeleton: Skeleton) {
  return {
    animator,
    skeleton,
    update(deltaTime: number) {
      const result = animator.update(deltaTime);
      applyPoseToSkeleton(animator, skeleton);
      return result;
    }
  };
}
