import type { Command, WorldEvent, WorldSnapshot } from "@living-rpg/schemas";

export class RuleViolation extends Error {}

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
      return [{ ...base, type: "PHASE_CHANGED", payload: { phase: "PLAYER_PLANNING" } }];
    case "MOVE_CHARACTER": {
      const x = command.payload.x;
      const y = command.payload.y;
      if (typeof x !== "number" || typeof y !== "number" || Math.abs(x - actor.x) + Math.abs(y - actor.y) > 4) throw new RuleViolation("Movement exceeds this turn's range");
      return [{ ...base, type: "CHARACTER_MOVED", payload: { x, y } }];
    }
    case "ATTACK_TARGET": {
      if (snapshot.phase !== "PLAYER_PLANNING") throw new RuleViolation("Combat actions require player planning");
      const targetId = command.payload.targetId;
      if (typeof targetId !== "string" || !snapshot.characters[targetId]?.alive) throw new RuleViolation("Target is not available");
      const target = snapshot.characters[targetId];
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
    case "END_PHASE":
      if (snapshot.phase !== "PLAYER_PLANNING") throw new RuleViolation("There is no player phase to commit");
      return [{ ...base, type: "PHASE_CHANGED", payload: { phase: "PLAYER_RESOLUTION" } }];
  }
}