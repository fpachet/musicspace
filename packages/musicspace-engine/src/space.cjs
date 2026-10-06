const { createSceneModel } = require("./musicspace-model");
const { createClock } = require("./musicspace-clock");
const CENTER = "$center";
const EMPTY = "$musicspace-empty";
const FREE_BOUNDS = { left: -Infinity, top: -Infinity, right: Infinity, bottom: Infinity };
const clone = (value) => structuredClone(value);

function finite(value, label) {
  if (!Number.isFinite(value)) throw new TypeError(`${label} must be finite.`);
}
function identifier(id) {
  if (typeof id !== "string" || !id.trim() || [CENTER, EMPTY, "Listener"].includes(id))
    throw new TypeError(`Invalid or reserved id: ${id}`);
}
function coreId(id) {
  return id === CENTER ? "Listener" : id;
}
function publicId(id) {
  return id === "Listener" ? CENTER : id;
}
function constraintToCore(spec) {
  const { id: _id, enabled: _enabled, points, point, ...rest } = spec;
  if (points) rest.sources = points.map(coreId);
  if (point !== undefined) rest.source = coreId(point);
  for (const key of ["anchor", "target", "carrier", "attached"])
    if (rest[key] !== undefined) rest[key] = coreId(rest[key]);
  return rest;
}
function constraintFromCore(spec) {
  const { node: _node, sources, source, ...rest } = spec;
  if (sources) rest.points = sources.map(publicId);
  if (source !== undefined) rest.point = publicId(source);
  for (const key of ["anchor", "target", "carrier", "attached"])
    if (rest[key] !== undefined) rest[key] = publicId(rest[key]);
  return rest;
}
function trajectoryToCore(trajectory) {
  const result = clone(trajectory);
  for (const key of ["start", "end"]) {
    if (result[key]?.type === "object") {
      result[key].name = coreId(result[key].id);
      delete result[key].id;
    }
  }
  return result;
}
function trajectoryFromCore(trajectory) {
  const result = clone(trajectory);
  delete result.rotationDelta;
  for (const key of ["start", "end"]) {
    if (result[key]?.type === "object") {
      result[key].id = publicId(result[key].name);
      delete result[key].name;
    }
  }
  return result;
}
function references(spec) {
  return [
    ...(spec.points || []),
    ...["point", "anchor", "target", "carrier", "attached"].flatMap((key) =>
      spec[key] === undefined ? [] : [spec[key]]
    )
  ];
}

