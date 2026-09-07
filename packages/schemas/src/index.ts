import { z } from "zod";

export type Visibility = "public" | "party" | "private" | "gm";

export type CommandType = "MOVE_CHARACTER" | "ATTACK_TARGET" | "RESPOND_REACTION" | "INTERACT_WITH_NPC" | "INSPECT_AREA" | "BEGIN_ENCOUNTER" | "END_PHASE";

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
  type: z.enum(["MOVE_CHARACTER", "ATTACK_TARGET", "RESPOND_REACTION", "INTERACT_WITH_NPC", "INSPECT_AREA", "BEGIN_ENCOUNTER", "END_PHASE"]),
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
  phase: "EXPLORATION" | "ENCOUNTER_START" | "PLAYER_PLANNING" | "PLAYER_RESOLUTION" | "ENEMY_RESOLUTION" | "ROUND_COMPLETE";
  worldTime: string;
  characters: Record<string, CharacterState>;
  knownSecrets: Record<string, string[]>;
  npcMemories: Record<string, string[]>;
  reactionWindow?: ReactionWindow;
}

export * from "./render.schema.js";