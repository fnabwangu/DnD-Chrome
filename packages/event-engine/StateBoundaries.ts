import type { CanonicalEvent } from "../schemas/src/event.schema";

export type UnitCanonicalState = {
  hp: number;
  status: "ALIVE" | "DEFEATED";
};

export type CanonicalState = {
  sequence: number;
  units: Record<string, UnitCanonicalState>;
};

export function createCanonicalState(seed?: Partial<CanonicalState>): CanonicalState {
  return {
    sequence: seed?.sequence ?? 0,
    units: { ...(seed?.units ?? {}) }
  };
}

export function reduceCanonicalState(state: CanonicalState, event: CanonicalEvent): CanonicalState {
  const next: CanonicalState = {
    sequence: Math.max(state.sequence, event.sequence),
    units: { ...state.units }
  };

  if (event.type === "DAMAGE_APPLIED" && event.targetId) {
    const current = next.units[event.targetId] ?? { hp: 11, status: "ALIVE" as const };
    const hp = typeof event.resultingHp === "number" ? event.resultingHp : Math.max(current.hp - (event.damage ?? 0), 0);
    next.units[event.targetId] = {
      hp,
      status: hp <= 0 || event.consequence === "DEFEATED" ? "DEFEATED" : "ALIVE"
    };
  }

  return next;
}
