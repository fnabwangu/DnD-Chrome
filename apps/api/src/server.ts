import { createServer } from "node:http";
import { FileGameRepository, PersistentGameService } from "@living-rpg/database";
import { GameApplication } from "@living-rpg/application";
import { CommandSchema } from "@living-rpg/schemas";
import { WebSocketServer, type WebSocket } from "ws";

const repository = new FileGameRepository(process.env.LIVING_RPG_DATA_FILE ?? ".data/black-hart.json");
const game = new PersistentGameService(repository);
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

async function readBody(request: import("node:http").IncomingMessage): Promise<unknown> {
  let raw = "";
  for await (const chunk of request) raw += chunk;
  return JSON.parse(raw);
}

function siteResponse(summary: string, structuredContent: unknown): { content: Array<{ type: "text"; text: string }>; structuredContent: unknown } {
  return { content: [{ type: "text", text: summary }], structuredContent };
}

async function visibleEvents(sessionId = "demo") {
  return (await game.getEvents(sessionId, 0))
    .filter((event) => event.visibility === "public" || event.visibility === "party")
    .map(({ id, type, sequence, actorId, targetId }) => ({ id, type, sequence, actorId, targetId }));
}

function clientResult(result: Awaited<ReturnType<PersistentGameService["execute"]>> | Awaited<ReturnType<PersistentGameService["advanceMorning"]>>) {
  return { events: result.events.map(({ id, type, sequence, actorId, targetId }) => ({ id, type, sequence, actorId, targetId })), view: result.view };
}

const server = createServer(async (request, response) => {
  if (request.method === "OPTIONS") { response.writeHead(204, { "access-control-allow-origin": "*", "access-control-allow-headers": "content-type" }); response.end(); return; }
  const url = new URL(request.url ?? "/", "http://localhost");
  const viewerId = url.searchParams.get("viewerId") ?? "player";
  if ((url.pathname === "/api/state" || url.pathname === "/api/site/view") && request.method === "GET") {
    const sessionId = url.searchParams.get("sessionId") ?? "demo";
    const view = await game.getView(sessionId, viewerId);
    const body = url.pathname === "/api/site/view" ? siteResponse(`Black Hart Inn: ${view.phase}, ${view.worldTime}.`, view) : { events: await visibleEvents(sessionId), view };
    send(response, 200, body); return;
  }
  if (url.pathname === "/api/news" && request.method === "GET") {
    send(response, 200, (await game.getView(url.searchParams.get("sessionId") ?? "demo", viewerId)).news); return;
  }
  if ((url.pathname === "/api/morning" || url.pathname === "/api/site/morning") && request.method === "POST") {
    try {
      const result = await game.advanceMorning(url.searchParams.get("sessionId") ?? "demo");
      const client = clientResult(result);
      broadcast({ type: "EVENTS", ...client });
      send(response, 200, url.pathname === "/api/site/morning" ? siteResponse("Morning arrives at the Black Hart Inn.", client) : client);
    } catch (error) { send(response, 409, { error: error instanceof Error ? error.message : "Command rejected" }); }
    return;
  }
  if (url.pathname === "/api/site/intent" && request.method === "POST") {
    try {
      const body = await readBody(request) as { actorId?: unknown; text?: unknown; sessionId?: unknown };
      if (typeof body.actorId !== "string" || typeof body.text !== "string") throw new Error("actorId and text are required");
      const view = await game.getView(typeof body.sessionId === "string" ? body.sessionId : "demo", body.actorId);
      const proposal = new GameApplication().submitIntent(body.actorId, body.text, view.sessionId);
      send(response, 200, siteResponse(`Proposed ${proposal.actions.length || "no"} action${proposal.actions.length === 1 ? "" : "s"}; confirmation is required.`, proposal));
    } catch (error) { send(response, 400, { error: error instanceof Error ? error.message : "Invalid intent" }); }
    return;
  }
  if ((url.pathname === "/api/commands" || url.pathname === "/api/site/actions") && request.method === "POST") {
    try {
      const parsed = CommandSchema.safeParse(await readBody(request));
      if (!parsed.success) { send(response, 400, { error: "Invalid command shape", details: parsed.error.flatten() }); return; }
      const result = await game.execute(parsed.data);
      const client = clientResult(result);
      broadcast({ type: "EVENTS", ...client });
      send(response, 200, url.pathname === "/api/site/actions" ? siteResponse(`Committed ${result.events.length} event${result.events.length === 1 ? "" : "s"}; world version ${result.view.worldVersion}.`, client) : client);
    } catch (error) { send(response, 409, { error: error instanceof Error ? error.message : "Command rejected" }); }
    return;
  }
  if (url.pathname === "/api/site/events" && request.method === "GET") {
    const afterSequence = Number(url.searchParams.get("afterSequence") ?? 0);
    const sessionId = url.searchParams.get("sessionId") ?? "demo";
    const events = await game.getEvents(sessionId, afterSequence);
    const view = await game.getView(sessionId, viewerId);
    send(response, 200, siteResponse(`${events.length} event${events.length === 1 ? "" : "s"} after sequence ${afterSequence}.`, { fromSequence: afterSequence + 1, throughSequence: events.at(-1)?.sequence ?? afterSequence, worldVersion: view.worldVersion, events, hasMore: false })); return;
  }
  send(response, 404, { error: "Not found" });
});

server.on("upgrade", (request, socket, head) => {
  if (request.url !== "/realtime") { socket.destroy(); return; }
  realtime.handleUpgrade(request, socket, head, (client) => realtime.emit("connection", client, request));
});

realtime.on("connection", (client) => {
  void (async () => client.send(JSON.stringify({ type: "SNAPSHOT", events: await visibleEvents(), view: await game.getView() })))();
});

server.listen(3001, () => console.log("Living RPG API listening on http://localhost:3001"));