import { readFile } from "node:fs/promises";

async function validate(): Promise<void> {
  const root = "content/campaigns/demo-campaign";
  const manifest = JSON.parse(await readFile(`${root}/manifest.json`, "utf8")) as Record<string, unknown>;
  const world = JSON.parse(await readFile(`${root}/world.json`, "utf8")) as Record<string, unknown>;
  if (typeof manifest.id !== "string" || typeof manifest.title !== "string" || !Array.isArray(world.locations) || !Array.isArray(world.npcs)) {
    throw new Error("Campaign pack is missing required data fields");
  }
  const serialized = JSON.stringify(world);
  if (/javascript:|__proto__|constructor|function\s*\(/i.test(serialized)) throw new Error("Executable content is not allowed");
  console.log(`Validated campaign: ${manifest.title}`);
}

void validate();