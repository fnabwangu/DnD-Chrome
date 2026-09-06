import type { WorldEvent } from "@living-rpg/schemas";

export interface NewsItem { headline: string; rumor: string; provenance: string[]; }

export function generateNews(events: readonly WorldEvent[]): NewsItem {
  const combat = events.filter((event) => event.type === "DAMAGE_APPLIED");
  return {
    headline: combat.length ? "Black Hart Inn survives a violent night" : "Quiet night reported at the Black Hart Inn",
    rumor: combat.length ? "They say the innkeeper saw everything." : "The rain kept everyone indoors.",
    provenance: combat.map((event) => event.id)
  };
}