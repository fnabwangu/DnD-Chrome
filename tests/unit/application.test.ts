import test from "node:test";
import assert from "node:assert/strict";
import { GameApplication } from "../../packages/application/src/index";

test("application exposes a viewer-safe scene and deterministic intent proposal", () => {
  const application = new GameApplication();
  const view = application.getView("xavi");
  assert.equal(view.currentScene.sceneId, "location.black_hart.common_room");
  assert.deepEqual(view.availableActions, ["TALK", "INSPECT", "BEGIN_ENCOUNTER"]);

  const proposal = application.submitIntent("xavi", "I talk to Mara");
  assert.equal(proposal.actions[0]?.type, "TALK");
  assert.equal(proposal.actions[0]?.targetId, "mara");
});

test("application execution returns committed state and refreshed view", () => {
  const application = new GameApplication();
  const result = application.execute({ id: "begin", sessionId: "demo", actorId: "xavi", expectedWorldVersion: 0, type: "BEGIN_ENCOUNTER", payload: {} });
  assert.equal(result.snapshot.version, 1);
  assert.equal(result.view.worldVersion, 1);
  assert.equal(result.view.phase, "PLAYER_PLANNING");
});
