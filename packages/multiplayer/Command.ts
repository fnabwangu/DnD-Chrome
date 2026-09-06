import type { StructuredCommand } from "../schemas/src/action.schema";

export type PlayerCommand = {
  sessionId: string;
  actorId: string;
  command: StructuredCommand;
  submittedAtSequence: number;
};
