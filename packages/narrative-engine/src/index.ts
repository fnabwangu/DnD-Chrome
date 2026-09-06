export interface NarrativeBeat {
  id: string;
  threadId: string;
  purpose: string;
  protectedFacts: string[];
  eligibleLocations?: string[];
  eligibleActors?: string[];
  completed: boolean;
}

export interface NarrativeThread {
  id: string;
  title: string;
  beats: NarrativeBeat[];
}

export class NarrativeDirector {
  private threads: NarrativeThread[] = [];

  constructor(threads: NarrativeThread[] = []) {
    this.threads = structuredClone(threads);
  }

  getEligibleBeats(): NarrativeBeat[] {
    return this.threads.flatMap((t) => t.beats.filter((b) => !b.completed));
  }

  completeBeat(beatId: string): void {
    for (const t of this.threads) {
      for (const b of t.beats) {
        if (b.id === beatId) b.completed = true;
      }
    }
  }
}
