import { EventLog, reduceWorld } from "@living-rpg/event-engine";
import { resolveCommand } from "@living-rpg/rules-engine";
import type { Command, MovementPlan, WorldEvent, WorldSnapshot } from "@living-rpg/schemas";

export class TurnSession {
  readonly eventLog = new EventLog();
  private current: WorldSnapshot;
  private pending: Command[] = [];

  constructor(initial: WorldSnapshot) {
    this.current = structuredClone(initial);
    if (!this.current.movementPlans) this.current.movementPlans = {};
    if (!this.current.readiness) this.current.readiness = {};
    if (this.current.round === undefined) this.current.round = 1;
  }

  get snapshot(): WorldSnapshot { return structuredClone(this.current); }

  get pendingCommands(): Command[] { return structuredClone(this.pending); }

  get plans(): Record<string, MovementPlan> { return structuredClone(this.current.movementPlans ?? {}); }

  get playerStatus(): Record<string, { id: string; state: "Planning" | "Move queued" | "Ready" | "Resolving" | "Completed" | "Invalidated"; ready: boolean; queuedDestination?: { col: number; row: number }; invalidReason?: string; }> {
    const entries: Record<string, any> = {};
    for (const actorId of Object.keys(this.current.characters)) {
      const plan = this.current.movementPlans?.[actorId];
      const ready = Boolean(this.current.readiness?.[actorId]);
      entries[actorId] = {
        id: actorId,
        state: ready ? "Ready" : plan ? "Move queued" : "Planning",
        ready,
        queuedDestination: plan?.destination,
        invalidReason: plan?.reason
      };
    }
    return entries;
  }

  submit(command: Command): WorldEvent[] {
    if (this.current.phase === "PLAYER_PLANNING" && command.type === "MOVE_CHARACTER") {
      const events = resolveCommand(command, this.current, this.current.version + 1);
      const queued = events[0];
      if (queued?.type === "MOVEMENT_QUEUED") {
        const plan = queued.payload.plan as MovementPlan;
        this.current.movementPlans = { ...(this.current.movementPlans ?? {}), [command.actorId]: plan };
        this.current.readiness = { ...(this.current.readiness ?? {}), [command.actorId]: false };
        return [];
      }
    }
    if (this.current.phase === "PLAYER_PLANNING" && command.type === "SET_READY") {
      this.current.readiness = { ...(this.current.readiness ?? {}), [command.actorId]: true };
      return [];
    }
    if (this.current.phase === "PLAYER_PLANNING" && command.type === "CANCEL_READY") {
      this.current.readiness = { ...(this.current.readiness ?? {}), [command.actorId]: false };
      return [];
    }
    if (command.type === "END_PHASE" && this.current.phase === "PLAYER_PLANNING") {
      return this.commit(command);
    }
    const events = resolveCommand(command, this.current, this.current.version + 1);
    for (const event of events) {
      this.eventLog.append(event);
      this.current = reduceWorld(this.current, event);
    }
    return events;
  }

  private resolveQueuedMoves(): WorldEvent[] {
    const events: WorldEvent[] = [];
    const ordered = Object.entries(this.current.movementPlans ?? {})
      .sort(([left], [right]) => left.localeCompare(right) || 0)
      .map(([actorId, plan]) => ({ actorId, plan }));
    for (const { actorId, plan } of ordered) {
      const actor = this.current.characters[actorId];
      if (!actor || !actor.alive) continue;
      const source = plan.source;
      const path = plan.path;
      const destination = plan.destination;
      const event = { id: `evt_${this.current.version + events.length + 1}`, sessionId: "demo", campaignId: "demo-campaign", sequence: this.current.version + events.length + 1, worldTime: this.current.worldTime, realTimestamp: new Date().toISOString(), type: "CHARACTER_MOVED", actorId, targetId: undefined, visibility: "public" as const, causedByCommandId: `move-${actorId}-${Date.now()}`, payload: { x: destination.col, y: destination.row, path, source, cost: plan.movementCost } };
      this.eventLog.append(event);
      this.current = reduceWorld(this.current, event);
      events.push(event);
    }
    this.current.movementPlans = {};
    this.current.readiness = {};
    return events;
  }

  private commit(commitCommand: Command): WorldEvent[] {
    const events: WorldEvent[] = [];
    if (Object.keys(this.current.movementPlans ?? {}).length > 0) {
      const movementEvents = this.resolveQueuedMoves();
      events.push(...movementEvents);
    }
    if (!this.current.reactionWindow && Object.keys(this.current.movementPlans ?? {}).length === 0) {
      const phaseEvents = resolveCommand({ ...commitCommand, expectedWorldVersion: this.current.version }, this.current, this.current.version + 1);
      for (const event of phaseEvents) {
        this.eventLog.append(event);
        this.current = reduceWorld(this.current, event);
        events.push(event);
      }
    }
    return events;
  }

  append(event: WorldEvent): void {
    this.eventLog.append(event);
    this.current = reduceWorld(this.current, event);
  }

  resolveReaction(command: Command): WorldEvent[] {
    const events = this.submit(command);
    if (!this.current.reactionWindow && this.pending.length > 0) return this.commit({ ...command, type: "END_PHASE" });
    return events;
  }
}