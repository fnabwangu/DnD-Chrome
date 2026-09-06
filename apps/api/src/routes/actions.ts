import { DMNarrator } from "../../../../packages/ai-orchestrator/DMNarrator";
import { IntentParser } from "../../../../packages/ai-orchestrator/IntentParser";
import { EventLog } from "../../../../packages/event-engine/EventLog";
import { AuthorityEngine } from "../../../../packages/rules-engine/src/AuthorityEngine";
import { isStructuredCommand, type StructuredCommand } from "../../../../packages/schemas/src/action.schema";
import { compileDrop, type DragDropPayload } from "../../../web/src/drag-drop/compileDrop";

type ActionSubmission = {
  actorId: string;
  command?: StructuredCommand;
  intent?: string;
};

const parser = new IntentParser();
const events = new EventLog();
const authority = new AuthorityEngine(events, { npc_goblin_22: 11 });
const narrator = new DMNarrator();

export function submitAction(submission: ActionSubmission) {
  const structuredCommand = submission.command
    ? submission.command
    : submission.intent
      ? parser.parse(submission.actorId, submission.intent)
      : undefined;

  if (!structuredCommand || !isStructuredCommand(structuredCommand)) {
    throw new Error("A valid structured command is required");
  }

  const event = authority.execute(structuredCommand);
  return {
    event,
    narration: narrator.narrate(event)
  };
}

export function submitDropAction(payload: DragDropPayload) {
  const command = compileDrop(payload);
  return submitAction({ actorId: payload.card.actorId, command });
}
