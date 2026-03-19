# Build Pipeline

This page explains how to turn `.whmap` files into runtime artifacts for a vanilla Three.js project.

Related guides:

- [Getting Started](./getting-started.md)
- [Loading A Scene](./loading-a-scene.md)
- [World Streaming](./world-streaming.md)

## Build-Time Package

Use `@ggez/runtime-build` for headless compilation.

Main APIs:

- `buildRuntimeSceneFromSnapshot()`
- `buildRuntimeBundleFromSnapshot()`
- `packRuntimeBundle()`
- `buildRuntimeWorldIndex()`

## Using The CLI

The package exposes a CLI:

```bash
web-hammer-runtime-build manifest --input level.whmap --output scene.runtime.json
web-hammer-runtime-build bundle --input level.whmap --output scene.runtime.zip
web-hammer-runtime-build world-index --chunks hub:/world/chunks/hub/scene.runtime.json --output world-index.json
```

This is the fastest path if your app already has a content-build step.

## Programmatic Build Example

If you already have a parsed `.whmap` snapshot:

```ts
import {
  buildRuntimeBundleFromSnapshot,
  buildRuntimeSceneFromSnapshot,
  packRuntimeBundle
} from "@ggez/runtime-build";

const runtimeScene = await buildRuntimeSceneFromSnapshot(snapshot);

const runtimeBundle = await buildRuntimeBundleFromSnapshot(snapshot, {
  assetDir: "assets"
});

const zipBytes = packRuntimeBundle(runtimeBundle);
```

## Recommended Outputs

For local validation or handoff:

- emit `scene.runtime.zip`

For production:

- emit `scene.runtime.json`
- emit normal asset files
- keep shared assets outside chunk-local outputs
- optionally emit `world-index.json`

## Small Project Output Example

```text
/public/levels/tutorial.runtime.zip
```

## Production Output Example

```text
/public/world/world-index.json
/public/world/chunks/hub/scene.runtime.json
/public/world/chunks/hub/assets/...
/public/world/chunks/cave-a/scene.runtime.json
/public/world/chunks/cave-a/assets/...
/public/world/shared/props/...
/public/world/shared/textures/...
```

## When To Use Bundles Vs Unpacked Manifests

Use bundles when:

- you want one downloadable artifact
- you are validating exports quickly
- the scene is small

Use unpacked manifests when:

- you care about CDN caching
- you want chunk streaming
- multiple chunks share heavy textures or models
- your app already has a normal asset pipeline

Continue with [Loading A Scene](./loading-a-scene.md).
