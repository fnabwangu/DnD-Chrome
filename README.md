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
