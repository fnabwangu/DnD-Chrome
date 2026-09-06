export interface MemoryEntry {
  id: string;
  ownerId: string;
  sourceEventId: string;
  summary: string;
  importance: number;
}

export class MemoryStore {
  private readonly entries = new Map<string, MemoryEntry[]>();

  record(entry: MemoryEntry): void {
    const existing = this.entries.get(entry.ownerId) ?? [];
    this.entries.set(entry.ownerId, [...existing, entry]);
  }

  getForOwner(ownerId: string): MemoryEntry[] {
    return this.entries.get(ownerId) ?? [];
  }
}
