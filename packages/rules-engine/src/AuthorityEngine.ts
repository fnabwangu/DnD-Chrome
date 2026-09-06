import { EventLog } from "../../event-engine/EventLog";
import type { CanonicalEvent } from "../../schemas/src/event.schema";
import type { StructuredCommand } from "../../schemas/src/action.schema";

export class AuthorityEngine {
  private sequence = 0;

  constructor(private readonly eventLog: EventLog, private readonly hpByUnit: Record<string, number> = {}) {}

  execute(command: StructuredCommand): CanonicalEvent {
    this.sequence += 1;

    if (command.type === "CAST_SPELL") {
      const targetId = command.target.type === "UNIT" ? command.target.targetId : undefined;
      const damage = command.spellId === "fireball" && targetId ? 11 : undefined;

      if (targetId && damage) {
        const hp = (this.hpByUnit[targetId] ?? 11) - damage;
        this.hpByUnit[targetId] = hp;

        return this.eventLog.append({
          id: `evt_${String(this.sequence).padStart(6, "0")}`,
          type: "DAMAGE_APPLIED",
          actorId: command.actorId,
          targetId,
          spellId: command.spellId,
          damage,
          resultingHp: hp,
          consequence: hp <= 0 ? "DEFEATED" : undefined,
          sequence: this.sequence
        });
      }

      return this.eventLog.append({
        id: `evt_${String(this.sequence).padStart(6, "0")}`,
        type: "SPELL_CAST",
        actorId: command.actorId,
        spellId: command.spellId,
        sequence: this.sequence
      });
    }

    const targetId = command.target.type === "UNIT" ? command.target.targetId : undefined;
    return this.eventLog.append({
      id: `evt_${String(this.sequence).padStart(6, "0")}`,
      type: "DAMAGE_APPLIED",
      actorId: command.actorId,
      targetId,
      damage: 1,
      sequence: this.sequence
    });
  }
}
