import type { Scene, SpaceOptions } from "./index";

/** Workbench JSON; geometry and output blocks are validated at runtime. */
export type LegacyPatch = Record<string, unknown>;
export interface LegacyPatchContext {
  version: 1;
  /** Independent copy preserving output bindings, display settings and unknown fields. */
  patch: LegacyPatch;
  /** Workbench object name to package point ID, including Listener -> CENTER. */
  pointIds: Record<string, string>;
  /** Constraint IDs in the original document's order. */
  constraintIds: string[];
}
export interface ImportedLegacyPatch {
  scene: Scene;
  context: LegacyPatchContext;
}
/** Uses workbench defaults (retarget center, propagation solver) unless overridden. */
export function importLegacyPatch(
  patch: LegacyPatch,
  options?: Pick<SpaceOptions, "solver" | "centerMode">
): ImportedLegacyPatch;
/** Throws for invalid geometry/bindings or disabled constraints, which legacy patches cannot represent. */
export function exportLegacyPatch(scene: Scene, context: LegacyPatchContext): LegacyPatch;
