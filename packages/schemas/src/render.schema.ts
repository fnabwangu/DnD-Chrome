import { z } from "zod";

export const GridCellSchema = z.object({ col: z.number().int().min(0).max(15), row: z.number().int().min(0).max(8) });
export type GridCell = z.infer<typeof GridCellSchema>;

export const MapDefinitionSchema = z.object({
  id: z.string(),
  logicalWidth: z.literal(1440),
  logicalHeight: z.literal(810),
  columns: z.literal(16),
  rows: z.literal(9),
  cellSize: z.literal(90),
  blockedCells: z.array(GridCellSchema),
  entrances: z.array(GridCellSchema),
  interactiveAreas: z.array(z.object({ id: z.string(), label: z.string(), kind: z.enum(["EXIT", "INSPECT", "DIALOGUE"]), cells: z.array(GridCellSchema) }))
});
export type MapDefinition = z.infer<typeof MapDefinitionSchema>;

export const SceneActorProjectionSchema = z.object({
  id: z.string(), name: z.string(), control: z.enum(["player", "npc"]), team: z.string(), position: GridCellSchema,
  facing: z.enum(["up", "left", "right", "down"]), hp: z.number().int().nonnegative().optional(), maxHp: z.number().int().positive().optional(),
  alive: z.boolean(), portraitAssetId: z.string(), tokenAssetId: z.string(), accessibleName: z.string(), status: z.string(), selected: z.boolean(), targetable: z.boolean(), visible: z.boolean()
});
export type SceneActorProjection = z.infer<typeof SceneActorProjectionSchema>;

export const RenderAssetManifestSchema = z.object({ version: z.literal(1), assets: z.record(z.object({ kind: z.enum(["background", "portrait", "token", "audio"]), src: z.string().optional(), fallback: z.string() })) });
export type RenderAssetManifest = z.infer<typeof RenderAssetManifestSchema>;

export const CameraDefinitionSchema = z.object({ stageWidth: z.literal(1440), stageHeight: z.literal(810), fit: z.enum(["contain", "cover"]), minZoom: z.number().positive(), maxZoom: z.number().positive() });
export type CameraDefinition = z.infer<typeof CameraDefinitionSchema>;

export const AnimationCueSchema = z.object({ eventId: z.string(), type: z.enum(["MOVE", "REVEAL", "ATTACK", "DAMAGE", "REACTION", "DOWN", "TIME", "DIALOGUE"]), actorId: z.string().optional(), targetId: z.string().optional(), path: z.array(GridCellSchema).optional() });
export type AnimationCue = z.infer<typeof AnimationCueSchema>;

export const AudioCueSchema = z.object({ id: z.string(), eventId: z.string().optional(), assetId: z.string(), captions: z.string().optional() });
export type AudioCue = z.infer<typeof AudioCueSchema>;

export const RendererCapabilityStateSchema = z.object({ background: z.boolean(), portraits: z.boolean(), tokens: z.boolean(), audio: z.boolean(), speechRecognition: z.boolean(), speechSynthesis: z.boolean(), remote: z.boolean() });
export type RendererCapabilityState = z.infer<typeof RendererCapabilityStateSchema>;

export const SceneManifestV2Schema = z.object({
  version: z.literal("2"), sceneId: z.literal("location.black_hart.common_room"), worldVersion: z.number().int().nonnegative(), layoutMode: z.enum(["exploration", "dialogue", "combat"]),
  map: MapDefinitionSchema, camera: CameraDefinitionSchema, actors: z.array(SceneActorProjectionSchema), assets: RenderAssetManifestSchema,
  animationCues: z.array(AnimationCueSchema), audioCues: z.array(AudioCueSchema), capabilities: RendererCapabilityStateSchema
});
export type SceneManifestV2 = z.infer<typeof SceneManifestV2Schema>;

export function worldToScreen(cell: GridCell): { x: number; y: number } { return { x: (cell.col + 0.5) * 90, y: (cell.row + 0.5) * 90 }; }
export function manhattanDistance(a: GridCell, b: GridCell): number { return Math.abs(a.col - b.col) + Math.abs(a.row - b.row); }
