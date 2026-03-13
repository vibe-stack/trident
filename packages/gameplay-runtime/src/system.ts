import { type GameplayRuntimeSystem, type GameplayRuntimeSystemContext, type GameplayRuntimeSystemDefinition } from "./types";

type GameplaySystemMetadata = {
  description?: string;
  hookTypes?: string[];
  id: string;
  label: string;
};

export abstract class GameplaySystem implements GameplayRuntimeSystem {
  protected readonly context: GameplayRuntimeSystemContext;

  constructor(context: GameplayRuntimeSystemContext) {
    this.context = context;
  }

  static readonly id = "system";
  static readonly label = "GameplaySystem";
  static readonly description: string | undefined = undefined;
  static readonly hookTypes: string[] | undefined = undefined;

  start?(): void;
  stop?(): void;
  update?(_deltaSeconds: number): void;
}

export type GameplaySystemClass<T extends GameplaySystem = GameplaySystem> = GameplaySystemMetadata & {
  new (context: GameplayRuntimeSystemContext): T;
};

export type GameplayRuntimeSystemRegistration = GameplayRuntimeSystemDefinition | GameplaySystemClass;

export function createGameplaySystemDefinition<T extends GameplaySystem>(
  SystemClass: GameplaySystemClass<T>
): GameplayRuntimeSystemDefinition {
  return {
    description: SystemClass.description,
    hookTypes: SystemClass.hookTypes,
    id: SystemClass.id,
    label: SystemClass.label,
    create(context) {
      return new SystemClass(context);
    }
  };
}

export function isGameplaySystemClass(value: GameplayRuntimeSystemRegistration): value is GameplaySystemClass {
  return typeof value === "function";
}
