import "./style.css";
import { GameApplication, type GameViewState } from "@living-rpg/application";
import type { Command } from "@living-rpg/schemas";

type ClientState = { view: GameViewState; events: Array<{ id: string; type: string; sequence: number; actorId?: string; targetId?: string }> };
type EventBatch = { fromSequence: number; throughSequence: number; worldVersion: number; events: ClientState["events"]; hasMore: boolean };
interface Client { load(): Promise<ClientState>; execute(command: Command): Promise<ClientState>; getEvents(afterSequence: number): Promise<EventBatch>; submitIntent(actorId: string, text: string): Promise<unknown>; advanceMorning(): Promise<ClientState>; reset(): Promise<ClientState> }

class DemoGameAdapter implements Client {
  private application = new GameApplication();
  private sequence = 0;
  async load(): Promise<ClientState> { return this.current(); }
  async reset(): Promise<ClientState> { this.application = new GameApplication(); this.sequence = 0; return this.current(); }
  async execute(command: Command): Promise<ClientState> { this.application.execute(command); return this.current(); }
  async getEvents(afterSequence: number): Promise<EventBatch> { const events = this.application.events.filter((event) => event.sequence > afterSequence).map(({ id, type, sequence, actorId, targetId }) => ({ id, type, sequence, actorId, targetId })); return { fromSequence: afterSequence + 1, throughSequence: events.at(-1)?.sequence ?? afterSequence, worldVersion: this.application.snapshot.version, events, hasMore: false }; }
  async submitIntent(actorId: string, text: string): Promise<unknown> { return this.application.submitIntent(actorId, text); }
  async advanceMorning(): Promise<ClientState> { this.application.advanceMorning(); return this.current(); }
  nextId(): number { return ++this.sequence; }
  private current(): ClientState { const view = this.application.getView("player", "demo"); return { view, events: this.application.events.map(({ id, type, sequence, actorId, targetId }) => ({ id, type, sequence, actorId, targetId })) }; }
}

class RemoteClient implements Client {
  constructor(private readonly base: string) {}
  async load(): Promise<ClientState> { const response = await fetch(`${this.base}/api/state`); if (!response.ok) throw new Error("Remote game unavailable"); return response.json(); }
  async reset(): Promise<ClientState> { throw new Error("Remote sessions cannot reset from this client"); }
  async execute(command: Command): Promise<ClientState> { const response = await fetch(`${this.base}/api/commands`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(command) }); if (!response.ok) throw new Error((await response.json() as { error?: string }).error ?? "Command rejected"); return response.json(); }
  async getEvents(afterSequence: number): Promise<EventBatch> { const response = await fetch(`${this.base}/api/site/events?sessionId=demo&afterSequence=${afterSequence}`); if (!response.ok) throw new Error("Event recovery unavailable"); return (await response.json() as { structuredContent: EventBatch }).structuredContent; }
  async submitIntent(actorId: string, text: string): Promise<unknown> { const response = await fetch(`${this.base}/api/site/intent`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ actorId, text, sessionId: "demo" }) }); if (!response.ok) throw new Error("Intent proposal unavailable"); return (await response.json() as { structuredContent: unknown }).structuredContent; }
  async advanceMorning(): Promise<ClientState> { const response = await fetch(`${this.base}/api/site/morning?sessionId=demo`, { method: "POST" }); if (!response.ok) throw new Error("World time update unavailable"); return (await response.json() as { structuredContent: ClientState }).structuredContent; }
}

const local = new DemoGameAdapter();
const remoteBase = (globalThis as typeof globalThis & { __LIVING_RPG_API_BASE?: string }).__LIVING_RPG_API_BASE?.replace(/\/$/, "") ?? "";
const demoMode = new URLSearchParams(window.location.search).get("demo") === "black-hart-render-v1";
let client: Client = demoMode ? local : new RemoteClient(remoteBase);
let state: ClientState;
let selectedActor = "xavi";
let preview: { col: number; row: number } | undefined;
let feed = ["Rain needles the windows of the Black Hart Inn.", "Mara watches the King's Road door."];
let dialogue = false;
let debug = false;
let soundEnabled = false;
let voiceStatus = "Typed input is always available.";

