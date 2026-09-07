import test from "node:test";
import assert from "node:assert/strict";
import { findCardinalPath, GameApplication, lineOfSight } from "../../packages/application/src/index";
import { RuleViolation, resolveCommand } from "../../packages/rules-engine/src/index";
import { SceneManifestV2Schema } from "../../packages/schemas/src/index";
import { InMemoryGameRepository, PersistentGameService } from "../../packages/database/src/index";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FileGameRepository } from "../../packages/database/src/index";

test("Black Hart projection is a valid fixed 16:9 render contract", () => {
  const view = new GameApplication().getView();
  const manifest = SceneManifestV2Schema.parse(view.renderManifest);
  assert.deepEqual(manifest.camera, { stageWidth: 1440, stageHeight: 810, fit: "contain", minZoom: 1, maxZoom: 1.4 });
  assert.deepEqual(manifest.actors.find((actor) => actor.id === "xavi")?.position, { col: 5, row: 6 });
  assert.equal(manifest.map.columns, 16);
  assert.equal(manifest.map.rows, 9);
});

test("movement goes through the authority reducer and rejects blocked cells", () => {
  const application = new GameApplication();
  const result = application.execute({ id: "step", sessionId: "demo", actorId: "xavi", expectedWorldVersion: 0, type: "MOVE_CHARACTER", payload: { x: 5, y: 5, source: { col: 5, row: 6 } } });
  assert.deepEqual(result.view.renderManifest.actors.find((actor) => actor.id === "xavi")?.position, { col: 5, row: 5 });
  assert.throws(() => resolveCommand({ id: "blocked", sessionId: "demo", actorId: "xavi", expectedWorldVersion: 1, type: "MOVE_CHARACTER", payload: { x: 5, y: 4, source: { col: 5, row: 5 } } }, result.snapshot, 2), RuleViolation);
});

test("same fixture and command sequence produce equal snapshots", () => {
  const run = (id: string) => { const application = new GameApplication(); application.execute({ id, sessionId: "demo", actorId: "xavi", expectedWorldVersion: 0, type: "MOVE_CHARACTER", payload: { x: 5, y: 5 } }); return application.snapshot; };
  assert.deepEqual(run("one"), run("two"));
});

test("pathfinding uses cardinal movement and stable up-left-right-down ties", () => {
  const map = new GameApplication().getView().renderManifest.map;
  assert.deepEqual(findCardinalPath(map, { col: 4, row: 5 }, { col: 4, row: 3 }), [{ col: 4, row: 5 }, { col: 4, row: 4 }, { col: 4, row: 3 }]);
  assert.equal(findCardinalPath(map, { col: 5, row: 5 }, { col: 5, row: 4 }), undefined);
});

test("inspection and dialogue are canonical commands", () => {
  const application = new GameApplication();
  const inspected = application.execute({ id: "inspect", sessionId: "demo", actorId: "xavi", expectedWorldVersion: 0, type: "INSPECT_AREA", payload: { areaId: "hearth" } });
  assert.equal(inspected.events[0]?.type, "AREA_INSPECTED");
  const dialogue = new GameApplication().execute({ id: "talk", sessionId: "demo", actorId: "xavi", expectedWorldVersion: 0, type: "INTERACT_WITH_NPC", payload: { npcId: "mara" } });
  assert.equal(dialogue.events[0]?.type, "SECRET_LEARNED");
});

test("combat authority enforces melee range", () => {
  const application = new GameApplication();
  application.execute({ id: "encounter", sessionId: "demo", actorId: "xavi", expectedWorldVersion: 0, type: "BEGIN_ENCOUNTER", payload: {} });
  assert.throws(() => application.execute({ id: "attack", sessionId: "demo", actorId: "xavi", expectedWorldVersion: 1, type: "ATTACK_TARGET", payload: { targetId: "ash-raider" } }), /melee range/);
});

test("line of sight reports deterministic blockers", () => {
  const map = new GameApplication().getView().renderManifest.map;
  assert.deepEqual(lineOfSight(map, { col: 4, row: 2 }, { col: 1, row: 2 }), { clear: false, blocker: { col: 2, row: 2 } });
  assert.deepEqual(lineOfSight(map, { col: 4, row: 5 }, { col: 4, row: 6 }), { clear: true });
});

test("persistent service rejects stale writes and makes duplicate commands idempotent", async () => {
  const service = new PersistentGameService(new InMemoryGameRepository());
  const command = { id: "persisted-move", sessionId: "shared", actorId: "xavi", expectedWorldVersion: 0, type: "MOVE_CHARACTER" as const, payload: { x: 5, y: 5 } };
  const first = await service.execute(command);
  const duplicate = await service.execute(command);
  assert.equal(duplicate.duplicate, true);
  assert.deepEqual(duplicate.snapshot, first.snapshot);
  await assert.rejects(() => service.execute({ ...command, id: "stale", payload: { x: 5, y: 7 } }), /Stale world version/);
});

test("file repository reloads the canonical snapshot after restart", async () => {
  const directory = await mkdtemp(join(tmpdir(), "living-rpg-"));
  try {
    const file = join(directory, "session.json");
    const first = new PersistentGameService(new FileGameRepository(file));
    await first.execute({ id: "restart-move", sessionId: "restart", actorId: "xavi", expectedWorldVersion: 0, type: "MOVE_CHARACTER", payload: { x: 5, y: 5 } });
    const restarted = new PersistentGameService(new FileGameRepository(file));
    const view = await restarted.getView("restart", "player");
    assert.deepEqual(view.renderManifest.actors.find((candidate) => candidate.id === "xavi")?.position, { col: 5, row: 5 });
  } finally { await rm(directory, { recursive: true, force: true }); }
});
