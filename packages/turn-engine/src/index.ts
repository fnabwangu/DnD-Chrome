import { EventLog, reduceWorld } from "@living-rpg/event-engine";
import { resolveCommand } from "@living-rpg/rules-engine";
import type { Command, WorldEvent, WorldSnapshot } from "@living-rpg/schemas";

export class TurnSession {
  readonly eventLog = new EventLog();
  private current: WorldSnapshot;
  private pending: Command[] = [];

  constructor(initial: WorldSnapshot) { this.current = structuredClone(initial); }

  get snapshot(): WorldSnapshot { return structuredClone(this.current); }

  get pendingCommands(): Command[] { return structuredClone(this.pending); }

  submit(command: Command): WorldEvent[] {
    if (this.current.phase === "PLAYER_PLANNING" && (command.type === "MOVE_CHARACTER" || command.type === "ATTACK_TARGET")) {
      resolveCommand(command, this.current, this.current.version + 1);
      this.pending.push(command);
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

  private commit(commitCommand: Command): WorldEvent[] {
    const events: WorldEvent[] = [];
    while (this.pending.length > 0 && !this.current.reactionWindow) {
      const planned = this.pending.shift()!;
      const resolved = resolveCommand({ ...planned, expectedWorldVersion: this.current.version }, this.current, this.current.version + 1);
      for (const event of resolved) {
        this.eventLog.append(event);
        this.current = reduceWorld(this.current, event);
        events.push(event);
      }
    }
    if (!this.current.reactionWindow && this.pending.length === 0) {
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