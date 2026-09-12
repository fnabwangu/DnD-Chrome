import "./style.css";
import { GameApplication, findCardinalPath, type GameViewState } from "@living-rpg/application";
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
let dragState: { actorId: string; pointerId: number } | undefined;
let feed = ["Rain needles the windows of the Black Hart Inn.", "Mara watches the King's Road door."];
let debug = false;
let soundEnabled = false;
let voiceStatus = "Typed input is always available.";

function actor(id: string) { return state.view.renderManifest.actors.find((candidate) => candidate.id === id); }
function keyForCell(cell: { col: number; row: number }): string { return `${cell.col},${cell.row}`; }
function command(type: Command["type"], actorId = selectedActor, payload: Record<string, unknown> = {}): Command {
  return { id: `demo-command-${local.nextId()}`, sessionId: "demo", actorId, expectedWorldVersion: state.view.worldVersion, type, payload };
}
async function execute(type: Command["type"], actorId = selectedActor, payload: Record<string, unknown> = {}): Promise<void> {
  try {
    state = await client.execute(command(type, actorId, payload));
    preview = undefined;
    feed = [`${type.replaceAll("_", " ").toLowerCase()} accepted.`, ...feed].slice(0, 8);
    render();
  } catch (error) {
    feed = [`Action unavailable: ${error instanceof Error ? error.message : "unknown error"}`, ...feed].slice(0, 8);
    preview = undefined;
    render();
  }
}
function getCellFromPointerEvent(event: PointerEvent): { col: number; row: number } | undefined {
  const stage = document.querySelector<HTMLElement>(".stage");
  if (!stage) return undefined;
  const rect = stage.getBoundingClientRect();
  const x = Math.max(0, Math.min(event.clientX - rect.left, rect.width));
  const y = Math.max(0, Math.min(event.clientY - rect.top, rect.height));
  const col = Math.min(15, Math.max(0, Math.floor((x / rect.width) * 16)));
  const row = Math.min(8, Math.max(0, Math.floor((y / rect.height) * 9)));
  return { col, row };
}
function getReachableCells(actorId: string): Set<string> {
  const source = actor(actorId)?.position;
  if (!source) return new Set();
  const blocked = new Set(state.view.renderManifest.map.blockedCells.map((cell) => keyForCell(cell)));
  const occupied = new Set(Object.values(state.view.renderManifest.actors).filter((candidate) => candidate.visible && candidate.alive && candidate.id !== actorId).map((candidate) => keyForCell(candidate.position)));
  const queue = [{ col: source.col, row: source.row }];
  const visited = new Set<string>([keyForCell(source)]);
  const distances = new Map<string, number>([[keyForCell(source), 0]]);
  const directions = [{ col: 0, row: -1 }, { col: 1, row: 0 }, { col: -1, row: 0 }, { col: 0, row: 1 }];
  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentKey = keyForCell(current);
    const distance = distances.get(currentKey) ?? 0;
    if (distance >= 6) continue;
    for (const step of directions) {
      const next = { col: current.col + step.col, row: current.row + step.row };
      const nextKey = keyForCell(next);
      if (next.col < 0 || next.col >= 16 || next.row < 0 || next.row >= 9) continue;
      if (blocked.has(nextKey)) continue;
      if (occupied.has(nextKey) && nextKey !== currentKey) continue;
      if (visited.has(nextKey)) continue;
      visited.add(nextKey);
      distances.set(nextKey, distance + 1);
      queue.push(next);
    }
  }
  return visited;
}
function getPreviewPath(actorId: string, destination: { col: number; row: number }): Array<{ col: number; row: number }> {
  const source = actor(actorId)?.position;
  if (!source) return [];
  const occupied = Object.values(state.view.renderManifest.actors)
    .filter((candidate) => candidate.id !== actorId && candidate.visible && candidate.alive)
    .map((candidate) => ({ col: candidate.position.col, row: candidate.position.row }));
  const path = findCardinalPath(state.view.renderManifest.map, source, destination, occupied);
  return path ?? [];
}
function moveByKey(key: string): void {
  const current = actor(selectedActor)?.position;
  if (!current) return;
  const delta: Record<string, { col: number; row: number }> = { w: { col: 0, row: -1 }, a: { col: -1, row: 0 }, s: { col: 0, row: 1 }, d: { col: 1, row: 0 } };
  const step = delta[key];
  if (!step) return;
  preview = { col: current.col + step.col, row: current.row + step.row };
  render();
}
function commitPreview(): void {
  if (preview) {
    void execute("MOVE_CHARACTER", selectedActor, { x: preview.col, y: preview.row, source: actor(selectedActor)?.position, path: [actor(selectedActor)?.position, preview] });
    return;
  }
  if (state.view.phase === "PLAYER_PLANNING") void execute("END_PHASE");
}
function queueMoveForActor(actorId: string, destination: { col: number; row: number }): void {
  const source = actor(actorId)?.position;
  if (!source) return;
  const path = getPreviewPath(actorId, destination);
  if (!path.length) {
    preview = destination;
    render();
    return;
  }
  preview = destination;
  void execute("MOVE_CHARACTER", actorId, { x: destination.col, y: destination.row, source, path });
}
function selectActor(id: string): void {
  if (!actor(id) || actor(id)!.control !== "player") return;
  selectedActor = id;
  preview = undefined;
  render();
}
function inspect(): void { void execute("INSPECT_AREA", selectedActor, { areaId: "hearth" }); }
function talk(): void { void execute("INTERACT_WITH_NPC", selectedActor, { npcId: "mara" }); }
function respondReaction(choice: string): void { const reaction = state.view.activeReaction; if (reaction) void execute("RESPOND_REACTION", reaction.actorId, { reactionId: reaction.id, choice }); }
function startVoice(): void {
  const Recognition = (window as Window & { SpeechRecognition?: new () => { start(): void; onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onerror: (() => void) | null } }).SpeechRecognition;
  if (!Recognition) {
    voiceStatus = "Speech recognition unavailable; use typed input.";
    render();
    return;
  }
  voiceStatus = "Listening...";
  const recognition = new Recognition();
  recognition.onresult = (event) => {
    const input = document.querySelector<HTMLInputElement>("#intent-input");
    if (input) input.value = event.results[0]?.[0]?.transcript ?? "";
    voiceStatus = "Transcript ready for confirmation.";
    render();
  };
  recognition.onerror = () => {
    voiceStatus = "Microphone unavailable; typed input remains ready.";
    render();
  };
  recognition.start();
}
function render(): void {
  const manifest = state.view.renderManifest;
  const selected = actor(selectedActor);
  const reachable = selectedActor && state.view.phase === "PLAYER_PLANNING" ? getReachableCells(selectedActor) : new Set<string>();
  const previewPath = selectedActor && preview ? getPreviewPath(selectedActor, preview) : [];
  const previewPathSet = new Set(previewPath.map((cell) => keyForCell(cell)));
  const queuedDestinationSet = new Set(Object.values(state.view.movementPlans ?? {}).map((plan) => keyForCell(plan.destination)));
  const grid = Array.from({ length: 144 }, (_, index) => {
    const col = index % 16;
    const row = Math.floor(index / 16);
    const key = keyForCell({ col, row });
    const blocked = manifest.map.blockedCells.some((cell) => cell.col === col && cell.row === row);
    const isReachable = reachable.has(key);
    const isPath = previewPathSet.has(key);
    const isQueued = queuedDestinationSet.has(key);
    const isGhost = preview?.col === col && preview.row === row;
    return `<span class="cell ${blocked ? "blocked" : ""} ${isReachable ? "reachable" : ""} ${isPath ? "path" : ""} ${isQueued ? "queued" : ""} ${isGhost ? "ghost" : ""}" data-cell="${col},${row}"></span>`;
  }).join("");
  const tokens = manifest.actors.filter((candidate) => candidate.visible).map((candidate) => {
    const plan = state.view.movementPlans[candidate.id];
    const queuedClass = plan ? "queued-token" : "";
    return `<button class="token team-${candidate.team} ${candidate.id === selectedActor ? "selected" : ""} ${candidate.alive ? "" : "down"} ${queuedClass}" style="--col:${candidate.position.col};--row:${candidate.position.row}" aria-label="${candidate.accessibleName}" data-actor="${candidate.id}">${candidate.name.split(" ").map((part) => part[0]).join("")}<i>${candidate.hp ?? "?"}</i></button>`;
  }).join("");
  const queuedGhosts = Object.values(state.view.movementPlans ?? {}).map((plan) => `<div class="queued-ghost" style="--col:${plan.destination.col};--row:${plan.destination.row}">${plan.actorId}</div>`).join("");
  const partyRows = manifest.actors.filter((candidate) => candidate.control === "player").map((candidate) => {
    const status = state.view.playerStatus[candidate.id] ?? { state: "Planning", ready: false };
    const destination = status.queuedDestination ? ` → ${status.queuedDestination.col},${status.queuedDestination.row}` : "";
    return `<div class="party-row ${candidate.id === selectedActor ? "chosen" : ""}" data-actor="${candidate.id}"><div><b>${candidate.name}</b><small>${status.state}${destination}</small></div><span>${candidate.hp}/${candidate.maxHp} HP</span></div>`;
  }).join("");
  const readyButtonText = state.view.playerStatus[selectedActor]?.ready ? "Cancel ready" : "Ready";
  const ghostToken = preview && selectedActor ? `<div class="ghost-token" style="--col:${preview.col};--row:${preview.row}">${actor(selectedActor)?.name?.slice(0, 1) ?? ""}</div>` : "";
  const reaction = state.view.activeReaction ? `<section class="reaction" role="dialog" aria-label="Reaction window"><b>REACTION WINDOW</b><p>Choose how to resolve ${state.view.activeReaction.damage} damage.</p>${state.view.activeReaction.options.map((choice) => `<button data-reaction="${choice}">${choice.replaceAll("_", " ")}</button>`).join("")}</section>` : "";
  document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
    <main>
      <header>
        <div><span class="eyebrow">LIVING RPG / DETERMINISTIC DEMO</span><h1>The Black Hart Inn</h1><p class="sub">Rain on the King's Road. Something is moving in the dark.</p></div>
        <div class="phase"><span>WORLD TIME</span><strong>${state.view.worldTime}</strong><small>VERSION ${state.view.worldVersion} / ${state.view.phase}</small></div>
      </header>
      <div class="status" role="status">${demoMode ? "Local authority / black-hart-render-v1" : "Remote authority"}<span>${voiceStatus}</span></div>
      <section class="layout">
        <section class="map-panel">
          <div class="map-head"><span>COMMON ROOM / 16 × 9</span><span class="live">● CANONICAL VIEW</span></div>
          <div class="stage-wrap"><div class="stage" tabindex="0" aria-label="Black Hart tactical map. Use W A S D to preview movement, Enter to commit, Escape to clear."><div class="cells">${grid}</div><div class="tokens">${tokens}${queuedGhosts}${ghostToken}</div></div></div>
          <div class="map-tools"><button data-action="debug">${debug ? "Hide grid" : "Show grid"}</button><span>Selected: <b>${selected?.name ?? "Unknown"}</b>${preview ? ` · Preview ${preview.col},${preview.row}` : ""}</span></div>
        </section>
        <aside class="rail">
          <section><div class="section-title">PARTY</div>${partyRows}</section>
          <section class="mini"><div class="section-title">PLAYER ACTIONS</div><div class="mini-actions"><button data-action="ready">${readyButtonText}</button><button data-action="clear-preview">Clear preview</button></div></section>
          <section class="narrative">${reaction}<div class="section-title">NARRATIVE FEED</div>${feed.slice(0, 6).map((line) => `<p>${line}</p>`).join("")}</section>
          <section class="audio"><div class="section-title">SOUND & CAPTIONS</div><button data-action="sound">${soundEnabled ? "Mute ambience" : "Enable ambience"}</button><span>Captions on · audio waits for your gesture</span></section>
        </aside>
      </section>
      <section class="controls">
        <div><b>ACTING AS ${selected?.name ?? "UNKNOWN"}</b><small>WASD previews; pointer drag queues movement.</small></div>
        <button data-action="inspect">Inspect hearth</button>
        <button data-action="talk">Talk to Mara</button>
        <button data-action="encounter">Begin encounter</button>
        <button data-action="commit">Commit move</button>
        <button data-action="attack">Attack raider</button>
      </section>
    </main>
  `;
  const stage = document.querySelector<HTMLElement>(".stage");
  if (stage) stage.focus();
  bindEvents();
}
function bindEvents(): void {
  const stage = document.querySelector<HTMLElement>(".stage");
  if (!stage) return;
  stage.onkeydown = (event) => {
    const key = event.key.toLowerCase();
    if (["w", "a", "s", "d"].includes(key)) {
      event.preventDefault();
      moveByKey(key);
    } else if (event.key === "Enter") {
      event.preventDefault();
      commitPreview();
    } else if (event.key === "Escape") {
      preview = undefined;
      render();
    }
  };
  stage.onpointerdown = (event) => {
    const actorElement = (event.target as HTMLElement).closest<HTMLElement>("[data-actor]");
    const actorId = actorElement?.dataset.actor;
    if (!actorId || actor(actorId)?.control !== "player") return;
    if (state.view.phase !== "PLAYER_PLANNING" || state.view.playerStatus[actorId]?.ready) return;
    selectedActor = actorId;
    dragState = { actorId, pointerId: event.pointerId };
    stage.setPointerCapture(event.pointerId);
    event.preventDefault();
    const cell = getCellFromPointerEvent(event);
    if (cell) {
      preview = cell;
      render();
    }
  };
  stage.onpointermove = (event) => {
    if (!dragState || event.pointerId !== dragState.pointerId) return;
    const cell = getCellFromPointerEvent(event);
    if (cell) {
      preview = cell;
      render();
    }
  };
  stage.onpointerup = (event) => {
    if (!dragState || event.pointerId !== dragState.pointerId) return;
    const destination = getCellFromPointerEvent(event);
    if (destination) queueMoveForActor(dragState.actorId, destination);
    dragState = undefined;
    preview = destination ?? preview;
    render();
  };
  stage.onpointercancel = () => {
    dragState = undefined;
    preview = undefined;
    render();
  };
  stage.onclick = (event) => {
    if (dragState) return;
    const cell = (event.target as HTMLElement).closest<HTMLElement>("[data-cell]")?.dataset.cell;
    if (cell) {
      const [col, row] = cell.split(",").map(Number);
      preview = { col, row };
      render();
    }
  };
  document.querySelectorAll<HTMLElement>("[data-actor]").forEach((element) => {
    element.onclick = () => selectActor(element.dataset.actor ?? "");
  });
  document.querySelectorAll<HTMLElement>("[data-reaction]").forEach((element) => {
    element.onclick = () => respondReaction(element.dataset.reaction ?? "");
  });
  document.querySelectorAll<HTMLElement>("[data-action]").forEach((element) => {
    const action = element.dataset.action;
    element.onclick = () => {
      if (action === "debug") { debug = !debug; render(); }
      if (action === "sound") { soundEnabled = !soundEnabled; render(); }
      if (action === "voice") startVoice();
      if (action === "inspect") inspect();
      if (action === "talk") talk();
      if (action === "clear-preview") { preview = undefined; render(); }
      if (action === "reset") void restart();
      if (action === "commit") commitPreview();
      if (action === "ready") { void (state.view.playerStatus[selectedActor]?.ready ? execute("CANCEL_READY", selectedActor) : execute("SET_READY", selectedActor)); }
      if (action === "encounter") void execute("BEGIN_ENCOUNTER");
      if (action === "attack") void execute("ATTACK_TARGET", selectedActor, { targetId: "ash-raider" });
    };
  });
}
async function restart(): Promise<void> { if (demoMode) { state = await local.reset(); selectedActor = "xavi"; feed = ["The scene is restored to the Black Hart render fixture."]; render(); } }
async function boot(): Promise<void> {
  try {
    state = await client.load();
    render();
  } catch (error) {
    if (demoMode) throw error;
    client = local;
    state = await client.load();
    feed = [`Remote unavailable; local demo engaged. ${error instanceof Error ? error.message : ""}`];
    render();
  }
}
function startRemoteSync(): void {
  if (demoMode) return;
  let acknowledged = state.events.reduce((highest, event) => Math.max(highest, event.sequence), 0);
  window.setInterval(async () => {
    try {
      const batch = await client.getEvents(acknowledged);
      const expected = acknowledged + 1;
      const contiguous = batch.events.every((event, index) => event.sequence === expected + index);
      if (!contiguous || (batch.events.length > 0 && batch.events[0].sequence !== expected)) {
        state = await client.load();
        acknowledged = state.events.reduce((highest, event) => Math.max(highest, event.sequence), 0);
        render();
        return;
      }
      if (batch.events.length > 0) {
        state = await client.load();
        acknowledged = batch.throughSequence;
        render();
      }
    } catch {
      feed = ["Reconnecting to the authority; the local scene remains visible.", ...feed].slice(0, 8);
      render();
    }
  }, 2000);
}
void boot().then(startRemoteSync);
