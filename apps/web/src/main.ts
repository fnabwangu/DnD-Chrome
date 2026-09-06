import type { WorldSnapshot } from "@living-rpg/schemas";
import "./style.css";

type StateResponse = { snapshot: WorldSnapshot; events: Array<{ type: string; payload: Record<string, unknown> }> };
const api = "http://localhost:3001";
let state: StateResponse;
let selectedActor = "xavi";
let feed = ["Rain needles the windows of the Black Hart Inn.", "Mara watches the door. Captain Varro refuses to meet your eye."];

async function load(): Promise<void> { state = await fetch(`${api}/api/state`).then((response) => response.json()); render(); }
function connectRealtime(): void {
  const socket = new WebSocket("ws://localhost:3001/realtime");
  socket.onmessage = (message) => {
    const update = JSON.parse(message.data) as { type: string; snapshot: WorldSnapshot; events?: StateResponse["events"] };
    state = { snapshot: update.snapshot, events: [...state.events, ...(update.events ?? [])] };
    render();
  };
  socket.onclose = () => window.setTimeout(connectRealtime, 1500);
}
async function command(type: string, actorId = selectedActor, payload: Record<string, unknown> = {}): Promise<void> {
  const response = await fetch(`${api}/api/commands`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: `cmd_${Date.now()}`, sessionId: "demo", type, actorId, expectedWorldVersion: state.snapshot.version, payload }) });
  const result = await response.json();
  if (!response.ok) { feed = [`Command rejected: ${result.error}`, ...feed]; render(); return; }
  state = { snapshot: result.snapshot, events: [...state.events, ...result.events] };
  for (const item of result.presentation ?? []) if (item.narration) feed = [item.narration, ...feed];
  render();
}
async function advanceMorning(): Promise<void> {
  const result = await fetch(`${api}/api/morning`, { method: "POST" }).then((response) => response.json());
  state = { snapshot: result.snapshot, events: [...state.events, result.event] };
  feed = [`${result.news.headline}.`, result.news.rumor, ...feed];
  render();
}

function render(): void {
  const characters = Object.values(state.snapshot.characters);
  document.querySelector<HTMLDivElement>("#app")!.innerHTML = `<main>
    <header><div><span class="eyebrow">LIVING RPG / DEMO CAMPAIGN</span><h1>The Black Hart Inn</h1><p class="sub">Rain. Rumors. A fight waiting to happen.</p></div><div class="phase"><span>WORLD TIME</span><strong>${state.snapshot.worldTime}</strong><small>VERSION ${state.snapshot.version}</small></div></header>
    <section class="map-panel"><div class="map-head"><span>THE TAVERN FLOOR</span><span class="live">● LIVE EVENT STREAM</span></div><div class="map">${characters.map((character) => `<button class="token ${character.alive ? "" : "down"}" style="left:${character.x * 16}%;top:${character.y * 17}%" title="${character.name}" onclick="selectActor('${character.id}')">${character.name.split(" ").map((word) => word[0]).join("")}</button>`).join("")}<div class="grid-lines"></div></div></section>
    <section class="lower"><article class="story"><div class="section-title">NARRATIVE FEED <span>${state.snapshot.phase}</span></div>${state.snapshot.reactionWindow ? `<div class="reaction"><b>REACTION WINDOW</b><p>Choose how to resolve the danger.</p><button onclick="respondReaction('ACCEPT_HIT')">ACCEPT HIT</button><button onclick="respondReaction('USE_REACTION')">USE REACTION</button><button onclick="respondReaction('ASK_GM')">ASK GM</button></div>` : ""}${feed.slice(0, 5).map((line) => `<p>${line}</p>`).join("")}</article><aside class="party"><div class="section-title">PARTY</div>${characters.filter((character) => ["xavi", "matu", "mara"].includes(character.id)).map((character) => `<button class="party-row ${selectedActor === character.id ? "chosen" : ""}" onclick="selectActor('${character.id}')"><b>${character.name}</b><span>${character.hp}/${character.maxHp} HP</span></button>`).join("")}</aside></section>
    <nav class="action-bar"><div class="selection">ACTING AS <b>${state.snapshot.characters[selectedActor]?.name}</b></div><button onclick="talk()">TALK TO MARA</button><button onclick="inspect()">INSPECT TAVERN</button><button onclick="beginEncounter()">BEGIN ENCOUNTER</button><button class="attack" onclick="attack()">ATTACK ASH RAIDER</button><button onclick="advanceMorning()">NEXT MORNING</button><button class="commit" onclick="commit()">COMMIT ACTION ↗</button></nav>
  </main>`;
}
function selectActor(id: string): void { selectedActor = id; render(); }
function talk(): void { void command("INTERACT_WITH_NPC", selectedActor, { npcId: "mara" }); }
function inspect(): void { feed = ["You notice muddy bootprints circling the hooded stranger's table.", ...feed]; render(); }
function attack(): void { void command("ATTACK_TARGET", selectedActor, { targetId: "ash-raider" }); }
function respondReaction(choice: string): void {
  const reaction = state.snapshot.reactionWindow;
  if (reaction) void command("RESPOND_REACTION", reaction.actorId, { reactionId: reaction.id, choice });
}
function beginEncounter(): void { void command("BEGIN_ENCOUNTER"); }
function commit(): void { void command("END_PHASE", selectedActor); }
Object.assign(window, { selectActor, talk, inspect, attack, respondReaction, beginEncounter, commit, advanceMorning });
void load().then(connectRealtime);