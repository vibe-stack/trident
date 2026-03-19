# Web Hammer In Vanilla Three.js

This guide set explains how to use Web Hammer as a content pipeline and runtime adapter inside a plain Three.js application.

Read in this order:

1. [Getting Started](./getting-started.md)
2. [Starter CLI](./starter-cli.md)
3. [Build Pipeline](./build-pipeline.md)
4. [Loading A Scene](./loading-a-scene.md)
5. [Gameplay And Physics](./gameplay-and-physics.md)
6. [World Streaming](./world-streaming.md)
7. [Suggested Project Layout](./project-layout.md)

What this stack looks like:

- `@ggez/runtime-format`: runtime manifest and world-index contracts
- `@ggez/runtime-build`: build-time compilation from `.whmap` to runtime artifacts
- `@ggez/three-runtime`: Three.js object creation and scene instances
- `@ggez/gameplay-runtime`: headless authored hook runtime
- `@ggez/runtime-physics-rapier`: optional Rapier bindings
- `@ggez/runtime-streaming`: optional chunk/world orchestration

Core rule:

Web Hammer does not replace your game app. Your app still owns renderer creation, the main loop, camera policy, input, save state, networking, and deployment.

Next: [Getting Started](./getting-started.md)
