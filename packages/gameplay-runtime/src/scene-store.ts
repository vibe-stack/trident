import { addVec3, resolveSceneGraph, type Entity, type GameplayValue, type GeometryNode, type Transform, type Vec3 } from "@ggez/shared";
import { type GameplayActor, type GameplayHookTarget, type GameplayRuntimeHost, type GameplayRuntimeScene, type GameplayRuntimeSceneStore } from "./types";

export type GameplayWorldOptions = {
  host?: GameplayRuntimeHost;
  scene: GameplayRuntimeScene;
};

export class GameplayWorld implements GameplayRuntimeSceneStore {
  readonly actorsById = new Map<string, GameplayActor>();
  readonly entitiesById: ReadonlyMap<string, Entity>;
  readonly nodesById: ReadonlyMap<string, GeometryNode>;

  private readonly host?: GameplayRuntimeHost;
  private readonly mutableNodesById: Map<string, GeometryNode>;
  private readonly mutableEntitiesById: Map<string, Entity>;
  private readonly initialNodeTransforms: Map<string, Transform>;
  private readonly initialEntityTransforms: Map<string, Transform>;
  private readonly hookTargets: GameplayHookTarget[];
  private readonly hookTargetsByType = new Map<string, GameplayHookTarget[]>();
  private readonly hookTargetById = new Map<string, GameplayHookTarget>();
  private readonly localState = new Map<string, Map<string, GameplayValue>>();
  private readonly playerState = new Map<string, GameplayValue>();
  private readonly worldState = new Map<string, GameplayValue>();
  private sceneGraph: ReturnType<typeof resolveSceneGraph>;

  constructor({ host, scene }: GameplayWorldOptions) {
    this.host = host;
    this.mutableNodesById = new Map(scene.nodes.map((node) => [node.id, structuredClone(node)] as const));
    this.mutableEntitiesById = new Map(scene.entities.map((entity) => [entity.id, structuredClone(entity)] as const));
    this.initialNodeTransforms = new Map(scene.nodes.map((node) => [node.id, structuredClone(node.transform)] as const));
    this.initialEntityTransforms = new Map(scene.entities.map((entity) => [entity.id, structuredClone(entity.transform)] as const));
    this.entitiesById = this.mutableEntitiesById;
    this.nodesById = this.mutableNodesById;
    this.hookTargets = buildHookTargets(this.mutableNodesById, this.mutableEntitiesById);
    this.sceneGraph = resolveSceneGraph(this.mutableNodesById.values(), this.mutableEntitiesById.values());

    this.hookTargets.forEach((target) => {
      const byType = this.hookTargetsByType.get(target.hook.type) ?? [];
      byType.push(target);
      this.hookTargetsByType.set(target.hook.type, byType);
      this.hookTargetById.set(`${target.targetId}:${target.hook.id}`, target);
    });
  }

  getActor(actorId: string) {
    return this.actorsById.get(actorId);
  }

  getActors() {
    return Array.from(this.actorsById.values());
  }

  getEntity(entityId: string) {
    return this.mutableEntitiesById.get(entityId);
  }

  getEntityWorldTransform(entityId: string) {
    return this.sceneGraph.entityWorldTransforms.get(entityId);
  }

  getHookTarget(targetId: string, hookId: string) {
    return this.hookTargetById.get(`${targetId}:${hookId}`);
  }

  getHookTargets() {
    return this.hookTargets;
  }

  getHookTargetsByType(type: string) {
    return this.hookTargetsByType.get(type) ?? [];
  }

  getLocalState(targetId: string, key: string) {
    return this.localState.get(targetId)?.get(key);
  }

  getNode(nodeId: string) {
    return this.mutableNodesById.get(nodeId);
  }

  getNodeWorldTransform(nodeId: string) {
    return this.sceneGraph.nodeWorldTransforms.get(nodeId);
  }

  getPlayerState(key: string) {
    return this.playerState.get(key);
  }

  getTargetInitialLocalTransform(targetId: string) {
    return this.initialNodeTransforms.get(targetId) ?? this.initialEntityTransforms.get(targetId);
  }

  getTargetLocalTransform(targetId: string) {
    return this.mutableNodesById.get(targetId)?.transform ?? this.mutableEntitiesById.get(targetId)?.transform;
  }

  getTargetWorldTransform(targetId: string) {
    return this.sceneGraph.nodeWorldTransforms.get(targetId) ?? this.sceneGraph.entityWorldTransforms.get(targetId);
  }

  getWorldState(key: string) {
    return this.worldState.get(key);
  }

  removeActor(actorId: string) {
    this.actorsById.delete(actorId);
  }

  resetTargetLocalTransform(targetId: string) {
    const initialTransform = this.initialNodeTransforms.get(targetId) ?? this.initialEntityTransforms.get(targetId);

    if (!initialTransform) {
      return;
    }

    this.setTargetLocalTransform(targetId, initialTransform);
  }

  setLocalState(targetId: string, key: string, value: GameplayValue) {
    const scopedState = this.localState.get(targetId) ?? new Map<string, GameplayValue>();
    scopedState.set(key, value);
    this.localState.set(targetId, scopedState);
  }

  setPlayerState(key: string, value: GameplayValue) {
    this.playerState.set(key, value);
  }

  setTargetLocalTransform(targetId: string, transform: Transform) {
    const node = this.mutableNodesById.get(targetId);

    if (node) {
      node.transform = structuredClone(transform);
      this.syncWorldTransforms();
      return;
    }

    const entity = this.mutableEntitiesById.get(targetId);

    if (!entity) {
      return;
    }

    entity.transform = structuredClone(transform);
    this.syncWorldTransforms();
  }

  setWorldState(key: string, value: GameplayValue) {
    this.worldState.set(key, value);
  }

  syncWorldTransforms() {
    this.sceneGraph = resolveSceneGraph(this.mutableNodesById.values(), this.mutableEntitiesById.values());

    this.mutableNodesById.forEach((node, nodeId) => {
      this.host?.applyNodeWorldTransform?.(nodeId, this.sceneGraph.nodeWorldTransforms.get(nodeId) ?? node.transform, node);
    });
    this.mutableEntitiesById.forEach((entity, entityId) => {
      this.host?.applyEntityWorldTransform?.(entityId, this.sceneGraph.entityWorldTransforms.get(entityId) ?? entity.transform, entity);
    });
  }

  translateTarget(targetId: string, offset: Vec3) {
    const currentTransform = this.getTargetLocalTransform(targetId);

    if (!currentTransform) {
      return;
    }

    this.setTargetLocalTransform(targetId, {
      ...currentTransform,
      position: addVec3(currentTransform.position, offset)
    });
  }

  upsertActor(actor: GameplayActor) {
    this.actorsById.set(actor.id, structuredClone(actor));
  }
}

export function createGameplaySceneStore(options: GameplayWorldOptions): GameplayRuntimeSceneStore {
  return new GameplayWorld(options);
}

function buildHookTargets(nodesById: Map<string, GeometryNode>, entitiesById: Map<string, Entity>): GameplayHookTarget[] {
  const nodeTargets = Array.from(nodesById.values()).flatMap((node) =>
    (node.hooks ?? []).map((hook) => ({
      hook,
      node,
      targetId: node.id,
      targetKind: "node" as const
    }))
  );
  const entityTargets = Array.from(entitiesById.values()).flatMap((entity) =>
    (entity.hooks ?? []).map((hook) => ({
      entity,
      hook,
      targetId: entity.id,
      targetKind: "entity" as const
    }))
  );

  return [...nodeTargets, ...entityTargets];
}
