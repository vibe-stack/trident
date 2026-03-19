# Gameplay And Physics

This page shows how to attach headless gameplay and optional Rapier physics to a vanilla Three.js integration.

Related guides:

- [Loading A Scene](./loading-a-scene.md)
- [World Streaming](./world-streaming.md)

## Gameplay Runtime

`@ggez/gameplay-runtime` stays headless. It does not require Three.js.

Use the adapter helper:

- `createGameplayRuntimeSceneFromRuntimeScene()`

Example:

```ts
import {
  createGameplayRuntime,
  createGameplayRuntimeSceneFromRuntimeScene
} from "@ggez/gameplay-runtime";

const gameplayRuntime = createGameplayRuntime({
  scene: createGameplayRuntimeSceneFromRuntimeScene(instance.scene),
  systems: [
    /* your system registrations */
  ]
});

gameplayRuntime.start();
```

This keeps authored hooks and gameplay state separate from rendering.

## Mapping Gameplay To Three Objects

Use the scene instance maps instead of hiding Three behind gameplay:

```ts
const doorObject = instance.nodesById.get("node:door");
const triggerEntity = instance.entities.find((entity) => entity.id === "entity:door-trigger");
```

That is the intended ownership boundary:

- gameplay consumes authored data
- rendering consumes Three objects
- your host app coordinates both

## Rapier Physics

Use `@ggez/runtime-physics-rapier` when you want Rapier bindings without baking Rapier into `three-runtime`.

Core APIs:

- `ensureRapierRuntimePhysics()`
- `createRapierPhysicsWorld()`
- `createStaticRigidBody()`
- `createDynamicRigidBody()`
- `createRuntimePhysicsDescriptors()`

Example:

```ts
import {
  createDynamicRigidBody,
  createRapierPhysicsWorld,
  createStaticRigidBody,
  ensureRapierRuntimePhysics
} from "@ggez/runtime-physics-rapier";

await ensureRapierRuntimePhysics();

const world = createRapierPhysicsWorld(instance.scene.settings);

for (const mesh of staticMeshes) {
  createStaticRigidBody(world, mesh);
}

for (const mesh of dynamicMeshes) {
  createDynamicRigidBody(world, mesh);
}
```

## Important Physics Ownership Rule

Your app still owns:

- when the Rapier world is created
- the simulation timestep
- stepping the world
- syncing rigid bodies to Three objects
- destroying the world and related objects

Web Hammer only gives you helper constructors and authored descriptors.

## Using `physicsDescriptors`

If you want to build physics from the runtime manifest rather than derived render meshes:

```ts
for (const descriptor of instance.physicsDescriptors) {
  console.log(descriptor.nodeId, descriptor.physics.colliderShape);
}
```

That is useful when your physics setup needs direct runtime-node access.

Continue with [World Streaming](./world-streaming.md).
