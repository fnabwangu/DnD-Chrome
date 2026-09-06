export type GridPointTarget = {
  type: "POINT";
  x: number;
  y: number;
};

export type UnitTarget = {
  type: "UNIT";
  targetId: string;
};

export type Target = GridPointTarget | UnitTarget;

export type StructuredCommand = {
  type: "CAST_SPELL" | "ATTACK";
  actorId: string;
  spellId?: string;
  target: Target;
};

export function isStructuredCommand(input: unknown): input is StructuredCommand {
  if (!input || typeof input !== "object") return false;
  const candidate = input as Partial<StructuredCommand>;
  if (!candidate.type || !candidate.actorId || !candidate.target) return false;
  if (candidate.type !== "CAST_SPELL" && candidate.type !== "ATTACK") return false;

  const target = candidate.target as Partial<Target>;
  if (target.type === "POINT") {
    return typeof (target as GridPointTarget).x === "number" && typeof (target as GridPointTarget).y === "number";
  }

  if (target.type === "UNIT") {
    return typeof (target as UnitTarget).targetId === "string";
  }

  return false;
}
