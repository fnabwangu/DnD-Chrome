export type CanonicalEventType = "SPELL_CAST" | "DAMAGE_APPLIED";

export type CanonicalEvent = {
  id: string;
  type: CanonicalEventType;
  actorId: string;
  targetId?: string;
  spellId?: string;
  damage?: number;
  resultingHp?: number;
  consequence?: "DEFEATED";
  sequence: number;
};
