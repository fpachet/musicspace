// Bounded propagation and iterative geometric projection, with no UI dependencies.
(function exposeSolvers(global) {
  const constants =
    typeof module === "object" && module.exports
      ? require("./musicspace-constants")
      : global.MusicSpaceConstants;
  function createSolvers({ state, classes, graph, geometry, onStatus = () => {} }) {
    const {
      MIN_DISTANCE,
      CONSTRAINT_EPSILON,
      MAX_PROPAGATION_STEPS,
      MAX_ENTITY_PROPAGATION_COUNT,
      SOLVER_MODE_PROPAGATION,
      SOLVER_MODE_XPBD,
      XPBD_ITERATIONS_DRAG,
      XPBD_ITERATIONS_RELEASE,
      MAX_XPBD_COMPONENT_ENTITIES,
      MAX_XPBD_COMPONENT_CONSTRAINTS
    } = constants;
    const {
      MovingObject,
      AngleConstraint,
      SumConstraint,
      ProductConstraint,
      RadialLimitConstraint,
      FixedDistanceConstraint,
      DistanceRatioConstraint,
      PinConstraint,
      SolidAttachmentConstraint,
      MinimumSeparationConstraint,
      AngleSectorConstraint
    } = classes;
    const { translateEntity, rotateVector, entityLabel, normalizeAngle, clamp } = geometry;
    const setConstraintStatus = onStatus;
    function enforceConstraints(moved, options = {}) {
      if (state.solverMode === SOLVER_MODE_XPBD) {
        const xpbdReport = enforceConstraintsWithXpbd(moved, options);
        if (xpbdReport) {
          state.lastPropagationReport = xpbdReport;
          setConstraintStatus(formatPropagationStatus(state.lastPropagationReport));
          return;
        }
      }

      enforceConstraintsByPropagation(moved);
    }

    function refineXpbdAfterDrag(entity) {
      if (state.solverMode !== SOLVER_MODE_XPBD || !entity) {
        return false;
      }

      const xpbdReport = enforceConstraintsWithXpbd(entity, { iterations: XPBD_ITERATIONS_RELEASE });
      if (!xpbdReport) {
        return false;
      }

      state.lastPropagationReport = xpbdReport;
      setConstraintStatus(formatPropagationStatus(state.lastPropagationReport));
      return true;
    }

    function enforceConstraintsWithXpbd(
      moved,
      { iterations = XPBD_ITERATIONS_DRAG, preserveTrajectoryFrame = false } = {}
    ) {
      const component = buildConstraintComponent(moved);
      if (
        !component ||
        component.entities.length > MAX_XPBD_COMPONENT_ENTITIES ||
        component.constraints.length > MAX_XPBD_COMPONENT_CONSTRAINTS
      ) {
        return null;
      }

      applyXpbdRotatorFrameDeltas(component.constraints);

      const positions = component.entities.map((entity) => ({ x: entity.x, y: entity.y }));
      const originalPositions = component.entities.map((entity) => ({ x: entity.x, y: entity.y }));
      const mobility = createXpbdMobility(component, moved);
      const intent =
        moved && component.indexByEntity.has(moved)
          ? {
              index: component.indexByEntity.get(moved),
              x: moved.x,
              y: moved.y,
              stiffness: 0.35
            }
          : null;

      const ordered = orderedXpbdConstraints(component.constraints);
      for (let iteration = 0; iteration < iterations; iteration += 1) {
        applyXpbdSoftIntent(positions, mobility, intent);

        for (const constraint of ordered) {
          projectXpbdConstraint(constraint, component.indexByEntity, positions, mobility);
        }
      }

      for (const constraint of component.constraints) {
        projectXpbdHardConstraint(constraint, component.indexByEntity, positions, mobility);
      }

      const movedEntities = [];
      for (let index = 0; index < component.entities.length; index += 1) {
        const entity = component.entities[index];
        const next = positions[index];
        const dx = next.x - entity.x;
        const dy = next.y - entity.y;
        if (Math.hypot(dx, dy) > 0.001) {
          commitXpbdEntityPosition(entity, next, { preserveTrajectoryFrame });
        }
        if (
          Math.hypot(next.x - originalPositions[index].x, next.y - originalPositions[index].y) >
          CONSTRAINT_EPSILON
        ) {
          movedEntities.push(entity);
        }
      }

      for (const constraint of component.constraints) {
        constraint.updateNode?.();
      }

      return createPropagationReport({
        hitEntityCap: false,
        hitStepCap: false,
        messages: [],
        movedEntities,
        processCounts: new Map(),
        propagationSteps: iterations * component.constraints.length,
        solverMode: SOLVER_MODE_XPBD
      });
    }

    function orderedXpbdConstraints(componentConstraints) {
      const hard = [];
      const structural = [];
      const aggregate = [];

      for (const constraint of componentConstraints) {
        if (
          constraint instanceof PinConstraint ||
          constraint instanceof RadialLimitConstraint ||
          constraint instanceof AngleSectorConstraint
        ) {
          hard.push(constraint);
        } else if (
          constraint instanceof SolidAttachmentConstraint ||
          constraint instanceof FixedDistanceConstraint ||
          constraint instanceof MinimumSeparationConstraint
        ) {
          structural.push(constraint);
        } else {
          aggregate.push(constraint);
        }
      }

      return [...hard, ...structural, ...aggregate];
    }

    function applyXpbdRotatorFrameDeltas(componentConstraints) {
      for (const constraint of componentConstraints) {
        if (constraint instanceof SolidAttachmentConstraint) {
          constraint.applyCarrierRotation();
        }
      }
    }

    function commitXpbdEntityPosition(entity, next, { preserveTrajectoryFrame = false } = {}) {
      if (preserveTrajectoryFrame && entity instanceof MovingObject) {
        entity.x = next.x;
        entity.y = next.y;
        return;
      }

      translateEntity(entity, next.x - entity.x, next.y - entity.y);
    }

    function buildConstraintComponent(startEntity) {
      if (!startEntity) {
        return null;
      }

      const entities = [];
      const componentConstraints = [];
      const entitySet = new Set();
      const constraintSet = new Set();
      const queue = [startEntity];
      entitySet.add(startEntity);

      let head = 0;
      while (head < queue.length) {
        const entity = queue[head++];
        for (const constraint of graph.neighbors(entity)) {
          if (constraintSet.has(constraint)) {
            continue;
          }

          const affected = constraint.affectedEntities?.().filter(Boolean) || [];
          if (!affected.includes(entity)) {
            continue;
          }

          constraintSet.add(constraint);
          componentConstraints.push(constraint);

          for (const affectedEntity of affected) {
            if (!entitySet.has(affectedEntity)) {
              entitySet.add(affectedEntity);
              queue.push(affectedEntity);
            }
          }
        }
      }

      for (const entity of entitySet) {
        entities.push(entity);
      }

      return {
        constraints: componentConstraints,
        entities,
        indexByEntity: new Map(entities.map((entity, index) => [entity, index]))
      };
    }

    function createXpbdMobility(component, moved) {
      const pinned = new Set(
        component.constraints
          .filter((constraint) => constraint instanceof PinConstraint)
          .map((constraint) => constraint.target)
      );

      return component.entities.map((entity) => {
        if (pinned.has(entity)) {
          return 0;
        }

        if (entity === state.listener && entity !== moved) {
          return 0;
        }

        return 1;
      });
    }

    function applyXpbdSoftIntent(positions, mobility, intent) {
      if (!intent || mobility[intent.index] <= 0) {
        return;
      }

      const position = positions[intent.index];
      position.x += (intent.x - position.x) * intent.stiffness;
      position.y += (intent.y - position.y) * intent.stiffness;
    }

    function projectXpbdConstraint(constraint, indexByEntity, positions, mobility) {
      if (
        constraint instanceof PinConstraint ||
        constraint instanceof RadialLimitConstraint ||
        constraint instanceof AngleSectorConstraint
      ) {
        projectXpbdHardConstraint(constraint, indexByEntity, positions, mobility);
        return;
      }

      if (constraint instanceof FixedDistanceConstraint) {
        projectXpbdDistance(
          indexByEntity.get(constraint.anchor),
          indexByEntity.get(constraint.target),
          constraint.distance,
          positions,
          mobility
        );
      } else if (constraint instanceof SolidAttachmentConstraint) {
        projectXpbdSolid(constraint, indexByEntity, positions, mobility);
      } else if (constraint instanceof MinimumSeparationConstraint) {
        projectXpbdMinSeparation(constraint, indexByEntity, positions, mobility);
      } else if (constraint instanceof SumConstraint) {
        projectXpbdSum(constraint, indexByEntity, positions, mobility);
      } else if (constraint instanceof ProductConstraint) {
        projectXpbdProduct(constraint, indexByEntity, positions, mobility);
      } else if (constraint instanceof DistanceRatioConstraint) {
        projectXpbdRatio(constraint, indexByEntity, positions, mobility);
      } else if (constraint instanceof AngleConstraint) {
        projectXpbdAngle(constraint, indexByEntity, positions, mobility);
      }
    }

    function projectXpbdHardConstraint(constraint, indexByEntity, positions, mobility) {
      if (constraint instanceof PinConstraint) {
        const index = indexByEntity.get(constraint.target);
        if (index === undefined) {
          return;
        }
        positions[index].x = constraint.fixedX;
        positions[index].y = constraint.fixedY;
      } else if (constraint instanceof RadialLimitConstraint) {
        projectXpbdRadialLimit(constraint, indexByEntity, positions, mobility);
      } else if (constraint instanceof AngleSectorConstraint) {
        projectXpbdAngleSector(constraint, indexByEntity, positions, mobility);
      }
    }

    function projectXpbdDistance(aIndex, bIndex, targetDistance, positions, mobility) {
      if (aIndex === undefined || bIndex === undefined) {
        return;
      }

      const a = positions[aIndex];
      const b = positions[bIndex];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const distance = Math.hypot(dx, dy);
      if (distance < 0.000001) {
        return;
      }

      const aMobility = mobility[aIndex];
      const bMobility = mobility[bIndex];
      const mobilitySum = aMobility + bMobility;
      if (mobilitySum <= 0) {
        return;
      }

      const residual = distance - targetDistance;
      const nx = dx / distance;
      const ny = dy / distance;
      a.x += nx * residual * (aMobility / mobilitySum);
      a.y += ny * residual * (aMobility / mobilitySum);
      b.x -= nx * residual * (bMobility / mobilitySum);
      b.y -= ny * residual * (bMobility / mobilitySum);
    }

    function projectXpbdRadialLimit(constraint, indexByEntity, positions, mobility) {
      const sourceIndex = indexByEntity.get(constraint.source);
      const listenerIndex = indexByEntity.get(constraint.listener);
      if (sourceIndex === undefined || listenerIndex === undefined || mobility[sourceIndex] <= 0) {
        return;
      }

      const source = positions[sourceIndex];
      const anchor = positions[listenerIndex];
      const dx = source.x - anchor.x;
      const dy = source.y - anchor.y;
      const distance = Math.hypot(dx, dy);
      const clampedDistance = clamp(distance, constraint.minDistance, constraint.maxDistance);
      if (Math.abs(distance - clampedDistance) <= CONSTRAINT_EPSILON) {
        return;
      }

      const angle = distance === 0 ? 0 : Math.atan2(dy, dx);
      source.x = anchor.x + clampedDistance * Math.cos(angle);
      source.y = anchor.y + clampedDistance * Math.sin(angle);
    }

    function projectXpbdAngleSector(constraint, indexByEntity, positions, mobility) {
      const sourceIndex = indexByEntity.get(constraint.source);
      const listenerIndex = indexByEntity.get(constraint.listener);
      if (sourceIndex === undefined || listenerIndex === undefined || mobility[sourceIndex] <= 0) {
        return;
      }

      const source = positions[sourceIndex];
      const anchor = positions[listenerIndex];
      const distance = Math.hypot(source.x - anchor.x, source.y - anchor.y);
      const angle = Math.atan2(source.y - anchor.y, source.x - anchor.x);
      const delta = normalizeAngle(angle - constraint.centerAngle);
      const halfWidth = constraint.width / 2;
      if (Math.abs(delta) <= halfWidth) {
        return;
      }

      const clampedAngle = constraint.centerAngle + clamp(delta, -halfWidth, halfWidth);
      source.x = anchor.x + distance * Math.cos(clampedAngle);
      source.y = anchor.y + distance * Math.sin(clampedAngle);
    }

    function projectXpbdSolid(constraint, indexByEntity, positions, mobility) {
      const carrierIndex = indexByEntity.get(constraint.carrier);
      const attachedIndex = indexByEntity.get(constraint.attached);
      if (carrierIndex === undefined || attachedIndex === undefined) {
        return;
      }

      const carrier = positions[carrierIndex];
      const attached = positions[attachedIndex];
      const errorX = attached.x - carrier.x - constraint.offsetX;
      const errorY = attached.y - carrier.y - constraint.offsetY;
      const carrierMobility = mobility[carrierIndex];
      const attachedMobility = mobility[attachedIndex];
      const mobilitySum = carrierMobility + attachedMobility;
      if (mobilitySum <= 0) {
        return;
      }

      carrier.x += errorX * (carrierMobility / mobilitySum);
      carrier.y += errorY * (carrierMobility / mobilitySum);
      attached.x -= errorX * (attachedMobility / mobilitySum);
      attached.y -= errorY * (attachedMobility / mobilitySum);
    }

    function projectXpbdMinSeparation(constraint, indexByEntity, positions, mobility) {
      const aIndex = indexByEntity.get(constraint.a);
      const bIndex = indexByEntity.get(constraint.b);
      if (aIndex === undefined || bIndex === undefined) {
        return;
      }

      const a = positions[aIndex];
      const b = positions[bIndex];
      const distance = Math.hypot(b.x - a.x, b.y - a.y);
      if (distance >= constraint.minDistance) {
        return;
      }

      projectXpbdDistance(aIndex, bIndex, constraint.minDistance, positions, mobility);
    }

    function projectXpbdSum(constraint, indexByEntity, positions, mobility) {
      const listenerIndex = indexByEntity.get(constraint.listener);
      if (listenerIndex === undefined) {
        return;
      }

      const anchor = positions[listenerIndex];
      const sourceIndexes = constraint.sources
        .map((source) => indexByEntity.get(source))
        .filter((index) => index !== undefined && mobility[index] > 0);
      const total = constraint.sources.reduce((sum, source) => {
        const index = indexByEntity.get(source);
        if (index === undefined) {
          return sum;
        }
        return sum + Math.hypot(positions[index].x - anchor.x, positions[index].y - anchor.y);
      }, 0);
      const mobilitySum = sourceIndexes.reduce((sum, index) => sum + mobility[index], 0);
      if (mobilitySum <= 0) {
        return;
      }

      const residual = total - constraint.totalDistance;
      for (const index of sourceIndexes) {
        const source = positions[index];
        const dx = source.x - anchor.x;
        const dy = source.y - anchor.y;
        const distance = Math.hypot(dx, dy);
        const angle = distance === 0 ? 0 : Math.atan2(dy, dx);
        const nextDistance = Math.max(MIN_DISTANCE, distance - residual * (mobility[index] / mobilitySum));
        source.x = anchor.x + nextDistance * Math.cos(angle);
        source.y = anchor.y + nextDistance * Math.sin(angle);
      }
    }

    function projectXpbdProduct(constraint, indexByEntity, positions, mobility) {
      const listenerIndex = indexByEntity.get(constraint.listener);
      if (listenerIndex === undefined || constraint.product <= 0) {
        return;
      }

      const anchor = positions[listenerIndex];
      const sourceIndexes = constraint.sources
        .map((source) => indexByEntity.get(source))
        .filter((index) => index !== undefined && mobility[index] > 0);
      const mobilitySum = sourceIndexes.reduce((sum, index) => sum + mobility[index], 0);
      if (mobilitySum <= 0) {
        return;
      }

      const currentLogProduct = constraint.sources.reduce((sum, source) => {
        const index = indexByEntity.get(source);
        if (index === undefined) {
          return sum;
        }
        return (
          sum +
          Math.log(
            Math.max(MIN_DISTANCE, Math.hypot(positions[index].x - anchor.x, positions[index].y - anchor.y))
          )
        );
      }, 0);
      const logResidual = currentLogProduct - Math.log(Math.max(1, constraint.product));

      for (const index of sourceIndexes) {
        const source = positions[index];
        const dx = source.x - anchor.x;
        const dy = source.y - anchor.y;
        const distance = Math.max(MIN_DISTANCE, Math.hypot(dx, dy));
        const angle = Math.atan2(dy, dx);
        const nextDistance = distance * Math.exp(-logResidual * (mobility[index] / mobilitySum));
        source.x = anchor.x + nextDistance * Math.cos(angle);
        source.y = anchor.y + nextDistance * Math.sin(angle);
      }
    }

    function projectXpbdRatio(constraint, indexByEntity, positions, mobility) {
      const listenerIndex = indexByEntity.get(constraint.listener);
      const aIndex = indexByEntity.get(constraint.a);
      const bIndex = indexByEntity.get(constraint.b);
      if (
        listenerIndex === undefined ||
        aIndex === undefined ||
        bIndex === undefined ||
        constraint.ratio <= 0
      ) {
        return;
      }

      const anchor = positions[listenerIndex];
      const a = positions[aIndex];
      const b = positions[bIndex];
      const distanceA = Math.max(MIN_DISTANCE, Math.hypot(a.x - anchor.x, a.y - anchor.y));
      const distanceB = Math.max(MIN_DISTANCE, Math.hypot(b.x - anchor.x, b.y - anchor.y));
      const mobilitySum = mobility[aIndex] + mobility[bIndex];
      if (mobilitySum <= 0) {
        return;
      }

      const logResidual = Math.log(distanceA / distanceB) - Math.log(constraint.ratio);
      if (mobility[aIndex] > 0) {
        setXpbdPolarDistance(
          a,
          anchor,
          distanceA * Math.exp(-logResidual * (mobility[aIndex] / mobilitySum))
        );
      }
      if (mobility[bIndex] > 0) {
        setXpbdPolarDistance(b, anchor, distanceB * Math.exp(logResidual * (mobility[bIndex] / mobilitySum)));
      }
    }

    function projectXpbdAngle(constraint, indexByEntity, positions, mobility) {
      const listenerIndex = indexByEntity.get(constraint.listener);
      const aIndex = indexByEntity.get(constraint.a);
      const bIndex = indexByEntity.get(constraint.b);
      if (listenerIndex === undefined || aIndex === undefined || bIndex === undefined) {
        return;
      }

      const anchor = positions[listenerIndex];
      const a = positions[aIndex];
      const b = positions[bIndex];
      const angleA = Math.atan2(a.y - anchor.y, a.x - anchor.x);
      const angleB = Math.atan2(b.y - anchor.y, b.x - anchor.x);
      const residual = normalizeAngle(angleB - angleA - constraint.angle);
      const mobilitySum = mobility[aIndex] + mobility[bIndex];
      if (mobilitySum <= 0) {
        return;
      }

      if (mobility[aIndex] > 0) {
        rotateXpbdAround(a, anchor, residual * (mobility[aIndex] / mobilitySum));
      }
      if (mobility[bIndex] > 0) {
        rotateXpbdAround(b, anchor, -residual * (mobility[bIndex] / mobilitySum));
      }
    }

    function setXpbdPolarDistance(position, anchor, distance) {
      const angle = Math.atan2(position.y - anchor.y, position.x - anchor.x);
      position.x = anchor.x + Math.max(MIN_DISTANCE, distance) * Math.cos(angle);
      position.y = anchor.y + Math.max(MIN_DISTANCE, distance) * Math.sin(angle);
    }

    function rotateXpbdAround(position, anchor, deltaAngle) {
      const dx = position.x - anchor.x;
      const dy = position.y - anchor.y;
      const rotated = rotateVector(dx, dy, deltaAngle);
      position.x = anchor.x + rotated.x;
      position.y = anchor.y + rotated.y;
    }

    function enforceConstraintsByPropagation(moved) {
      const messages = [];
      const queue = [];
      const queuedEntities = new Set();
      const processCounts = new Map();
      const movedEntities = new Set();
      let propagationSteps = 0;
      let hitEntityCap = false;

      enqueuePropagationEntity(moved, queue, queuedEntities, processCounts);

      let head = 0;
      while (head < queue.length && propagationSteps < MAX_PROPAGATION_STEPS) {
        const currentMoved = queue[head++];
        queuedEntities.delete(currentMoved);

        const processCount = processCounts.get(currentMoved) || 0;
        if (processCount >= MAX_ENTITY_PROPAGATION_COUNT) {
          hitEntityCap = true;
          continue;
        }
        processCounts.set(currentMoved, processCount + 1);
        movedEntities.add(currentMoved);
        propagationSteps += 1;

        for (const constraint of graph.neighbors(currentMoved)) {
          const result = constraint.enforce(currentMoved);
          if (result && result.message && !messages.includes(result.message)) {
            messages.push(result.message);
          }
          for (const movedEntity of result?.movedEntities || []) {
            enqueuePropagationEntity(movedEntity, queue, queuedEntities, processCounts, currentMoved);
          }
          if (result?.movedEntity) {
            enqueuePropagationEntity(result.movedEntity, queue, queuedEntities, processCounts, currentMoved);
          }
        }
      }

      state.lastPropagationReport = createPropagationReport({
        hitEntityCap:
          hitEntityCap || [...processCounts.values()].some((count) => count >= MAX_ENTITY_PROPAGATION_COUNT),
        hitStepCap: head < queue.length,
        messages,
        movedEntities: [...movedEntities],
        processCounts,
        propagationSteps
      });
      setConstraintStatus(formatPropagationStatus(state.lastPropagationReport));
    }

    function enqueuePropagationEntity(entity, queue, queuedEntities, processCounts, currentMoved = null) {
      if (!entity || entity === currentMoved || queuedEntities.has(entity)) {
        return;
      }

      if ((processCounts.get(entity) || 0) >= MAX_ENTITY_PROPAGATION_COUNT) {
        return;
      }

      queue.push(entity);
      queuedEntities.add(entity);
    }

    function createPropagationReport({
      hitEntityCap,
      hitStepCap,
      messages,
      movedEntities,
      processCounts,
      propagationPaused = false,
      propagationSteps,
      solverMode = SOLVER_MODE_PROPAGATION
    }) {
      const residuals = measureConstraintResiduals();

      return {
        hitEntityCap,
        hitStepCap,
        messages,
        movedEntities,
        processCounts,
        propagationPaused,
        propagationSteps,
        residuals,
        solverMode,
        satisfied: residuals.length === 0 && !hitEntityCap && !hitStepCap && !propagationPaused
      };
    }

    function measureConstraintResiduals() {
      return state.constraints
        .map((constraint) => ({
          constraint,
          measurement: normalizeConstraintMeasurement(constraint)
        }))
        .filter(({ measurement }) => measurement.error > measurement.tolerance);
    }

    function normalizeConstraintMeasurement(constraint) {
      const measurement = constraint.measureError?.() || {
        error: 0,
        label: constraint.node?.label || "Constraint",
        tolerance: CONSTRAINT_EPSILON,
        unit: "px"
      };

      return {
        error: Number.isFinite(measurement.error) ? measurement.error : Number.POSITIVE_INFINITY,
        label: measurement.label || constraint.node?.label || "Constraint",
        tolerance: measurement.tolerance ?? CONSTRAINT_EPSILON,
        unit: measurement.unit || ""
      };
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
    return {
      enforceConstraints,
      refineXpbdAfterDrag,
      enforceConstraintsWithXpbd,
      createPropagationReport,
      measureConstraintResiduals,
      formatPropagationStatus,
      getLastPropagationReport
    };
  }
  const api = { createSolvers };
  if (typeof module === "object" && module.exports) module.exports = api;
  else global.MusicSpaceSolvers = api;
})(globalThis);
