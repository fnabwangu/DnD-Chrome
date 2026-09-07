# Black Hart Render Contract

The authoritative flow is `intent -> versioned command -> rules engine -> canonical event -> reducer -> read-only projection`. The renderer, voice, audio, animation, and narrator layers may not mutate canonical state or invent game facts. Missing projected data is rendered as unknown or unavailable.

## Version 2

`SceneManifestV2` is validated by `@living-rpg/schemas` before it reaches the web renderer. It contains the fixed logical stage, map collision data, actor projections, camera, asset fallbacks, animation/audio cues, and capability state. Invalid manifests must be rejected rather than partially applied.

Black Hart uses a 1440 x 810 stage, 16 columns by 9 rows, 90-unit cells, top-left origin, and zero-based `{ col, row }` coordinates. A token is centered at `(col + 0.5) * 90, (row + 0.5) * 90`; distance is Manhattan and movement is cardinal. CSS scales the complete stage but never changes those values.

The versioned fixture is `content/campaigns/demo-campaign/snapshots/black-hart-render-v1.json`. Its deterministic roster starts Xavi at `{ col: 5, row: 6 }`, Matu at `{ col: 5, row: 7 }`, Mara at `{ col: 12, row: 6 }`, Captain Varro at `{ col: 9, row: 2 }`, the Hooded Stranger at `{ col: 4, row: 2 }`, Ash Raider at `{ col: 12, row: 3 }`, and Coin Raider at `{ col: 13, row: 4 }`.

## Renderer permissions

The renderer may invent decorative presentation details such as safe line breaks, fallback colors, particle positions, and animation easing. It may not invent identity, position, HP, conditions, inventory, faction, control authority, walkability, collision, range, line of sight, movement cost, dice, damage, outcomes, turn order, reactions, secrets, rewards, event order, or authorization.

WASD creates a preview only. Commit sends `MOVE_CHARACTER` with source, destination, path, and expected world version. The authority engine validates the cell, cardinal adjacency, collision, and version; the event reducer then applies `CHARACTER_MOVED`. The map never infers collision from pixels.

## Fallbacks

The local `DemoGameAdapter` uses the same `GameApplication` contract as the HTTP client and boots without credentials. Missing art uses the asset fallback color and initials tokens. Missing speech recognition leaves typed input active; missing speech synthesis leaves captions and the narrative feed active. Audio waits for explicit user gesture and may remain silent. A failed configured remote client falls back to the local demo with a visible status.

## Example projection

```json
{
  "version": "2",
  "sceneId": "location.black_hart.common_room",
  "worldVersion": 0,
  "layoutMode": "exploration",
  "camera": { "stageWidth": 1440, "stageHeight": 810, "fit": "contain", "minZoom": 1, "maxZoom": 1.4 },
  "actor": { "id": "xavi", "position": { "col": 5, "row": 6 }, "control": "player", "team": "party" }
}
```
