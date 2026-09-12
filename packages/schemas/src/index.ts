import { z } from "zod";

export type Visibility = "public" | "party" | "private" | "gm";

export type GridCell = { col: number; row: number };

export type MovementPlanStatus = "QUEUED" | "READY";

export interface MovementPlan {
  actorId: string;
  source: GridCell;
  destination: GridCell;
  path: GridCell[];
  movementCost: number;
  expectedWorldVersion: number;
  status: MovementPlanStatus;
  round: number;
  reason?: string;
}

export type CommandType = "MOVE_CHARACTER" | "ATTACK_TARGET" | "RESPOND_REACTION" | "INTERACT_WITH_NPC" | "INSPECT_AREA" | "BEGIN_ENCOUNTER" | "END_PHASE" | "SET_READY" | "CANCEL_READY";

export interface Command {
  id: string;
  type: CommandType;
  sessionId: string;
  actorId: string;
  expectedWorldVersion: number;
  payload: Record<string, unknown>;
}

export const CommandSchema = z.object({
  id: z.string().min(1).max(100),
  type: z.enum(["MOVE_CHARACTER", "ATTACK_TARGET", "RESPOND_REACTION", "INTERACT_WITH_NPC", "INSPECT_AREA", "BEGIN_ENCOUNTER", "END_PHASE", "SET_READY", "CANCEL_READY"]),
  sessionId: z.string().min(1).max(100),
  actorId: z.string().min(1).max(100),
  expectedWorldVersion: z.number().int().nonnegative(),
  payload: z.record(z.unknown())
}).strict();

export interface WorldEvent {
  id: string;
  sessionId: string;
  campaignId: string;
  sequence: number;
  worldTime: string;
  realTimestamp: string;
  type: string;
  actorId?: string;
  targetId?: string;
  locationId?: string;
  payload: Record<string, unknown>;
  visibility: Visibility;
  causedByCommandId?: string;
}

export interface CharacterState {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  x: number;
  y: number;
  alive: boolean;
}

export interface ReactionWindow {
  id: string;
  actorId: string;
  targetId: string;
  options: string[];
  damage: number;
}

export interface WorldSnapshot {
  version: number;
  round?: number;
  phase: "EXPLORATION" | "ENCOUNTER_START" | "PLAYER_PLANNING" | "PLAYER_COMMIT" | "AUTHORITATIVE_RESOLUTION" | "REACTION_WINDOWS" | "NARRATIVE_RESOLUTION" | "ENEMY_PLANNING" | "ENEMY_RESOLUTION" | "NEXT_ROUND" | "PLAYER_RESOLUTION" | "ROUND_COMPLETE";
  worldTime: string;
  characters: Record<string, CharacterState>;
  knownSecrets: Record<string, string[]>;
  npcMemories: Record<string, string[]>;
  reactionWindow?: ReactionWindow;
  movementPlans?: Record<string, MovementPlan>;
  readiness?: Record<string, boolean>;
}

export * from "./render.schema.js";