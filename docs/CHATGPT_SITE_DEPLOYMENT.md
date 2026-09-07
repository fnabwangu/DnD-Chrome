# ChatGPT Site Deployment

## Current contract

Deploy `@living-rpg/api` as the server-owned game gateway. A ChatGPT site, MCP host, and the standalone browser app are untrusted clients of this gateway.

The API uses the shared `GameApplication` service in `packages/application/src/index.ts`. It is the only adapter layer that reads the in-memory `TurnSession` for the current demo. Clients receive `GameViewState`, semantic scene data, and public or party-visible event summaries. They do not receive `WorldSnapshot`, `knownSecrets`, or `npcMemories`.

Use the `/api/site/*` routes for a site function or MCP tool adapter:

| Route | Method | Purpose |
| --- | --- | --- |
| `/api/site/view` | `GET` | Read `GameViewState` and current `SceneManifest`. |
| `/api/site/intent` | `POST` | Produce an `ActionProposal` without mutation. |
| `/api/site/actions` | `POST` | Submit a validated, versioned command. |
| `/api/site/events` | `GET` | Read visible events after `afterSequence`. |
| `/api/site/morning` | `POST` | Advance the demo clock. |

All site routes return `{ content: [{ type: "text", text }], structuredContent }`, so a host can continue play without rendering a widget. An interactive site should use `structuredContent` as read-only render data and refetch after every mutation or reconnect.

## Local run

```sh
pnpm install
pnpm --filter @living-rpg/api dev
pnpm --filter @living-rpg/web dev
```

The API binds to port `3001`; the web app binds to port `3000`. Configure the deployed web client with the public API origin rather than the development `localhost` constant before production release.

## Release TODOs

- [ ] Replace the singleton in-memory `GameApplication` with a database-backed, session-keyed repository and compare-and-swap event append.
- [ ] Authenticate site users, map users to viewer and actor permissions server-side, and remove client-selected actor authority.
- [ ] Publish an MCP server that maps `game.get_view`, `game.submit_intent`, `game.execute_action`, and `game.get_events` to these application methods with the host SDK.
- [ ] Register a `ui://living-rpg/game` resource and package the portable widget independently from the authority service.
- [ ] Add CSP, rate limits, allowed origins, structured error codes, observability, and persistent replay snapshots.
- [ ] Move the API origin to runtime configuration and add an environment-specific deployment manifest.
- [ ] Implement provider-backed voice only behind short-lived server-minted credentials; retain text and captions as the default fallback.