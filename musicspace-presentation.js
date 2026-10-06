// Plain workbench records and pure geometry helpers. No model, graph or solver.
(function exposePresentation(global) {
  const isNode = typeof module === "object" && module.exports;
  const constants = isNode ? require("./musicspace-constants") : global.MusicSpaceConstants;
  const patchApi = isNode ? require("./musicspace-patch") : global.MusicSpacePatch;
  const trajectoryApi = isNode ? require("./musicspace-trajectories") : global.MusicSpaceTrajectories;
  const {
    MIN_DISTANCE,
    DEFAULT_SOLVER_MODE,
    LISTENER_MODE_RETARGET,
    SOLVER_MODE_XPBD,
    MAX_PROPAGATION_STEPS,
    MAX_ENTITY_PROPAGATION_COUNT
  } = constants;
  function createPresentation(options = {}) {
    const state = {
      listener: null,
      sources: [],
      movingObjects: [],
      constraints: [],
      listenerMode: LISTENER_MODE_RETARGET,
      solverMode: DEFAULT_SOLVER_MODE,
      gravity: { x: 0, y: 0 },
      draggedEntity: null,
      lastPropagationReport: null,
      propagationPaused: false
    };
    let patchData = {};
    let lastValidation = [];
    const { validatePatch } = patchApi.createPatchTools(options);
    const { normalizeTrajectory, resolveTrajectoryEndpoint } = trajectoryApi.createTrajectories({
      getListener: () => state.listener,
      getObjectByName
    });
    const isKind = (object, kind) => object?.kind === kind;
    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
    // The schema describes display references and editable fields. It contains
    // no propagation rules. Defaults/recapture measure the current geometry only.
    const midpoint = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
    const sourceAngle = (c) => Math.atan2(c.source.y - c.listener.y, c.source.x - c.listener.x);
    const pairAngle = (c) =>
      Math.atan2(c.b.y - c.listener.y, c.b.x - c.listener.x) -
      Math.atan2(c.a.y - c.listener.y, c.a.x - c.listener.x);
    const sumDistance = (c) =>
      c.sources.reduce((sum, p) => sum + Math.hypot(p.x - c.listener.x, p.y - c.listener.y), 0);
    const productDistance = (c) =>
      c.sources.reduce((product, p) => product * distanceBetween(p, c.listener), 1);
    const pairNode = (c) => midpoint(c.a, c.b);
    const anchoredNode = (c) => midpoint(c.anchor, c.target);
    const radialNode = (c) => midpoint(c.listener, c.source);
    const pinNode = (c) => ({ x: c.target.x + 34, y: c.target.y - 34 });
    const linkNode = (c) => midpoint(c.carrier, c.attached);
    // params: creation argument order; links: patch reference keys -> record fields;
    // fields: patch scalar keys -> record fields. Node layout is display-only.
    const schemas = {
      AngleConstraint: {
        type: "angle",
        label: "Angle",
        color: "#2563eb",
        params: ["listener", "a", "b"],
        links: { sources: ["a", "b"] },
        fields: { angle: "angle" },
        defaults: (c) => ({ angle: pairAngle(c) }),
        capture: (c) => ({ angle: pairAngle(c) }),
        node: pairNode,
        layout: pairNode
      },
      SumConstraint: {
        type: "sum",
        label: "Sum",
        color: "#059669",
        params: ["listener", "sources"],
        links: { sources: "sources" },
        fields: { totalDistance: "totalDistance" },
        defaults: (c) => ({ totalDistance: sumDistance(c) }),
        capture: (c) => ({ totalDistance: sumDistance(c) }),
        node: (c) => ({ x: c.listener.x + 90, y: c.listener.y })
      },
      ProductConstraint: {
        type: "product",
        label: "Product",
        glyph: "π",
        color: "#7c3aed",
        params: ["listener", "sources"],
        links: { sources: "sources" },
        fields: { product: "product" },
        defaults: (c) => ({ product: productDistance(c) }),
        capture: (c) => ({ product: productDistance(c) }),
        node: (c) => ({ x: c.listener.x - 90, y: c.listener.y })
      },
      RadialLimitConstraint: {
        type: "radialLimit",
        label: "Limit",
        color: "#ea580c",
        params: ["listener", "source", "minDistance", "maxDistance"],
        links: { source: "source" },
        fields: { minDistance: "minDistance", maxDistance: "maxDistance" },
        node: (c) => ({ x: c.source.x, y: c.source.y - 56 }),
        layout: radialNode
      },
      FixedDistanceConstraint: {
        type: "fixedDistance",
        label: "Distance",
        color: "#0f766e",
        params: ["anchor", "target", "distance"],
        links: { anchor: "anchor", target: "target" },
        fields: { distance: "distance" },
        defaults: (c) => ({ distance: distanceBetween(c.anchor, c.target) }),
        capture: (c) => ({ distance: distanceBetween(c.anchor, c.target) }),
        node: anchoredNode,
        layout: anchoredNode
      },
      GravitationalConstraint: {
        type: "gravitational",
        label: "Gravity",
        glyph: "G",
        color: "#4f46e5",
        params: ["anchor", "target", "strength", "softening"],
        links: { anchor: "anchor", target: "target" },
        fields: { strength: "strength", softening: "softening" },
        defaults: () => ({ strength: 1000000, softening: 10 }),
        node: anchoredNode,
        layout: anchoredNode
      },
      SpringConstraint: {
        type: "spring",
        label: "Spring",
        glyph: "S",
        color: "#be185d",
        params: ["anchor", "target", "restLength", "stiffness", "damping"],
        links: { anchor: "anchor", target: "target" },
        fields: { restLength: "restLength", stiffness: "stiffness", damping: "damping" },
        defaults: (c) => ({
          restLength: Math.hypot(c.target.x - c.anchor.x, c.target.y - c.anchor.y),
          stiffness: 40,
          damping: 2
        }),
        capture: (c) => ({ restLength: Math.hypot(c.target.x - c.anchor.x, c.target.y - c.anchor.y) }),
        node: anchoredNode,
        layout: anchoredNode
      },
      DistanceRatioConstraint: {
        type: "distanceRatio",
        label: "Ratio",
        color: "#9333ea",
        params: ["listener", "a", "b", "ratio"],
        links: { sources: ["a", "b"] },
        fields: { ratio: "ratio" },
        defaults: (c) => ({ ratio: distanceBetween(c.a, c.listener) / distanceBetween(c.b, c.listener) }),
        capture: (c) => ({ ratio: distanceBetween(c.a, c.listener) / distanceBetween(c.b, c.listener) }),
        node: pairNode,
        layout: pairNode
      },
      PinConstraint: {
        type: "pin",
        label: "Pin",
        color: "#475569",
        params: ["target", "fixedX", "fixedY"],
        links: { target: "target" },
        fields: { x: "fixedX", y: "fixedY" },
        defaults: (c) => ({ fixedX: c.target.x, fixedY: c.target.y }),
        capture: (c) => ({ fixedX: c.target.x, fixedY: c.target.y }),
        node: pinNode,
        layout: pinNode
      },
      SolidAttachmentConstraint: {
        type: "solid",
        label: "Link",
        color: "#0369a1",
        params: ["carrier", "attached", "offsetX", "offsetY"],
        links: { carrier: "carrier", attached: "attached" },
        fields: { offsetX: "offsetX", offsetY: "offsetY" },
        defaults: (c) => ({ offsetX: c.attached.x - c.carrier.x, offsetY: c.attached.y - c.carrier.y }),
        capture: (c) => ({ offsetX: c.attached.x - c.carrier.x, offsetY: c.attached.y - c.carrier.y }),
        node: linkNode,
        layout: linkNode
      },
      MinimumSeparationConstraint: {
        type: "separation",
        label: "Separate",
        color: "#be123c",
        params: ["a", "b", "minDistance"],
        links: { sources: ["a", "b"] },
        fields: { minDistance: "minDistance" },
        defaults: () => ({ minDistance: 80 }),
        capture: (c) => ({ minDistance: Math.max(c.minDistance, distanceBetween(c.a, c.b)) }),
        node: pairNode,
        layout: pairNode
      },
      AngleSectorConstraint: {
        type: "angleSector",
        label: "Sector",
        color: "#c2410c",
        params: ["listener", "source", "centerAngle", "width"],
        links: { source: "source" },
        fields: { centerAngle: "centerAngle", width: "width" },
        defaults: (c) => ({ centerAngle: sourceAngle(c), width: Math.PI / 2 }),
        capture: (c) => ({ centerAngle: sourceAngle(c) }),
        node: (c) => ({ x: c.source.x, y: c.source.y - 52 }),
        layout: radialNode
      }
    };
    const schemaByType = Object.fromEntries(
      Object.entries(schemas).map(([kind, schema]) => [schema.type, { kind, ...schema }])
    );
    function createEntity(x, y, color = "#2563eb") {
      return { kind: "Entity", x, y, radius: 13, color, prevX: x, prevY: y, drawTrace: false };
    }
    function createListener(x, y) {
      return { ...createEntity(x, y, "#111827"), kind: "Listener", name: "Listener" };
    }
    function createSoundSource(x, y, name) {
      return { ...createEntity(x, y, "#dc2626"), kind: "SoundSource", name };
    }
    function createMovingObject(x, y, name, trajectory = { type: "free" }) {
      return {
        ...createEntity(x, y, "#0891b2"),
        kind: "MovingObject",
        radius: 11,
        name,
        trajectory: normalizeTrajectory(trajectory, x, y)
      };
    }
    function createConstraintNode(x, y, label, color = "#d97706", glyph = label[0]) {
      return { ...createEntity(x, y, color), kind: "ConstraintNode", label, glyph, isManual: false };
    }
    const entityFactories = {
      Entity: createEntity,
      Listener: createListener,
      SoundSource: createSoundSource,
      MovingObject: createMovingObject,
      ConstraintNode: createConstraintNode
    };
    function createObject(kind, ...args) {
      if (entityFactories[kind]) return entityFactories[kind](...args);
      const schema = schemas[kind];
      if (!schema) throw new TypeError("Unknown display kind: " + kind);
      const object = { kind, ...Object.fromEntries(schema.params.map((name, i) => [name, args[i]])) };
      for (const [key, value] of Object.entries(schema.defaults?.(object) || {}))
        if (object[key] === undefined) object[key] = value;
      const position = schema.node(object);
      object.node = createConstraintNode(position.x, position.y, schema.label, schema.color, schema.glyph);
      return object;
    }
    function updateNode(object) {
      const layout = schemas[object.kind]?.layout;
      if (layout && !object.node.isManual) Object.assign(object.node, layout(object));
    }
    function refresh(object) {
      Object.assign(object, schemas[object.kind]?.capture?.(object));
      updateNode(object);
    }
    function affectedEntities(object) {
      const schema = schemas[object.kind];
      return [
        ...(schema.params.includes("listener") ? [object.listener] : []),
        ...Object.values(schema.links).flatMap((fields) =>
          Array.isArray(fields) ? fields.map((f) => object[f]) : [object[fields]].flat()
        )
      ];
    }
    function constraintReferencesEntity(constraint, entity) {
      return constraint.node === entity || affectedEntities(constraint).includes(entity);
    }
    function createObjectMap() {
      return new Map(
        [state.listener, ...state.sources, ...state.movingObjects].map((object) => [object.name, object])
      );
    }
    function createConstraintFromSpec(spec, byName) {
      const schema = schemaByType[spec.type];
      if (!schema) return null;
      const values = { listener: state.listener };
      for (const [key, fields] of Object.entries(schema.links)) {
        if (Array.isArray(fields)) fields.forEach((field, i) => (values[field] = byName.get(spec[key][i])));
        else
          values[fields] = Array.isArray(spec[key])
            ? spec[key].map((name) => byName.get(name))
            : byName.get(spec[key]);
      }
      for (const [key, field] of Object.entries(schema.fields)) values[field] = spec[key];
      const object = createObject(schema.kind, ...schema.params.map((field) => values[field]));
      // Angle/sum/product capture defaults at construction, but loaded targets
      // must keep the saved invariant instead of capturing the current geometry.
      for (const [key, field] of Object.entries(schema.fields))
        if (spec[key] !== undefined) object[field] = spec[key];
      if (spec.node)
        Object.assign(object.node, spec.node, {
          isManual: Boolean(spec.node.isManual),
          drawTrace: Boolean(spec.node.drawTrace)
        });
      return object;
    }
    function serializeConstraint(object) {
      const schema = schemas[object.kind];
      if (!schema) return null;
      const { x, y, isManual, drawTrace } = object.node;
      const spec = { type: schema.type, node: { x, y, isManual, drawTrace } };
      for (const [key, fields] of Object.entries(schema.links)) {
        if (Array.isArray(fields)) spec[key] = fields.map((field) => entityLabel(object[field]));
        else
          spec[key] = Array.isArray(object[fields])
            ? object[fields].map(entityLabel)
            : entityLabel(object[fields]);
      }
      for (const [key, field] of Object.entries(schema.fields)) spec[key] = object[field];
      return spec;
    }
    function distanceBetween(a, b) {
      return Math.max(MIN_DISTANCE, Math.hypot(a.x - b.x, a.y - b.y));
    }
    function getObjectByName(name) {
      if (!name) {
        return null;
      }

      if (state.listener?.name === name) {
        return state.listener;
      }

      return (
        (state.sources || []).find((source) => source.name === name) ||
        (state.movingObjects || []).find((mover) => mover.name === name) ||
        null
      );
    }
    function entityLabel(entity) {
      if (isKind(entity, "ConstraintNode")) {
        return `${entity.label} constraint`;
      }

      return entity && entity.name ? entity.name : "Object";
    }
    function parameterFeatureValue(feature, entity) {
      if (feature === "x") {
        return entity.x;
      }

      if (feature === "y") {
        return entity.y;
      }

      if (feature === "angle") {
        return Math.atan2(entity.y - state.listener.y, entity.x - state.listener.x);
      }

      return distanceBetween(entity, state.listener);
    }
    function serializePatch() {
      return patchApi.clonePatch({
        ...patchData,
        version: 1,
        ...(patchData.gravity || state.gravity.x || state.gravity.y ? { gravity: { ...state.gravity } } : {}),
        listener: { x: state.listener.x, y: state.listener.y, drawTrace: state.listener.drawTrace },
        sources: state.sources.map((source) => ({
          name: source.name,
          x: source.x,
          y: source.y,
          drawTrace: source.drawTrace,
          ...(source.dynamics ? { dynamics: { ...source.dynamics } } : {})
        })),
        movingObjects: state.movingObjects.map((mover) => ({
          name: mover.name,
          x: mover.x,
          y: mover.y,
          drawTrace: mover.drawTrace,
          trajectory: mover.trajectory,
          ...(mover.dynamics ? { dynamics: { ...mover.dynamics } } : {})
        })),
        constraints: state.constraints.map(serializeConstraint).filter(Boolean)
      });
    }
    function formatPropagationStatus(report) {
      const statusParts = [...report.messages];

      if (report.solverMode === SOLVER_MODE_XPBD) {
        if (report.residuals.length > 0) {
          statusParts.push("Best fit.");
        }
      } else {
        if (report.hitStepCap) {
          statusParts.push(`Propagation stopped after ${MAX_PROPAGATION_STEPS} steps.`);
        } else if (report.hitEntityCap) {
          statusParts.push(`Propagation capped one entity after ${MAX_ENTITY_PROPAGATION_COUNT} passes.`);
        }
      }

      if (report.residuals.length > 0) {
        const residual = report.residuals[0].measurement;
        const suffix = report.residuals.length > 1 ? ` (+${report.residuals.length - 1} more)` : "";
        statusParts.push(`${residual.label} residual ${formatConstraintError(residual)}${suffix}.`);
      }

      return statusParts.join(" ");
    }
    function formatConstraintError(measurement) {
      const roundedError =
        measurement.error >= 10
          ? measurement.error.toFixed(1)
          : measurement.error.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
      const roundedTolerance =
        measurement.tolerance >= 10
          ? measurement.tolerance.toFixed(1)
          : measurement.tolerance.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
      const unit = measurement.unit ? ` ${measurement.unit}` : "";
      return `${roundedError}${unit} > ${roundedTolerance}${unit}`;
    }
    function getLastPropagationReport() {
      if (!state.lastPropagationReport) {
        return null;
      }

      return {
        hitEntityCap: state.lastPropagationReport.hitEntityCap,
        hitStepCap: state.lastPropagationReport.hitStepCap,
        messages: [...state.lastPropagationReport.messages],
        movedEntities: state.lastPropagationReport.movedEntities.map(entityLabel),
        propagationPaused: state.lastPropagationReport.propagationPaused,
        propagationSteps: state.lastPropagationReport.propagationSteps,
        residuals: state.lastPropagationReport.residuals.map(({ measurement }) => ({
          error: measurement.error,
          label: measurement.label,
          tolerance: measurement.tolerance,
          unit: measurement.unit
        })),
        solverMode: state.lastPropagationReport.solverMode,
        satisfied: state.lastPropagationReport.satisfied
      };
    }
    function loadPatch(patch) {
      lastValidation = validatePatch(patch);
      if (lastValidation.some((f) => f.level === "error")) return false;
      const before = { ...state };
      try {
        const candidate = structuredClone(patch);
        state.listener = Object.assign(createListener(candidate.listener.x, candidate.listener.y), {
          drawTrace: Boolean(candidate.listener.drawTrace)
        });
        state.sources = candidate.sources.map((p) =>
          Object.assign(createSoundSource(p.x, p.y, p.name), {
            drawTrace: Boolean(p.drawTrace),
            ...(p.dynamics ? { dynamics: { ...p.dynamics } } : {})
          })
        );
        state.movingObjects = (candidate.movingObjects || []).map((p) =>
          Object.assign(createMovingObject(p.x, p.y, p.name, { type: "free" }), {
            drawTrace: Boolean(p.drawTrace),
            ...(p.dynamics ? { dynamics: { ...p.dynamics } } : {})
          })
        );
        state.movingObjects.forEach(
          (p, i) => (p.trajectory = normalizeTrajectory(candidate.movingObjects[i].trajectory, p.x, p.y))
        );
        const byName = createObjectMap();
        state.constraints = (candidate.constraints || []).map((spec) =>
          createConstraintFromSpec(spec, byName)
        );
        if (state.constraints.some((c) => !c)) throw Error("Invalid display constraint");
        state.gravity = { x: 0, y: 0, ...candidate.gravity };
        state.draggedEntity = null;
        state.lastPropagationReport = null;
        state.propagationPaused = false;
        patchData = candidate;
        return true;
      } catch (error) {
        Object.assign(state, before);
        lastValidation = [{ level: "error", message: error.message }];
        return false;
      }
    }
    return {
      state,
      createObject,
      isKind,
      kindOf: (object) => object?.kind,
      refresh,
      updateNode,
      affectedEntities,
      loadPatch,
      serializePatch,
      validatePatch,
      validation: () => structuredClone(lastValidation),
      constraintReferencesEntity,
      distanceBetween,
      getObjectByName,
      entityLabel,
      parameterFeatureValue,
      normalizeTrajectory,
      resolveTrajectoryEndpoint,
      clamp,
      formatPropagationStatus,
      getLastPropagationReport,
      hasDynamics: () =>
        state.constraints.some(
          (c) => c.kind === "SpringConstraint" || c.kind === "GravitationalConstraint"
        ) || [...state.sources, ...state.movingObjects].some((p) => p.dynamics),
      getSolverMode: () => state.solverMode,
      setSolverMode: (mode) => {
        state.solverMode = mode;
      }
    };
  }
  // Only the standard engine uses this adapter. Renderers and editors use the
  // same record-oriented operations without importing its classes themselves.
  function legacyPresentation(scene) {
    const entries = Object.entries(scene.classes).reverse();
    return {
      createObject: (kind, ...args) => new scene.classes[kind](...args),
      isKind: (object, kind) => object instanceof scene.classes[kind],
      kindOf: (object) => entries.find(([, Type]) => object instanceof Type)?.[0],
      updateNode: (object) => object.updateNode?.(),
      refresh: (object) => object.refresh?.(),
      affectedEntities: (object) => object.affectedEntities()
    };
  }
  function containsPoint(object, x, y) {
    return (x - object.x) ** 2 + (y - object.y) ** 2 <= object.radius ** 2;
  }
  const api = { createPresentation, legacyPresentation, containsPoint };
  if (isNode) module.exports = api;
  else global.MusicSpacePresentation = api;
})(globalThis);
