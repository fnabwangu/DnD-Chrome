import { GameApplication, demoInitialSnapshot, type ApplicationResult } from "@living-rpg/application";
import type { Command, WorldEvent, WorldSnapshot } from "@living-rpg/schemas";
import type { GameRepository, StoredSession } from "./GameRepository.js";

export class PersistentGameService {
  private readonly applications = new Map<string, GameApplication>();
  private readonly locks = new Map<string, Promise<void>>();
  constructor(private readonly repository: GameRepository) {}

  async ensureSession(sessionId = "demo", fixtureId = "black-hart-render-v1"): Promise<StoredSession> {
    const existing = await this.repository.getSession(sessionId);
    if (existing) { this.applications.set(sessionId, new GameApplication(existing.snapshot)); return existing; }
    const created = await this.repository.createSession({ sessionId, campaignId: "demo-campaign", fixtureId, snapshot: demoInitialSnapshot });
    this.applications.set(sessionId, new GameApplication(created.snapshot));
    return created;
  }

  async getView(sessionId = "demo", viewerId = "player") { await this.ensureSession(sessionId); return this.applications.get(sessionId)!.getView(viewerId, sessionId); }
  async getEvents(sessionId = "demo", afterSequence = 0): Promise<WorldEvent[]> { await this.ensureSession(sessionId); return this.repository.getEventsAfter(sessionId, afterSequence); }

  async execute(command: Command): Promise<ApplicationResult & { duplicate?: boolean }> {
    if (!(["xavi", "matu"].includes(command.actorId))) throw new Error("Actor is not granted control in this session");
    await this.ensureSession(command.sessionId);
    const previous = this.locks.get(command.sessionId) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => { release = resolve; });
    this.locks.set(command.sessionId, current);
    await previous;
    try {
      const storedBefore = await this.repository.getSession(command.sessionId);
      const priorEvents = storedBefore?.commandResults[command.id];
      if (storedBefore && priorEvents) {
        const duplicateApplication = new GameApplication(storedBefore.snapshot);
        return { events: priorEvents, snapshot: storedBefore.snapshot, view: duplicateApplication.getView(command.actorId, command.sessionId), duplicate: true };
      }
      const application = this.applications.get(command.sessionId)!;
      const result = application.execute(command);
      const append = await this.repository.appendEventsCas({ sessionId: command.sessionId, expectedVersion: command.expectedWorldVersion, command, events: result.events, snapshot: result.snapshot });
      if (!append.accepted) throw new Error(`Stale world version: expected ${append.session.version}, received ${command.expectedWorldVersion}`);
      if (append.duplicate) {
        const stored = append.session.snapshot;
        const duplicateApplication = new GameApplication(stored);
        return { events: append.events, snapshot: stored, view: duplicateApplication.getView(command.actorId, command.sessionId), duplicate: true };
      }
      return result;
    } finally { release(); if (this.locks.get(command.sessionId) === current) this.locks.delete(command.sessionId); }
  }

  async resetDemo(sessionId = "demo"): Promise<ApplicationResult> { const session = await this.repository.resetDemoSession(sessionId, "black-hart-render-v1", demoInitialSnapshot); const application = new GameApplication(session.snapshot); this.applications.set(sessionId, application); return { events: [], snapshot: application.snapshot, view: application.getView("player", sessionId) }; }

  async advanceMorning(sessionId = "demo"): Promise<ApplicationResult> {
    await this.ensureSession(sessionId);
    const application = this.applications.get(sessionId)!;
    const result = application.advanceMorning(sessionId);
    const command: Command = { id: `morning-${result.snapshot.version}`, sessionId, actorId: "xavi", expectedWorldVersion: result.snapshot.version - 1, type: "END_PHASE", payload: {} };
    const append = await this.repository.appendEventsCas({ sessionId, expectedVersion: command.expectedWorldVersion, command, events: result.events, snapshot: result.snapshot });
    if (!append.accepted) throw new Error(`Stale world version: expected ${append.session.version}, received ${command.expectedWorldVersion}`);
    return result;
  }
}
