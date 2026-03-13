import {
  BallCollider,
  ConeCollider,
  CuboidCollider,
  CylinderCollider,
  RigidBody,
  TrimeshCollider,
  type RapierRigidBody
} from "@react-three/rapier";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  BackSide,
  Box3,
  BoxGeometry,
  BufferGeometry,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Float32BufferAttribute,
  FrontSide,
  Group,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  RepeatWrapping,
  SphereGeometry,
  SRGBColorSpace,
  TextureLoader,
  Vector3,
  type Side
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MTLLoader } from "three/examples/jsm/loaders/MTLLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import type { DerivedLight, DerivedRenderMesh } from "@web-hammer/render-pipeline";
import { createBlockoutTextureDataUri, resolveTransformPivot, toTuple, type MaterialRenderSide } from "@web-hammer/shared";
import type { AssetPathResolver } from "./types";

const previewTextureCache = new Map<string, ReturnType<TextureLoader["load"]>>();
const modelSceneCache = new Map<string, Object3D>();
const gltfLoader = new GLTFLoader();
const mtlLoader = new MTLLoader();
const modelTextureLoader = new TextureLoader();

export function RenderStaticMesh({
  mesh,
  onNodeObjectChange,
  resolveAssetPath
}: {
  mesh: DerivedRenderMesh;
  onNodeObjectChange?: (nodeId: string, object: Object3D | null) => void;
  resolveAssetPath: AssetPathResolver;
}) {
  const groupRef = useRef<Group | null>(null);

  useEffect(() => {
    onNodeObjectChange?.(mesh.nodeId, groupRef.current);
    return () => {
      onNodeObjectChange?.(mesh.nodeId, null);
    };
  }, [mesh.nodeId, onNodeObjectChange]);

  if (!mesh.surface && !mesh.primitive && !mesh.modelPath) {
    return null;
  }

  return (
    <group position={toTuple(mesh.position)} ref={groupRef} rotation={toTuple(mesh.rotation)} scale={toTuple(mesh.scale)}>
      <RenderNodeBody mesh={mesh} resolveAssetPath={resolveAssetPath} />
    </group>
  );
}

export function PhysicsPropMesh({
  mesh,
  onNodePhysicsBodyChange,
  resolveAssetPath
}: {
  mesh: DerivedRenderMesh;
  onNodePhysicsBodyChange?: (nodeId: string, body: RapierRigidBody | null) => void;
  resolveAssetPath: AssetPathResolver;
}) {
  const physics = mesh.physics;
  const colliderProps = useMemo(() => resolvePhysicsColliderProps(mesh.physics), [mesh.physics]);
  const bodyRef = useRef<RapierRigidBody | null>(null);

  if (!physics) {
    return null;
  }

  useEffect(() => {
    onNodePhysicsBodyChange?.(mesh.nodeId, bodyRef.current);
    return () => {
      onNodePhysicsBodyChange?.(mesh.nodeId, null);
    };
  }, [mesh.nodeId, onNodePhysicsBodyChange]);

  const useTrimeshCollider = physics.colliderShape === "trimesh" || !mesh.primitive;

  return (
    <RigidBody
      angularDamping={physics.angularDamping}
      canSleep={physics.canSleep}
      ccd={physics.ccd}
      colliders={false}
      gravityScale={physics.gravityScale}
      linearDamping={physics.linearDamping}
      lockRotations={physics.lockRotations}
      lockTranslations={physics.lockTranslations}
      position={toTuple(mesh.position)}
      ref={bodyRef}
      rotation={toTuple(mesh.rotation)}
      type={physics.bodyType}
    >
      {!useTrimeshCollider ? <ManualCollider mesh={mesh} /> : <TrimeshPhysicsCollider colliderProps={colliderProps} mesh={mesh} />}
      <group scale={toTuple(mesh.scale)}>
        <RenderNodeBody mesh={mesh} resolveAssetPath={resolveAssetPath} />
      </group>
    </RigidBody>
  );
}

export function StaticPhysicsCollider({
  mesh,
  onNodePhysicsBodyChange
}: {
  mesh: DerivedRenderMesh;
  onNodePhysicsBodyChange?: (nodeId: string, body: RapierRigidBody | null) => void;
}) {
  const bodyRef = useRef<RapierRigidBody | null>(null);

  useEffect(() => {
    onNodePhysicsBodyChange?.(mesh.nodeId, bodyRef.current);
    return () => {
      onNodePhysicsBodyChange?.(mesh.nodeId, null);
    };
  }, [mesh.nodeId, onNodePhysicsBodyChange]);

  return (
    <RigidBody colliders={false} position={toTuple(mesh.position)} ref={bodyRef} rotation={toTuple(mesh.rotation)} type="kinematicPosition">
      <TrimeshPhysicsCollider mesh={mesh} />
    </RigidBody>
  );
}

