import { type GameplayValue, type Transform, type Vec3 } from "@ggez/shared";
import { GameplayEventBus, type GameplayEventBusOptions } from "./event-bus";
import { GameplayWorld } from "./scene-store";
import {
  createGameplaySystemDefinition,
  isGameplaySystemClass,
  type GameplayRuntimeSystemRegistration
} from "./system";
import {
  type GameplayActor,
  type GameplayEvent,
  type GameplayEventFilter,
  type GameplayEventInput,
  type GameplayHookTarget,
  type GameplayRuntime as GameplayRuntimeShape,
  type GameplayRuntimeHost,
  type GameplayRuntimeScene,
  type GameplayRuntimeSystem,
  type GameplayRuntimeSystemContext
} from "./types";

export type GameplayGameOptions = {
  eventBus?: GameplayEventBus;
  eventBusOptions?: GameplayEventBusOptions;
  host?: GameplayRuntimeHost;
  scene: GameplayRuntimeScene;
  systems?: GameplayRuntimeSystemRegistration[];
  world?: GameplayWorld;
};

export class GameplayGame implements GameplayRuntimeShape {
  readonly eventBus: GameplayEventBus;
  readonly scene: GameplayWorld;
  readonly world: GameplayWorld;

  private readonly systemInstances: Array<{
    instance: GameplayRuntimeSystem;
  }> = [];
  private started = false;

  constructor({
    eventBus,
    eventBusOptions,
    host,
    scene,
    systems = [],
    world
  }: GameplayGameOptions) {
    this.scene = world ?? new GameplayWorld({ host, scene });
    this.world = this.scene;
    this.eventBus = eventBus ?? new GameplayEventBus({ ...eventBusOptions, onEvent: host?.onEvent });

    const context = this as GameplayRuntimeSystemContext;
    this.systemInstances = systems
      .map((registration) => (isGameplaySystemClass(registration) ? createGameplaySystemDefinition(registration) : registration))
      .map((definition) => ({
        definition,
        instance: definition.create(context)
      }));
  }

  emitEvent(input: GameplayEventInput) {
    return this.eventBus.emit(input);
  }

  emitFromHookTarget(
    target: GameplayHookTarget,
    eventName: string,
    payload?: GameplayEvent["payload"],
    targetId = target.targetId
  ) {
    return this.eventBus.emit({
      event: eventName,
      payload,
      sourceHookType: target.hook.type,
      sourceId: target.targetId,
      sourceKind: target.targetKind,
      targetId
    });
  }

  getActor(actorId: string) {
    return this.scene.getActor(actorId);
  }

  getActors() {
    return this.scene.getActors();
  }

  getEntity(entityId: string) {
    return this.scene.getEntity(entityId);
  }

  getEntityWorldTransform(entityId: string) {
    return this.scene.getEntityWorldTransform(entityId);
  }

  getHookTarget(targetId: string, hookId: string) {
    return this.scene.getHookTarget(targetId, hookId);
  }

  getHookTargets() {
    return this.scene.getHookTargets();
  }

  getHookTargetsByType(type: string) {
    return this.scene.getHookTargetsByType(type);
  }

  getLocalState(targetId: string, key: string) {
    return this.scene.getLocalState(targetId, key);
  }

  getNode(nodeId: string) {
    return this.scene.getNode(nodeId);
  }

  getNodeWorldTransform(nodeId: string) {
    return this.scene.getNodeWorldTransform(nodeId);
  }

  getPlayerState(key: string) {
    return this.scene.getPlayerState(key);
  }

  getTargetInitialLocalTransform(targetId: string) {
    return this.scene.getTargetInitialLocalTransform(targetId);
  }

  getTargetLocalTransform(targetId: string) {
    return this.scene.getTargetLocalTransform(targetId);
  }

  getTargetWorldTransform(targetId: string) {
    return this.scene.getTargetWorldTransform(targetId);
  }

  getWorldState(key: string) {
    return this.scene.getWorldState(key);
  }

  onEvent(
    filter: GameplayEventFilter | ((event: GameplayEvent) => void),
    listener?: (event: GameplayEvent) => void
  ) {
    return this.eventBus.subscribe(filter, listener);
  }

  removeActor(actorId: string) {
    this.scene.removeActor(actorId);
  }

  resetTargetLocalTransform(targetId: string) {
    this.scene.resetTargetLocalTransform(targetId);
  }

  setLocalState(targetId: string, key: string, value: GameplayValue) {
    this.scene.setLocalState(targetId, key, value);
  }

  setPlayerState(key: string, value: GameplayValue) {
    this.scene.setPlayerState(key, value);
  }

  setTargetLocalTransform(targetId: string, transform: Transform) {
    this.scene.setTargetLocalTransform(targetId, transform);
  }

  setWorldState(key: string, value: GameplayValue) {
    this.scene.setWorldState(key, value);
  }

  translateTarget(targetId: string, offset: Vec3) {
    this.scene.translateTarget(targetId, offset);
  }

  updateActor(actor: GameplayActor) {
    this.scene.upsertActor(actor);
  }

  dispose() {
    this.systemInstances.forEach((system) => {
      system.instance.stop?.();
    });
    this.eventBus.flush();
  }

  start() {
    if (this.started) {
      return;
    }

    this.scene.syncWorldTransforms();
    this.systemInstances.forEach((system) => {
      system.instance.start?.();
    });
    this.eventBus.flush();
    this.started = true;
  }

  stop() {
    if (!this.started) {
      return;
    }

    this.systemInstances.forEach((system) => {
      system.instance.stop?.();
    });
    this.started = false;
  }

  update(deltaSeconds: number) {
    if (!this.started) {
      return;
    }

    this.eventBus.flush();
    this.systemInstances.forEach((system) => {
      system.instance.update?.(deltaSeconds);
    });
    this.eventBus.flush();
  }
}

export function createGameplayRuntime(options: GameplayGameOptions): GameplayRuntimeShape {
  return new GameplayGame(options);
}
