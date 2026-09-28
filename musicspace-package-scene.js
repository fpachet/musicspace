// Transitional workbench adapter: package-owned simulation, existing presentation objects.
(function exposePackageScene(global) {
  function createPackageScene({ createView, onStatus = () => {}, loadModules } = {}) {
    const view = createView();
    const state = view.state;
    let modules,
      space,
      context,
      lastValidation = [],
      released = false;
    let settings = {};
    const load =
      loadModules ||
      (() =>
        Promise.all([
          import("./packages/musicspace-engine/dist/index.mjs"),
          import("./packages/musicspace-engine/dist/legacy-patch.mjs")
        ]));

    // Output clients own these blocks and merge their current state in the UI.
    // Keeping old bindings here would invalidate a rename or deletion before the
    // clients have had a chance to update their references.
    function geometryPatch() {
      const patch = view.serializePatch();
      for (const key of [
        "target",
        "audioSynth",
        "parameterMappings",
        "audioMappings",
        "sourceBindings",
        "sourceGenerators",
        "sourceGeneratorMappings",
        "midiFile"
      ])
        delete patch[key];
      return patch;
    }
    function editGeometry(mutate) {
      if (!space) return false;
      syncSettings();
      const previousState = {
        ...state,
        gravity: { ...state.gravity },
        sources: [...state.sources],
        movingObjects: [...state.movingObjects],
        constraints: [...state.constraints]
      };
      const objects = [
        state.listener,
        ...state.sources,
        ...state.movingObjects,
        ...state.constraints,
        ...state.constraints.map((c) => c.node)
      ];
      const previousObjects = objects.map((object) => [
        object,
        Object.fromEntries(
          Object.entries(object).map(([key, value]) => [
            key,
            ["trajectory", "dynamics"].includes(key)
              ? structuredClone(value)
              : Array.isArray(value)
                ? [...value]
                : value
          ])
        )
      ]);
      try {
        mutate();
        const imported = modules.importLegacyPatch(geometryPatch(), settings);
        // Public restore validates a candidate before installing it. Authoring
        // is synchronous, so no simulation frame can observe an incomplete edit.
        space.restore(imported.scene);
        context = imported.context;
        released = false;
      } catch (error) {
        Object.assign(state, previousState);
        for (const [object, properties] of previousObjects) {
          for (const key of Object.keys(object)) delete object[key];
          Object.assign(object, properties);
        }
        onStatus(error.message);
        return false;
      }
      sync(null, false);
      return true;
    }

    function pointId(entity) {
      return entity &&
        typeof entity.name === "string" &&
        context &&
        Object.hasOwn(context.pointIds, entity.name)
        ? context.pointIds[entity.name]
        : null;
    }
    function syncSettings() {
      if (!space) return;
      const next = { solver: state.solverMode, centerMode: state.listenerMode };
      if (next.solver !== settings.solver || next.centerMode !== settings.centerMode) {
        space.configure(next);
        settings = next;
      }
    }
    function residuals(diagnostics = space?.diagnostics()) {
      if (!diagnostics) return [];
      return diagnostics.residuals.map(({ id, ...measurement }) => ({
        constraint: state.constraints[context.constraintIds.indexOf(id)],
        measurement
      }));
    }
    function sync(event, notify = true) {
      const snapshot = space.snapshot();
      const names = new Map(Object.entries(context.pointIds).map(([name, id]) => [id, name]));
      Object.assign(state.listener, snapshot.center);
      for (const point of snapshot.points) {
        const target = view.getObjectByName(names.get(point.id));
        target.x = point.x;
        target.y = point.y;
        if (point.dynamics) target.dynamics = { ...point.dynamics };
        else delete target.dynamics;
        if (point.trajectory) {
          target.trajectory = structuredClone(point.trajectory);
          for (const key of ["start", "end"])
            if (target.trajectory[key]?.type === "object") {
              target.trajectory[key].name = names.get(target.trajectory[key].id);
              delete target.trajectory[key].id;
            }
        }
      }
      // Only invariant values and display node layout are updated here. Never
      // call enforce(), refresh(), tick() or a solver on presentation objects.
      snapshot.constraints.forEach((spec, index) => {
        const target = state.constraints[index];
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
          "ratio",
          "offsetX",
          "offsetY",
          "centerAngle",
          "width"
        ])
          if (spec[key] !== undefined) target[key] = spec[key];
        if (spec.type === "pin") {
          target.fixedX = spec.x;
          target.fixedY = spec.y;
        }
        target.updateNode?.();
      });
      const diagnostics = event?.diagnostics || space.diagnostics();
      state.propagationPaused = diagnostics.propagationPaused;
      state.lastPropagationReport = {
        ...diagnostics,
        solverMode: diagnostics.solver,
        residuals: residuals(diagnostics),
        movedEntities: (event?.changed || []).map((p) => view.getObjectByName(names.get(p.id))),
        messages: diagnostics.propagationPaused
          ? ["Propagation paused (Shift). Constraints are not being enforced."]
          : [],
        propagationSteps: 0,
        processCounts: new Map()
      };
      if (notify) onStatus(view.formatPropagationStatus(state.lastPropagationReport));
      return view.getLastPropagationReport();
    }
    function run(operation) {
      if (!space) return null;
      syncSettings();
      return sync(operation());
    }
    function resume() {
      return run(() => space.resumePropagation());
    }
    return {
      ...view,
      engineKind: "package",
      editGeometry,
      async initialize() {
        const [engine, adapter] = await load();
        modules = { ...engine, ...adapter };
      },
      loadPatch(patch) {
        if (!modules) {
          lastValidation = [{ level: "error", message: "Package engine is not initialized." }];
          return false;
        }
        try {
          const findings = view.validatePatch(patch);
          if (findings.some((finding) => finding.level === "error")) {
            lastValidation = findings;
            return false;
          }
          const nextSettings = { solver: state.solverMode, centerMode: state.listenerMode };
          const imported = modules.importLegacyPatch(patch, nextSettings);
          const candidate = modules.createSpace(imported.scene);
          if (!view.loadPatch(patch)) {
            lastValidation = view.validation();
            return false;
          }
          space = candidate;
          context = imported.context;
          settings = nextSettings;
          released = false;
          lastValidation = findings;
          sync(null, false);
          return true;
        } catch (error) {
          lastValidation = [{ level: "error", message: error.message }];
          return false;
        }
      },
      validation() {
        return structuredClone(lastValidation);
      },
      serializePatch() {
        if (!space) return view.serializePatch();
        syncSettings();
        // Trace flags and node positions belong to the interface. Output clients
        // continue to merge their latest bindings in musicspace.js.
        return modules.exportLegacyPatch(space.snapshot(), { ...context, patch: geometryPatch() });
      },
      moveEntity(entity, x, y, { bounds = null, skipPropagation = false } = {}) {
        if (!space) return null;
        syncSettings();
        const limits = bounds || { left: 0, top: 0, right: 800, bottom: 600 };
        const id = pointId(entity);
        if (id) return sync(space.move(id, x, y, { bounds: limits, skipPropagation }));
        if (!state.constraints.some((c) => c.node === entity))
          throw new TypeError("Unknown presentation object.");
        entity.x = view.clamp(x, limits.left, limits.right);
        entity.y = view.clamp(y, limits.top, limits.bottom);
        entity.isManual = true;
        // A constraint handle is display-only. Shift still pauses dynamics.
        if (skipPropagation)
          space.move(modules.CENTER, state.listener.x, state.listener.y, { skipPropagation: true });
        return sync();
      },
      step() {
        return run(() => space.step());
      },
      beginDrag(entity) {
        if (!space) return;
        syncSettings();
        released = false;
        const id = pointId(entity);
        if (id) space.beginDrag(id);
        state.draggedEntity = entity;
      },
      endDrag({ refine = true } = {}) {
        if (!space) return;
        syncSettings();
        released = Boolean(
          refine && pointId(state.draggedEntity) && !state.propagationPaused && state.solverMode === "xpbd"
        );
        const report = sync(space.endDrag({ refine }));
        state.draggedEntity = null;
        return report;
      },
      // The UI asks whether to redraw after endDrag. Refinement already happened
      // in the package, so this must never invoke the presentation solver.
      refineXpbdAfterDrag() {
        const result = released;
        released = false;
        return result;
      },
      enforceConstraints(entity) {
        return run(() => space.solve(pointId(entity) || modules.CENTER));
      },
      refreshConstraints: resume,
      resumePropagationAfterPausedDrag: resume,
      measureConstraintResiduals() {
        return residuals();
      },
      initializeDynamics() {
        // Body creation occurs while the package validates an authoring edit.
        return editGeometry(() => {});
      }
    };
  }
  const api = { createPackageScene };
  if (typeof module === "object" && module.exports) module.exports = api;
  else global.MusicSpacePackageScene = api;
})(globalThis);
