import type { CanonicalState } from "./StateBoundaries";
import { createCanonicalState } from "./StateBoundaries";

export type CanonicalSnapshot = {
  atSequence: number;
  state: CanonicalState;
};

export function createSnapshot(state: CanonicalState): CanonicalSnapshot {
  return {
    atSequence: state.sequence,
    state: createCanonicalState(state)
  };
}

export function restoreSnapshot(snapshot: CanonicalSnapshot): CanonicalState {
  return createCanonicalState(snapshot.state);
}
