import type { CanonicalEvent } from "../schemas/src/event.schema";

export class EventLog {
  private readonly events: CanonicalEvent[] = [];

  append(event: CanonicalEvent): CanonicalEvent {
    this.events.push(event);
    return event;
  }

  all(): CanonicalEvent[] {
    return [...this.events];
  }
}
