import type { WorldEvent } from "@living-rpg/schemas";

export interface WorldClock {
  currentDay: number;
  timeOfDay: "Morning" | "Afternoon" | "Dusk" | "Night";
}

export function advanceClock(current: WorldClock): WorldClock {
  if (current.timeOfDay === "Night") {
    return { currentDay: current.currentDay + 1, timeOfDay: "Morning" };
  }
  const nextTime: Record<WorldClock["timeOfDay"], WorldClock["timeOfDay"]> = {
    Morning: "Afternoon",
    Afternoon: "Dusk",
    Dusk: "Night",
    Night: "Morning"
  };
  return { currentDay: current.currentDay, timeOfDay: nextTime[current.timeOfDay] };
}
