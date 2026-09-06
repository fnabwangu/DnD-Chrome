import type { CanonicalEvent } from "../schemas/src/event.schema";
import type { CanonicalSnapshot } from "./Snapshot";
import { restoreSnapshot } from "./Snapshot";
import { reduceEvents } from "./EventReducer";
import { createCanonicalState, type CanonicalState } from "./StateBoundaries";

export function replayFromEvents(events: CanonicalEvent[], seed?: CanonicalState): CanonicalState {
  return reduceEvents(events, seed ?? createCanonicalState());
}

export function replayFromSnapshot(snapshot: CanonicalSnapshot, eventsAfterSnapshot: CanonicalEvent[]): CanonicalState {
  return reduceEvents(eventsAfterSnapshot, restoreSnapshot(snapshot));
}
