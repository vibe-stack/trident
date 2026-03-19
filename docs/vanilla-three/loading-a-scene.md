# Loading A Scene

This page explains how to mount Web Hammer runtime content into a vanilla Three.js application.

Related guides:

- [Build Pipeline](./build-pipeline.md)
- [Gameplay And Physics](./gameplay-and-physics.md)
- [World Streaming](./world-streaming.md)

## Main Three Runtime API

For vanilla Three.js, the main entrypoint is:

- `createThreeRuntimeSceneInstance()`

Compatibility API:

- `loadWebHammerEngineScene()`

Lower-level API:

- `createThreeRuntimeObjectFactory()`

## Load A Bundle

```ts
import * as THREE from "three";
import {
  createThreeAssetResolver,
  createThreeRuntimeSceneInstance,
  parseWebHammerEngineBundleZip
} from "@ggez/three-runtime";

const response = await fetch("/world/chunks/hub.runtime.zip");
const bytes = new Uint8Array(await response.arrayBuffer());
const bundle = parseWebHammerEngineBundleZip(bytes);
const assetResolver = createThreeAssetResolver(bundle);

const threeScene = new THREE.Scene();

const instance = await createThreeRuntimeSceneInstance(bundle.manifest, {
  applyToScene: threeScene,
  lod: {
    midDistance: 10,
    lowDistance: 30
  },
  resolveAssetUrl: ({ path }) => assetResolver.resolve(path)
});

threeScene.add(instance.root);
```

## Load An Unpacked Manifest

```ts
import {
  createThreeRuntimeSceneInstance
} from "@ggez/three-runtime";
import { parseRuntimeScene } from "@ggez/runtime-format";

const response = await fetch("/world/chunks/hub/scene.runtime.json");
const manifest = parseRuntimeScene(await response.text());

const instance = await createThreeRuntimeSceneInstance(manifest, {
  resolveAssetUrl: ({ path }) => `/world/chunks/hub/${path}`
});
```

## What The Scene Instance Gives You

`createThreeRuntimeSceneInstance()` returns:

- `root`: the object tree to mount into your `THREE.Scene`
- `nodesById`: map of runtime node IDs to `Object3D`
- `lights`: created light objects
- `physicsDescriptors`: runtime physics-ready node descriptors
- `entities`: runtime entities with resolved transforms
- `scene`: the runtime manifest used to create the instance
- `dispose()`: resource cleanup

## World Settings

If you want to apply or clear skybox/fog state manually:

```ts
import {
  applyRuntimeWorldSettingsToThreeScene,
  clearRuntimeWorldSettingsFromThreeScene
} from "@ggez/three-runtime";

await applyRuntimeWorldSettingsToThreeScene(threeScene, {
  settings: manifest.settings
});

clearRuntimeWorldSettingsFromThreeScene(threeScene);
```

## Unloading

When a scene or chunk is no longer needed:

```ts
threeScene.remove(instance.root);
instance.dispose();
assetResolver.dispose();
```

If you loaded an unpacked manifest with normal URLs, there may be no asset resolver to dispose.

## Minimal App Skeleton

```ts
import * as THREE from "three";

const renderer = new THREE.WebGLRenderer({ antialias: true });
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000);
const scene = new THREE.Scene();

document.body.append(renderer.domElement);

const instance = await createThreeRuntimeSceneInstance(manifest, {
  applyToScene: scene
});

scene.add(instance.root);

function frame() {
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

frame();
```

Continue with [Gameplay And Physics](./gameplay-and-physics.md).
