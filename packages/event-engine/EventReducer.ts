import type { CanonicalEvent } from "../schemas/src/event.schema";
import { createCanonicalState, reduceCanonicalState, type CanonicalState } from "./StateBoundaries";

export function reduceEvents(events: CanonicalEvent[], seed?: CanonicalState): CanonicalState {
  return events.reduce(
    (state, event) => reduceCanonicalState(state, event),
    seed ? createCanonicalState(seed) : createCanonicalState()
  );
}
