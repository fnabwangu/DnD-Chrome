import test from "node:test";
import assert from "node:assert/strict";

import { TurnStateMachine } from "../../packages/turn-engine/TurnStateMachine";

test("turn state machine follows team-phased combat loop", () => {
  const machine = new TurnStateMachine();
  const phases = [
    machine.current(),
    machine.advance(),
    machine.advance(),
    machine.advance(),
    machine.advance(),
    machine.advance(),
    machine.advance(),
    machine.advance(),
    machine.advance(),
    machine.advance()
  ];

  assert.deepEqual(phases, [
    "EXPLORATION",
    "ENCOUNTER_START",
    "PLAYER_PLANNING",
    "PLAYER_COMMIT",
    "AUTHORITATIVE_RESOLUTION",
    "REACTION_WINDOWS",
    "NARRATIVE_RESOLUTION",
    "ENEMY_PLANNING",
    "ENEMY_RESOLUTION",
    "NEXT_ROUND"
  ]);

  assert.equal(machine.advance(), "PLAYER_PLANNING");
});
