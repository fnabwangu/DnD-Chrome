export * from "./GameRepository.js";
export * from "./GameService.js";
import type { WorldEvent, WorldSnapshot } from "@living-rpg/schemas";

export interface EventRepository {
  append(event: WorldEvent): Promise<void>;
  getEvents(sessionId: string): Promise<WorldEvent[]>;
  saveSnapshot(sessionId: string, snapshot: WorldSnapshot): Promise<void>;
  getLatestSnapshot(sessionId: string): Promise<WorldSnapshot | null>;
}

export class InMemoryEventRepository implements EventRepository {
  private events: WorldEvent[] = [];
  private snapshots = new Map<string, WorldSnapshot>();

  async append(event: WorldEvent): Promise<void> {
    this.events.push(event);
  }

  async getEvents(sessionId: string): Promise<WorldEvent[]> {
    return this.events.filter((e) => e.sessionId === sessionId);
  }

  async saveSnapshot(sessionId: string, snapshot: WorldSnapshot): Promise<void> {
    this.snapshots.set(sessionId, structuredClone(snapshot));
  }

  async getLatestSnapshot(sessionId: string): Promise<WorldSnapshot | null> {
    return structuredClone(this.snapshots.get(sessionId) ?? null);
  }
}
