export interface TelemetryEvent {
  name: string;
  timestamp: string;
  sessionId?: string;
  properties?: Record<string, unknown>;
}

export class TelemetryLogger {
  private events: TelemetryEvent[] = [];

  log(name: string, properties?: Record<string, unknown>, sessionId?: string): void {
    this.events.push({
      name,
      timestamp: new Date().toISOString(),
      sessionId,
      properties
    });
  }

  getEvents(): TelemetryEvent[] {
    return [...this.events];
  }
}
