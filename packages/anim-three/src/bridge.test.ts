import { describe, expect, it } from "bun:test";
import { createPoseBufferFromRig } from "@ggez/anim-core";
import { AnimationClip, Bone, Matrix4, QuaternionKeyframeTrack, Skeleton, VectorKeyframeTrack } from "three";
import { applyPoseBufferToSkeleton, createClipAssetFromThreeClip, createRigFromSkeleton } from "./bridge";

describe("@ggez/anim-three", () => {
  it("creates a rig definition from a three skeleton", () => {
    const root = new Bone();
    root.name = "root";
    const child = new Bone();
    child.name = "child";
    root.add(child);
    const skeleton = new Skeleton([root, child]);

    const rig = createRigFromSkeleton(skeleton);

    expect(rig.boneNames).toEqual(["root", "child"]);
    expect(Array.from(rig.parentIndices)).toEqual([-1, 0]);
  });

  it("imports clip tracks from a three animation clip", () => {
    const root = new Bone();
    root.name = "root";
    const skeleton = new Skeleton([root]);
    const clip = new AnimationClip("Walk", 1, [
      new VectorKeyframeTrack(".bones[root].position", [0, 1], [0, 0, 0, 1, 0, 0]),
      new QuaternionKeyframeTrack(".bones[root].quaternion", [0, 1], [0, 0, 0, 1, 0, 0, 0, 1])
    ]);

    const asset = createClipAssetFromThreeClip(clip, skeleton);

    expect(asset.tracks).toHaveLength(1);
    expect(asset.rootBoneIndex).toBe(0);
    expect(Array.from(asset.tracks[0]!.translationValues ?? [])).toEqual([0, 0, 0, 1, 0, 0]);
  });

  it("prefers hips as the imported root-motion bone when present", () => {
    const root = new Bone();
    root.name = "Armature";
    const hips = new Bone();
    hips.name = "mixamorigHips";
    const spine = new Bone();
    spine.name = "mixamorigSpine";
    root.add(hips);
    hips.add(spine);

    const skeleton = new Skeleton([root, hips, spine]);
    const clip = new AnimationClip("Walk", 1, [
      new VectorKeyframeTrack(".bones[mixamorigHips].position", [0, 1], [0, 1, 0, 0.8, 1, 0.4]),
      new QuaternionKeyframeTrack(".bones[mixamorigSpine].quaternion", [0, 1], [0, 0, 0, 1, 0, 0, 0, 1])
    ]);

    const asset = createClipAssetFromThreeClip(clip, skeleton);

    expect(asset.rootBoneIndex).toBe(1);
  });

  it("applies a pose without mutating skeleton bind inverses", () => {
    const root = new Bone();
    root.name = "root";
    const child = new Bone();
    child.name = "child";
    root.add(child);

    const skeleton = new Skeleton([root, child]);
    root.updateMatrixWorld(true);
    skeleton.calculateInverses();

    const originalInverse = skeleton.boneInverses[0]!.clone();
    const rig = createRigFromSkeleton(skeleton);
    const pose = createPoseBufferFromRig(rig);

    pose.translations[0] = 1;
    pose.translations[1] = 2;
    pose.translations[2] = 3;

    applyPoseBufferToSkeleton(pose, skeleton);

    expect(root.position.toArray()).toEqual([1, 2, 3]);
    expect(skeleton.boneInverses[0]!.equals(originalInverse)).toBe(true);
    expect(root.matrixWorld.equals(new Matrix4())).toBe(false);
  });
});
