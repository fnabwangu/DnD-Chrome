import type { Command, MovementPlan, WorldEvent, WorldSnapshot } from "@living-rpg/schemas";

export class RuleViolation extends Error {}

const blockedCells = new Set([
  ...Array.from({ length: 16 }, (_, col) => `${col},0`),
  ...Array.from({ length: 16 }, (_, col) => `${col},8`),
  ...Array.from({ length: 7 }, (_, row) => `0,${row + 1}`),
  ...Array.from({ length: 7 }, (_, row) => `15,${row + 1}`),
  ...[3, 4].flatMap((row) => [5, 6, 7, 8, 9, 10].map((col) => `${col},${row}`)),
  ...[2, 3].flatMap((row) => [1, 2, 13, 14].map((col) => `${col},${row}`)), "3,6", "3,7"
]);

function isCellOpen(x: number, y: number, snapshot: WorldSnapshot, actorId: string): boolean {
  return x >= 0 && x < 16 && y >= 0 && y < 9 && !blockedCells.has(`${x},${y}`) && !Object.values(snapshot.characters).some((character) => character.id !== actorId && character.alive && character.x === x && character.y === y);
}

function validateMovementPlan(snapshot: WorldSnapshot, actorId: string, destination: { x: number; y: number }, source?: { col: number; row: number }): MovementPlan {
  const actor = snapshot.characters[actorId];
  if (!actor || !actor.alive) throw new RuleViolation("Actor is not available");
  const sourceCell = source ? { col: source.col, row: source.row } : { col: actor.x, row: actor.y };
  if (sourceCell.col !== actor.x || sourceCell.row !== actor.y) throw new RuleViolation("Movement source is stale");
  if (destination.x < 0 || destination.x >= 16 || destination.y < 0 || destination.y >= 9) throw new RuleViolation("Destination is out of bounds");
  if (blockedCells.has(`${destination.x},${destination.y}`)) throw new RuleViolation("Destination is blocked");
  const occupied = Object.values(snapshot.characters).some((character) => character.id !== actorId && character.alive && character.x === destination.x && character.y === destination.y);
  if (occupied) throw new RuleViolation("Destination is occupied");
  const path: Array<{ col: number; row: number }> = [{ col: actor.x, row: actor.y }, { col: destination.x, row: destination.y }];
  const distance = Math.abs(destination.x - actor.x) + Math.abs(destination.y - actor.y);
  if (distance === 0) throw new RuleViolation("No legal path");
  if (distance > 6) throw new RuleViolation("Out of range");
  const validPath = Array.from({ length: distance }, (_, index) => ({ col: actor.x + (index + 1) * Math.sign(destination.x - actor.x), row: actor.y + (index + 1) * Math.sign(destination.y - actor.y) }));
  const finalPath = [{ col: actor.x, row: actor.y }, ...validPath.filter((cell) => cell.col !== actor.x || cell.row !== actor.y)];
  if (finalPath.at(-1)?.col !== destination.x || finalPath.at(-1)?.row !== destination.y) throw new RuleViolation("No legal path");
  return {
    actorId,
    source: { col: actor.x, row: actor.y },
    destination: { col: destination.x, row: destination.y },
    path: finalPath,
    movementCost: distance,
    expectedWorldVersion: snapshot.version,
    status: "QUEUED",
    round: snapshot.round ?? 1
  };
}

function hasLineOfSight(sourceX: number, sourceY: number, targetX: number, targetY: number): boolean {
  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const steps = Math.max(Math.abs(dx), Math.abs(dy));
  for (let step = 1; step < steps; step += 1) {
    const x = Math.round(sourceX + (dx * step) / steps);
    const y = Math.round(sourceY + (dy * step) / steps);
    if (blockedCells.has(`${x},${y}`)) return false;
  }
  return true;
}

