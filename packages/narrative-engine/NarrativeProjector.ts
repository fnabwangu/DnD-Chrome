import type { CanonicalEvent } from "../schemas/src/event.schema";

export type NarrativeState = {
  latestSummary: string;
  activeThreads: string[];
};

export function projectNarrativeState(event: CanonicalEvent): NarrativeState {
  if (event.type === "DAMAGE_APPLIED" && event.targetId && event.consequence === "DEFEATED") {
    return {
      latestSummary: `${event.targetId} is defeated by ${event.actorId}.`,
      activeThreads: ["combat_resolution"]
    };
  }

  if (event.type === "SPELL_CAST") {
    return {
      latestSummary: `${event.actorId} casts ${event.spellId ?? "a spell"}.`,
      activeThreads: ["combat_tension"]
    };
  }

  return {
    latestSummary: `${event.actorId} acts.`,
    activeThreads: []
  };
}
