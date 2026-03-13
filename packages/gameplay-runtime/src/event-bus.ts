import { type GameplayEvent, type GameplayEventFilter, type GameplayRuntimeEventBus } from "./types";

export type GameplayEventBusOptions = {
  historyLimit?: number;
  maxMicroPhases?: number;
  onEvent?: (event: GameplayEvent) => void;
};

export class GameplayEventBus implements GameplayRuntimeEventBus {
  private readonly historyLimit: number;
  private readonly maxMicroPhases: number;
  private readonly onEvent?: (event: GameplayEvent) => void;
  private readonly queue: GameplayEvent[] = [];
  private readonly history: GameplayEvent[] = [];
  private readonly listeners = new Set<(event: GameplayEvent) => void>();
  private sequence = 0;

  constructor({
    historyLimit = 128,
    maxMicroPhases = 24,
    onEvent
  }: GameplayEventBusOptions = {}) {
    this.historyLimit = historyLimit;
    this.maxMicroPhases = maxMicroPhases;
    this.onEvent = onEvent;
  }

  emit(input: Omit<GameplayEvent, "id" | "time">) {
    const event: GameplayEvent = {
      ...input,
      id: `event:${this.sequence += 1}`,
      time: performance.now()
    };

    this.queue.push(event);
    return event;
  }

  flush() {
    const dispatched: GameplayEvent[] = [];
    let phase = 0;

    while (this.queue.length > 0) {
      phase += 1;

      if (phase > this.maxMicroPhases) {
        throw new Error("Gameplay event bus exceeded the allowed micro-phase depth.");
      }

      const batch = this.queue.splice(0, this.queue.length);

      batch.forEach((event) => {
        dispatched.push(event);
        this.history.push(event);

        if (this.history.length > this.historyLimit) {
          this.history.splice(0, this.history.length - this.historyLimit);
        }

        this.listeners.forEach((listener) => {
          listener(event);
        });
        this.onEvent?.(event);
      });
    }

    return dispatched;
  }

  getHistory() {
    return this.history;
  }

  subscribe(
    filter: GameplayEventFilter | ((event: GameplayEvent) => void),
    listener?: (event: GameplayEvent) => void
  ) {
    const resolvedListener = typeof filter === "function" ? filter : listener;

    if (!resolvedListener) {
      return () => undefined;
    }

    const wrapped =
      typeof filter === "function"
        ? resolvedListener
        : (event: GameplayEvent) => {
            if (matchesEventFilter(event, filter)) {
              resolvedListener(event);
            }
          };

    this.listeners.add(wrapped);

    return () => {
      this.listeners.delete(wrapped);
    };
  }
}

export function createGameplayEventBus(options: GameplayEventBusOptions = {}): GameplayRuntimeEventBus {
  return new GameplayEventBus(options);
}

function matchesEventFilter(event: GameplayEvent, filter: GameplayEventFilter) {
  if (filter.event) {
    const allowed = Array.isArray(filter.event) ? filter.event : [filter.event];

    if (!allowed.includes(event.event)) {
      return false;
    }
  }

  if (filter.sourceHookType && filter.sourceHookType !== event.sourceHookType) {
    return false;
  }

  if (filter.sourceId && filter.sourceId !== event.sourceId) {
    return false;
  }

  if (filter.targetId && filter.targetId !== event.targetId) {
    return false;
  }

  return true;
}
