import { generateNews } from "@living-rpg/news-engine";
import { CommandSchema, SceneManifestV2Schema, type Command, type CharacterState, type WorldEvent, type WorldSnapshot, type SceneManifestV2 } from "@living-rpg/schemas";
import { TurnSession } from "@living-rpg/turn-engine";
import { z } from "zod";

export { findCardinalPath } from "./tactical.js";
export { lineOfSight } from "./line-of-sight.js";

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
  renderManifest: SceneManifestV2;
}

const blockedCells = [
  ...Array.from({ length: 16 }, (_, col) => ({ col, row: 0 })),
  ...Array.from({ length: 16 }, (_, col) => ({ col, row: 8 })),
  ...Array.from({ length: 7 }, (_, row) => ({ col: 0, row: row + 1 })),
  ...Array.from({ length: 7 }, (_, row) => ({ col: 15, row: row + 1 })),
  ...[3, 4].flatMap((row) => [5, 6, 7, 8, 9, 10].map((col) => ({ col, row }))),
  ...[2, 3].flatMap((row) => [1, 2, 13, 14].map((col) => ({ col, row }))),
  { col: 3, row: 6 }, { col: 3, row: 7 }
];
const blackHartMap = {
  id: "black-hart-common-room-v1", logicalWidth: 1440 as const, logicalHeight: 810 as const, columns: 16 as const, rows: 9 as const, cellSize: 90 as const,
  blockedCells, entrances: [{ col: 15, row: 5 }],
  interactiveAreas: [
    { id: "kings-road-door", label: "King's Road door", kind: "EXIT" as const, cells: [{ col: 15, row: 5 }] },
    { id: "hearth", label: "The hearth", kind: "INSPECT" as const, cells: [{ col: 2, row: 5 }, { col: 2, row: 6 }] },
    { id: "mara-bar", label: "Mara's bar", kind: "DIALOGUE" as const, cells: [{ col: 12, row: 6 }, { col: 13, row: 6 }] },
    { id: "varro-table", label: "Captain Varro's table", kind: "DIALOGUE" as const, cells: [{ col: 9, row: 2 }, { col: 10, row: 2 }] }
  ]
};

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
    xavi: { id: "xavi", name: "Xavi", hp: 12, maxHp: 12, x: 5, y: 6, alive: true },
    matu: { id: "matu", name: "Matu", hp: 12, maxHp: 12, x: 5, y: 7, alive: true },
    mara: { id: "mara", name: "Mara", hp: 10, maxHp: 10, x: 12, y: 6, alive: true },
    varro: { id: "varro", name: "Captain Varro", hp: 14, maxHp: 14, x: 9, y: 2, alive: true },
    stranger: { id: "stranger", name: "Hooded Stranger", hp: 8, maxHp: 8, x: 4, y: 2, alive: true },
    "ash-raider": { id: "ash-raider", name: "Ash Raider", hp: 8, maxHp: 8, x: 12, y: 3, alive: true },
    "coin-raider": { id: "coin-raider", name: "Coin Raider", hp: 8, maxHp: 8, x: 13, y: 4, alive: true }
  }
};

function buildRenderManifest(snapshot: WorldSnapshot, events: WorldEvent[], selectedActor = "xavi"): SceneManifestV2 {
  const layoutMode = snapshot.reactionWindow || snapshot.phase !== "EXPLORATION" ? "combat" : "exploration";
  return SceneManifestV2Schema.parse({ version: "2", sceneId: "location.black_hart.common_room", worldVersion: snapshot.version, layoutMode,
    map: blackHartMap, camera: { stageWidth: 1440, stageHeight: 810, fit: "contain", minZoom: 1, maxZoom: 1.4 },
    actors: Object.values(snapshot.characters).map((actor) => ({ id: actor.id, name: actor.name, control: ["xavi", "matu"].includes(actor.id) ? "player" : "npc", team: actor.id.includes("raider") ? "hostile" : ["xavi", "matu"].includes(actor.id) ? "party" : actor.id === "mara" ? "ally" : "neutral", position: { col: actor.x, row: actor.y }, facing: "down", hp: actor.hp, maxHp: actor.maxHp, alive: actor.alive, portraitAssetId: `portrait.${actor.id}`, tokenAssetId: `token.${actor.id}`, accessibleName: `${actor.name}, ${actor.hp} of ${actor.maxHp} hit points`, status: actor.alive ? "standing" : "down", selected: actor.id === selectedActor, targetable: actor.alive && actor.id !== selectedActor, visible: true })),
    assets: { version: 1, assets: { "background.black-hart": { kind: "background", fallback: "#382d25" } } }, animationCues: events.slice(-10).map((event) => ({ eventId: event.id, type: event.type === "CHARACTER_MOVED" ? "MOVE" as const : event.type === "DAMAGE_APPLIED" ? "DAMAGE" as const : event.type === "REACTION_WINDOW_OPENED" ? "REACTION" as const : event.type === "PHASE_CHANGED" ? "REVEAL" as const : "DIALOGUE" as const, actorId: event.actorId, targetId: event.targetId, path: Array.isArray(event.payload.path) ? event.payload.path as Array<{ col: number; row: number }> : undefined })), audioCues: [{ id: "rain", assetId: "ambience.black_hart.rain", captions: "Rain at the windows" }],
    capabilities: { background: false, portraits: false, tokens: false, audio: typeof globalThis !== "undefined" && "Audio" in globalThis, speechRecognition: false, speechSynthesis: typeof globalThis !== "undefined" && "speechSynthesis" in globalThis, remote: false }
  });
}

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
        ,renderManifest: buildRenderManifest(snapshot, events, viewerId)
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
