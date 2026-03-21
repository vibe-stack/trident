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