export function RenderLightNode({
  light,
  onNodeObjectChange
}: {
  light: DerivedLight;
  onNodeObjectChange?: (nodeId: string, object: Object3D | null) => void;
}) {
  const targetRef = useRef<Object3D | null>(null);
  const lightRef = useRef<{ target?: Object3D } | null>(null);
  const groupRef = useRef<Group | null>(null);

  useEffect(() => {
    if (lightRef.current && targetRef.current) {
      lightRef.current.target = targetRef.current;
      targetRef.current.updateMatrixWorld();
    }
  }, [light.nodeId, light.rotation.x, light.rotation.y, light.rotation.z]);

  useEffect(() => {
    onNodeObjectChange?.(light.nodeId, groupRef.current);
    return () => {
      onNodeObjectChange?.(light.nodeId, null);
    };
  }, [light.nodeId, onNodeObjectChange]);

  if (!light.data.enabled) {
    return null;
  }

  return (
    <group position={toTuple(light.position)} ref={groupRef} rotation={toTuple(light.rotation)}>
      {light.data.type === "ambient" ? <ambientLight color={light.data.color} intensity={light.data.intensity} /> : null}
      {light.data.type === "hemisphere" ? (
        <hemisphereLight args={[light.data.color, light.data.groundColor ?? "#0f1721", light.data.intensity]} />
      ) : null}
      {light.data.type === "point" ? (
        <pointLight castShadow={light.data.castShadow} color={light.data.color} decay={light.data.decay} distance={light.data.distance} intensity={light.data.intensity} />
      ) : null}
      {light.data.type === "directional" ? (
        <>
          <directionalLight castShadow={light.data.castShadow} color={light.data.color} intensity={light.data.intensity} ref={lightRef} />
          <object3D position={[0, 0, -6]} ref={targetRef} />
        </>
      ) : null}
      {light.data.type === "spot" ? (
        <>
          <spotLight
            angle={light.data.angle}
            castShadow={light.data.castShadow}
            color={light.data.color}
            decay={light.data.decay}
            distance={light.data.distance}
            intensity={light.data.intensity}
            penumbra={light.data.penumbra}
            ref={lightRef}
          />
          <object3D position={[0, 0, -6]} ref={targetRef} />
        </>
      ) : null}
    </group>
  );
}

function RenderNodeBody({ mesh, resolveAssetPath }: { mesh: DerivedRenderMesh; resolveAssetPath: AssetPathResolver }) {
  if (mesh.modelPath) {
    return <RenderModelBody mesh={mesh} resolveAssetPath={resolveAssetPath} />;
  }

  return <RenderMeshBody mesh={mesh} resolveAssetPath={resolveAssetPath} />;
}

function TrimeshPhysicsCollider({
  colliderProps,
  mesh
}: {
  colliderProps?: ReturnType<typeof resolvePhysicsColliderProps>;
  mesh: DerivedRenderMesh;
}) {
  const colliderArgs = useTrimeshColliderArgs(mesh);
  const pivot = resolveMeshPivot(mesh);

  if (!colliderArgs) {
    return null;
  }

  return (
    <group scale={toTuple(mesh.scale)}>
      <TrimeshCollider args={colliderArgs} position={[-pivot.x, -pivot.y, -pivot.z]} {...colliderProps} />
    </group>
  );
}

function useTrimeshColliderArgs(mesh: DerivedRenderMesh): [ArrayLike<number>, ArrayLike<number>] | undefined {
  const geometry = useRenderableGeometry(mesh);
  const fallbackIndices = useMemo(() => {
    if (!geometry) {
      return new Uint32Array();
    }

    const positionCount = geometry.getAttribute("position")?.count ?? 0;
    return Uint32Array.from({ length: positionCount }, (_, index) => index);
  }, [geometry]);

  useEffect(() => () => geometry?.dispose(), [geometry]);

  if (!geometry) {
    return undefined;
  }

  return [geometry.getAttribute("position").array, geometry.getIndex()?.array ?? fallbackIndices];
}

