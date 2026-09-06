import test from "node:test";
import assert from "node:assert/strict";

import { createCanonicalState, reduceCanonicalState } from "../../packages/event-engine/StateBoundaries";
import { projectNarrativeState } from "../../packages/narrative-engine/NarrativeProjector";
import { projectPresentationState } from "../../packages/media-engine/PresentationProjector";

test("canonical state is reduced only from canonical events", () => {
  const initial = createCanonicalState({
    units: {
      npc_goblin_22: { hp: 11, status: "ALIVE" }
    }
  });

  const next = reduceCanonicalState(initial, {
    id: "evt_001847",
    type: "DAMAGE_APPLIED",
    actorId: "pc_xavi",
    targetId: "npc_goblin_22",
    damage: 11,
    resultingHp: 0,
    consequence: "DEFEATED",
    sequence: 1847
  });

  assert.equal(next.sequence, 1847);
  assert.deepEqual(next.units.npc_goblin_22, { hp: 0, status: "DEFEATED" });
});

test("narrative and presentation are projections and do not mutate canonical state", () => {
  const canonical = createCanonicalState({
    sequence: 1847,
    units: {
      npc_goblin_22: { hp: 0, status: "DEFEATED" }
    }
  });

  const snapshot = JSON.parse(JSON.stringify(canonical));

  const event = {
    id: "evt_001847",
    type: "DAMAGE_APPLIED" as const,
    actorId: "pc_xavi",
    targetId: "npc_goblin_22",
    damage: 11,
    resultingHp: 0,
    consequence: "DEFEATED" as const,
    sequence: 1847
  };

  const narrative = projectNarrativeState(event);
  const presentation = projectPresentationState(event);

  assert.equal(narrative.latestSummary, "npc_goblin_22 is defeated by pc_xavi.");
  assert.deepEqual(presentation.cues, [
    { channel: "audio", cue: "enemy_defeated_sting" },
    { channel: "ui", cue: "show_defeat_banner" }
  ]);

  assert.deepEqual(canonical, snapshot);
});
