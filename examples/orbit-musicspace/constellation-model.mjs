import { createSpace } from "./vendor/musicspace-engine.mjs";

export const names = ["Bass", "Body", "Air", "Dry", "Wet", "Cutoff", "Resonance", "Rate", "Depth", "Pan"];
export const palette = [
  "#94dbbd",
  "#94dbbd",
  "#94dbbd",
  "#8dbbd8",
  "#8dbbd8",
  "#edb59b",
  "#edb59b",
  "#c5ace8",
  "#c5ace8",
  "#e1ce91"
];

// Titles describe geometry where the rule is not directly a relation in parameter units.
export const relations = [
  {
    id: "mix",
    number: "01",
    title: "Voice balance",
    detail: "Bass + Body + Air = 1",
    type: "sum",
    names: ["Bass", "Body", "Air"],
    color: "#94dbbd",
    symbol: "Σ"
  },
  {
    id: "blend",
    number: "02",
    title: "Dry / wet balance",
    detail: "Dry + Wet = 1",
    type: "sum",
    names: ["Dry", "Wet"],
    color: "#8dbbd8",
    symbol: "Σ"
  },
  {
    id: "filter",
    number: "03",
    title: "Filter linkage",
    detail: "Cutoff ↔ Resonance · fixed distance",
    type: "fixedDistance",
    names: ["Cutoff", "Resonance"],
    color: "#edb59b",
    symbol: "↔"
  },
  {
    id: "pulse",
    number: "04",
    title: "Pulse proportion",
    detail: "Rate / Depth · radial distance ratio",
    type: "distanceRatio",
    names: ["Rate", "Depth"],
    color: "#c5ace8",
    symbol: ":"
  },
  {
    id: "voices",
    number: "05",
    title: "Voice angle",
    detail: "Bass ∠ Body · constant angle",
    type: "angle",
    names: ["Bass", "Body"],
    color: "#94dbbd",
    symbol: "∠"
  },
  {
    id: "space",
    number: "06",
    title: "Make room",
    detail: "Body ↔ Cutoff · minimum separation",
    type: "separation",
    names: ["Body", "Cutoff"],
    color: "#a9c4c0",
    symbol: "≥"
  },
  {
    id: "air-spring",
    number: "07",
    title: "Air → filter spring",
    detail: "Air ∿ Cutoff · elastic distance",
    type: "spring",
    names: ["Air", "Cutoff"],
    color: "#e5b1bd",
    symbol: "∿"
  },
  {
    id: "pan-spring",
    number: "08",
    title: "Pulse → pan spring",
    detail: "Depth ∿ Pan · elastic distance",
    type: "spring",
    names: ["Depth", "Pan"],
    color: "#e1ce91",
    symbol: "∿"
  },
  {
    id: "pan-sector",
    number: "09",
    title: "Pan corridor",
    detail: "Pan stays inside an angular sector",
    type: "angleSector",
    names: ["Pan"],
    color: "#e1ce91",
    symbol: "∠"
  }
];

export class Constellation {
  constructor(state, paths) {
    this.paths = paths;
    this.disabled = new Set();
    this.held = null;
    this.reseed(state);
  }

  reseed(state) {
    this.state = structuredClone(state);
    this.held = null;
    const points = Object.values(state.controls).map(({ path: id, x, y }) => ({ id, x, y }));
    const constraints = points.map(({ id }) => ({
      id: `range:${id}`,
      type: "radialLimit",
      point: id,
      minDistance: state.innerRadius,
      maxDistance: state.outerRadius
    }));
    for (const relation of relations) {
      const ids = relation.names.map((name) => this.paths[name]);
      const [a, b] = ids.map((id) => state.controls[id]);
      const base = { id: relation.id, type: relation.type, enabled: !this.disabled.has(relation.id) };
      if (relation.type === "sum")
        Object.assign(base, {
          points: ids,
          totalDistance: ids.length * state.outerRadius - (state.outerRadius - state.innerRadius)
        });
      if (relation.type === "fixedDistance")
        Object.assign(base, { anchor: ids[0], target: ids[1], distance: Math.hypot(b.x - a.x, b.y - a.y) });
      if (relation.type === "distanceRatio")
        Object.assign(base, { points: ids, ratio: this.radius(a) / this.radius(b) });
      if (relation.type === "angle") Object.assign(base, { points: ids });
      if (relation.type === "separation")
        Object.assign(base, { points: ids, minDistance: Math.hypot(b.x - a.x, b.y - a.y) * 0.7 });
      if (relation.type === "spring")
        Object.assign(base, { anchor: ids[0], target: ids[1], stiffness: 14, damping: 3 });
      if (relation.type === "angleSector")
        Object.assign(base, {
          point: ids[0],
          centerAngle: Math.atan2(a.y - state.center.y, a.x - state.center.x),
          width: Math.PI / 2
        });
      constraints.push(base);
    }
    this.space = createSpace({
      center: state.center,
      points,
      constraints,
      solver: "xpbd",
      centerMode: "preserve"
    });
  }

  radius(point) {
    return Math.hypot(point.x - this.state.center.x, point.y - this.state.center.y);
  }

  resolve(state, path, hold = true) {
    if (
      !path ||
      state.center.x !== this.state.center.x ||
      state.center.y !== this.state.center.y ||
      state.outerRadius !== this.state.outerRadius ||
      state.innerRadius !== this.state.innerRadius
    ) {
      this.reseed(state);
      return this.toOrbit(state);
    }
    if (hold && this.held !== path) {
      this.release();
      this.space.beginDrag(path);
      this.held = path;
    }
    const p = state.controls[path],
      c = state.center;
    const angle = Math.atan2(p.y - c.y, p.x - c.x);
    const radius = Math.max(
      state.innerRadius + 1,
      Math.min(state.outerRadius - 1, Math.hypot(p.x - c.x, p.y - c.y))
    );
    this.space.move(path, c.x + Math.cos(angle) * radius, c.y + Math.sin(angle) * radius);
    return this.toOrbit(state);
  }

  release() {
    if (this.held) this.space.endDrag({ refine: false });
    this.held = null;
  }

  toggle(id) {
    if (!relations.some((r) => r.id === id)) throw new Error("Unknown relation");
    const enabled = this.disabled.has(id);
    if (enabled) this.disabled.delete(id);
    else this.disabled.add(id);
    this.space.updateConstraint(id, { enabled });
    this.space.solve();
    return this.toOrbit();
  }

  toOrbit(state = this.state) {
    const next = structuredClone(state);
    for (const point of this.space.positions())
      if (next.controls[point.id]) Object.assign(next.controls[point.id], { x: point.x, y: point.y });
    this.state = structuredClone(next);
    return next;
  }

  snapshot() {
    return this.space.snapshot();
  }
  restore(scene, state) {
    const candidate = createSpace(scene);
    const ids = candidate
      .positions()
      .map((p) => p.id)
      .filter((id) => id !== "$center")
      .sort();
    if (JSON.stringify(ids) !== JSON.stringify(Object.values(this.paths).sort()))
      throw new Error("Unexpected controls");
    this.space = candidate;
    this.state = structuredClone(state);
    this.disabled = new Set(scene.constraints.filter((c) => c.enabled === false).map((c) => c.id));
    this.held = null;
  }
}
