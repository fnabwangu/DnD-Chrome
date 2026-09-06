import type { WorldEvent } from "@living-rpg/schemas";

export interface AIProvider { narrate(events: readonly WorldEvent[]): Promise<string>; }

export class MockAIProvider implements AIProvider {
  async narrate(events: readonly WorldEvent[]): Promise<string> {
    const damage = events.find((event) => event.type === "DAMAGE_APPLIED");
    return damage ? "Xavi's arrow catches the raider beneath the collarbone." : "The Black Hart holds its breath.";
  }
}