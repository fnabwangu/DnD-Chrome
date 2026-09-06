import { describe, expect, it } from "vitest";
import { canKnowEvent, rememberEvent } from "@living-rpg/npc-engine";
import { generateNews } from "@living-rpg/news-engine";
import type { WorldEvent } from "@living-rpg/schemas";

const event: WorldEvent = { id: "evt-7", sessionId: "s", campaignId: "demo", sequence: 7, worldTime: "night", realTimestamp: "2026-09-06T00:00:00.000Z", type: "DAMAGE_APPLIED", actorId: "xavi", targetId: "raider", payload: { damage: 4 }, visibility: "public" };

describe("world consequence adapters", () => {
  it("creates NPC memory with event provenance without granting hidden knowledge", () => {
    expect(rememberEvent("mara", event, "Mara saw the fight")).toEqual({ id: "memory_mara_evt-7", npcId: "mara", eventId: "evt-7", text: "Mara saw the fight" });
    expect(canKnowEvent([], event)).toBe(true);
  });

  it("keeps news provenance tied to combat events", () => {
    expect(generateNews([event])).toEqual({ headline: "Black Hart Inn survives a violent night", rumor: "They say the innkeeper saw everything.", provenance: ["evt-7"] });
  });
});