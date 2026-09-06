# Event Model

`WorldEvent` is immutable and sequenced per session. `EventLog` enforces contiguous sequences. `reduceWorld` is a pure reducer, and `replayWorld(initial, events)` reconstructs a snapshot without consulting the client or narrative prose.