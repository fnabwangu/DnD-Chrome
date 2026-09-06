export type TurnPhase =
  | "EXPLORATION"
  | "ENCOUNTER_START"
  | "PLAYER_PLANNING"
  | "PLAYER_COMMIT"
  | "AUTHORITATIVE_RESOLUTION"
  | "REACTION_WINDOWS"
  | "NARRATIVE_RESOLUTION"
  | "ENEMY_PLANNING"
  | "ENEMY_RESOLUTION"
  | "NEXT_ROUND";

const NEXT_PHASE: Record<TurnPhase, TurnPhase> = {
  EXPLORATION: "ENCOUNTER_START",
  ENCOUNTER_START: "PLAYER_PLANNING",
  PLAYER_PLANNING: "PLAYER_COMMIT",
  PLAYER_COMMIT: "AUTHORITATIVE_RESOLUTION",
  AUTHORITATIVE_RESOLUTION: "REACTION_WINDOWS",
  REACTION_WINDOWS: "NARRATIVE_RESOLUTION",
  NARRATIVE_RESOLUTION: "ENEMY_PLANNING",
  ENEMY_PLANNING: "ENEMY_RESOLUTION",
  ENEMY_RESOLUTION: "NEXT_ROUND",
  NEXT_ROUND: "PLAYER_PLANNING"
};

export class TurnStateMachine {
  private phase: TurnPhase = "EXPLORATION";

  current(): TurnPhase {
    return this.phase;
  }

  advance(): TurnPhase {
    this.phase = NEXT_PHASE[this.phase];
    return this.phase;
  }

  reset(): TurnPhase {
    this.phase = "EXPLORATION";
    return this.phase;
  }
}
