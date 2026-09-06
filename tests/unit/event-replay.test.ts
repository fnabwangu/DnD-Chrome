import test from "node:test";
import assert from "node:assert/strict";

import { replayFromEvents, replayFromSnapshot } from "../../packages/event-engine/Replay";
import { createSnapshot } from "../../packages/event-engine/Snapshot";
import { createCanonicalState } from "../../packages/event-engine/StateBoundaries";
import type { CanonicalEvent } from "../../packages/schemas/src/event.schema";

const sequence = (n: number) => `evt_${String(n).padStart(6, "0")}`;

test("replay rebuilds canonical state from canonical event history", () => {
  const events: CanonicalEvent[] = [
    {
      id: sequence(1),
      type: "DAMAGE_APPLIED",
      actorId: "pc_xavi",
      targetId: "npc_goblin_22",
      damage: 4,
      resultingHp: 7,
      sequence: 1
    },
    {
      id: sequence(2),
      type: "DAMAGE_APPLIED",
      actorId: "pc_xavi",
      targetId: "npc_goblin_22",
      damage: 7,
      resultingHp: 0,
      consequence: "DEFEATED",
      sequence: 2
    }
  ];

  const canonical = replayFromEvents(events);
  assert.equal(canonical.sequence, 2);
  assert.deepEqual(canonical.units.npc_goblin_22, { hp: 0, status: "DEFEATED" });
});

test("snapshot + replay supports retcon-style regeneration", () => {
  const seed = createCanonicalState({
    sequence: 10,
    units: {
      npc_goblin_22: { hp: 11, status: "ALIVE" }
    }
  });

  const baselineEvents: CanonicalEvent[] = [
    {
      id: sequence(11),
      type: "DAMAGE_APPLIED",
      actorId: "pc_xavi",
      targetId: "npc_goblin_22",
      damage: 3,
      resultingHp: 8,
      sequence: 11
    }
  ];

  const afterBaseline = replayFromEvents(baselineEvents, seed);
  const snapshot = createSnapshot(afterBaseline);

  const originalFuture: CanonicalEvent[] = [
    {
      id: sequence(12),
      type: "DAMAGE_APPLIED",
      actorId: "pc_xavi",
      targetId: "npc_goblin_22",
      damage: 2,
      resultingHp: 6,
      sequence: 12
    }
  ];

  const retconnedFuture: CanonicalEvent[] = [
    {
      id: sequence(12),
      type: "DAMAGE_APPLIED",
      actorId: "pc_xavi",
      targetId: "npc_goblin_22",
      damage: 8,
      resultingHp: 0,
      consequence: "DEFEATED",
      sequence: 12
    }
  ];

  const original = replayFromSnapshot(snapshot, originalFuture);
  const retconned = replayFromSnapshot(snapshot, retconnedFuture);

  assert.deepEqual(original.units.npc_goblin_22, { hp: 6, status: "ALIVE" });
  assert.deepEqual(retconned.units.npc_goblin_22, { hp: 0, status: "DEFEATED" });
});
