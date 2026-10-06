export const CENTER: "$center";
export type Solver = "propagation" | "xpbd";
export interface Position {
  x: number;
  y: number;
}
export interface PointPosition extends Position {
  id: string;
}
export interface Dynamics {
  mass?: number;
  vx?: number;
  vy?: number;
}
export type Endpoint = ({ type: "fixed" } & Position) | { type: "object"; id: string };
/** Legacy trajectory speeds are per 1/60 second step; angles are radians. */
export type Trajectory =
  | { type: "free" }
  | { type: "translation"; vx?: number; vy?: number; bounce?: boolean }
  | { type: "bounce"; vx?: number; vy?: number }
  | {
      type: "rotation";
      centerX?: number;
      centerY?: number;
      radius?: number;
      phase?: number;
      angularSpeed?: number;
    }
  | {
      type: "rotator";
      running?: boolean;
      periodSeconds?: number;
      direction?: 1 | -1;
      displacementInducesRotation?: boolean;
      phase?: number;
    }
  | {
      type: "shuttle";
      start?: Endpoint;
      end?: Endpoint;
      phase?: number;
      speed?: number;
      direction?: 1 | -1;
      showPath?: boolean;
    };
export interface Point extends PointPosition {
  dynamics?: Dynamics;
  trajectory?: Trajectory | null;
}
export interface ConstraintBase {
  id: string;
  enabled?: boolean;
}
export type Constraint = ConstraintBase &
  (
    | { type: "angle"; points: [string, string]; angle?: number }
    | { type: "sum"; points: string[]; totalDistance?: number }
    | { type: "product"; points: string[]; product?: number }
    | { type: "radialLimit"; point: string; minDistance: number; maxDistance: number }
    | { type: "fixedDistance"; anchor: string; target: string; distance: number }
    | {
        type: "spring";
        anchor: string;
        target: string;
        restLength?: number;
        stiffness?: number;
        damping?: number;
      }
    | {
        type: "gravitational";
        anchor: string;
        target: string;
        /** G in scene-distance³ / (mass × second²). Default 1,000,000; nonnegative. */
        strength?: number;
        /** Positive softening length in scene units. Default 10. */
        softening?: number;
      }
    | { type: "distanceRatio"; points: [string, string]; ratio: number }
    | { type: "pin"; target: string; x: number; y: number }
    | { type: "solid"; carrier: string; attached: string; offsetX?: number; offsetY?: number }
    | { type: "separation"; points: [string, string]; minDistance: number }
    | { type: "angleSector"; point: string; centerAngle: number; width: number }
  );
export interface SpaceOptions {
  version?: 1;
  center?: Position;
  points?: Point[];
  constraints?: Constraint[];
  solver?: Solver;
  centerMode?: "preserve" | "retarget";
  gravity?: Position;
}
export interface Scene extends Required<SpaceOptions> {}
export interface Residual {
  id: string;
  label: string;
  error: number;
  tolerance: number;
  unit: string;
}
export interface Diagnostics {
  satisfied: boolean;
  residuals: Residual[];
  hitStepCap: boolean;
  hitEntityCap: boolean;
  propagationPaused: boolean;
  solver: Solver;
}
export interface Change {
  reason: string;
  positions: PointPosition[];
  changed: PointPosition[];
  removed: string[];
  diagnostics: Diagnostics;
}
export interface MoveOptions {
  /** Bounds clamp the proposed position, not every point moved by propagation. */
  bounds?: { left: number; top: number; right: number; bottom: number };
  /** Move directly and pause propagation/dynamics until resumed or a normal move. */
  skipPropagation?: boolean;
}
export interface Space {
  /** Independent JSON-compatible snapshot, including invariant targets and velocities. */
  snapshot(): Scene;
  restore(scene: SpaceOptions): Change;
  positions(): PointPosition[];
  getPoint(id: string): PointPosition;
  diagnostics(): Diagnostics;
  /** Synchronous notification after a committed operation. Returns an unsubscribe function. */
  onChange(listener: (event: Change) => void): () => void;
  addPoint(point: Point): Change;
  /** Authoring edit; does not propagate. Use move for interactive displacement. */
  updatePoint(id: string, changes: Partial<Omit<Point, "id">>): Change;
  /** Also removes dependent constraints and freezes dependent shuttle endpoints. */
  removePoint(id: string): Change;
  addConstraint(constraint: Constraint): Change;
  updateConstraint(id: string, changes: Partial<Constraint>): Change;
  removeConstraint(id: string): Change;
  /** Propose a displacement and solve; defaults to unbounded coordinates. */
  move(id: string, x: number, y: number, options?: MoveOptions): Change;
  /** Resume after a paused edit, retargeting geometric constraints to the current layout. Spring rest lengths remain unchanged. */
  resumePropagation(): Change;
  beginDrag(id: string): void;
  /** Pass refine:false for a click/cancel that should not refine geometric XPBD. */
  endDrag(options?: { refine?: boolean }): Change;
  solve(id?: string): Change;
  /** Advance exactly 1/60 second, regardless of rendering frequency. */
  step(): Change;
  /** Host animation timestamp in milliseconds. At most 8 steps per call. First call primes the clock. */
  advance(timestampMs: number): number;
  resetClock(): void;
  configure(options: Pick<SpaceOptions, "solver" | "centerMode" | "gravity">): Change;
}
export function createSpace(options?: SpaceOptions): Space;
