import type { TurnPhase } from "../turn-engine/TurnStateMachine";

export type SessionPlayer = {
  actorId: string;
  connected: boolean;
};

export type SessionState = {
  id: string;
  round: number;
  phase: TurnPhase;
  players: SessionPlayer[];
  committedActorIds: string[];
};

export function createSessionState(id: string, actorIds: string[]): SessionState {
  return {
    id,
    round: 1,
    phase: "PLAYER_PLANNING",
    players: actorIds.map((actorId) => ({ actorId, connected: true })),
    committedActorIds: []
  };
}

export function commitPlayerAction(state: SessionState, actorId: string): SessionState {
  if (state.phase !== "PLAYER_PLANNING") {
    throw new Error("Player actions can only be committed during PLAYER_PLANNING");
  }

  const actorExists = state.players.some((player) => player.actorId === actorId && player.connected);
  if (!actorExists) {
    throw new Error("Actor is not in the active session");
  }

  if (state.committedActorIds.includes(actorId)) {
    return state;
  }

  const committedActorIds = [...state.committedActorIds, actorId];
  const activePlayers = state.players.filter((player) => player.connected).map((player) => player.actorId);
  const allCommitted = activePlayers.every((activeActorId) => committedActorIds.includes(activeActorId));

  return {
    ...state,
    committedActorIds,
    phase: allCommitted ? "PLAYER_COMMIT" : state.phase
  };
}

export function beginAuthoritativeResolution(state: SessionState): SessionState {
  if (state.phase !== "PLAYER_COMMIT") {
    throw new Error("Resolution can only begin after PLAYER_COMMIT");
  }

  return {
    ...state,
    phase: "AUTHORITATIVE_RESOLUTION"
  };
}

export function beginNextRound(state: SessionState): SessionState {
  if (state.phase !== "ENEMY_RESOLUTION") {
    throw new Error("Next round can only begin after ENEMY_RESOLUTION");
  }

  return {
    ...state,
    round: state.round + 1,
    phase: "PLAYER_PLANNING",
    committedActorIds: []
  };
}
