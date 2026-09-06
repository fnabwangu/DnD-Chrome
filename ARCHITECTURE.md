# Architecture

The authority boundary is:

`intent -> command -> schema validation -> rules engine -> canonical event -> reducer -> presentation`

`TurnSession` owns the current snapshot and ordered `EventLog`. The rules engine is deterministic and rejects stale versions before resolving commands. The client submits commands and renders responses; it never writes world state.

Canonical state, narrative state, and presentation state are separate. AI adapters will receive structured context and may propose or dramatize actions, but only the rules engine may produce canonical events.

The first slice uses an in-memory repository deliberately. A database adapter can persist the same event shape, and a WebSocket adapter can broadcast its sequence to multiple clients.