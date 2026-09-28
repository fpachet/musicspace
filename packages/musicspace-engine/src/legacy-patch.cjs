// Compatibility boundary for workbench patches. No audio client is instantiated.
const { createSceneModel } = require("./musicspace-model");
const { createSpace, CENTER } = require("./space");
const clone = (value) => structuredClone(value);
const referenceKeys = ["anchor", "target", "carrier", "attached"];
const trajectoryFields = [
  "type",
  "vx",
  "vy",
  "bounce",
  "centerX",
  "centerY",
  "radius",
  "phase",
  "angularSpeed",
  "periodSeconds",
  "direction",
  "running",
  "displacementInducesRotation",
  "rotationDelta",
  "start",
  "end",
  "ax",
  "ay",
  "bx",
  "by",
  "speed",
  "showPath"
];
const constraintFields = [
  "type",
  "sources",
  "source",
  ...referenceKeys,
  "angle",
  "totalDistance",
  "product",
  "minDistance",
  "maxDistance",
  "distance",
  "restLength",
  "stiffness",
  "damping",
  "ratio",
  "x",
  "y",
  "offsetX",
  "offsetY",
  "centerAngle",
  "width"
];
function extraFields(value, fields) {
  const result = clone(value || {});
  for (const field of fields) delete result[field];
  return result;
}

function readPatch(patch) {
  const model = createSceneModel();
  if (!model.loadPatch(patch))
    throw new TypeError(
      model
        .validation()
        .filter((finding) => finding.level === "error")
        .map((finding) => finding.message)
        .join("\n")
    );
  return model.serializePatch();
}

/** Import geometry while retaining the original document in a serializable context. */
function importLegacyPatch(patch, options = {}) {
  const original = clone(patch);
  const normalized = readPatch(original);
  const objects = [...normalized.sources, ...normalized.movingObjects];
  // IDs are separate from user names, which can collide with package reserved IDs.
  const pointIds = Object.fromEntries([
    ["Listener", CENTER],
    ...objects.map((object, index) => [object.name, `point-${index}`])
  ]);
  const id = (name) => {
    if (!Object.hasOwn(pointIds, name)) throw new TypeError(`Unknown patch object: ${name}`);
    return pointIds[name];
  };
  const constraints = normalized.constraints.map(({ node: _node, sources, source, ...spec }, index) => {
    if (sources) spec.points = sources.map(id);
    if (source !== undefined) spec.point = id(source);
    for (const key of referenceKeys) if (spec[key] !== undefined) spec[key] = id(spec[key]);
    return { ...spec, id: `constraint-${index}` };
  });
  const points = objects.map((object) => {
    const point = { id: id(object.name), x: object.x, y: object.y };
    if (object.dynamics) point.dynamics = clone(object.dynamics);
    if (object.trajectory) {
      point.trajectory = clone(object.trajectory);
      delete point.trajectory.rotationDelta;
      for (const key of ["start", "end"])
        if (point.trajectory[key]?.type === "object") {
          point.trajectory[key].id = id(point.trajectory[key].name);
          delete point.trajectory[key].name;
        }
    }
    return point;
  });
  const scene = createSpace({
    center: { x: normalized.listener.x, y: normalized.listener.y },
    points,
    constraints,
    gravity: normalized.gravity || { x: 0, y: 0 },
    solver: options.solver ?? "propagation",
    // Match the workbench's default; createSpace itself defaults to preserve.
    centerMode: options.centerMode ?? "retarget"
  }).snapshot();
  return {
    scene,
    context: {
      version: 1,
      patch: original,
      pointIds,
      constraintIds: constraints.map((constraint) => constraint.id)
    }
  };
}

/** Export current geometry without discarding workbench metadata or unknown fields. */
function exportLegacyPatch(scene, context) {
  if (!context || context.version !== 1 || !context.pointIds || !Array.isArray(context.constraintIds))
    throw new TypeError("Expected a legacy patch context returned by importLegacyPatch.");
  // Validate both inputs without mutating either. Never let a broken binding
  // disappear just because the geometric engine has no use for it.
  readPatch(context.patch);
  const current = createSpace(scene).snapshot();
  if (current.constraints.some((constraint) => constraint.enabled === false))
    throw new TypeError(
      "Legacy patches cannot represent disabled constraints. Remove or enable them before export."
    );
  const patch = clone(context.patch);
  const oldObjects = new Map(
    [...(patch.sources || []), ...(patch.movingObjects || [])].map((p) => [p.name, p])
  );
  const namesById = new Map();
  for (const [name, id] of Object.entries(context.pointIds)) {
    if (namesById.has(id)) throw new TypeError(`Duplicate legacy point ID: ${id}`);
    namesById.set(id, name);
  }
  if (namesById.get(CENTER) !== "Listener") throw new TypeError("Invalid center mapping.");
  const usedNames = new Set(["Listener"]);
  const activeNames = new Map([[CENTER, "Listener"]]);
  for (const point of current.points) {
    const name = namesById.get(point.id) ?? point.id;
    if (usedNames.has(name)) throw new TypeError(`Duplicate exported object name: ${name}`);
    usedNames.add(name);
    activeNames.set(point.id, name);
  }
  const nameOf = (id) => {
    if (!activeNames.has(id)) throw new TypeError(`Unknown scene point: ${id}`);
    return activeNames.get(id);
  };
  patch.listener = { ...patch.listener, ...current.center };
  patch.sources = [];
  patch.movingObjects = [];
  for (const point of current.points) {
    const name = nameOf(point.id);
    const object = { ...clone(oldObjects.get(name) || {}), name, x: point.x, y: point.y };
    if (point.dynamics) object.dynamics = { ...object.dynamics, ...point.dynamics };
    else delete object.dynamics;
    if (point.trajectory) {
      object.trajectory = { ...extraFields(object.trajectory, trajectoryFields), ...clone(point.trajectory) };
      // Per-step rotation deltas are transient and recomputed on the next tick.
      delete object.trajectory.rotationDelta;
      for (const key of ["start", "end"])
        if (point.trajectory[key]) {
          object.trajectory[key] = {
            ...oldObjects.get(name)?.trajectory?.[key],
            ...clone(point.trajectory[key])
          };
          if (point.trajectory[key].type === "object") {
            object.trajectory[key].name = nameOf(point.trajectory[key].id);
            delete object.trajectory[key].id;
          } else delete object.trajectory[key].name;
        }
      patch.movingObjects.push(object);
    } else {
      delete object.trajectory;
      patch.sources.push(object);
    }
  }
  patch.constraints = current.constraints.map(({ id, enabled: _enabled, points, point, ...spec }) => {
    const index = context.constraintIds.indexOf(id);
    const old = index < 0 ? {} : context.patch.constraints[index];
    if (points) spec.sources = points.map(nameOf);
    if (point !== undefined) spec.source = nameOf(point);
    for (const key of referenceKeys) if (spec[key] !== undefined) spec[key] = nameOf(spec[key]);
    return { ...extraFields(old, constraintFields), ...spec };
  });
  if (patch.gravity || current.gravity.x || current.gravity.y)
    patch.gravity = { ...patch.gravity, ...current.gravity };
  // This catches deleted objects that still have audio/MIDI/mapping references.
  readPatch(patch);
  return patch;
}

module.exports = { importLegacyPatch, exportLegacyPatch };
