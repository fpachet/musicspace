import { createSpace } from "./vendor/musicspace-engine.mjs";
import { names } from "./constellation-model.mjs";

export const motors = ["motor-orbit", "motor-shuttle"];
export const springPairs = [
  ["Bass", "Body"],
  ["Body", "Air"],
  ["Air", "Wet"],
  ["Wet", "Depth"],
  ["Depth", "Rate"],
  ["Rate", "Pan"],
  ["Pan", "Resonance"],
  ["Resonance", "Cutoff"],
  ["Cutoff", "Dry"],
  ["Dry", "Bass"],
  [motors[0], "Bass"],
  [motors[0], "Cutoff"],
  [motors[1], "Air"],
  [motors[1], "Depth"]
];

// Motor energy is injected through public engine trajectories, never fake UI jitter.
export class LivingSprings {
  constructor(state, paths, settings = {}) {
    this.paths = paths;
    this.settings = { speed: 1, stiffness: 28, damping: 1.2, powered: true, ...settings };
    this.held = null;
    this.reseed(state);
  }

  reseed(state) {
    this.state = structuredClone(state);
    this.held = null;
    const { center: c, outerRadius: r } = state;
    this.orbitPath = { centerX: c.x - r * 0.52, centerY: c.y - r * 0.02, radius: r * 0.28 };
    this.shuttlePath = {
      start: { type: "fixed", x: c.x + r * 0.57, y: c.y - r * 0.67 },
      end: { type: "fixed", x: c.x + r * 0.35, y: c.y + r * 0.62 }
    };
    const points = names.map((name, i) => ({
      id: this.paths[name],
      x: state.controls[this.paths[name]].x,
      y: state.controls[this.paths[name]].y,
      dynamics: { mass: 0.8 + (i % 4) * 0.3, vx: 0, vy: 0 }
    }));
    points.push({
      id: motors[0],
      x: this.orbitPath.centerX + this.orbitPath.radius,
      y: this.orbitPath.centerY,
      trajectory: this.settings.powered ? this.orbitTrajectory(0) : { type: "free" }
    });
    points.push({
      id: motors[1],
      x: this.shuttlePath.start.x,
      y: this.shuttlePath.start.y,
      trajectory: this.settings.powered ? this.shuttleTrajectory(0, 1) : { type: "free" }
    });
    const constraints = names.map((name) => ({
      id: `range:${name}`,
      type: "radialLimit",
      point: this.paths[name],
      minDistance: state.innerRadius + 2,
      maxDistance: state.outerRadius - 2
    }));
    springPairs.forEach(([a, b], i) =>
      constraints.push({
        id: `spring-${i + 1}`,
        type: "spring",
        anchor: this.paths[a] ?? a,
        target: this.paths[b] ?? b,
        stiffness: this.settings.stiffness,
        damping: this.settings.damping
      })
    );
    // Unpowered motors are anchored, so the springs can settle around them.
    if (!this.settings.powered)
      for (const p of points.filter((point) => motors.includes(point.id)))
        constraints.push({ id: `pin:${p.id}`, type: "pin", target: p.id, x: p.x, y: p.y });
    this.space = createSpace({
      center: state.center,
      points,
      constraints,
      solver: "xpbd",
      centerMode: "preserve"
    });
  }

  orbitTrajectory(phase) {
    return {
      type: "rotation",
      ...this.orbitPath,
      phase,
      angularSpeed: ((Math.PI * 2) / (60 * 7.3)) * this.settings.speed
    };
  }
  shuttleTrajectory(phase, direction) {
    return { type: "shuttle", ...this.shuttlePath, phase, direction, speed: 0.0031 * this.settings.speed };
  }

  configure(changes) {
    this.release();
    const scene = this.space.snapshot();
    const wasPowered = this.settings.powered;
    Object.assign(this.settings, changes);
    for (const constraint of scene.constraints)
      if (constraint.type === "spring") {
        constraint.stiffness = this.settings.stiffness;
        constraint.damping = this.settings.damping;
      }
    scene.constraints = scene.constraints.filter((c) => !c.id.startsWith("pin:motor-"));
    for (const p of scene.points.filter((point) => motors.includes(point.id))) {
      if (!this.settings.powered) {
        p.trajectory = { type: "free" };
        p.dynamics = { mass: 1, vx: 0, vy: 0 };
        scene.constraints.push({ id: `pin:${p.id}`, type: "pin", target: p.id, x: p.x, y: p.y });
      } else if (p.id === motors[0]) {
        const phase = wasPowered
          ? p.trajectory.phase
          : Math.atan2(p.y - this.orbitPath.centerY, p.x - this.orbitPath.centerX);
        p.trajectory = this.orbitTrajectory(phase);
      } else {
        const { start, end } = this.shuttlePath;
        const dx = end.x - start.x,
          dy = end.y - start.y;
        const phase = wasPowered
          ? p.trajectory.phase
          : Math.max(0, Math.min(1, ((p.x - start.x) * dx + (p.y - start.y) * dy) / (dx * dx + dy * dy)));
        p.trajectory = this.shuttleTrajectory(phase, wasPowered ? p.trajectory.direction : 1);
      }
    }
    // One atomic authoring edit, preserving invariant targets and current velocities.
    this.space.restore(scene);
  }

  resolve(state, path, hold = true) {
    if (
      !path ||
      state.center.x !== this.state.center.x ||
      state.center.y !== this.state.center.y ||
      state.innerRadius !== this.state.innerRadius ||
      state.outerRadius !== this.state.outerRadius
    ) {
      this.reseed(state);
      return this.toOrbit();
    }
    if (hold && this.held !== path) {
      this.release();
      this.space.beginDrag(path);
      this.held = path;
    }
    const p = state.controls[path],
      c = state.center;
    const angle = Math.atan2(p.y - c.y, p.x - c.x);
    const r = Math.max(
      state.innerRadius + 2,
      Math.min(state.outerRadius - 2, Math.hypot(p.x - c.x, p.y - c.y))
    );
    this.space.move(path, c.x + Math.cos(angle) * r, c.y + Math.sin(angle) * r);
    return this.toOrbit(state);
  }
  release() {
    if (this.held) this.space.endDrag({ refine: false });
    this.held = null;
  }
  toOrbit(state = this.state) {
    const next = structuredClone(state);
    for (const p of this.space.positions())
      if (next.controls[p.id]) Object.assign(next.controls[p.id], { x: p.x, y: p.y });
    this.state = structuredClone(next);
    return next;
  }
  advance(timestamp) {
    this.space.advance(timestamp);
    return this.toOrbit();
  }
  snapshot() {
    return {
      scene: this.space.snapshot(),
      settings: { ...this.settings },
      orbitPath: structuredClone(this.orbitPath),
      shuttlePath: structuredClone(this.shuttlePath)
    };
  }
  restore(saved, state) {
    this.space.restore(saved.scene);
    this.settings = { ...saved.settings };
    this.orbitPath = structuredClone(saved.orbitPath);
    this.shuttlePath = structuredClone(saved.shuttlePath);
    this.state = structuredClone(state);
    this.held = null;
  }
}
