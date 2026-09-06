import test from "node:test";
import assert from "node:assert/strict";

import { submitAction } from "../../apps/api/src/routes/actions";

test("structured command produces canonical event before narration", () => {
  const result = submitAction({
    actorId: "pc_xavi",
    command: {
      type: "CAST_SPELL",
      actorId: "pc_xavi",
      spellId: "fireball",
      target: {
        type: "UNIT",
        targetId: "npc_goblin_22"
      }
    }
  });

  assert.equal(result.event.type, "DAMAGE_APPLIED");
  assert.equal(result.event.actorId, "pc_xavi");
  assert.equal(result.event.targetId, "npc_goblin_22");
  assert.equal(result.event.damage, 11);
  assert.equal(result.event.resultingHp, 0);
  assert.equal(result.event.consequence, "DEFEATED");
  assert.equal(result.narration, "npc_goblin_22 takes 11 damage.");
});

test("natural language intent is parsed into structured command and resolved", () => {
  const result = submitAction({
    actorId: "pc_xavi",
    intent: "I cast fireball at H17"
  });

  assert.equal(result.event.type, "SPELL_CAST");
  assert.equal(result.event.actorId, "pc_xavi");
  assert.equal(result.event.spellId, "fireball");
  assert.equal(result.narration, "pc_xavi acts.");
});

test("guardrails reject command payloads containing canonical fields", () => {
  assert.throws(
    () =>
      submitAction({
        actorId: "pc_xavi",
        command: {
          type: "ATTACK",
          actorId: "pc_xavi",
          target: { type: "UNIT", targetId: "npc_goblin_22" },
          sequence: 999
        } as unknown as Parameters<typeof submitAction>[0]["command"]
      }),
    /canonical-state field: sequence/
  );
});

test("CAST_SPELL without spellId is rejected", () => {
  assert.throws(
    () =>
      submitAction({
        actorId: "pc_xavi",
        command: {
          type: "CAST_SPELL",
          actorId: "pc_xavi",
          target: { type: "POINT", x: 17, y: 8 }
        } as unknown as Parameters<typeof submitAction>[0]["command"]
      }),
    /valid structured command/
  );
});

test("invalid input is rejected", () => {
  assert.throws(() => submitAction({ actorId: "pc_xavi" }), /valid structured command/);
});
