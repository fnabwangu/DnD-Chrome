import { generateNews } from "@living-rpg/news-engine";
import { CommandSchema, type Command, type CharacterState, type WorldEvent, type WorldSnapshot } from "@living-rpg/schemas";
import { TurnSession } from "@living-rpg/turn-engine";
import { z } from "zod";

export const ActionProposalSchema = z.object({
  proposalId: z.string(),
  actorId: z.string(),
  sourceText: z.string(),
  actions: z.array(z.object({
    type: z.enum(["TALK", "INSPECT", "MOVE", "ATTACK", "BEGIN_ENCOUNTER", "COMMIT"]),
    targetId: z.string().optional(),
    payload: z.record(z.unknown()).default({})
  })),
  confidence: z.number().min(0).max(1),
  unresolvedReferences: z.array(z.string()),
  requiresConfirmation: z.boolean()
});

export type ActionProposal = z.infer<typeof ActionProposalSchema>;

export interface SceneManifest {
  version: "1";
  sceneId: "location.black_hart.common_room";
  sceneVersion: number;
  layoutMode: "exploration" | "dialogue" | "combat";
  environment: { assetId: string; time: string; weather: string };
  actors: Array<{ id: string; name: string; x: number; y: number; alive: boolean; assetId: string }>;
  cues: Array<{ type: "NARRATION" | "SOUND"; text?: string; assetId?: string }>;
}

export interface GameViewState {
  version: "1";
  sessionId: string;
  viewerId: string;
  worldVersion: number;
  phase: WorldSnapshot["phase"];
  worldTime: string;
  currentScene: SceneManifest;
  visibleActors: CharacterState[];
  availableActions: string[];
  activeReaction?: WorldSnapshot["reactionWindow"];
  recentEvents: Array<Pick<WorldEvent, "id" | "type" | "sequence" | "actorId" | "targetId">>;
  news: ReturnType<typeof generateNews>;
}

export interface ApplicationResult {
  events: WorldEvent[];
  snapshot: WorldSnapshot;
  view: GameViewState;
}

export const demoInitialSnapshot: WorldSnapshot = {
  version: 0,
  phase: "EXPLORATION",
  worldTime: "Night, 14th of Ember",
  knownSecrets: {},
  npcMemories: {},
  characters: {
    xavi: { id: "xavi", name: "Xavi", hp: 12, maxHp: 12, x: 1, y: 1, alive: true },
    matu: { id: "matu", name: "Matu", hp: 12, maxHp: 12, x: 1, y: 2, alive: true },
    mara: { id: "mara", name: "Mara", hp: 10, maxHp: 10, x: 2, y: 1, alive: true },
    "ash-raider": { id: "ash-raider", name: "Ash Raider", hp: 8, maxHp: 8, x: 5, y: 2, alive: true },
    "coin-raider": { id: "coin-raider", name: "Coin Raider", hp: 8, maxHp: 8, x: 5, y: 4, alive: true }
  }
};

function buildManifest(snapshot: WorldSnapshot, events: WorldEvent[]): SceneManifest {
  const layoutMode = snapshot.reactionWindow || snapshot.phase !== "EXPLORATION" ? "combat" : "exploration";
  return {
    version: "1",
    sceneId: "location.black_hart.common_room",
    sceneVersion: snapshot.version,
    layoutMode,
    environment: { assetId: "location.black_hart.common_room.base", time: snapshot.worldTime, weather: "rain" },
    actors: Object.values(snapshot.characters).map((actor) => ({
      id: actor.id,
      name: actor.name,
      x: actor.x,
      y: actor.y,
      alive: actor.alive,
      assetId: `character.${actor.id}.token`
    })),
    cues: events.slice(-3).map((event) => ({ type: event.type === "DAMAGE_APPLIED" ? "SOUND" as const : "NARRATION" as const, text: event.type === "DAMAGE_APPLIED" ? undefined : event.type, assetId: event.type === "DAMAGE_APPLIED" ? "sfx.combat.impact" : undefined }))
  };
}