/** A facade over the shared engine. No renderer, audio output or automatic timer. */
function createSpace(initial = {}) {
  let model;
  let definition;
  let dragging = null;
  let pointsById = new Map();
  let activeConstraintIds = new Map();
  const subscribers = new Set();
  const clock = createClock();

  function install(input) {
    if (!input || typeof input !== "object" || Array.isArray(input))
      throw new TypeError("A scene must be an object.");
    const next = clone({
      version: 1,
      center: { x: 0, y: 0 },
      points: [],
      constraints: [],
      solver: "propagation",
      centerMode: "preserve",
      gravity: { x: 0, y: 0 },
      ...input
    });
    if (next.version !== 1) throw new TypeError("Unsupported scene version.");
    if (!["propagation", "xpbd"].includes(next.solver)) throw new TypeError("Unknown solver.");
    if (!["preserve", "retarget"].includes(next.centerMode)) throw new TypeError("Unknown center mode.");
    if (!Array.isArray(next.points) || !Array.isArray(next.constraints))
      throw new TypeError("points and constraints must be arrays.");
    const ids = new Set([CENTER]);
    for (const point of next.points) {
      identifier(point.id);
      if (ids.has(point.id)) throw new TypeError(`Duplicate point: ${point.id}`);
      ids.add(point.id);
      if (point.trajectory) {
        for (const key of [
          "vx",
          "vy",
          "centerX",
          "centerY",
          "radius",
          "phase",
          "angularSpeed",
          "periodSeconds",
          "speed"
        ])
          if (point.trajectory[key] !== undefined) finite(point.trajectory[key], `trajectory.${key}`);
        if (point.trajectory.direction !== undefined && ![1, -1].includes(point.trajectory.direction))
          throw new TypeError("Trajectory direction must be 1 or -1.");
      }
    }
    const constraintIds = new Set();
    for (const spec of next.constraints) {
      identifier(spec.id);
      if (constraintIds.has(spec.id)) throw new TypeError(`Duplicate constraint: ${spec.id}`);
      constraintIds.add(spec.id);
      if (spec.enabled !== undefined && typeof spec.enabled !== "boolean")
        throw new TypeError("enabled must be boolean.");
      for (const key of [
        "angle",
        "totalDistance",
        "product",
        "minDistance",
        "maxDistance",
        "distance",
        "restLength",
        "stiffness",
        "damping",
        "strength",
        "softening",
        "ratio",
        "x",
        "y",
        "offsetX",
        "offsetY",
        "centerAngle",
        "width"
      ])
        if (spec[key] !== undefined) finite(spec[key], `constraint.${key}`);
      if (["source", "sources", "node"].some((key) => key in spec))
        throw new TypeError("Use point/points in the public constraint API.");
      if (["angle", "distanceRatio", "separation"].includes(spec.type) && spec.points?.length !== 2)
        throw new TypeError(`${spec.type} needs exactly two points.`);
      const refs = references(spec);
      if (new Set(refs).size !== refs.length) throw new TypeError("Constraint endpoints must be distinct.");
      for (const id of refs) if (!ids.has(id)) throw new TypeError(`Unknown point: ${id}`);
    }
    // The application's patch loader requires a source. An isolated temporary
    // source lets the package support empty scenes and scenes containing only movers.
    const sources = next.points.filter((p) => !p.trajectory).map(({ id, ...p }) => ({ ...p, name: id }));
    const movers = next.points
      .filter((p) => p.trajectory)
      .map(({ id, ...p }) => ({
        ...p,
        name: id,
        trajectory: trajectoryToCore(p.trajectory)
      }));
    for (const p of next.points)
      for (const key of ["start", "end"])
        if (p.trajectory?.[key]?.type === "object" && !ids.has(p.trajectory[key].id))
          throw new TypeError(`Unknown trajectory endpoint: ${p.trajectory[key].id}`);
    const candidate = createSceneModel();
    const patch = {
      version: 1,
      listener: next.center,
      gravity: next.gravity,
      sources: sources.length ? sources : [{ name: EMPTY, x: 0, y: 0 }],
      movingObjects: movers,
      constraints: next.constraints.map(constraintToCore)
    };
    if (!candidate.loadPatch(patch))
      throw new TypeError(
        candidate
          .validation()
          .filter((f) => f.level === "error")
          .map((f) => f.message)
          .join("\n")
      );
    if (!sources.length) candidate.state.sources = [];
    const normalized = candidate.serializePatch().constraints;
    next.constraints = next.constraints.map((spec, i) => ({
      ...constraintFromCore(normalized[i]),
      id: spec.id,
      enabled: spec.enabled !== false
    }));
    candidate.state.constraints = candidate.state.constraints.filter((_, i) => next.constraints[i].enabled);
    candidate.setSolverMode(next.solver);
    candidate.state.listenerMode = next.centerMode;
    if (dragging && ids.has(dragging)) candidate.beginDrag(candidate.getObjectByName(coreId(dragging)));
    else dragging = null;
    model = candidate;
    definition = next;
    pointsById = new Map(entities().map((point) => [publicId(point.name), point]));
    const activeSpecs = next.constraints.filter((spec) => spec.enabled);
    activeConstraintIds = new Map(
      candidate.state.constraints.map((constraint, index) => [constraint, activeSpecs[index].id])
    );
  }
  function entities() {
    return [model.state.listener, ...model.state.sources, ...model.state.movingObjects];
  }
  function positions() {
    return entities().map((entity) => ({ id: publicId(entity.name), x: entity.x, y: entity.y }));
  }
  function entity(id) {
    const value = pointsById.get(id);
    if (!value) throw new TypeError(`Unknown point: ${id}`);
    return value;
  }
  function snapshot() {
    const patch = model.serializePatch();
    let activeIndex = 0;
    const constraints = definition.constraints.map((spec) =>
      spec.enabled
        ? {
            ...constraintFromCore(patch.constraints[activeIndex++]),
            id: spec.id,
            enabled: true
          }
        : clone(spec)
    );
    const points = [...patch.sources, ...patch.movingObjects].map(({ name, drawTrace: _trace, ...p }) => ({
      ...p,
      id: name,
      ...(p.trajectory ? { trajectory: trajectoryFromCore(p.trajectory) } : {})
    }));
    // serializePatch already owns all nested data. The transformed records below
    // can be returned directly without a second whole-scene clone.
    return {
      version: 1,
      center: { x: patch.listener.x, y: patch.listener.y },
      points,
      constraints,
      solver: model.getSolverMode(),
      centerMode: model.state.listenerMode,
      gravity: patch.gravity || { x: 0, y: 0 }
    };
  }
  function diagnostics() {
    const residuals = model.measureConstraintResiduals().map(({ constraint, measurement }) => ({
      id: activeConstraintIds.get(constraint),
      ...measurement
    }));
    const report = model.getLastPropagationReport();
    const hitStepCap = Boolean(report?.hitStepCap);
    const hitEntityCap = Boolean(report?.hitEntityCap);
    const propagationPaused = model.state.propagationPaused;
    return {
      satisfied: !residuals.length && !hitStepCap && !hitEntityCap && !propagationPaused,
      residuals,
      hitStepCap,
      hitEntityCap,
      propagationPaused,
      solver: model.getSolverMode()
    };
  }
  function publish(reason, before) {
    const after = positions();
    const beforeById = new Map(before.map((point) => [point.id, point]));
    const afterIds = new Set(after.map((point) => point.id));
    const changed = after.filter((point) => {
      const previous = beforeById.get(point.id);
      return !previous || previous.x !== point.x || previous.y !== point.y;
    });
    const removed = before.filter((point) => !afterIds.has(point.id)).map((point) => point.id);
    const event = { reason, positions: after, changed, removed, diagnostics: diagnostics() };
    // Each observer receives its own data; mutating it cannot change the engine.
    for (const listener of subscribers) listener(clone(event));
    return event;
  }
  function edit(reason, mutate) {
    const before = positions();
    const next = snapshot();
    mutate(next);
    install(next);
    return publish(reason, before);
  }
  function constraintIndex(scene, id) {
    const index = scene.constraints.findIndex((c) => c.id === id);
    if (index < 0) throw new TypeError(`Unknown constraint: ${id}`);
    return index;
  }
  install(initial);
  return {
    snapshot,
    positions,
    diagnostics,
    getPoint(id) {
      const p = entity(id);
      return { id, x: p.x, y: p.y };
    },
    onChange(listener) {
      if (typeof listener !== "function") throw new TypeError("Expected a function.");
      subscribers.add(listener);
      return () => subscribers.delete(listener);
    },
    addPoint(point) {
      return edit("addPoint", (s) => s.points.push(clone(point)));
    },
    updatePoint(id, changes) {
      if (id === CENTER) throw new TypeError("Use move(CENTER, x, y) to move the center.");
      return edit("updatePoint", (s) => {
        const i = s.points.findIndex((p) => p.id === id);
        if (i < 0) throw new TypeError(`Unknown point: ${id}`);
        s.points[i] = { ...s.points[i], ...clone(changes), id };
      });
    },
    removePoint(id) {
      if (id === CENTER) throw new TypeError("The center cannot be removed.");
      entity(id);
      return edit("removePoint", (s) => {
        // Freeze object-referenced shuttle endpoints at their last position.
        const position = s.points.find((p) => p.id === id);
        for (const p of s.points)
          for (const key of ["start", "end"])
            if (p.trajectory?.[key]?.type === "object" && p.trajectory[key].id === id)
              p.trajectory[key] = { type: "fixed", x: position.x, y: position.y };
        s.points = s.points.filter((p) => p.id !== id);
        s.constraints = s.constraints.filter((c) => !references(c).includes(id));
      });
    },
    addConstraint(spec) {
      return edit("addConstraint", (s) => s.constraints.push(clone(spec)));
    },
    updateConstraint(id, changes) {
      return edit("updateConstraint", (s) => {
        const i = constraintIndex(s, id);
        s.constraints[i] = { ...s.constraints[i], ...clone(changes), id };
      });
    },
    removeConstraint(id) {
      return edit("removeConstraint", (s) => s.constraints.splice(constraintIndex(s, id), 1));
    },
    move(id, x, y, { bounds = FREE_BOUNDS, skipPropagation = false } = {}) {
      finite(x, "x");
      finite(y, "y");
      if (bounds !== FREE_BOUNDS) {
        for (const key of ["left", "top", "right", "bottom"]) finite(bounds?.[key], `bounds.${key}`);
        if (bounds.left > bounds.right || bounds.top > bounds.bottom)
          throw new TypeError("Invalid bounds ordering.");
      }
      if (typeof skipPropagation !== "boolean") throw new TypeError("skipPropagation must be boolean.");
      const p = entity(id),
        before = positions();
      model.moveEntity(p, x, y, { bounds, skipPropagation });
      return publish("move", before);
    },
    resumePropagation() {
      const before = positions();
      model.resumePropagationAfterPausedDrag();
      return publish("resumePropagation", before);
    },
    beginDrag(id) {
      model.beginDrag(entity(id));
      dragging = id;
    },
    endDrag({ refine = true } = {}) {
      if (typeof refine !== "boolean") throw new TypeError("refine must be boolean.");
      const before = positions();
      const p = dragging ? entity(dragging) : null;
      model.endDrag();
      dragging = null;
      if (refine && p && model.getSolverMode() === "xpbd" && !model.state.propagationPaused)
        model.refineXpbdAfterDrag(p);
      return publish("endDrag", before);
    },
    solve(id = CENTER) {
      const p = entity(id),
        before = positions();
      model.enforceConstraints(p);
      return publish("solve", before);
    },
    step() {
      const before = positions();
      model.step();
      return publish("step", before);
    },
    advance(timestampMs) {
      finite(timestampMs, "timestampMs");
      const before = positions();
      const count = clock.advance(timestampMs, () => model.step());
      if (count) publish("advance", before);
      return count;
    },
    resetClock() {
      clock.reset();
    },
    configure(options) {
      const solver = options.solver === undefined ? model.state.solverMode : options.solver;
      const centerMode = options.centerMode === undefined ? model.state.listenerMode : options.centerMode;
      const gravity = options.gravity === undefined ? model.state.gravity : clone(options.gravity);
      if (!["propagation", "xpbd"].includes(solver)) throw new TypeError("Unknown solver.");
      if (!["preserve", "retarget"].includes(centerMode)) throw new TypeError("Unknown center mode.");
      finite(gravity?.x, "gravity.x");
      finite(gravity?.y, "gravity.y");
      const before = positions();
      // Runtime settings must preserve trajectory deltas, velocities, drag state
      // and paused propagation. Rebuilding a scene loses those transient values.
      model.setSolverMode(solver);
      model.state.listenerMode = centerMode;
      model.state.gravity = { x: gravity.x, y: gravity.y };
      return publish("configure", before);
    },
    restore(scene) {
      const before = positions();
      install(scene);
      model.endDrag();
      dragging = null;
      clock.reset();
      return publish("restore", before);
    }
  };
}
module.exports = { createSpace, CENTER };
