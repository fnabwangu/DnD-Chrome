import type { WorldEvent } from "@living-rpg/schemas";

export interface PresentationCue { id: string; eventId: string; type: "NARRATION" | "NPC_SPEECH" | "SOUND_EFFECT"; text?: string; actorId?: string; }

export function narrationCue(event: WorldEvent, text: string): PresentationCue {
  return { id: `cue_${event.id}`, eventId: event.id, type: "NARRATION", text };
}