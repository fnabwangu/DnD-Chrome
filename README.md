# living-rpg (DnD-Chrome)

This repository is now structured as a **TypeScript monorepo** for a web-first, AI-moderated, turn-based RPG, with a Chrome extension as an optional companion.

## Architecture baseline

Implemented top-level monorepo scaffold:

- `apps/web` (primary game UI runtime)
- `apps/api` (HTTP/action gateway)
- `apps/realtime` (authoritative multiplayer session service)
- `packages/schemas` (shared command/event language)
- `packages/rules-engine` (deterministic authority)
- `packages/event-engine` (canonical event log)
- `packages/ai-orchestrator` (intent parsing + narration)
- `packages/domain`, `packages/turn-engine`, `packages/npc-engine`, `packages/media-engine`
- `content/campaigns/demo-campaign`
- `tests/unit`

## Enforced game-state boundary

The repository now follows this rule in code:

`PLAYER/NPC INTENT -> (optional AI parsing) -> STRUCTURED COMMAND -> RULES/AUTHORITY ENGINE -> CANONICAL EVENT -> NARRATION`

The LLM/narrator does **not** mutate canonical state directly.

## Minimal vertical slice in code

Implemented pipeline components:

- `packages/ai-orchestrator/IntentParser.ts`
- `packages/rules-engine/src/AuthorityEngine.ts`
- `packages/event-engine/EventLog.ts`
- `apps/api/src/routes/actions.ts`

These provide:

- intent text to structured command parsing (supported: fireball to grid point)
- deterministic command execution in authority engine
- canonical event emission (`SPELL_CAST`, `DAMAGE_APPLIED`)
- narration generated only after canonical event creation

## Development commands

- `npm run test`
- `npm run typecheck`

The original playable proof is **The Black Hart Inn**. It uses an in-memory event log and can boot without credentials or external services.

Additional demo commands:

```sh
pnpm dev
pnpm validate:campaign
pnpm demo:reset
```

## ChatGPT site deployment

The demo now has a shared `@living-rpg/application` authority facade. Both the web client and a hosted site integration should use the API projection routes; neither should receive or store the raw world snapshot.

- `GET /api/site/view?viewerId=xavi` returns concise model text plus `structuredContent: GameViewState`.
- `POST /api/site/intent` accepts `{ actorId, text, sessionId? }` and returns an ActionProposal only. It does not change the world.
- `POST /api/site/actions` accepts a versioned shared Command and returns committed visible events plus a refreshed GameViewState.
- `GET /api/site/events?afterSequence=0` supports reconnect/gap recovery.
- `POST /api/site/morning` advances the credential-free demo clock and returns a refreshed projection.

See [docs/CHATGPT_SITE_DEPLOYMENT.md](docs/CHATGPT_SITE_DEPLOYMENT.md) for the integration contract and release checklist.
