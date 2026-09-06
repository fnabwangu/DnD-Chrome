import type { CanonicalEvent } from "../schemas/src/event.schema";

export type PresentationCue = {
  channel: "audio" | "ui" | "cinematic";
  cue: string;
};

export type PresentationState = {
  cues: PresentationCue[];
};

export function projectPresentationState(event: CanonicalEvent): PresentationState {
  if (event.type === "DAMAGE_APPLIED" && event.consequence === "DEFEATED") {
    return {
      cues: [
        { channel: "audio", cue: "enemy_defeated_sting" },
        { channel: "ui", cue: "show_defeat_banner" }
      ]
    };
  }

  if (event.type === "SPELL_CAST") {
    return {
      cues: [
        { channel: "audio", cue: "spell_cast_whoosh" },
        { channel: "cinematic", cue: "focus_caster" }
      ]
    };
  }

  return { cues: [] };
}
