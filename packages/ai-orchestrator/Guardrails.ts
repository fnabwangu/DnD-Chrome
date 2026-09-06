const CANONICAL_ONLY_FIELDS = ["id", "sequence", "resultingHp", "consequence", "damage", "event"];

export function assertNoCanonicalStateMutationFields(input: unknown): void {
  if (!input || typeof input !== "object") {
    return;
  }

  const record = input as Record<string, unknown>;
  for (const field of CANONICAL_ONLY_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(record, field)) {
      throw new Error(`Submitted command contains canonical-state field: ${field}`);
    }
  }
}
