import type { AnimationClipAsset, RigDefinition } from "@ggez/anim-core";
import type { ClipReference, SerializableRig } from "@ggez/anim-schema";
import { createClipAssetFromThreeClip, createRigFromSkeleton } from "@ggez/anim-three";
import type { AnimationClip, Object3D, Skeleton } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

const gltfLoader = new GLTFLoader();
gltfLoader.setMeshoptDecoder(MeshoptDecoder);

const fbxLoader = new FBXLoader();

export interface ImportedPreviewClip {
  id: string;
  name: string;
  duration: number;
  source: string;
  asset: AnimationClipAsset;
  reference: ClipReference;
}

export interface ImportedCharacterAsset {
  fileName: string;
  scene: Object3D;
  skeleton: Skeleton;
  rig: RigDefinition;
  documentRig: SerializableRig;
  clips: ImportedPreviewClip[];
}

interface LoadedAnimationSource {
  root: Object3D;
  animations: AnimationClip[];
}

function getFileExtension(fileName: string): string {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

function slugifyClipId(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "clip";
}

function makeUniqueClipId(baseId: string, existingIds: Set<string>): string {
  if (!existingIds.has(baseId)) {
    existingIds.add(baseId);
    return baseId;
  }

  let suffix = 2;
  while (existingIds.has(`${baseId}-${suffix}`)) {
    suffix += 1;
  }

  const uniqueId = `${baseId}-${suffix}`;
  existingIds.add(uniqueId);
  return uniqueId;
}

export function serializeRigDefinition(rig: RigDefinition): SerializableRig {
  return {
    boneNames: [...rig.boneNames],
    parentIndices: Array.from(rig.parentIndices),
    rootBoneIndex: rig.rootBoneIndex,
    bindTranslations: Array.from(rig.bindTranslations),
    bindRotations: Array.from(rig.bindRotations),
    bindScales: Array.from(rig.bindScales),
  };
}

export function findPrimarySkeleton(root: Object3D): Skeleton | null {
  let foundSkeleton: Skeleton | null = null;

  root.traverse((child) => {
    if (foundSkeleton) {
      return;
    }

    const candidate = child as Object3D & {
      isSkinnedMesh?: boolean;
      skeleton?: Skeleton;
    };

    if (candidate.isSkinnedMesh && candidate.skeleton) {
      foundSkeleton = candidate.skeleton;
    }
  });

  return foundSkeleton;
}

async function loadAnimationSource(file: File): Promise<LoadedAnimationSource> {
  const extension = getFileExtension(file.name);
  const url = URL.createObjectURL(file);

  try {
    if (extension === "glb" || extension === "gltf") {
      const result = await gltfLoader.loadAsync(url);
      return {
        root: result.scene,
        animations: result.animations,
      };
    }

    if (extension === "fbx") {
      const result = await fbxLoader.loadAsync(url);
      return {
        root: result,
        animations: result.animations,
      };
    }

    throw new Error(`Unsupported file type ".${extension || "unknown"}". Use .glb, .gltf, or .fbx.`);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function buildImportedClips(
  animations: AnimationClip[],
  skeleton: Skeleton,
  fileName: string,
  existingIds: Set<string>
): ImportedPreviewClip[] {
  return animations.map((clip) => {
    const clipId = makeUniqueClipId(slugifyClipId(clip.name || fileName.replace(/\.[^.]+$/, "")), existingIds);
    const asset = createClipAssetFromThreeClip(clip, skeleton);

    return {
      id: clipId,
      name: clip.name || clipId,
      duration: clip.duration,
      source: fileName,
      asset: {
        ...asset,
        id: clipId,
        name: clip.name || clipId,
      },
      reference: {
        id: clipId,
        name: clip.name || clipId,
        duration: clip.duration,
        source: fileName,
      },
    };
  });
}

export async function importCharacterFile(
  file: File,
  existingClipIds: Iterable<string> = []
): Promise<ImportedCharacterAsset> {
  const source = await loadAnimationSource(file);
  const skeleton = findPrimarySkeleton(source.root);

  if (!skeleton) {
    throw new Error(`"${file.name}" does not contain a skinned skeleton. Import a rigged GLB/FBX character.`);
  }

  const rig = createRigFromSkeleton(skeleton);
  const clips = buildImportedClips(source.animations, skeleton, file.name, new Set(existingClipIds));

  return {
    fileName: file.name,
    scene: source.root,
    skeleton,
    rig,
    documentRig: serializeRigDefinition(rig),
    clips,
  };
}

export async function importAnimationFiles(
  files: File[],
  skeleton: Skeleton,
  existingClipIds: Iterable<string> = []
): Promise<ImportedPreviewClip[]> {
  const ids = new Set(existingClipIds);
  const imported: ImportedPreviewClip[] = [];

  for (const file of files) {
    const source = await loadAnimationSource(file);
    imported.push(...buildImportedClips(source.animations, skeleton, file.name, ids));
  }

  return imported;
}
