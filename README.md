# Living RPG

An event-driven multiplayer RPG foundation. The first playable proof is **The Black Hart Inn**: player commands are resolved by the server, reduced into canonical state, and turned into narration, NPC memory, and news.

## Run

```sh
pnpm install
pnpm dev
```

Open `http://localhost:3000`. The API runs on `http://localhost:3001`.

Useful checks:

```sh
pnpm test
pnpm typecheck
pnpm validate:campaign
```

The current demo uses an in-memory event log so it boots without credentials or external services. PostgreSQL/Drizzle and WebSockets are extension points for the next phase; the authoritative command and event contracts do not live in the UI.