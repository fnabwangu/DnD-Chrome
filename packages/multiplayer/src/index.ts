import type { WorldEvent, WorldSnapshot } from "@living-rpg/schemas";

export type SessionMessage =
  | { type: "SNAPSHOT"; snapshot: WorldSnapshot; events: WorldEvent[] }
  | { type: "EVENTS"; events: WorldEvent[]; snapshot: WorldSnapshot }
  | { type: "ERROR"; message: string };

export function filterEventsForPlayer(events: WorldEvent[], playerId: string, isGm = false): WorldEvent[] {
  if (isGm) return events;
  return events.filter((e) => {
    if (e.visibility === "public" || e.visibility === "party") return true;
    if (e.visibility === "private" && e.actorId === playerId) return true;
    return false;
  });
}
