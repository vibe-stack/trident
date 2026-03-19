# World Streaming

This page explains how to stream multiple Web Hammer chunks in a vanilla Three.js project.

Related guides:

- [Build Pipeline](./build-pipeline.md)
- [Loading A Scene](./loading-a-scene.md)
- [Suggested Project Layout](./project-layout.md)

## World-Level Contract

Use `RuntimeWorldIndex` from `@ggez/runtime-format` as the world-level contract.

A runtime scene is one chunk.

A world index is the streaming contract that describes multiple chunks.

## Streaming Package

Use `@ggez/runtime-streaming`.

Main APIs:

- `createRuntimeWorldManager()`
- `loadChunk()`
- `unloadChunk()`
- `updateStreamingFocus()`

## Basic Flow

```ts
import { createRuntimeWorldManager } from "@ggez/runtime-streaming";
import { createThreeRuntimeSceneInstance } from "@ggez/three-runtime";

const manager = createRuntimeWorldManager({
  async loadChunk(chunk) {
    const response = await fetch(chunk.manifestUrl!);
    const manifest = await response.text();
    const instance = await createThreeRuntimeSceneInstance(manifest, {
      resolveAssetUrl: ({ path }) => `/world/chunks/${chunk.id}/${path}`
    });

    threeScene.add(instance.root);
    return instance;
  },
  async unloadChunk(_chunk, instance) {
    threeScene.remove(instance.root);
    instance.dispose();
  },
  worldIndex
});
```

Then update focus from the player or camera position:

```ts
await manager.updateStreamingFocus({
  x: player.position.x,
  y: player.position.y,
  z: player.position.z
});
```

## Recommended Chunk Strategy

Do not treat one giant runtime bundle as your whole open world.

Better approach:

1. Split the world into authored chunks.
2. Build one runtime manifest per chunk.
3. Keep large shared assets outside chunk-local asset folders.
4. Load nearby chunks.
5. Unload distant chunks.

## Example World Index

```json
{
  "version": 1,
  "chunks": [
    {
      "id": "hub",
      "bounds": [-40, 0, -40, 40, 20, 40],
      "manifestUrl": "/world/chunks/hub/scene.runtime.json",
      "loadDistance": 120,
      "unloadDistance": 180
    }
  ]
}
```

## Chunk Data Type

The streaming manager is generic.

That means your loaded chunk data can be:

- a `ThreeRuntimeSceneInstance`
- a custom object containing scene instance, gameplay runtime, and physics world
- a cached manifest
- any host-defined structure

This is intentional. Streaming stays host-owned.

Continue with [Suggested Project Layout](./project-layout.md).