function RenderMeshBody({ mesh, resolveAssetPath }: { mesh: DerivedRenderMesh; resolveAssetPath: AssetPathResolver }) {
  const geometry = useRenderableGeometry(mesh);
  const previewMaterials = usePreviewMaterials(mesh, resolveAssetPath);
  const pivot = resolveMeshPivot(mesh);

  useEffect(() => () => geometry?.dispose(), [geometry]);
  useEffect(() => () => previewMaterials.forEach((material) => material.dispose()), [previewMaterials]);

  if (!geometry) {
    return null;
  }

  return (
    <group position={[-pivot.x, -pivot.y, -pivot.z]}>
      <mesh castShadow receiveShadow>
        <primitive attach="geometry" object={geometry} />
        <primitive attach="material" object={previewMaterials.length === 1 ? previewMaterials[0] : previewMaterials} />
      </mesh>
    </group>
  );
}

function RenderModelBody({
  mesh,
  resolveAssetPath
}: {
  mesh: DerivedRenderMesh;
  resolveAssetPath: AssetPathResolver;
}) {
  const loadedScene = useLoadedModelScene(
    mesh.modelPath,
    mesh.modelFormat === "obj" ? "obj" : "glb",
    mesh.modelTexturePath,
    mesh.modelMtlText,
    resolveAssetPath
  );
  const loadedBounds = useMemo(() => (loadedScene ? computeModelBounds(loadedScene) : undefined), [loadedScene]);
  const modelScene = useMemo(() => {
    if (!loadedScene) {
      return undefined;
    }

    const clone = loadedScene.clone(true);
    clone.traverse((child) => {
      if (child instanceof Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    return clone;
  }, [loadedScene]);
  const modelBounds = loadedBounds ?? (mesh.modelSize && mesh.modelCenter ? { center: mesh.modelCenter, size: mesh.modelSize } : undefined);
  const center = modelBounds?.center ?? mesh.modelCenter ?? { x: 0, y: 0, z: 0 };

  return modelScene ? (
    <primitive object={modelScene} position={[-center.x, -center.y, -center.z]} />
  ) : (
    <mesh castShadow receiveShadow>
      <boxGeometry args={toTuple(mesh.modelSize ?? { x: 1.4, y: 1.4, z: 1.4 })} />
      <meshStandardMaterial color={mesh.material.color} metalness={0.08} roughness={0.72} />
    </mesh>
  );
}

function useLoadedModelScene(
  path?: string,
  format: "glb" | "obj" = "glb",
  texturePath?: string,
  mtlText?: string,
  resolveAssetPath?: AssetPathResolver
) {
  const [scene, setScene] = useState<Object3D>();

  useEffect(() => {
    if (!path) {
      setScene(undefined);
      return;
    }

    let cancelled = false;

    void Promise.all([
      Promise.resolve(resolveAssetPath ? resolveAssetPath(path) : path),
      texturePath ? Promise.resolve(resolveAssetPath ? resolveAssetPath(texturePath) : texturePath) : Promise.resolve(undefined)
    ])
      .then(async ([resolvedPath, resolvedTexturePath]) => {
        const cacheKey = `${format}:${resolvedPath}:${resolvedTexturePath ?? ""}:${mtlText ?? ""}`;
        const cachedScene = modelSceneCache.get(cacheKey);

        if (cachedScene) {
          return cachedScene;
        }

        const loadedScene = await loadModelScene(resolvedPath, format, resolvedTexturePath, mtlText);
        modelSceneCache.set(cacheKey, loadedScene);
        return loadedScene;
      })
      .then((loadedScene) => {
        if (!cancelled) {
          setScene(loadedScene);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setScene(undefined);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [format, mtlText, path, resolveAssetPath, texturePath]);

  return scene;
}

async function loadModelScene(path: string, format: "glb" | "obj", texturePath?: string, mtlText?: string) {
  if (format === "obj") {
    const objLoader = new OBJLoader();

    if (mtlText) {
      const materialCreator = mtlLoader.parse(patchMtlTextureReferences(mtlText, texturePath), "");
      materialCreator.preload();
      objLoader.setMaterials(materialCreator);
    }

    const object = await objLoader.loadAsync(path);

    if (!mtlText && texturePath) {
      const texture = await loadModelTexture(texturePath);

      object.traverse((child) => {
        if (child instanceof Mesh) {
          child.material = new MeshStandardMaterial({
            map: texture,
            metalness: 0.12,
            roughness: 0.76
          });
        }
      });
    }

    return object;
  }

  const gltf = await gltfLoader.loadAsync(path);
  return gltf.scene;
}

async function loadModelTexture(path: string) {
  const cacheKey = `model:${path}`;
  const cached = previewTextureCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const texture = await modelTextureLoader.loadAsync(path);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.colorSpace = SRGBColorSpace;
  previewTextureCache.set(cacheKey, texture);
  return texture;
}

function computeModelBounds(scene: Object3D) {
  const box = new Box3().setFromObject(scene);
  const size = box.getSize(new Vector3());
  const center = box.getCenter(new Vector3());

  return {
    center: { x: center.x, y: center.y, z: center.z },
    size: {
      x: Math.max(size.x, 0.001),
      y: Math.max(size.y, 0.001),
      z: Math.max(size.z, 0.001)
    }
  };
}

function ManualCollider({ mesh }: { mesh: DerivedRenderMesh }) {
  const pivot = resolveMeshPivot(mesh);
  const commonProps = {
    position: [-pivot.x, -pivot.y, -pivot.z] as [number, number, number],
    scale: toTuple(mesh.scale),
    ...resolvePhysicsColliderProps(mesh.physics)
  };

  if (!mesh.primitive || !mesh.physics) {
    return null;
  }

  if (mesh.physics.colliderShape === "ball" && mesh.primitive.kind === "sphere") {
    return <BallCollider args={[mesh.primitive.radius]} {...commonProps} />;
  }

  if (mesh.physics.colliderShape === "cuboid" && mesh.primitive.kind === "box") {
    return <CuboidCollider args={[mesh.primitive.size.x * 0.5, mesh.primitive.size.y * 0.5, mesh.primitive.size.z * 0.5]} {...commonProps} />;
  }

  if (mesh.physics.colliderShape === "cylinder" && mesh.primitive.kind === "cylinder") {
    return <CylinderCollider args={[mesh.primitive.height * 0.5, Math.max(mesh.primitive.radiusTop, mesh.primitive.radiusBottom)]} {...commonProps} />;
  }

  if (mesh.physics.colliderShape === "cone" && mesh.primitive.kind === "cone") {
    return <ConeCollider args={[mesh.primitive.height * 0.5, mesh.primitive.radius]} {...commonProps} />;
  }

  return null;
}

function resolvePhysicsColliderProps(physics: DerivedRenderMesh["physics"]) {
  if (!physics) {
    return {};
  }

  return {
    ...(physics.contactSkin !== undefined ? { contactSkin: physics.contactSkin } : {}),
    ...(physics.density !== undefined ? { density: physics.density } : physics.mass !== undefined ? { mass: physics.mass } : {}),
    ...(physics.friction !== undefined ? { friction: physics.friction } : {}),
    ...(physics.restitution !== undefined ? { restitution: physics.restitution } : {}),
    ...(physics.sensor !== undefined ? { sensor: physics.sensor } : {})
  };
}

function useRenderableGeometry(mesh: DerivedRenderMesh) {
  return useMemo(() => {
    let bufferGeometry: BufferGeometry | undefined;

    if (mesh.surface) {
      bufferGeometry = createIndexedGeometry(mesh.surface.positions, mesh.surface.indices, mesh.surface.uvs, mesh.surface.groups);
    } else if (mesh.primitive?.kind === "box") {
      bufferGeometry = new BoxGeometry(...toTuple(mesh.primitive.size));
    } else if (mesh.primitive?.kind === "sphere") {
      bufferGeometry = new SphereGeometry(mesh.primitive.radius, mesh.primitive.widthSegments, mesh.primitive.heightSegments);
    } else if (mesh.primitive?.kind === "cylinder") {
      bufferGeometry = new CylinderGeometry(mesh.primitive.radiusTop, mesh.primitive.radiusBottom, mesh.primitive.height, mesh.primitive.radialSegments);
    } else if (mesh.primitive?.kind === "cone") {
      bufferGeometry = new ConeGeometry(mesh.primitive.radius, mesh.primitive.height, mesh.primitive.radialSegments);
    }

    if (!bufferGeometry) {
      return undefined;
    }

    bufferGeometry.computeVertexNormals();
    bufferGeometry.computeBoundingBox();
    bufferGeometry.computeBoundingSphere();
    return bufferGeometry;
  }, [mesh.primitive, mesh.surface]);
}

function usePreviewMaterials(mesh: DerivedRenderMesh, resolveAssetPath: AssetPathResolver) {
  const resolvedSpecs = useResolvedMaterialSpecs(mesh, resolveAssetPath);

  return useMemo(() => resolvedSpecs.map((spec) => createPreviewMaterial(spec)), [resolvedSpecs]);
}

function useResolvedMaterialSpecs(mesh: DerivedRenderMesh, resolveAssetPath: AssetPathResolver) {
  const specs = useMemo(() => mesh.materials ?? [mesh.material], [mesh.material, mesh.materials]);
  const [resolvedSpecs, setResolvedSpecs] = useState(specs);

  useEffect(() => {
    let cancelled = false;

    void Promise.all(
      specs.map(async (spec) => ({
        ...spec,
        colorTexture: spec.colorTexture ? await Promise.resolve(resolveAssetPath(spec.colorTexture)) : spec.colorTexture,
        metalnessTexture: spec.metalnessTexture ? await Promise.resolve(resolveAssetPath(spec.metalnessTexture)) : spec.metalnessTexture,
        normalTexture: spec.normalTexture ? await Promise.resolve(resolveAssetPath(spec.normalTexture)) : spec.normalTexture,
        roughnessTexture: spec.roughnessTexture ? await Promise.resolve(resolveAssetPath(spec.roughnessTexture)) : spec.roughnessTexture
      }))
    ).then((nextSpecs) => {
      if (!cancelled) {
        setResolvedSpecs(nextSpecs);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [resolveAssetPath, specs]);

  return resolvedSpecs;
}

function resolveMeshPivot(mesh: DerivedRenderMesh) {
  return resolveTransformPivot({
    pivot: mesh.pivot,
    position: mesh.position,
    rotation: mesh.rotation,
    scale: mesh.scale
  });
}

function createPreviewMaterial(spec: DerivedRenderMesh["material"]) {
  const colorTexture = spec.colorTexture
    ? loadTexture(spec.colorTexture, true)
    : spec.category === "blockout"
      ? loadTexture(createBlockoutTextureDataUri(spec.color, spec.edgeColor ?? "#f5f2ea", spec.edgeThickness ?? 0.018), true)
      : undefined;
  const normalTexture = spec.normalTexture ? loadTexture(spec.normalTexture, false) : undefined;
  const metalnessTexture = spec.metalnessTexture ? loadTexture(spec.metalnessTexture, false) : undefined;
  const roughnessTexture = spec.roughnessTexture ? loadTexture(spec.roughnessTexture, false) : undefined;

  return new MeshStandardMaterial({
    color: colorTexture ? "#ffffff" : spec.color,
    flatShading: spec.flatShaded,
    metalness: spec.wireframe ? 0.05 : spec.metalness,
    roughness: spec.wireframe ? 0.45 : spec.roughness,
    side: resolvePreviewMaterialSide(spec.side),
    wireframe: spec.wireframe,
    ...(colorTexture ? { map: colorTexture } : {}),
    ...(metalnessTexture ? { metalnessMap: metalnessTexture } : {}),
    ...(normalTexture ? { normalMap: normalTexture } : {}),
    ...(roughnessTexture ? { roughnessMap: roughnessTexture } : {})
  });
}

function loadTexture(source: string, isColor: boolean) {
  const cacheKey = `${isColor ? "color" : "data"}:${source}`;
  const cached = previewTextureCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const texture = new TextureLoader().load(source);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;

  if (isColor) {
    texture.colorSpace = SRGBColorSpace;
  }

  previewTextureCache.set(cacheKey, texture);
  return texture;
}

function resolvePreviewMaterialSide(side?: MaterialRenderSide): Side {
  switch (side) {
    case "back":
      return BackSide;
    case "double":
      return DoubleSide;
    default:
      return FrontSide;
  }
}

function createIndexedGeometry(positions: number[], indices?: number[], uvs?: number[], groups?: Array<{ count: number; materialIndex: number; start: number }>) {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));

  if (uvs) {
    geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  }

  if (indices) {
    geometry.setIndex(indices);
  }

  geometry.clearGroups();
  groups?.forEach((group) => {
    geometry.addGroup(group.start, group.count, group.materialIndex);
  });

  return geometry;
}

function patchMtlTextureReferences(mtlText: string, texturePath?: string) {
  if (!texturePath) {
    return mtlText;
  }

  const mapPattern = /^(map_Ka|map_Kd|map_d|map_Bump|bump)\s+.+$/gm;
  const hasDiffuseMap = /^map_Kd\s+.+$/m.test(mtlText);
  const normalized = mtlText.replace(mapPattern, (line) => {
    if (line.startsWith("map_Kd ")) {
      return `map_Kd ${texturePath}`;
    }

    return line;
  });

  return hasDiffuseMap ? normalized : `${normalized.trim()}\nmap_Kd ${texturePath}\n`;
}
