# Getting Started

This page covers the minimum setup for using Web Hammer in a plain Three.js app.

Related guides:

- [Build Pipeline](./build-pipeline.md)
- [Loading A Scene](./loading-a-scene.md)
- [Suggested Project Layout](./project-layout.md)

## What Web Hammer Produces

You should think about Web Hammer outputs like this:

- `.whmap`: authored editor source file
- `scene.runtime.json`: stable runtime manifest
- `scene.runtime.zip`: transport bundle containing the manifest plus bundled assets
- `world-index.json`: optional chunk/world-level streaming index

For small projects or quick validation, `scene.runtime.zip` is convenient.

For production projects, prefer unpacked `scene.runtime.json` files plus normal static asset hosting.

## Packages To Install

Minimum runtime setup:

```bash
bun add three @ggez/three-runtime @ggez/runtime-format
```

If you want to build runtime artifacts in your own app/toolchain:

```bash
bun add @ggez/runtime-build
```

If you want authored gameplay hooks:

```bash
bun add @ggez/gameplay-runtime
```

If you want Rapier physics:

```bash
bun add @ggez/runtime-physics-rapier @dimforge/rapier3d-compat
```

If you want chunk streaming:

```bash
bun add @ggez/runtime-streaming
```

## Runtime Ownership Model

Your game should own:

- `WebGLRenderer`
- the main render/update loop
- the camera and controls
- when scenes mount and unmount
- asset caching policy
- chunk loading policy
- physics stepping
- gameplay system registration

Web Hammer should own:

- runtime content contracts
- runtime scene compilation
- renderer-specific object creation
- optional helper packages for streaming and physics

## Minimal Mental Model

The most common vanilla Three.js flow is:

1. Build a runtime artifact from `.whmap`.
2. Load the runtime manifest or bundle.
3. Create a Three runtime scene instance.
4. Add `instance.root` to your `THREE.Scene`.
5. Optionally attach gameplay, physics, and streaming.
6. Call `instance.dispose()` when unloading.

Continue with [Build Pipeline](./build-pipeline.md).
