import type { StructuredCommand } from "../../../../packages/schemas/src/action.schema";

type DragDropCard = {
  actorId: string;
  cardKind: "SPELL" | "ATTACK";
  cardId: string;
};

type DragDropTarget =
  | {
      targetKind: "GRID";
      grid: string;
    }
  | {
      targetKind: "UNIT";
      targetId: string;
    };

export type DragDropPayload = {
  card: DragDropCard;
  target: DragDropTarget;
};

function parseGrid(grid: string): { x: number; y: number } {
  const match = grid.toUpperCase().match(/^([A-Z])(\d+)$/);
  if (!match) {
    throw new Error("Invalid grid coordinate");
  }

  return {
    x: Number(match[2]),
    y: match[1].charCodeAt(0) - 64
  };
}

export function compileDrop(payload: DragDropPayload): StructuredCommand {
  const { card, target } = payload;

  if (card.cardKind === "SPELL") {
    if (target.targetKind === "GRID") {
      const { x, y } = parseGrid(target.grid);
      return {
        type: "CAST_SPELL",
        actorId: card.actorId,
        spellId: card.cardId,
        target: { type: "POINT", x, y }
      };
    }

    return {
      type: "CAST_SPELL",
      actorId: card.actorId,
      spellId: card.cardId,
      target: { type: "UNIT", targetId: target.targetId }
    };
  }

  if (target.targetKind !== "UNIT") {
    throw new Error("Attack cards require a unit target");
  }

  return {
    type: "ATTACK",
    actorId: card.actorId,
    target: { type: "UNIT", targetId: target.targetId }
  };
}
