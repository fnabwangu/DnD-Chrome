import { createServer } from "node:http";
import { TurnSession } from "@living-rpg/turn-engine";
import { CommandSchema, type Command, type WorldEvent, type WorldSnapshot } from "@living-rpg/schemas";
import { generateNews } from "@living-rpg/news-engine";
import { WebSocketServer, type WebSocket } from "ws";

const initial: WorldSnapshot = {
  version: 0, phase: "EXPLORATION", worldTime: "Night, 14th of Ember", knownSecrets: {}, npcMemories: {},
  characters: {
    xavi: { id: "xavi", name: "Xavi", hp: 12, maxHp: 12, x: 1, y: 1, alive: true },
    matu: { id: "matu", name: "Matu", hp: 12, maxHp: 12, x: 1, y: 2, alive: true },
    mara: { id: "mara", name: "Mara", hp: 10, maxHp: 10, x: 2, y: 1, alive: true },
    "ash-raider": { id: "ash-raider", name: "Ash Raider", hp: 8, maxHp: 8, x: 5, y: 2, alive: true },
    "coin-raider": { id: "coin-raider", name: "Coin Raider", hp: 8, maxHp: 8, x: 5, y: 4, alive: true }
  }
};

const session = new TurnSession(initial);
const realtime = new WebSocketServer({ noServer: true });

function send(response: import("node:http").ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "content-type": "application/json", "access-control-allow-origin": "*" });
  response.end(JSON.stringify(body));
}

function broadcast(message: unknown): void {
  const encoded = JSON.stringify(message);
  realtime.clients.forEach((client: WebSocket) => {
    if (client.readyState === 1) client.send(encoded);
  });
}

function derived(event: WorldEvent): { narration?: string; cue?: Record<string, unknown> } {
  if (event.type === "DAMAGE_APPLIED") {
    const target = event.targetId === "ash-raider" ? "the Ash Raider" : "the Coin Raider";
    return { narration: `Xavi's arrow catches ${target}. The inn falls silent for one sharp breath.`, cue: { type: "SOUND_EFFECT", sound: "arrow-impact", eventId: event.id } };
  }
  if (event.type === "SECRET_LEARNED") return { narration: "Mara leans close and shares a secret meant for the party alone.", cue: { type: "NPC_SPEECH", actorId: "mara", text: "Keep your voices low." , eventId: event.id } };
  return {};
}

const server = createServer(async (request, response) => {
  if (request.method === "OPTIONS") { response.writeHead(204, { "access-control-allow-origin": "*", "access-control-allow-headers": "content-type" }); response.end(); return; }
  if (request.url === "/api/state" && request.method === "GET") { send(response, 200, { snapshot: session.snapshot, events: session.eventLog.all(), pendingCommands: session.pendingCommands }); return; }
  if (request.url === "/api/news" && request.method === "GET") {
    send(response, 200, generateNews(session.eventLog.all())); return;
  }
  if (request.url === "/api/morning" && request.method === "POST") {
    const event: WorldEvent = { id: `evt_${session.snapshot.version + 1}`, sessionId: "demo", campaignId: "demo-campaign", sequence: session.snapshot.version + 1, worldTime: "Morning, 15th of Ember", realTimestamp: new Date().toISOString(), type: "WORLD_TIME_ADVANCED", payload: { worldTime: "Morning, 15th of Ember" }, visibility: "public" };
    session.append(event);
    broadcast({ type: "EVENTS", events: [event], snapshot: session.snapshot });
    send(response, 200, { event, snapshot: session.snapshot, news: generateNews(session.eventLog.all()) }); return;
  }
  if (request.url === "/api/commands" && request.method === "POST") {
    try {
      const body = await new Promise<string>((resolve, reject) => { let raw = ""; request.on("data", (chunk) => raw += chunk); request.on("end", () => resolve(raw)); request.on("error", reject); });
      const parsed = CommandSchema.safeParse(JSON.parse(body));
      if (!parsed.success) { send(response, 400, { error: "Invalid command shape", details: parsed.error.flatten() }); return; }
      const command = parsed.data as Command;
      const events = command.type === "RESPOND_REACTION" ? session.resolveReaction(command) : session.submit(command);
      const extras: WorldEvent[] = [];
      if (events.some((event) => event.type === "DAMAGE_APPLIED")) {
        const memory: WorldEvent = { id: `evt_${session.snapshot.version + 1}`, sessionId: command.sessionId, campaignId: "demo-campaign", sequence: session.snapshot.version + 1, worldTime: session.snapshot.worldTime, realTimestamp: new Date().toISOString(), type: "NPC_MEMORY_CREATED", actorId: "mara", payload: { memory: "Mara witnessed the party strike the raiders." }, visibility: "party", causedByCommandId: command.id };
        session.append(memory); extras.push(memory);
      }
      broadcast({ type: "EVENTS", events: [...events, ...extras], snapshot: session.snapshot });
      send(response, 200, { events: [...events, ...extras], pendingCommands: session.pendingCommands, snapshot: session.snapshot, presentation: [...events, ...extras].map(derived) });
    } catch (error) { send(response, 409, { error: error instanceof Error ? error.message : "Command rejected" }); }
    return;
  }
  send(response, 404, { error: "Not found" });
});

server.on("upgrade", (request, socket, head) => {
  if (request.url !== "/realtime") { socket.destroy(); return; }
  realtime.handleUpgrade(request, socket, head, (client) => realtime.emit("connection", client, request));
});

realtime.on("connection", (client) => {
  client.send(JSON.stringify({ type: "SNAPSHOT", snapshot: session.snapshot, events: session.eventLog.all() }));
});

server.listen(3001, () => console.log("Living RPG API listening on http://localhost:3001"));