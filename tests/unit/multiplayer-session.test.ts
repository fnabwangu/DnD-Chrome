import test from "node:test";
import assert from "node:assert/strict";

import {
  beginAuthoritativeResolution,
  beginNextRound,
  commitPlayerAction,
  createSessionState
} from "../../packages/multiplayer/SessionState";
import { applyNextVersion, initializeVersioned, mergeLatestVersion } from "../../packages/multiplayer/Synchronization";

test("session moves to PLAYER_COMMIT when all active players commit", () => {
  let session = createSessionState("sess_001", ["pc_xavi", "pc_matu"]);
  session = commitPlayerAction(session, "pc_xavi");
  assert.equal(session.phase, "PLAYER_PLANNING");

  session = commitPlayerAction(session, "pc_matu");
  assert.equal(session.phase, "PLAYER_COMMIT");
  assert.deepEqual(session.committedActorIds.sort(), ["pc_matu", "pc_xavi"]);
});

test("session can start authoritative resolution after commit", () => {
  let session = createSessionState("sess_001", ["pc_xavi"]);
  session = commitPlayerAction(session, "pc_xavi");
  session = beginAuthoritativeResolution(session);
  assert.equal(session.phase, "AUTHORITATIVE_RESOLUTION");
});

test("session starts next round from ENEMY_RESOLUTION", () => {
  const next = beginNextRound({
    id: "sess_001",
    round: 1,
    phase: "ENEMY_RESOLUTION",
    players: [{ actorId: "pc_xavi", connected: true }],
    committedActorIds: ["pc_xavi"]
  });

  assert.equal(next.round, 2);
  assert.equal(next.phase, "PLAYER_PLANNING");
  assert.deepEqual(next.committedActorIds, []);
});

test("synchronization enforces strictly increasing versions", () => {
  const v0 = initializeVersioned({ phase: "PLAYER_PLANNING" });
  const v1 = applyNextVersion(v0, 1, { phase: "PLAYER_COMMIT" });
  assert.equal(v1.version, 1);

  assert.throws(() => applyNextVersion(v1, 3, { phase: "AUTHORITATIVE_RESOLUTION" }), /Out-of-order/);
});

test("synchronization picks latest version", () => {
  const current = initializeVersioned({ round: 1 });
  const incoming = { version: 2, value: { round: 2 } };

  assert.deepEqual(mergeLatestVersion(current, incoming), incoming);
  assert.deepEqual(mergeLatestVersion(incoming, current), incoming);
});
