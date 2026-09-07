import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { Command, WorldEvent, WorldSnapshot } from "@living-rpg/schemas";

export type StoredSession = {
  id: string;
  campaignId: string;
  fixtureId: string;
  version: number;
  snapshot: WorldSnapshot;
  events: WorldEvent[];
  commandResults: Record<string, WorldEvent[]>;
};

export type CreateSessionInput = { sessionId: string; campaignId: string; fixtureId: string; snapshot: WorldSnapshot };
export type AppendEventsCasInput = { sessionId: string; expectedVersion: number; command: Command; events: WorldEvent[]; snapshot: WorldSnapshot };
export type AppendResult = { accepted: boolean; duplicate: boolean; session: StoredSession; events: WorldEvent[] };

export interface GameRepository {
  createSession(input: CreateSessionInput): Promise<StoredSession>;
  getSession(sessionId: string): Promise<StoredSession | null>;
  appendEventsCas(input: AppendEventsCasInput): Promise<AppendResult>;
  getEventsAfter(sessionId: string, afterSequence: number): Promise<WorldEvent[]>;
  resetDemoSession(sessionId: string, fixtureId: string, snapshot: WorldSnapshot): Promise<StoredSession>;
}

function clone<T>(value: T): T { return structuredClone(value); }

export class InMemoryGameRepository implements GameRepository {
  private readonly sessions = new Map<string, StoredSession>();
  async createSession(input: CreateSessionInput): Promise<StoredSession> {
    if (this.sessions.has(input.sessionId)) throw new Error("Session already exists");
    const session = { id: input.sessionId, campaignId: input.campaignId, fixtureId: input.fixtureId, version: input.snapshot.version, snapshot: clone(input.snapshot), events: [], commandResults: {} };
    this.sessions.set(session.id, session);
    return clone(session);
  }
  async getSession(sessionId: string): Promise<StoredSession | null> { return clone(this.sessions.get(sessionId) ?? null); }
  async appendEventsCas(input: AppendEventsCasInput): Promise<AppendResult> {
    const session = this.sessions.get(input.sessionId);
    if (!session) throw new Error("Session not found");
    const previous = session.commandResults[input.command.id];
    if (previous) return { accepted: true, duplicate: true, session: clone(session), events: clone(previous) };
    if (session.version !== input.expectedVersion) return { accepted: false, duplicate: false, session: clone(session), events: [] };
    session.events.push(...clone(input.events));
    session.snapshot = clone(input.snapshot);
    session.version = input.snapshot.version;
    session.commandResults[input.command.id] = clone(input.events);
    return { accepted: true, duplicate: false, session: clone(session), events: clone(input.events) };
  }
  async getEventsAfter(sessionId: string, afterSequence: number): Promise<WorldEvent[]> { return clone((this.sessions.get(sessionId)?.events ?? []).filter((event) => event.sequence > afterSequence)); }
  async resetDemoSession(sessionId: string, fixtureId: string, snapshot: WorldSnapshot): Promise<StoredSession> { this.sessions.delete(sessionId); return this.createSession({ sessionId, campaignId: "demo-campaign", fixtureId, snapshot }); }
}

type RepositoryFile = { sessions: StoredSession[] };
export class FileGameRepository implements GameRepository {
  private queue: Promise<void> = Promise.resolve();
  constructor(private readonly filePath: string) {}
  private async read(): Promise<RepositoryFile> { try { return JSON.parse(await readFile(this.filePath, "utf8")) as RepositoryFile; } catch { return { sessions: [] }; } }
  private async write(file: RepositoryFile): Promise<void> { await mkdir(dirname(this.filePath), { recursive: true }); const temporary = `${this.filePath}.tmp`; await writeFile(temporary, JSON.stringify(file)); await rename(temporary, this.filePath); }
  private async locked<T>(operation: (file: RepositoryFile) => Promise<T> | T): Promise<T> { let result!: T; const previous = this.queue; let release!: () => void; this.queue = new Promise<void>((resolve) => { release = resolve; }); await previous; try { const file = await this.read(); result = await operation(file); await this.write(file); return result; } finally { release(); } }
  async createSession(input: CreateSessionInput): Promise<StoredSession> { return this.locked((file) => { if (file.sessions.some((session) => session.id === input.sessionId)) throw new Error("Session already exists"); const session = { id: input.sessionId, campaignId: input.campaignId, fixtureId: input.fixtureId, version: input.snapshot.version, snapshot: clone(input.snapshot), events: [], commandResults: {} }; file.sessions.push(session); return clone(session); }); }
  async getSession(sessionId: string): Promise<StoredSession | null> { const file = await this.read(); return clone(file.sessions.find((session) => session.id === sessionId) ?? null); }
  async appendEventsCas(input: AppendEventsCasInput): Promise<AppendResult> { return this.locked((file) => { const session = file.sessions.find((candidate) => candidate.id === input.sessionId); if (!session) throw new Error("Session not found"); const previous = session.commandResults[input.command.id]; if (previous) return { accepted: true, duplicate: true, session: clone(session), events: clone(previous) }; if (session.version !== input.expectedVersion) return { accepted: false, duplicate: false, session: clone(session), events: [] }; session.events.push(...clone(input.events)); session.snapshot = clone(input.snapshot); session.version = input.snapshot.version; session.commandResults[input.command.id] = clone(input.events); return { accepted: true, duplicate: false, session: clone(session), events: clone(input.events) }; }); }
  async getEventsAfter(sessionId: string, afterSequence: number): Promise<WorldEvent[]> { const session = await this.getSession(sessionId); return (session?.events ?? []).filter((event) => event.sequence > afterSequence); }
  async resetDemoSession(sessionId: string, fixtureId: string, snapshot: WorldSnapshot): Promise<StoredSession> { return this.locked((file) => { file.sessions = file.sessions.filter((session) => session.id !== sessionId); const session = { id: sessionId, campaignId: "demo-campaign", fixtureId, version: snapshot.version, snapshot: clone(snapshot), events: [], commandResults: {} }; file.sessions.push(session); return clone(session); }); }
}
