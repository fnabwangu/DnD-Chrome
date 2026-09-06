import test from "node:test";
import assert from "node:assert/strict";

import { submitDropAction } from "../../apps/api/src/routes/actions";
import { compileDrop } from "../../apps/web/src/drag-drop/compileDrop";

test("dragging a spell card onto grid compiles to CAST_SPELL POINT command", () => {
  const command = compileDrop({
    card: { actorId: "pc_xavi", cardKind: "SPELL", cardId: "fireball" },
    target: { targetKind: "GRID", grid: "H17" }
  });

  assert.equal(command.type, "CAST_SPELL");
  assert.equal(command.actorId, "pc_xavi");
  assert.equal(command.spellId, "fireball");
  assert.deepEqual(command.target, { type: "POINT", x: 17, y: 8 });
});

test("submitDropAction routes compiled command through authority/event flow", () => {
  const result = submitDropAction({
    card: { actorId: "pc_xavi", cardKind: "SPELL", cardId: "fireball" },
    target: { targetKind: "UNIT", targetId: "npc_goblin_22" }
  });

  assert.equal(result.event.type, "DAMAGE_APPLIED");
  assert.equal(result.event.damage, 11);
  assert.equal(result.narration, "npc_goblin_22 takes 11 damage.");
});

test("attack card to non-unit target is rejected", () => {
  assert.throws(
    () =>
      compileDrop({
        card: { actorId: "pc_xavi", cardKind: "ATTACK", cardId: "longbow" },
        target: { targetKind: "GRID", grid: "A1" }
      }),
    /require a unit target/
  );
});