function parseIntent(actorId: string, text: string): ActionProposal {
  const normalized = text.toLowerCase();
  const actions: ActionProposal["actions"] = [];
  if (normalized.includes("mara") && /(talk|tell|speak|ask)/.test(normalized)) actions.push({ type: "TALK", targetId: "mara", payload: {} });
  else if (normalized.includes("inspect") || normalized.includes("look") || normalized.includes("search")) actions.push({ type: "INSPECT", payload: {} });
  else if (normalized.includes("attack") || normalized.includes("strike") || normalized.includes("hit")) actions.push({ type: "ATTACK", targetId: normalized.includes("coin") ? "coin-raider" : "ash-raider", payload: {} });
  else if (normalized.includes("encounter") || normalized.includes("fight")) actions.push({ type: "BEGIN_ENCOUNTER", payload: {} });
  else if (normalized.includes("commit") || normalized.includes("end turn")) actions.push({ type: "COMMIT", payload: {} });
  return ActionProposalSchema.parse({ proposalId: `proposal_${Date.now()}`, actorId, sourceText: text, actions, confidence: actions.length ? 0.92 : 0.2, unresolvedReferences: actions.length ? [] : [text], requiresConfirmation: true });
}

export class GameApplication {
  private readonly session: TurnSession;

  constructor(initial: WorldSnapshot = demoInitialSnapshot) {
    this.session = new TurnSession(initial);
  }

  get snapshot(): WorldSnapshot { return this.session.snapshot; }
  get events(): WorldEvent[] { return this.session.eventLog.all(); }

  getView(viewerId = "player", sessionId = "demo"): GameViewState {
    const snapshot = this.session.snapshot;
    const events = this.session.eventLog.all();
    return {
      version: "1",
      sessionId,
      viewerId,
      worldVersion: snapshot.version,
      phase: snapshot.phase,
      worldTime: snapshot.worldTime,
      currentScene: buildManifest(snapshot, events),
      visibleActors: Object.values(snapshot.characters),
      availableActions: snapshot.reactionWindow ? ["RESPOND_REACTION"] : snapshot.phase === "EXPLORATION" ? ["TALK", "INSPECT", "BEGIN_ENCOUNTER"] : ["MOVE", "ATTACK", "COMMIT"],
      activeReaction: snapshot.reactionWindow,
      recentEvents: events.slice(-10).map(({ id, type, sequence, actorId, targetId }) => ({ id, type, sequence, actorId, targetId })),
      news: generateNews(events)
    };
  }

  submitIntent(actorId: string, text: string, sessionId = "demo"): ActionProposal {
    return parseIntent(actorId, text);
  }

  execute(command: Command): ApplicationResult {
    const validated = CommandSchema.parse(command);
    const events = validated.type === "RESPOND_REACTION" ? this.session.resolveReaction(validated) : this.session.submit(validated);
    return { events, snapshot: this.session.snapshot, view: this.getView(validated.actorId, validated.sessionId) };
  }

  advanceMorning(sessionId = "demo"): ApplicationResult {
    const command: Command = { id: `morning_${Date.now()}`, sessionId, actorId: "xavi", expectedWorldVersion: this.session.snapshot.version, type: "END_PHASE", payload: {} };
    const event: WorldEvent = { id: `evt_${this.session.snapshot.version + 1}`, sessionId, campaignId: "demo-campaign", sequence: this.session.snapshot.version + 1, worldTime: "Morning, 15th of Ember", realTimestamp: new Date().toISOString(), type: "WORLD_TIME_ADVANCED", payload: { worldTime: "Morning, 15th of Ember" }, visibility: "public", causedByCommandId: command.id };
    this.session.append(event);
    return { events: [event], snapshot: this.session.snapshot, view: this.getView("player", sessionId) };
  }
}
