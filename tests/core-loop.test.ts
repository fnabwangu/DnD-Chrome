import { describe, expect, it } from "vitest";
import { replayWorld } from "@living-rpg/event-engine";
import { RuleViolation } from "@living-rpg/rules-engine";
import { TurnSession } from "@living-rpg/turn-engine";
import type { WorldSnapshot } from "@living-rpg/schemas";

const initial: WorldSnapshot = {
  version: 0, phase: "EXPLORATION", worldTime: "night", knownSecrets: {}, npcMemories: {},
  characters: {
    xavi: { id: "xavi", name: "Xavi", hp: 12, maxHp: 12, x: 1, y: 1, alive: true },
    mara: { id: "mara", name: "Mara", hp: 10, maxHp: 10, x: 2, y: 1, alive: true },
    raider: { id: "raider", name: "Raider", hp: 8, maxHp: 8, x: 3, y: 1, alive: true }
  }
};

describe("authoritative event loop", () => {
  it("resolves commands into ordered events and replay reproduces state", () => {
    const session = new TurnSession(initial);
    session.submit({ id: "cmd-1", type: "BEGIN_ENCOUNTER", sessionId: "s", actorId: "xavi", expectedWorldVersion: 0, payload: {} });
    session.submit({ id: "cmd-2", type: "ATTACK_TARGET", sessionId: "s", actorId: "xavi", expectedWorldVersion: 1, payload: { targetId: "raider" } });
    expect(session.snapshot.reactionWindow).toBeUndefined();
    expect(session.pendingCommands).toHaveLength(1);
    session.submit({ id: "commit", type: "END_PHASE", sessionId: "s", actorId: "xavi", expectedWorldVersion: 1, payload: {} });
    expect(session.snapshot.reactionWindow?.targetId).toBe("raider");
    session.resolveReaction({ id: "cmd-3", type: "RESPOND_REACTION", sessionId: "s", actorId: "xavi", expectedWorldVersion: 2, payload: { reactionId: "reaction_2", choice: "ACCEPT_HIT" } });
    expect(session.snapshot.characters.raider?.hp).toBe(4);
    expect(session.snapshot.phase).toBe("PLAYER_PLANNING");
    expect(replayWorld(initial, session.eventLog.all())).toEqual(session.snapshot);
  });

  it("rejects stale commands and illegal movement", () => {
    const session = new TurnSession(initial);
    expect(() => session.submit({ id: "stale", type: "MOVE_CHARACTER", sessionId: "s", actorId: "xavi", expectedWorldVersion: 9, payload: { x: 2, y: 1 } })).toThrow(RuleViolation);
    expect(() => session.submit({ id: "far", type: "MOVE_CHARACTER", sessionId: "s", actorId: "xavi", expectedWorldVersion: 0, payload: { x: 9, y: 9 } })).toThrow("range");
    expect(() => session.submit({ id: "attack", type: "ATTACK_TARGET", sessionId: "s", actorId: "xavi", expectedWorldVersion: 0, payload: { targetId: "raider" } })).toThrow("planning");
  });
});