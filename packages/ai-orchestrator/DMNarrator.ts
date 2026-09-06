import type { CanonicalEvent } from "../schemas/src/event.schema";

export class DMNarrator {
  narrate(event: CanonicalEvent): string {
    if (event.type === "DAMAGE_APPLIED" && event.targetId) {
      return `${event.targetId} takes ${event.damage} damage.`;
    }

    return `${event.actorId} acts.`;
  }
}
