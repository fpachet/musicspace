import { createSpace } from "./vendor/musicspace-engine.mjs";

// All geometry lives in the engine. Orbit supplies the parameter mapping and view.
export class OrbitMusicSpace {
  constructor(state, paths, settings = { balance: true, spring: false }) {
    this.paths = paths;
    this.settings = { ...settings };
    this.held = null;
    this.sweeping = false;
    this.reseed(state);
  }

  reseed(state) {
    this.state = structuredClone(state);
    this.held = null;
    this.sweeping = false;
    const points = Object.values(state.controls).map(({ path: id, x, y }) => ({ id, x, y }));
    const constraints = points.map(({ id }) => ({
      id: `range:${id}`,
      type: "radialLimit",
      point: id,
      minDistance: state.innerRadius,
      maxDistance: state.outerRadius
    }));
    if (this.settings.balance)
      constraints.push({
        id: "balance",
        type: "sum",
        points: [this.paths.Dry, this.paths.Wet],
        totalDistance: state.innerRadius + state.outerRadius
      });
    if (this.settings.spring)
      constraints.push({
        id: "spring",
        type: "spring",
        anchor: this.paths.Cutoff,
        target: this.paths.Resonance,
        stiffness: 22,
        damping: 2.8
      });
    this.space = createSpace({ center: state.center, points, constraints, centerMode: "preserve" });
  }

  configure(settings, state) {
    Object.assign(this.settings, settings);
    this.reseed(state);
    // Turning balance on keeps Dry where the user put it and adjusts Wet.
    return this.resolve(state, this.paths.Dry, false);
  }

  resolve(state, path, hold = true) {
    if (
      !path ||
      state.innerRadius !== this.state.innerRadius ||
      state.outerRadius !== this.state.outerRadius ||
      state.center.x !== this.state.center.x ||
      state.center.y !== this.state.center.y
    ) {
      this.reseed(state);
      path = this.paths.Dry;
    }
    if (hold && this.held !== path) {
      if (this.held) this.space.endDrag({ refine: false });
      this.space.beginDrag(path);
      this.held = path;
    }
    const point = state.controls[path];
    // Clamp the user's proposal to the same annulus used by Orbit's value map.
    const dx = point.x - state.center.x;
    const dy = point.y - state.center.y;
    const radius = Math.hypot(dx, dy);
    const bounded = Math.max(state.innerRadius, Math.min(state.outerRadius, radius));
    this.space.move(
      path,
      state.center.x + (radius ? dx / radius : 1) * bounded,
      state.center.y + (radius ? dy / radius : 0) * bounded
    );
    return this.toOrbit(state);
  }

  release() {
    if (this.held) this.space.endDrag({ refine: false });
    this.held = null;
  }

  toOrbit(state = this.state) {
    const next = structuredClone(state);
    for (const point of this.space.positions()) {
      if (next.controls[point.id]) Object.assign(next.controls[point.id], { x: point.x, y: point.y });
    }
    this.state = structuredClone(next);
    return next;
  }

  sweep(enabled) {
    this.release();
    const id = this.paths.Cutoff;
    if (enabled) {
      const point = this.space.getPoint(id);
      const center = this.state.center;
      const angle = Math.atan2(point.y - center.y, point.x - center.x);
      const endpoint = (r) => ({
        type: "fixed",
        x: center.x + Math.cos(angle) * r,
        y: center.y + Math.sin(angle) * r
      });
      const startR = this.state.innerRadius + 0.15 * (this.state.outerRadius - this.state.innerRadius);
      const endR = this.state.innerRadius + 0.9 * (this.state.outerRadius - this.state.innerRadius);
      const radius = Math.hypot(point.x - center.x, point.y - center.y);
      this.space.updatePoint(id, {
        trajectory: {
          type: "shuttle",
          start: endpoint(startR),
          end: endpoint(endR),
          phase: Math.max(0, Math.min(1, (radius - startR) / (endR - startR))),
          speed: 0.003,
          direction: 1
        }
      });
    } else {
      this.space.updatePoint(id, { trajectory: null, dynamics: { mass: 1, vx: 0, vy: 0 } });
    }
    this.sweeping = enabled;
    this.space.resetClock();
  }

  advance(timestamp) {
    if (!this.settings.spring && !this.sweeping) return null;
    this.space.advance(timestamp);
    return this.toOrbit();
  }

  snapshot() {
    return { scene: this.space.snapshot(), settings: { ...this.settings }, sweeping: this.sweeping };
  }

  restore(snapshot, state) {
    const space = createSpace(snapshot.scene);
    const ids = space
      .positions()
      .map(({ id }) => id)
      .filter((id) => id !== "$center")
      .sort();
    if (JSON.stringify(ids) !== JSON.stringify(Object.keys(state.controls).sort())) {
      throw new Error("This scene does not match the four Faust controls.");
    }
    this.space = space;
    this.settings = { ...snapshot.settings };
    this.sweeping = snapshot.sweeping === true;
    this.state = structuredClone(state);
    this.held = null;
    this.space.resetClock();
  }
}