function actor(id: string) { return state.view.renderManifest.actors.find((candidate) => candidate.id === id); }
function command(type: Command["type"], actorId = selectedActor, payload: Record<string, unknown> = {}): Command { return { id: `demo-command-${local.nextId()}`, sessionId: "demo", actorId, expectedWorldVersion: state.view.worldVersion, type, payload }; }
async function execute(type: Command["type"], actorId = selectedActor, payload: Record<string, unknown> = {}): Promise<void> {
  try { state = await client.execute(command(type, actorId, payload)); preview = undefined; feed = [`${type.replaceAll("_", " ").toLowerCase()} accepted.`, ...feed].slice(0, 8); render(); }
  catch (error) { feed = [`Action unavailable: ${error instanceof Error ? error.message : "unknown error"}`, ...feed].slice(0, 8); preview = undefined; render(); }
}
function moveByKey(key: string): void { const current = actor(selectedActor)?.position; if (!current) return; const delta: Record<string, { col: number; row: number }> = { w: { col: 0, row: -1 }, a: { col: -1, row: 0 }, s: { col: 0, row: 1 }, d: { col: 1, row: 0 } }; const step = delta[key]; if (step) { preview = { col: current.col + step.col, row: current.row + step.row }; render(); } }
function commitPreview(): void { if (preview) void execute("MOVE_CHARACTER", selectedActor, { x: preview.col, y: preview.row, source: actor(selectedActor)?.position, path: [actor(selectedActor)?.position, preview] }); else if (state.view.phase === "PLAYER_PLANNING") void execute("END_PHASE"); }
function selectActor(id: string): void { if (actor(id)?.control === "player") { selectedActor = id; preview = undefined; render(); } }
function inspect(): void { void execute("INSPECT_AREA", selectedActor, { areaId: "hearth" }); }
function talk(): void { void execute("INTERACT_WITH_NPC", selectedActor, { npcId: "mara" }); dialogue = true; }
function respondReaction(choice: string): void { const reaction = state.view.activeReaction; if (reaction) void execute("RESPOND_REACTION", reaction.actorId, { reactionId: reaction.id, choice }); }
function startVoice(): void { const Recognition = (window as Window & { SpeechRecognition?: new () => { start(): void; onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onerror: (() => void) | null } }).SpeechRecognition; if (!Recognition) { voiceStatus = "Speech recognition unavailable; use typed input."; render(); return; } voiceStatus = "Listening..."; const recognition = new Recognition(); recognition.onresult = (event) => { const input = document.querySelector<HTMLInputElement>("#intent-input"); if (input) input.value = event.results[0]?.[0]?.transcript ?? ""; voiceStatus = "Transcript ready for confirmation."; render(); }; recognition.onerror = () => { voiceStatus = "Microphone unavailable; typed input remains ready."; render(); }; recognition.start(); }
function render(): void {
  const manifest = state.view.renderManifest; const selected = actor(selectedActor);
  const grid = Array.from({ length: 144 }, (_, index) => { const col = index % 16; const row = Math.floor(index / 16); const blocked = manifest.map.blockedCells.some((cell) => cell.col === col && cell.row === row); const ghost = preview?.col === col && preview.row === row; return `<span class="cell ${blocked ? "blocked" : ""} ${ghost ? "ghost" : ""}" data-cell="${col},${row}">${debug ? `<small>${col},${row}</small>` : ""}</span>`; }).join("");
  const tokens = manifest.actors.filter((candidate) => candidate.visible).map((candidate) => `<button class="token team-${candidate.team} ${candidate.id === selectedActor ? "selected" : ""} ${candidate.alive ? "" : "down"}" style="--col:${candidate.position.col};--row:${candidate.position.row}" aria-label="${candidate.accessibleName}" data-actor="${candidate.id}">${candidate.name.split(" ").map((part) => part[0]).join("")}<i>${candidate.hp ?? "?"}</i></button>`).join("");
  const areas = manifest.map.interactiveAreas.map((area) => `<div class="area" style="--area-col:${area.cells[0].col};--area-row:${area.cells[0].row}" title="${area.label}">${area.label}</div>`).join("");
  const party = manifest.actors.filter((candidate) => candidate.control === "player").map((candidate) => `<button class="party-row ${candidate.id === selectedActor ? "chosen" : ""}" data-actor="${candidate.id}"><b>${candidate.name}</b><span>${candidate.hp}/${candidate.maxHp} HP</span></button>`).join("");
  const reaction = state.view.activeReaction ? `<section class="reaction" role="dialog" aria-label="Reaction window"><b>REACTION WINDOW</b><p>Choose how to resolve ${state.view.activeReaction.damage} damage.</p>${state.view.activeReaction.options.map((choice) => `<button data-reaction="${choice}">${choice.replaceAll("_", " ")}</button>`).join("")}</section>` : "";
  document.querySelector<HTMLDivElement>("#app")!.innerHTML = `<main><header><div><span class="eyebrow">LIVING RPG / DETERMINISTIC DEMO</span><h1>The Black Hart Inn</h1><p class="sub">Rain on the King's Road. Something is moving in the dark.</p></div><div class="phase"><span>WORLD TIME</span><strong>${state.view.worldTime}</strong><small>VERSION ${state.view.worldVersion} / ${state.view.phase}</small></div></header><div class="status" role="status">${demoMode ? "Local authority / black-hart-render-v1" : "Remote authority"}<span>${voiceStatus}</span></div><section class="layout"><section class="map-panel"><div class="map-head"><span>COMMON ROOM / 16 × 9</span><span class="live">● CANONICAL VIEW</span></div><div class="stage-wrap"><div class="stage" tabindex="0" aria-label="Black Hart tactical map. Use W A S D to preview movement, Enter to commit, Escape to clear."><div class="cells">${grid}</div>${areas}<div class="tokens">${tokens}</div></div></div><div class="map-tools"><button data-action="debug">${debug ? "Hide grid" : "Show grid"}</button><span>Selected: <b>${selected?.name ?? "Unknown"}</b> ${preview ? `· Preview ${preview.col},${preview.row}` : ""}</span></div></section><aside class="rail"><section><div class="section-title">PARTY</div>${party}</section><section class="narrative">${reaction}<div class="section-title">NARRATIVE FEED</div>${feed.slice(0, 6).map((line) => `<p>${line}</p>`).join("")}</section><section class="audio"><div class="section-title">SOUND & CAPTIONS</div><button data-action="sound">${soundEnabled ? "Mute ambience" : "Enable ambience"}</button><span>Captions on · audio waits for your gesture</span></section></aside></section><section class="controls"><div><b>ACTING AS ${selected?.name ?? "UNKNOWN"}</b><small>WASD previews one cardinal cell</small></div><button data-action="inspect">Inspect hearth</button><button data-action="talk">Talk to Mara</button><button data-action="encounter">Begin encounter</button><button data-action="attack">Attack Ash Raider</button><button class="commit" data-action="commit">${preview ? "Commit move" : "Commit phase"}</button><button data-action="reset">Restart scene</button></section><form id="intent"><label for="intent-input">Propose an action</label><div><input id="intent-input" maxlength="240" placeholder="Ask Mara, inspect the hearth, or describe a plan"><button type="submit">Propose</button><button type="button" data-action="voice">PTT</button></div></form>${dialogue ? `<section class="dialogue"><button class="close" data-action="close">Close</button><div class="portrait">M</div><div><span class="eyebrow">MARA / INNKEEPER</span><h2>"Keep your voices down."</h2><p>"The watch captain is hunting a smuggler inside the inn."</p></div></section>` : ""}</main>`;
  bindEvents();
}
function bindEvents(): void {
  document.querySelectorAll<HTMLElement>("[data-actor]").forEach((element) => element.onclick = () => selectActor(element.dataset.actor ?? ""));
  document.querySelectorAll<HTMLElement>("[data-reaction]").forEach((element) => element.onclick = () => respondReaction(element.dataset.reaction ?? ""));
  document.querySelector<HTMLElement>(".stage")?.addEventListener("keydown", (event) => { const key = event.key.toLowerCase(); if (["w", "a", "s", "d"].includes(key)) { event.preventDefault(); moveByKey(key); } else if (event.key === "Enter") { event.preventDefault(); commitPreview(); } else if (event.key === "Escape") { preview = undefined; render(); } });
  document.querySelector<HTMLElement>(".stage")?.addEventListener("click", (event) => { const cell = (event.target as HTMLElement).closest<HTMLElement>("[data-cell]")?.dataset.cell; if (cell) { const [col, row] = cell.split(",").map(Number); preview = { col, row }; render(); } });
  document.querySelector<HTMLFormElement>("#intent")?.addEventListener("submit", (event) => { event.preventDefault(); const input = document.querySelector<HTMLInputElement>("#intent-input"); if (input?.value.trim()) { feed = [`Proposed: ${input.value.trim()}. Confirm with a visible action.`, ...feed]; render(); } });
  document.querySelectorAll<HTMLElement>("[data-action]").forEach((element) => element.onclick = () => { const action = element.dataset.action; if (action === "debug") { debug = !debug; render(); } if (action === "sound") { soundEnabled = !soundEnabled; render(); } if (action === "voice") startVoice(); if (action === "inspect") inspect(); if (action === "talk") talk(); if (action === "close") { dialogue = false; render(); } if (action === "reset") void restart(); if (action === "commit") commitPreview(); if (action === "encounter") void execute("BEGIN_ENCOUNTER"); if (action === "attack") void execute("ATTACK_TARGET", selectedActor, { targetId: "ash-raider" }); });
}
async function restart(): Promise<void> { if (demoMode) { state = await local.reset(); selectedActor = "xavi"; feed = ["The scene is restored to the Black Hart render fixture."]; render(); } }
async function boot(): Promise<void> { try { state = await client.load(); render(); } catch (error) { if (demoMode) throw error; client = local; state = await client.load(); feed = [`Remote unavailable; local demo engaged. ${error instanceof Error ? error.message : ""}`]; render(); } }
function startRemoteSync(): void {
  if (demoMode) return;
  let acknowledged = state.events.reduce((highest, event) => Math.max(highest, event.sequence), 0);
  window.setInterval(async () => {
    try {
      const batch = await client.getEvents(acknowledged);
      const expected = acknowledged + 1;
      const contiguous = batch.events.every((event, index) => event.sequence === expected + index);
      if (!contiguous || (batch.events.length > 0 && batch.events[0].sequence !== expected)) { state = await client.load(); acknowledged = state.events.reduce((highest, event) => Math.max(highest, event.sequence), 0); render(); return; }
      if (batch.events.length > 0) { state = await client.load(); acknowledged = batch.throughSequence; render(); }
    } catch { feed = ["Reconnecting to the authority; the local scene remains visible.", ...feed].slice(0, 8); render(); }
  }, 2000);
}
void boot().then(startRemoteSync);
