import type { StructuredCommand } from "../schemas/src/action.schema";

const GRID_MATCH = /\b([A-Z])(\d+)\b/;

export class IntentParser {
  parse(actorId: string, text: string): StructuredCommand {
    const normalized = text.toLowerCase();

    if (normalized.includes("fireball")) {
      const gridMatch = text.toUpperCase().match(GRID_MATCH);
      if (gridMatch) {
        const [, letter, number] = gridMatch;
        return {
          type: "CAST_SPELL",
          actorId,
          spellId: "fireball",
          target: {
            type: "POINT",
            x: Number(number),
            y: letter.charCodeAt(0) - 64
          }
        };
      }
    }

    throw new Error("Intent could not be parsed into a supported structured command");
  }
}
