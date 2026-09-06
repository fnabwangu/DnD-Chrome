import type { WorldEvent, WorldSnapshot } from "@living-rpg/schemas";

export class EventLog {
  private readonly events: WorldEvent[] = [];

  append(event: WorldEvent): void {
    const expectedSequence = this.events.length + 1;
    if (event.sequence !== expectedSequence) {
      throw new Error(`Event sequence must be ${expectedSequence}, received ${event.sequence}`);
    }
    this.events.push(event);
  }

  all(): WorldEvent[] {
    return [...this.events];
  }
}

export function reduceWorld(snapshot: WorldSnapshot, event: WorldEvent): WorldSnapshot {
  const next: WorldSnapshot = structuredClone(snapshot);
  next.version = event.sequence;

  switch (event.type) {
    case "WORLD_TIME_ADVANCED":
      next.worldTime = event.payload.worldTime as string;
      break;
    case "PHASE_CHANGED":
      next.phase = event.payload.phase as WorldSnapshot["phase"];
      break;
    case "CHARACTER_MOVED": {
      const character = next.characters[event.actorId ?? ""];
      if (character) {
        character.x = event.payload.x as number;
        character.y = event.payload.y as number;
      }
      break;
    }
    case "DAMAGE_APPLIED": {
      const character = next.characters[event.targetId ?? ""];
      if (character) {
        character.hp = event.payload.resultingHp as number;
        character.alive = character.hp > 0;
      }
      break;
    }
    case "REACTION_WINDOW_OPENED":
      next.reactionWindow = {
        id: event.payload.reactionId as string,
        actorId: event.payload.actorId as string,
        targetId: event.targetId as string,
        options: event.payload.options as string[],
        damage: event.payload.damage as number
      };
      break;
    case "REACTION_RESOLVED":
      delete next.reactionWindow;
      break;
    case "SECRET_LEARNED": {
      const secrets = next.knownSecrets[event.actorId ?? ""] ?? [];
      next.knownSecrets[event.actorId ?? ""] = [...secrets, event.payload.secret as string];
      break;
    }
    case "NPC_MEMORY_CREATED": {
      const memories = next.npcMemories[event.actorId ?? ""] ?? [];
      next.npcMemories[event.actorId ?? ""] = [...memories, event.payload.memory as string];
      break;
    }
  }
  return next;
}

export function replayWorld(initial: WorldSnapshot, events: WorldEvent[]): WorldSnapshot {
  return events.reduce(reduceWorld, initial);
}