export function resolveCommand(command: Command, snapshot: WorldSnapshot, sequence: number, now = new Date()): WorldEvent[] {
  if (command.expectedWorldVersion !== snapshot.version) {
    throw new RuleViolation(`Stale world version: expected ${snapshot.version}, received ${command.expectedWorldVersion}`);
  }
  const actor = snapshot.characters[command.actorId];
  if (!actor || !actor.alive) throw new RuleViolation("Actor is not available");

  const base = { id: `evt_${sequence}`, sessionId: command.sessionId, campaignId: "demo-campaign", sequence, worldTime: snapshot.worldTime, realTimestamp: now.toISOString(), visibility: "public" as const, causedByCommandId: command.id, actorId: command.actorId };
  switch (command.type) {
    case "BEGIN_ENCOUNTER":
      if (snapshot.phase !== "EXPLORATION") throw new RuleViolation("An encounter is already active");
      return [{ ...base, type: "PHASE_CHANGED", payload: { phase: "PLAYER_PLANNING", round: snapshot.round ?? 1 } }];
    case "SET_READY": {
      if (snapshot.phase !== "PLAYER_PLANNING") throw new RuleViolation("Combat actions require player planning");
      return [{ ...base, type: "PLAYER_READY", payload: { actorId: command.actorId } }];
    }
    case "CANCEL_READY": {
      if (snapshot.phase !== "PLAYER_PLANNING") throw new RuleViolation("Combat actions require player planning");
      return [{ ...base, type: "PLAYER_READY_CANCELLED", payload: { actorId: command.actorId } }];
    }
    case "MOVE_CHARACTER": {
      const x = command.payload.x;
      const y = command.payload.y;
      const source = command.payload.source;
      if (typeof x !== "number" || typeof y !== "number" || !Number.isInteger(x) || !Number.isInteger(y)) throw new RuleViolation("Movement requires an integer grid cell");
      if (snapshot.phase === "PLAYER_PLANNING") {
        const plan = validateMovementPlan(snapshot, actor.id, { x, y }, source as { col: number; row: number } | undefined);
        return [{ ...base, type: "MOVEMENT_QUEUED", payload: { actorId: actor.id, plan } }];
      }
      if (source && (typeof source !== "object" || (source as { col?: unknown }).col !== actor.x || (source as { row?: unknown }).row !== actor.y)) throw new RuleViolation("Movement source is stale");
      if (Math.abs(x - actor.x) + Math.abs(y - actor.y) !== 1) throw new RuleViolation("Movement must be one cardinal step");
      if (!isCellOpen(x, y, snapshot, actor.id)) throw new RuleViolation("Destination is blocked or occupied");
      return [{ ...base, type: "CHARACTER_MOVED", payload: { x, y, path: [{ col: actor.x, row: actor.y }, { col: x, row: y }] } }];
    }
    case "ATTACK_TARGET": {
      if (snapshot.phase !== "PLAYER_PLANNING") throw new RuleViolation("Combat actions require player planning");
      const targetId = command.payload.targetId;
      if (typeof targetId !== "string" || !snapshot.characters[targetId]?.alive) throw new RuleViolation("Target is not available");
      const target = snapshot.characters[targetId];
      const distance = Math.abs(actor.x - target.x) + Math.abs(actor.y - target.y);
      const ranged = command.payload.rangeMode === "ranged";
      if (ranged ? distance > 6 : distance !== 1) throw new RuleViolation(ranged ? "Target is outside ranged distance" : "Target is outside melee range");
      if (!hasLineOfSight(actor.x, actor.y, target.x, target.y)) throw new RuleViolation("Target line of sight is blocked");
      const damage = 4;
      return [{ ...base, type: "REACTION_WINDOW_OPENED", targetId, payload: { reactionId: `reaction_${sequence}`, actorId: command.actorId, options: ["ACCEPT_HIT", "USE_REACTION", "ASK_GM"], damage, resultingHp: Math.max(0, target.hp - damage) } }];
    }
    case "RESPOND_REACTION": {
      const reaction = snapshot.reactionWindow;
      if (!reaction) throw new RuleViolation("There is no reaction window");
      if (command.actorId !== reaction.actorId) throw new RuleViolation("Only the reacting player may answer");
      if (command.payload.reactionId !== reaction.id) throw new RuleViolation("Reaction window is stale");
      const choice = command.payload.choice;
      if (typeof choice !== "string" || !reaction.options.includes(choice)) throw new RuleViolation("Reaction choice is not available");
      const resolved = { ...base, type: "REACTION_RESOLVED", targetId: reaction.targetId, payload: { reactionId: reaction.id, choice } };
      if (choice === "USE_REACTION") {
        return [resolved];
      }
      const target = snapshot.characters[reaction.targetId];
      if (!target || !target.alive) throw new RuleViolation("Reaction target is no longer available");
      return [resolved, { ...base, id: `evt_${sequence + 1}`, sequence: sequence + 1, type: "DAMAGE_APPLIED", targetId: reaction.targetId, payload: { damage: reaction.damage, resultingHp: Math.max(0, target.hp - reaction.damage) } }];
    }
    case "INTERACT_WITH_NPC":
      return [{ ...base, type: "SECRET_LEARNED", targetId: String(command.payload.npcId), payload: { secret: "The watch captain is hunting a smuggler inside the inn." }, visibility: "party" }];
    case "INSPECT_AREA": {
      const areaId = command.payload.areaId;
      if (areaId !== "hearth" && areaId !== "kings-road-door" && areaId !== "varro-table") throw new RuleViolation("Area is not inspectable");
      return [{ ...base, type: "AREA_INSPECTED", locationId: String(areaId), payload: { areaId }, visibility: "public" }];
    }
    case "END_PHASE":
      if (snapshot.phase !== "PLAYER_PLANNING") throw new RuleViolation("There is no player phase to commit");
      return [{ ...base, type: "PHASE_CHANGED", payload: { phase: "PLAYER_RESOLUTION" } }];
  }
}