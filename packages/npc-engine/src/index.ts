import type { WorldEvent } from "@living-rpg/schemas";

export interface NPCMemory { id: string; npcId: string; eventId: string; text: string; }
export interface NPCKnowledge { npcId: string; memories: NPCMemory[]; }

export function rememberEvent(npcId: string, event: WorldEvent, text: string): NPCMemory {
  return { id: `memory_${npcId}_${event.id}`, npcId, eventId: event.id, text };
}

export function canKnowEvent(knownEventIds: readonly string[], event: WorldEvent): boolean {
  return event.visibility === "public" || knownEventIds.includes(event.id);
}