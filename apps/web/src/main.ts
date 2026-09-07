import "./style.css";

type VisibleActor = { id: string; name: string; hp: number; maxHp: number; x: number; y: number; alive: boolean };
type View = { worldVersion: number; phase: string; worldTime: string; visibleActors: VisibleActor[]; activeReaction?: { id: string; actorId: string; options: string[] }; news: { headline: string; rumor: string } };
type StateResponse = { events: Array<{ id: string; type: string; sequence: number; actorId?: string; targetId?: string }>; view: View };
type SiteResponse<T> = { content: Array<{ type: "text"; text: string }>; structuredContent: T };
type Proposal = { actions: Array<{ type: string; targetId?: string }>; confidence: number; unresolvedReferences: string[] };
const api = "http://localhost:3001";
let state: StateResponse;
let selectedActor = "xavi";
let feed = ["Rain needles the windows of the Black Hart Inn.", "Mara watches the door. Captain Varro refuses to meet your eye."];

async function load(): Promise<void> { state = await fetch(`${api}/api/state`).then((response) => response.json()); render(); }
function connectRealtime(): void {
  const socket = new WebSocket("ws://localhost:3001/realtime");
  socket.onmessage = (message) => {
    const update = JSON.parse(message.data) as { type: string; view: View; events?: StateResponse["events"] };
    state = { view: update.view, events: [...state.events, ...(update.events ?? [])] };
    render();
  };
  socket.onclose = () => window.setTimeout(connectRealtime, 1500);
}
async function command(type: string, actorId = selectedActor, payload: Record<string, unknown> = {}): Promise<void> {
  const response = await fetch(`${api}/api/commands`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: `cmd_${Date.now()}`, sessionId: "demo", type, actorId, expectedWorldVersion: state.view.worldVersion, payload }) });
  const result = await response.json();
  if (!response.ok) { feed = [`Command rejected: ${result.error}`, ...feed]; render(); return; }
  state = { events: [...state.events, ...result.events], view: result.view };
  feed = [`Committed ${result.events.length} canonical event${result.events.length === 1 ? "" : "s"}.`, ...feed];
  render();
}
async function advanceMorning(): Promise<void> {
  const result = await fetch(`${api}/api/morning`, { method: "POST" }).then((response) => response.json());
  state = { events: [...state.events, ...result.events], view: result.view };
  feed = [`${result.view.news.headline}.`, result.view.news.rumor, ...feed];
  render();
}
async function submitIntent(): Promise<void> {
  const input = document.querySelector<HTMLInputElement>("#intent")!;
  const text = input.value.trim();
  if (!text) return;
  const response = await fetch(`${api}/api/site/intent`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ actorId: selectedActor, text }) });
  const result = await response.json() as SiteResponse<Proposal>;
  if (!response.ok) { feed = [`Intent rejected: ${(result as { error?: string }).error ?? "unknown error"}`, ...feed]; render(); return; }
  const proposal = result.structuredContent;
  const actions = proposal.actions.map((action) => `${action.type}${action.targetId ? ` ${action.targetId}` : ""}`).join(", ");
  feed = [actions ? `Proposed action: ${actions}. Confirm with a matching control.` : `Intent needs clarification: ${proposal.unresolvedReferences.join(", ")}.`, ...feed];
  render();
}

function render(): void {
  const characters = state.view.visibleActors;
  document.querySelector<HTMLDivElement>("#app")!.innerHTML = `<main>
    <header><div><span class="eyebrow">LIVING RPG / DEMO CAMPAIGN</span><h1>The Black Hart Inn</h1><p class="sub">Rain. Rumors. A fight waiting to happen.</p></div><div class="phase"><span>WORLD TIME</span><strong>${state.view.worldTime}</strong><small>VERSION ${state.view.worldVersion}</small></div></header>
    <section class="map-panel"><div class="map-head"><span>THE TAVERN FLOOR</span><span class="live">● LIVE EVENT STREAM</span></div><div class="map">${characters.map((character) => `<button class="token ${character.alive ? "" : "down"}" style="left:${character.x * 16}%;top:${character.y * 17}%" title="${character.name}" onclick="selectActor('${character.id}')">${character.name.split(" ").map((word) => word[0]).join("")}</button>`).join("")}<div class="grid-lines"></div></div></section>
    <section class="lower"><article class="story"><div class="section-title">NARRATIVE FEED <span>${state.view.phase}</span></div>${state.view.activeReaction ? `<div class="reaction"><b>REACTION WINDOW</b><p>Choose how to resolve the danger.</p><button onclick="respondReaction('ACCEPT_HIT')">ACCEPT HIT</button><button onclick="respondReaction('USE_REACTION')">USE REACTION</button><button onclick="respondReaction('ASK_GM')">ASK GM</button></div>` : ""}${feed.slice(0, 5).map((line) => `<p>${line}</p>`).join("")}</article><aside class="party"><div class="section-title">PARTY</div>${characters.filter((character) => ["xavi", "matu", "mara"].includes(character.id)).map((character) => `<button class="party-row ${selectedActor === character.id ? "chosen" : ""}" onclick="selectActor('${character.id}')"><b>${character.name}</b><span>${character.hp}/${character.maxHp} HP</span></button>`).join("")}</aside></section>
    <nav class="action-bar"><div class="selection">ACTING AS <b>${characters.find((character) => character.id === selectedActor)?.name}</b></div><button onclick="talk()">TALK TO MARA</button><button onclick="inspect()">INSPECT TAVERN</button><button onclick="beginEncounter()">BEGIN ENCOUNTER</button><button class="attack" onclick="attack()">ATTACK ASH RAIDER</button><button onclick="advanceMorning()">NEXT MORNING</button><button class="commit" onclick="commit()">COMMIT ACTION</button></nav>
    <form class="intent-form" onsubmit="submitIntent(); return false"><label for="intent">Describe an action</label><input id="intent" maxlength="240" placeholder="Tell Mara to run, inspect the tavern, or begin a fight"><button type="submit">PROPOSE</button></form>
  </main>`;
}
function selectActor(id: string): void { selectedActor = id; render(); }
function talk(): void { void command("INTERACT_WITH_NPC", selectedActor, { npcId: "mara" }); }
function inspect(): void { void submitFixedIntent("Inspect the tavern"); }
async function submitFixedIntent(text: string): Promise<void> {
  const input = document.querySelector<HTMLInputElement>("#intent");
  if (input) input.value = text;
  await submitIntent();
}
function attack(): void { void command("ATTACK_TARGET", selectedActor, { targetId: "ash-raider" }); }
function respondReaction(choice: string): void {
  const reaction = state.view.activeReaction;
  if (reaction) void command("RESPOND_REACTION", reaction.actorId, { reactionId: reaction.id, choice });
}
function beginEncounter(): void { void command("BEGIN_ENCOUNTER"); }
function commit(): void { void command("END_PHASE", selectedActor); }
Object.assign(window, { selectActor, talk, inspect, attack, respondReaction, beginEncounter, commit, advanceMorning, submitIntent });
void load().then(connectRealtime);