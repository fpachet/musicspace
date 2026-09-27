// Headless scene state, entities and edit operations. Rendering is attached by the UI.
(function exposeModel(global) {
  const isNode = typeof module === "object" && module.exports;
  const constants = isNode ? require("./musicspace-constants") : global.MusicSpaceConstants;
  const patchApi = isNode ? require("./musicspace-patch") : global.MusicSpacePatch;
  const trajectoryApi = isNode ? require("./musicspace-trajectories") : global.MusicSpaceTrajectories;
  const graphApi = isNode ? require("./musicspace-graph") : global.MusicSpaceGraph;
  const solverApi = isNode ? require("./musicspace-solvers") : global.MusicSpaceSolvers;
  function createSceneModel(options = {}) {
    const {
      WIDTH,
      HEIGHT,
      LISTENER_MODE_RETARGET,
      MIN_DISTANCE,
      CONSTRAINT_EPSILON,
      PRODUCT_EPSILON,
      SOLVER_MODE_PROPAGATION,
      SOLVER_MODE_XPBD,
      DEFAULT_SOLVER_MODE,
      ANGLE_EPSILON,
      RATIO_EPSILON,
      RELATIVE_PRODUCT_EPSILON
    } = constants;
    const state = {
      listener: null,
      sources: [],
      movingObjects: [],
      constraints: [],
      listenerMode: LISTENER_MODE_RETARGET,
      solverMode: DEFAULT_SOLVER_MODE,
      lastPropagationReport: null,
      propagationPaused: false,
      gravity: { x: 0, y: 0 },
      draggedEntity: null
    };
    const graph = graphApi.createConstraintGraph();
    let trackedConstraints = graph.track(state.constraints);
    Object.defineProperty(state, "constraints", {
      enumerable: true,
      get: () => trackedConstraints,
      set(next) {
        trackedConstraints = graph.track(next);
      }
    });
    const setConstraintStatus = options.onStatus || (() => {});
    const { validatePatch } = patchApi.createPatchTools(options);
    let patchData = {};
    let lastValidation = [];
    const trajectories = trajectoryApi.createTrajectories({
      getListener: () => state.listener,
      getObjectByName
    });
    const { normalizeTrajectory, resolveTrajectoryEndpoint } = trajectories;
    class Entity {
      constructor(x, y, color = "#2563eb") {
        this.x = x;
        this.y = y;
        this.radius = 13;
        this.color = color;
        this.prevX = x;
        this.prevY = y;
        this.drawTrace = false;
      }

      isInside(px, py) {
        return (px - this.x) ** 2 + (py - this.y) ** 2 <= this.radius ** 2;
      }
    }

    class Listener extends Entity {
      constructor(x, y) {
        super(x, y, "#111827");
        this.name = "Listener";
      }
    }

    class SoundSource extends Entity {
      constructor(x, y, name) {
        super(x, y, "#dc2626");
        this.name = name;
        this.prevX = x;
        this.prevY = y;
      }
    }

    class MovingObject extends Entity {
      constructor(x, y, name, trajectory = { type: "free" }) {
        super(x, y, "#0891b2");
        this.name = name;
        this.radius = 11;
        this.prevX = x;
        this.prevY = y;
        this.trajectory = normalizeTrajectory(trajectory, x, y);
      }

      tick() {
        return trajectories.tick(this);
      }
    }

    class ConstraintNode extends Entity {
      constructor(x, y, label, color = "#d97706", glyph = label[0]) {
        super(x, y, color);
        this.label = label;
        this.glyph = glyph;
        this.isManual = false;
      }
    }

    class AngleConstraint {
      constructor(listener, a, b) {
        this.listener = listener;
        this.a = a;
        this.b = b;
        this.angle = this.computeAngle();
        this.node = new ConstraintNode((a.x + b.x) / 2, (a.y + b.y) / 2, "Angle", "#2563eb");
      }

      computeAngle() {
        return (
          Math.atan2(this.b.y - this.listener.y, this.b.x - this.listener.x) -
          Math.atan2(this.a.y - this.listener.y, this.a.x - this.listener.x)
        );
      }

      affectedEntities() {
        return [this.listener, this.a, this.b];
      }

      measureError() {
        return {
          label: this.node.label,
          error: Math.abs(normalizeAngle(this.computeAngle() - this.angle)),
          tolerance: ANGLE_EPSILON,
          unit: "rad"
        };
      }

      refresh() {
        this.angle = this.computeAngle();
        this.updateNode();
      }

      updateNode() {
        if (!this.node.isManual) {
          this.node.x = (this.a.x + this.b.x) / 2;
          this.node.y = (this.a.y + this.b.y) / 2;
        }
      }

      enforce(moved) {
        if (moved !== this.a && moved !== this.b && moved !== this.listener) {
          return;
        }

        if (moved === this.b) {
          const baseAngle = Math.atan2(this.b.y - this.listener.y, this.b.x - this.listener.x);
          const newAngle = baseAngle - this.angle;
          const dist = Math.hypot(this.a.x - this.listener.x, this.a.y - this.listener.y);

          const nextX = this.listener.x + dist * Math.cos(newAngle);
          const nextY = this.listener.y + dist * Math.sin(newAngle);
          translateEntity(this.a, nextX - this.a.x, nextY - this.a.y);
          this.updateNode();
          return { satisfied: true, movedEntity: this.a };
        } else {
          const baseAngle = Math.atan2(this.a.y - this.listener.y, this.a.x - this.listener.x);
          const newAngle = baseAngle + this.angle;
          const dist = Math.hypot(this.b.x - this.listener.x, this.b.y - this.listener.y);

          const nextX = this.listener.x + dist * Math.cos(newAngle);
          const nextY = this.listener.y + dist * Math.sin(newAngle);
          translateEntity(this.b, nextX - this.b.x, nextY - this.b.y);
          this.updateNode();
          return { satisfied: true, movedEntity: this.b };
        }
      }
    }

    class SumConstraint {
      constructor(listener, sources) {
        this.listener = listener;
        this.sources = sources;
        this.totalDistance = this.computeTotalDistance();
        this.node = new ConstraintNode(listener.x + 90, listener.y, "Sum", "#059669");
      }

      computeTotalDistance() {
        return this.sources.reduce((sum, source) => sum + this.distanceToListener(source), 0);
      }

      distanceToListener(source) {
        return Math.hypot(source.x - this.listener.x, source.y - this.listener.y);
      }

      affectedEntities() {
        return [this.listener, ...this.sources];
      }

      measureError() {
        return {
          label: this.node.label,
          error: Math.abs(this.computeTotalDistance() - this.totalDistance),
          tolerance: CONSTRAINT_EPSILON,
          unit: "px"
        };
      }

      refresh() {
        this.totalDistance = this.computeTotalDistance();
      }

      enforce(moved) {
        if (moved !== this.listener && !this.sources.includes(moved)) {
          return;
        }

        const adjustableSources =
          moved === this.listener ? [...this.sources] : this.sources.filter((source) => source !== moved);
        const currentTotal = this.computeTotalDistance();
        const delta = this.totalDistance - currentTotal;
        const result = distributeDistanceDelta(adjustableSources, delta, this.listener);

        if (!result.satisfied && moved !== this.listener && this.sources.includes(moved)) {
          const movedDistance = this.distanceToListener(moved);
          setSourceDistance(
            moved,
            this.listener,
            Math.max(MIN_DISTANCE, movedDistance + result.remainingDelta)
          );
        }

        const remainingError = this.totalDistance - this.computeTotalDistance();
        if (Math.abs(remainingError) > CONSTRAINT_EPSILON) {
          return {
            satisfied: false,
            movedEntities: result.movedEntities,
            message: "Sum constraint reached its limit; source motion was backed off."
          };
        }

        if (!result.satisfied) {
          return {
            satisfied: true,
            movedEntities: result.movedEntities,
            message: "Sum constraint used backoff to keep distances non-negative."
          };
        }

        return { satisfied: true, movedEntities: result.movedEntities };
      }
    }

    class ProductConstraint {
      constructor(listener, sources) {
        this.listener = listener;
        this.sources = sources;
        this.product = this.computeProduct();
        this.node = new ConstraintNode(listener.x - 90, listener.y, "Product", "#7c3aed", "π");
      }

      computeProduct() {
        return this.sources.reduce((product, source) => product * this.distanceToListener(source), 1);
      }

      distanceToListener(source) {
        return Math.max(MIN_DISTANCE, Math.hypot(source.x - this.listener.x, source.y - this.listener.y));
      }

      affectedEntities() {
        return [this.listener, ...this.sources];
      }

      measureError() {
        return {
          label: this.node.label,
          error: Math.abs(this.computeProduct() - this.product) / Math.max(1, Math.abs(this.product)),
          tolerance: RELATIVE_PRODUCT_EPSILON,
          unit: "relative"
        };
      }

      refresh() {
        this.product = this.computeProduct();
      }

      enforce(moved) {
        if (moved !== this.listener && !this.sources.includes(moved)) {
          return;
        }

        const adjustableSources =
          moved === this.listener ? [...this.sources] : this.sources.filter((source) => source !== moved);
        const result = distributeProduct(adjustableSources, this.product, this.sources, this.listener);
        const error = Math.abs(this.computeProduct() - this.product);

        if (error > PRODUCT_EPSILON) {
          return {
            satisfied: false,
            movedEntities: result.movedEntities,
            message: "Product constraint has no solution within the active limits."
          };
        }

        if (result.usedBackoff) {
          return {
            satisfied: true,
            movedEntities: result.movedEntities,
            message: "Product constraint skipped a limited source and propagated to the remaining sources."
          };
        }

        return { satisfied: true, movedEntities: result.movedEntities };
      }
    }

    class RadialLimitConstraint {
      constructor(listener, source, minDistance, maxDistance) {
        this.listener = listener;
        this.source = source;
        this.minDistance = minDistance;
        this.maxDistance = maxDistance;
        this.node = new ConstraintNode(source.x, source.y - 56, "Limit", "#ea580c");
      }

      refresh() {
        this.updateNode();
      }

      affectedEntities() {
        return [this.listener, this.source];
      }

      measureError() {
        const distance = distanceBetween(this.source, this.listener);
        return {
          label: this.node.label,
          error: Math.max(0, this.minDistance - distance, distance - this.maxDistance),
          tolerance: CONSTRAINT_EPSILON,
          unit: "px"
        };
      }

      updateNode() {
        if (!this.node.isManual) {
          this.node.x = (this.listener.x + this.source.x) / 2;
          this.node.y = (this.listener.y + this.source.y) / 2;
        }
      }

      enforce(moved) {
        if (moved !== this.source && moved !== this.listener) {
          return;
        }

        const distance = Math.hypot(this.source.x - this.listener.x, this.source.y - this.listener.y);
        const clampedDistance = clamp(distance, this.minDistance, this.maxDistance);

        if (Math.abs(distance - clampedDistance) > CONSTRAINT_EPSILON) {
          setSourceDistance(this.source, this.listener, clampedDistance);
          this.updateNode();
          return {
            satisfied: true,
            movedEntity: this.source,
            message: `${this.source.name} reached its radial limit.`
          };
        }

        this.updateNode();
        return { satisfied: true };
      }
    }

    class FixedDistanceConstraint {
      constructor(anchor, target, distance = distanceBetween(anchor, target)) {
        this.anchor = anchor;
        this.target = target;
        this.distance = distance;
        this.node = new ConstraintNode(
          (anchor.x + target.x) / 2,
          (anchor.y + target.y) / 2,
          "Distance",
          "#0f766e"
        );
      }

      refresh() {
        this.distance = distanceBetween(this.anchor, this.target);
        this.updateNode();
      }

      affectedEntities() {
        return [this.anchor, this.target];
      }

      measureError() {
        return {
          label: this.node.label,
          error: Math.abs(distanceBetween(this.anchor, this.target) - this.distance),
          tolerance: CONSTRAINT_EPSILON,
          unit: "px"
        };
      }

      updateNode() {
        if (!this.node.isManual) {
          this.node.x = (this.anchor.x + this.target.x) / 2;
          this.node.y = (this.anchor.y + this.target.y) / 2;
        }
      }

      enforce(moved) {
        if (moved !== this.anchor && moved !== this.target) {
          return;
        }

        if (moved === this.anchor) {
          setEntityDistance(this.target, this.anchor, this.distance);
        } else {
          setEntityDistance(this.target, this.anchor, this.distance);
        }

        this.updateNode();
        return {
          satisfied: true,
          movedEntity: this.target
        };
      }
    }

    class SpringConstraint {
      constructor(
        anchor,
        target,
        restLength = Math.hypot(target.x - anchor.x, target.y - anchor.y),
        stiffness = 40,
        damping = 2
      ) {
        this.anchor = anchor;
        this.target = target;
        this.restLength = restLength;
        this.stiffness = stiffness;
        this.damping = damping;
        this.node = new ConstraintNode(
          (anchor.x + target.x) / 2,
          (anchor.y + target.y) / 2,
          "Spring",
          "#be185d",
          "S"
        );
      }

      affectedEntities() {
        return [this.anchor, this.target];
      }

      refresh() {
        this.restLength = Math.hypot(this.target.x - this.anchor.x, this.target.y - this.anchor.y);
        this.updateNode();
      }

      updateNode() {
        if (!this.node.isManual) {
          this.node.x = (this.anchor.x + this.target.x) / 2;
          this.node.y = (this.anchor.y + this.target.y) / 2;
        }
      }

      // Extension stores energy; it is not a failed geometric constraint.
      measureError() {
        return { label: "Spring", error: 0, tolerance: CONSTRAINT_EPSILON, unit: "px" };
      }
      enforce() {
        this.updateNode();
        return { satisfied: true };
      }
    }

    class DistanceRatioConstraint {
      constructor(listener, a, b, ratio = distanceBetween(a, listener) / distanceBetween(b, listener)) {
        this.listener = listener;
        this.a = a;
        this.b = b;
        this.ratio = ratio;
        this.node = new ConstraintNode((a.x + b.x) / 2, (a.y + b.y) / 2, "Ratio", "#9333ea");
      }

      refresh() {
        this.ratio = distanceBetween(this.a, this.listener) / distanceBetween(this.b, this.listener);
        this.updateNode();
      }

      affectedEntities() {
        return [this.listener, this.a, this.b];
      }

      measureError() {
        const currentRatio =
          distanceBetween(this.a, this.listener) /
          Math.max(MIN_DISTANCE, distanceBetween(this.b, this.listener));
        return {
          label: this.node.label,
          error: Math.abs(currentRatio - this.ratio),
          tolerance: RATIO_EPSILON,
          unit: "ratio"
        };
      }

      updateNode() {
        if (!this.node.isManual) {
          this.node.x = (this.a.x + this.b.x) / 2;
          this.node.y = (this.a.y + this.b.y) / 2;
        }
      }

      enforce(moved) {
        if (moved !== this.listener && moved !== this.a && moved !== this.b) {
          return;
        }

        let movedEntity;
        if (moved === this.b) {
          setEntityDistance(this.a, this.listener, distanceBetween(this.b, this.listener) * this.ratio);
          movedEntity = this.a;
        } else {
          setEntityDistance(this.b, this.listener, distanceBetween(this.a, this.listener) / this.ratio);
          movedEntity = this.b;
        }

        this.updateNode();
        return { satisfied: true, movedEntity };
      }
    }

    class PinConstraint {
      constructor(target, x = target.x, y = target.y) {
        this.target = target;
        this.fixedX = x;
        this.fixedY = y;
        this.node = new ConstraintNode(target.x + 34, target.y - 34, "Pin", "#475569");
      }

      refresh() {
        this.fixedX = this.target.x;
        this.fixedY = this.target.y;
        this.updateNode();
      }

      affectedEntities() {
        return [this.target];
      }

      measureError() {
        return {
          label: this.node.label,
          error: Math.hypot(this.target.x - this.fixedX, this.target.y - this.fixedY),
          tolerance: CONSTRAINT_EPSILON,
          unit: "px"
        };
      }

      updateNode() {
        if (!this.node.isManual) {
          this.node.x = this.target.x + 34;
          this.node.y = this.target.y - 34;
        }
      }

      enforce(moved) {
        if (moved !== this.target) {
          return;
        }

        translateEntity(this.target, this.fixedX - this.target.x, this.fixedY - this.target.y);
        this.updateNode();
        return {
          satisfied: true,
          movedEntity: this.target,
          message: `${entityLabel(this.target)} is pinned.`
        };
      }
    }

    class SolidAttachmentConstraint {
      constructor(carrier, attached, offsetX = attached.x - carrier.x, offsetY = attached.y - carrier.y) {
        this.carrier = carrier;
        this.attached = attached;
        this.offsetX = offsetX;
        this.offsetY = offsetY;
        this.node = new ConstraintNode(
          (carrier.x + attached.x) / 2,
          (carrier.y + attached.y) / 2,
          "Link",
          "#0369a1"
        );
      }

      refresh() {
        this.offsetX = this.attached.x - this.carrier.x;
        this.offsetY = this.attached.y - this.carrier.y;
        this.updateNode();
      }

      affectedEntities() {
        return [this.carrier, this.attached];
      }

      measureError() {
        return {
          label: this.node.label,
          error: Math.hypot(
            this.attached.x - this.carrier.x - this.offsetX,
            this.attached.y - this.carrier.y - this.offsetY
          ),
          tolerance: CONSTRAINT_EPSILON,
          unit: "px"
        };
      }

      updateNode() {
        if (!this.node.isManual) {
          this.node.x = (this.carrier.x + this.attached.x) / 2;
          this.node.y = (this.carrier.y + this.attached.y) / 2;
        }
      }

      enforce(moved) {
        if (moved === this.carrier) {
          this.applyCarrierRotation();
          const nextX = this.carrier.x + this.offsetX;
          const nextY = this.carrier.y + this.offsetY;
          translateEntity(this.attached, nextX - this.attached.x, nextY - this.attached.y);
          this.updateNode();
          return { satisfied: true, movedEntity: this.attached };
        }

        if (moved === this.attached) {
          const nextX = this.attached.x - this.offsetX;
          const nextY = this.attached.y - this.offsetY;
          translateEntity(this.carrier, nextX - this.carrier.x, nextY - this.carrier.y);
          this.updateNode();
          return { satisfied: true, movedEntity: this.carrier };
        }

        return undefined;
      }

      applyCarrierRotation() {
        if (!(this.carrier instanceof MovingObject) || this.carrier.trajectory?.type !== "rotator") {
          return;
        }

        const delta = this.carrier.trajectory.rotationDelta || 0;
        if (Math.abs(delta) < 0.000001) {
          return;
        }

        const rotated = rotateVector(this.offsetX, this.offsetY, delta);
        this.offsetX = rotated.x;
        this.offsetY = rotated.y;
      }
    }

    class MinimumSeparationConstraint {
      constructor(a, b, minDistance = 80) {
        this.a = a;
        this.b = b;
        this.minDistance = minDistance;
        this.node = new ConstraintNode((a.x + b.x) / 2, (a.y + b.y) / 2, "Separate", "#be123c");
      }

      refresh() {
        this.minDistance = Math.max(this.minDistance, distanceBetween(this.a, this.b));
        this.updateNode();
      }

      affectedEntities() {
        return [this.a, this.b];
      }

      measureError() {
        return {
          label: this.node.label,
          error: Math.max(0, this.minDistance - distanceBetween(this.a, this.b)),
          tolerance: CONSTRAINT_EPSILON,
          unit: "px"
        };
      }

      updateNode() {
        if (!this.node.isManual) {
          this.node.x = (this.a.x + this.b.x) / 2;
          this.node.y = (this.a.y + this.b.y) / 2;
        }
      }

      enforce(moved) {
        if (moved !== this.a && moved !== this.b) {
          return;
        }

        const distance = Math.hypot(this.b.x - this.a.x, this.b.y - this.a.y);
        if (distance >= this.minDistance) {
          this.updateNode();
          return { satisfied: true };
        }

        const pushed = moved === this.a ? this.b : this.a;
        const anchor = moved === this.a ? this.a : this.b;
        const angle = distance === 0 ? 0 : Math.atan2(pushed.y - anchor.y, pushed.x - anchor.x);
        const nextX = anchor.x + this.minDistance * Math.cos(angle);
        const nextY = anchor.y + this.minDistance * Math.sin(angle);
        translateEntity(pushed, nextX - pushed.x, nextY - pushed.y);
        this.updateNode();
        return {
          satisfied: true,
          movedEntity: pushed,
          message: "Minimum separation pushed the paired object away."
        };
      }
    }

    class AngleSectorConstraint {
      constructor(
        listener,
        source,
        centerAngle = Math.atan2(source.y - listener.y, source.x - listener.x),
        width = Math.PI / 2
      ) {
        this.listener = listener;
        this.source = source;
        this.centerAngle = centerAngle;
        this.width = width;
        this.node = new ConstraintNode(source.x, source.y - 52, "Sector", "#c2410c");
      }

      refresh() {
        this.centerAngle = Math.atan2(this.source.y - this.listener.y, this.source.x - this.listener.x);
        this.updateNode();
      }

      affectedEntities() {
        return [this.listener, this.source];
      }

      measureError() {
        const angle = Math.atan2(this.source.y - this.listener.y, this.source.x - this.listener.x);
        const delta = normalizeAngle(angle - this.centerAngle);
        return {
          label: this.node.label,
          error: Math.max(0, Math.abs(delta) - this.width / 2),
          tolerance: ANGLE_EPSILON,
          unit: "rad"
        };
      }

      updateNode() {
        if (!this.node.isManual) {
          this.node.x = (this.listener.x + this.source.x) / 2;
          this.node.y = (this.listener.y + this.source.y) / 2;
        }
      }

      enforce(moved) {
        if (moved !== this.source && moved !== this.listener) {
          return;
        }

        const distance = distanceBetween(this.source, this.listener);
        const angle = Math.atan2(this.source.y - this.listener.y, this.source.x - this.listener.x);
        const delta = normalizeAngle(angle - this.centerAngle);
        const halfWidth = this.width / 2;

        if (Math.abs(delta) > halfWidth) {
          const clampedAngle = this.centerAngle + clamp(delta, -halfWidth, halfWidth);
          const nextX = this.listener.x + distance * Math.cos(clampedAngle);
          const nextY = this.listener.y + distance * Math.sin(clampedAngle);
          translateEntity(this.source, nextX - this.source.x, nextY - this.source.y);
          this.updateNode();
          return {
            satisfied: true,
            movedEntity: this.source,
            message: `${entityLabel(this.source)} reached its angle sector.`
          };
        }

        this.updateNode();
        return { satisfied: true };
      }
    }
    function createObjectMap() {
      const objectByName = new Map([[state.listener.name, state.listener]]);
      for (const source of state.sources) {
        objectByName.set(source.name, source);
      }
      for (const mover of state.movingObjects) {
        objectByName.set(mover.name, mover);
      }
      return objectByName;
    }

    function createConstraintFromSpec(spec, objectByName) {
      let constraint = null;

      if (spec.type === "angle") {
        constraint = new AngleConstraint(
          state.listener,
          objectByName.get(spec.sources[0]),
          objectByName.get(spec.sources[1])
        );
      } else if (spec.type === "sum") {
        constraint = new SumConstraint(
          state.listener,
          spec.sources.map((name) => objectByName.get(name))
        );
      } else if (spec.type === "product") {
        constraint = new ProductConstraint(
          state.listener,
          spec.sources.map((name) => objectByName.get(name))
        );
      } else if (spec.type === "radialLimit") {
        constraint = new RadialLimitConstraint(
          state.listener,
          objectByName.get(spec.source),
          spec.minDistance,
          spec.maxDistance
        );
      } else if (spec.type === "spring") {
        constraint = new SpringConstraint(
          objectByName.get(spec.anchor),
          objectByName.get(spec.target),
          spec.restLength,
          spec.stiffness,
          spec.damping
        );
      } else if (spec.type === "fixedDistance") {
        constraint = new FixedDistanceConstraint(
          objectByName.get(spec.anchor),
          objectByName.get(spec.target),
          spec.distance
        );
      } else if (spec.type === "distanceRatio") {
        constraint = new DistanceRatioConstraint(
          state.listener,
          objectByName.get(spec.sources[0]),
          objectByName.get(spec.sources[1]),
          spec.ratio
        );
      } else if (spec.type === "pin") {
        constraint = new PinConstraint(objectByName.get(spec.target), spec.x, spec.y);
      } else if (spec.type === "solid") {
        constraint = new SolidAttachmentConstraint(
          objectByName.get(spec.carrier),
          objectByName.get(spec.attached),
          spec.offsetX,
          spec.offsetY
        );
      } else if (spec.type === "separation") {
        constraint = new MinimumSeparationConstraint(
          objectByName.get(spec.sources[0]),
          objectByName.get(spec.sources[1]),
          spec.minDistance
        );
      } else if (spec.type === "angleSector") {
        constraint = new AngleSectorConstraint(
          state.listener,
          objectByName.get(spec.source),
          spec.centerAngle,
          spec.width
        );
      }

      if (!constraint || hasMissingConstraintSources(constraint)) {
        return null;
      }

      if (constraint instanceof AngleConstraint && spec.angle !== undefined) constraint.angle = spec.angle;
      if (constraint instanceof SumConstraint && spec.totalDistance !== undefined)
        constraint.totalDistance = spec.totalDistance;
      if (constraint instanceof ProductConstraint && spec.product !== undefined)
        constraint.product = spec.product;

      if (spec.node) {
        constraint.node.x = spec.node.x;
        constraint.node.y = spec.node.y;
        constraint.node.isManual = Boolean(spec.node.isManual);
        constraint.node.drawTrace = Boolean(spec.node.drawTrace);
      }

      return constraint;
    }

    function hasMissingConstraintSources(constraint) {
      if (constraint instanceof AngleConstraint) {
        return !constraint.a || !constraint.b;
      }

      if (constraint instanceof SumConstraint || constraint instanceof ProductConstraint) {
        return constraint.sources.some((source) => !source);
      }

      if (constraint instanceof RadialLimitConstraint) {
        return !constraint.source;
      }

      if (constraint instanceof FixedDistanceConstraint || constraint instanceof SpringConstraint) {
        return !constraint.anchor || !constraint.target;
      }

      if (constraint instanceof DistanceRatioConstraint) {
        return !constraint.a || !constraint.b;
      }

      if (constraint instanceof PinConstraint) {
        return !constraint.target;
      }

      if (constraint instanceof SolidAttachmentConstraint) {
        return !constraint.carrier || !constraint.attached;
      }

      if (constraint instanceof MinimumSeparationConstraint) {
        return !constraint.a || !constraint.b;
      }

      if (constraint instanceof AngleSectorConstraint) {
        return !constraint.source;
      }

      return true;
    }

    function constraintReferencesEntity(constraint, entity) {
      if (constraint.node === entity) {
        return true;
      }

      if (constraint instanceof AngleConstraint) {
        return constraint.a === entity || constraint.b === entity || constraint.listener === entity;
      }

      if (constraint instanceof SumConstraint || constraint instanceof ProductConstraint) {
        return constraint.listener === entity || constraint.sources.includes(entity);
      }

      if (constraint instanceof RadialLimitConstraint) {
        return constraint.listener === entity || constraint.source === entity;
      }

      if (constraint instanceof FixedDistanceConstraint || constraint instanceof SpringConstraint) {
        return constraint.anchor === entity || constraint.target === entity;
      }

      if (constraint instanceof DistanceRatioConstraint) {
        return constraint.listener === entity || constraint.a === entity || constraint.b === entity;
      }

      if (constraint instanceof PinConstraint) {
        return constraint.target === entity;
      }

      if (constraint instanceof SolidAttachmentConstraint) {
        return constraint.carrier === entity || constraint.attached === entity;
      }

      if (constraint instanceof MinimumSeparationConstraint) {
        return constraint.a === entity || constraint.b === entity;
      }

      if (constraint instanceof AngleSectorConstraint) {
        return constraint.listener === entity || constraint.source === entity;
      }

      return false;
    }

    function serializeConstraint(constraint) {
      const node = {
        x: constraint.node.x,
        y: constraint.node.y,
        isManual: constraint.node.isManual,
        drawTrace: constraint.node.drawTrace
      };

      if (constraint instanceof AngleConstraint) {
        return {
          type: "angle",
          angle: constraint.angle,
          sources: [entityLabel(constraint.a), entityLabel(constraint.b)],
          node
        };
      }

      if (constraint instanceof SumConstraint) {
        return {
          type: "sum",
          totalDistance: constraint.totalDistance,
          sources: constraint.sources.map(entityLabel),
          node
        };
      }

      if (constraint instanceof ProductConstraint) {
        return {
          type: "product",
          product: constraint.product,
          sources: constraint.sources.map(entityLabel),
          node
        };
      }

      if (constraint instanceof RadialLimitConstraint) {
        return {
          type: "radialLimit",
          source: entityLabel(constraint.source),
          minDistance: constraint.minDistance,
          maxDistance: constraint.maxDistance,
          node
        };
      }

      if (constraint instanceof SpringConstraint) {
        return {
          type: "spring",
          anchor: entityLabel(constraint.anchor),
          target: entityLabel(constraint.target),
          restLength: constraint.restLength,
          stiffness: constraint.stiffness,
          damping: constraint.damping,
          node
        };
      }

      if (constraint instanceof FixedDistanceConstraint) {
        return {
          type: "fixedDistance",
          anchor: entityLabel(constraint.anchor),
          target: entityLabel(constraint.target),
          distance: constraint.distance,
          node
        };
      }

      if (constraint instanceof DistanceRatioConstraint) {
        return {
          type: "distanceRatio",
          sources: [entityLabel(constraint.a), entityLabel(constraint.b)],
          ratio: constraint.ratio,
          node
        };
      }

      if (constraint instanceof PinConstraint) {
        return {
          type: "pin",
          target: entityLabel(constraint.target),
          x: constraint.fixedX,
          y: constraint.fixedY,
          node
        };
      }

      if (constraint instanceof SolidAttachmentConstraint) {
        return {
          type: "solid",
          carrier: entityLabel(constraint.carrier),
          attached: entityLabel(constraint.attached),
          offsetX: constraint.offsetX,
          offsetY: constraint.offsetY,
          node
        };
      }

      if (constraint instanceof MinimumSeparationConstraint) {
        return {
          type: "separation",
          sources: [entityLabel(constraint.a), entityLabel(constraint.b)],
          minDistance: constraint.minDistance,
          node
        };
      }

      if (constraint instanceof AngleSectorConstraint) {
        return {
          type: "angleSector",
          source: entityLabel(constraint.source),
          centerAngle: constraint.centerAngle,
          width: constraint.width,
          node
        };
      }

      return null;
    }

    function distanceBetween(a, b) {
      return Math.max(MIN_DISTANCE, Math.hypot(a.x - b.x, a.y - b.y));
    }

    function setEntityDistance(entity, anchor, distance) {
      const currentDistance = Math.hypot(entity.x - anchor.x, entity.y - anchor.y);
      const angle = currentDistance === 0 ? 0 : Math.atan2(entity.y - anchor.y, entity.x - anchor.x);

      const nextX = anchor.x + distance * Math.cos(angle);
      const nextY = anchor.y + distance * Math.sin(angle);
      translateEntity(entity, nextX - entity.x, nextY - entity.y);
    }

    function setSourceDistance(source, anchor, distance) {
      setEntityDistance(source, anchor, distance);
    }

    function translateEntity(entity, dx, dy) {
      if (entity instanceof MovingObject && entity.trajectory?.type === "rotator") {
        updateRotatorDisplacementDelta(entity, dx, dy);
      }

      entity.x += dx;
      entity.y += dy;

      if (entity instanceof MovingObject) {
        translateTrajectoryFrame(entity.trajectory, dx, dy);
      }
    }

    function translateTrajectoryFrame(trajectory, dx, dy) {
      if (!trajectory) {
        return;
      }

      if (trajectory.type === "rotation") {
        trajectory.centerX += dx;
        trajectory.centerY += dy;
      } else if (trajectory.type === "shuttle") {
        translateShuttleEndpoint(trajectory.start, dx, dy);
        translateShuttleEndpoint(trajectory.end, dx, dy);
        trajectory.ax = trajectory.start.x;
        trajectory.ay = trajectory.start.y;
        trajectory.bx = trajectory.end.x;
        trajectory.by = trajectory.end.y;
      }
    }

    function translateShuttleEndpoint(endpoint, dx, dy) {
      if (!endpoint || endpoint.type !== "fixed") {
        return;
      }

      endpoint.x += dx;
      endpoint.y += dy;
    }

    function updateRotatorDisplacementDelta(mover, dx, dy) {
      const trajectory = mover.trajectory;
      trajectory.rotationDelta = 0;

      if (!trajectory.displacementInducesRotation) {
        return;
      }

      const displacement = Math.hypot(dx, dy);
      if (displacement <= 0.001) {
        return;
      }

      const radius = averageAttachmentRadius(mover);
      trajectory.rotationDelta = (trajectory.direction * displacement) / radius;
      trajectory.phase += trajectory.rotationDelta;
    }

    function averageAttachmentRadius(mover) {
      const radii = state.constraints
        .filter(
          (constraint) => constraint instanceof SolidAttachmentConstraint && constraint.carrier === mover
        )
        .map((constraint) => Math.max(MIN_DISTANCE, Math.hypot(constraint.offsetX, constraint.offsetY)));

      if (radii.length === 0) {
        return 80;
      }

      return radii.reduce((sum, radius) => sum + radius, 0) / radii.length;
    }

    function rotateVector(x, y, angle) {
      return {
        x: x * Math.cos(angle) - y * Math.sin(angle),
        y: x * Math.sin(angle) + y * Math.cos(angle)
      };
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
      if (entity instanceof ConstraintNode) {
        return `${entity.label} constraint`;
      }

      return entity && entity.name ? entity.name : "Object";
    }

    function normalizeAngle(angle) {
      let nextAngle = angle;
      while (nextAngle <= -Math.PI) {
        nextAngle += Math.PI * 2;
      }
      while (nextAngle > Math.PI) {
        nextAngle -= Math.PI * 2;
      }
      return nextAngle;
    }

    function getRadialLimitsForSource(source) {
      const limit = state.constraints.find(
        (constraint) => constraint instanceof RadialLimitConstraint && constraint.source === source
      );

      if (!limit) {
        return { minDistance: MIN_DISTANCE, maxDistance: Number.POSITIVE_INFINITY };
      }

      return {
        minDistance: limit.minDistance,
        maxDistance: limit.maxDistance
      };
    }

    function distributeDistanceDelta(sourcesToAdjust, totalDelta, anchor) {
      let remainingDelta = totalDelta;
      const activeSources = [...sourcesToAdjust];
      const movedEntities = new Set();

      while (activeSources.length > 0 && Math.abs(remainingDelta) > CONSTRAINT_EPSILON) {
        const share = remainingDelta / activeSources.length;
        let appliedDelta = 0;
        let clampedAny = false;

        for (let index = activeSources.length - 1; index >= 0; index -= 1) {
          const source = activeSources[index];
          const currentDistance = Math.hypot(source.x - anchor.x, source.y - anchor.y);
          const nextDistance = currentDistance + share;

          if (nextDistance < MIN_DISTANCE) {
            setSourceDistance(source, anchor, MIN_DISTANCE);
            movedEntities.add(source);
            appliedDelta += MIN_DISTANCE - currentDistance;
            activeSources.splice(index, 1);
            clampedAny = true;
          }
        }

        if (!clampedAny) {
          for (const source of activeSources) {
            const currentDistance = Math.hypot(source.x - anchor.x, source.y - anchor.y);
            setSourceDistance(source, anchor, currentDistance + share);
            movedEntities.add(source);
          }
          remainingDelta = 0;
          break;
        }

        remainingDelta -= appliedDelta;
      }

      return {
        satisfied: Math.abs(remainingDelta) <= CONSTRAINT_EPSILON,
        remainingDelta,
        movedEntities: [...movedEntities]
      };
    }

    function distributeProduct(sourcesToAdjust, targetProduct, allSources, anchor) {
      const activeSources = [...sourcesToAdjust];
      const movedEntities = new Set();
      let usedBackoff = false;

      while (activeSources.length > 0) {
        const fixedProduct = allSources
          .filter((source) => !activeSources.includes(source))
          .reduce((product, source) => product * distanceBetween(source, anchor), 1);
        const targetActiveProduct = targetProduct / fixedProduct;
        const currentActiveProduct = activeSources.reduce(
          (product, source) => product * distanceBetween(source, anchor),
          1
        );

        if (targetActiveProduct <= 0 || currentActiveProduct <= 0) {
          return { satisfied: false, usedBackoff, movedEntities: [...movedEntities] };
        }

        const factor = Math.pow(targetActiveProduct / currentActiveProduct, 1 / activeSources.length);
        let clampedAny = false;

        for (let index = activeSources.length - 1; index >= 0; index -= 1) {
          const source = activeSources[index];
          const currentDistance = distanceBetween(source, anchor);
          const nextDistance = currentDistance * factor;
          const { minDistance, maxDistance } = getRadialLimitsForSource(source);
          const clampedDistance = clamp(nextDistance, minDistance, maxDistance);

          if (Math.abs(nextDistance - clampedDistance) > CONSTRAINT_EPSILON) {
            setSourceDistance(source, anchor, clampedDistance);
            movedEntities.add(source);
            activeSources.splice(index, 1);
            clampedAny = true;
            usedBackoff = true;
          }
        }

        if (!clampedAny) {
          for (const source of activeSources) {
            const currentDistance = distanceBetween(source, anchor);
            setSourceDistance(source, anchor, currentDistance * factor);
            if (Math.abs(currentDistance * factor - currentDistance) > CONSTRAINT_EPSILON) {
              movedEntities.add(source);
            }
          }
          return { satisfied: true, usedBackoff, movedEntities: [...movedEntities] };
        }
      }

      return { satisfied: false, usedBackoff, movedEntities: [...movedEntities] };
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

    function refreshConstraints() {
      for (const constraint of state.constraints) {
        if (constraint instanceof SpringConstraint) constraint.updateNode();
        else constraint.refresh();
      }
      state.propagationPaused = false;
      state.lastPropagationReport = null;
      setConstraintStatus("");
    }

    function moveEntity(entity, x, y, { skipPropagation = false } = {}) {
      const nextX = clamp(x, 0, WIDTH);
      const nextY = clamp(y, 0, HEIGHT);
      translateEntity(entity, nextX - entity.x, nextY - entity.y);
      if (entity.dynamics) {
        entity.dynamics.vx = 0;
        entity.dynamics.vy = 0;
      }

      if (skipPropagation) {
        pausePropagation(entity);
      } else if (entity === state.listener && state.listenerMode === LISTENER_MODE_RETARGET) {
        state.propagationPaused = false;
        refreshConstraints();
      } else {
        state.propagationPaused = false;
        enforceConstraints(entity);
      }

      return getLastPropagationReport();
    }

    function pausePropagation(entity) {
      state.propagationPaused = true;
      state.lastPropagationReport = createPropagationReport({
        hitEntityCap: false,
        hitStepCap: false,
        messages: ["Propagation paused (Shift). Constraints are not being enforced."],
        movedEntities: entity ? [entity] : [],
        processCounts: new Map(),
        propagationPaused: true,
        propagationSteps: 0
      });
      setConstraintStatus(formatPropagationStatus(state.lastPropagationReport));
    }

    function resumePropagationAfterPausedDrag() {
      state.propagationPaused = false;
      refreshConstraints();
      setConstraintStatus("Propagation resumed; constraints retargeted to paused positions.");
    }

    function clamp(value, min, max) {
      return Math.max(min, Math.min(max, value));
    }
    const classes = {
      Entity,
      Listener,
      SoundSource,
      MovingObject,
      ConstraintNode,
      AngleConstraint,
      SumConstraint,
      ProductConstraint,
      RadialLimitConstraint,
      FixedDistanceConstraint,
      SpringConstraint,
      DistanceRatioConstraint,
      PinConstraint,
      SolidAttachmentConstraint,
      MinimumSeparationConstraint,
      AngleSectorConstraint
    };
    const solvers = solverApi.createSolvers({
      state,
      classes,
      graph,
      geometry: { translateEntity, rotateVector, distanceBetween, entityLabel, normalizeAngle, clamp },
      onStatus: setConstraintStatus
    });
    const { enforceConstraints, createPropagationReport, formatPropagationStatus, getLastPropagationReport } =
      solvers;

    function loadPatch(patch) {
      lastValidation = validatePatch(patch);
      if (lastValidation.some((finding) => finding.level === "error")) return false;
      const previous = { ...state };
      try {
        const candidate = patchApi.clonePatch(patch);
        state.listener = new Listener(candidate.listener.x, candidate.listener.y);
        state.listener.drawTrace = Boolean(candidate.listener.drawTrace);
        state.sources = candidate.sources.map((source) =>
          Object.assign(new SoundSource(source.x, source.y, source.name), {
            drawTrace: Boolean(source.drawTrace),
            ...(source.dynamics ? { dynamics: normalizeDynamics(source.dynamics) } : {})
          })
        );
        state.movingObjects = (candidate.movingObjects || []).map((mover) =>
          Object.assign(new MovingObject(mover.x, mover.y, mover.name, { type: "free" }), {
            drawTrace: Boolean(mover.drawTrace),
            ...(mover.dynamics ? { dynamics: normalizeDynamics(mover.dynamics) } : {})
          })
        );
        state.movingObjects.forEach((mover, index) => {
          mover.trajectory = normalizeTrajectory(candidate.movingObjects[index].trajectory, mover.x, mover.y);
        });
        const byName = createObjectMap();
        state.constraints = (candidate.constraints || []).map((spec) =>
          createConstraintFromSpec(spec, byName)
        );
        if (state.constraints.some((constraint) => !constraint))
          throw new Error("Could not construct constraints.");
        state.gravity = { x: 0, y: 0, ...candidate.gravity };
        state.draggedEntity = null;
        solvers.initializeDynamics();
        state.lastPropagationReport = null;
        state.propagationPaused = false;
        patchData = candidate;
        return true;
      } catch (error) {
        Object.assign(state, previous);
        lastValidation = [{ level: "error", message: error.message }];
        return false;
      }
    }
    function normalizeDynamics(body = {}) {
      return { mass: body.mass ?? 1, vx: body.vx ?? 0, vy: body.vy ?? 0 };
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
    function step(dt = 1 / 60) {
      for (const mover of state.movingObjects) {
        if (mover.tick()) enforceConstraints(mover, { preserveTrajectoryFrame: true });
      }
      solvers.stepDynamics(dt);
      return getLastPropagationReport();
    }
    return {
      state,
      classes,
      graph,
      ...solvers,
      constraintReferencesEntity,
      distanceBetween,
      translateEntity,
      resolveTrajectoryEndpoint,
      getObjectByName,
      entityLabel,
      normalizeTrajectory,
      parameterFeatureValue,
      refreshConstraints,
      moveEntity,
      resumePropagationAfterPausedDrag,
      clamp,
      loadPatch,
      serializePatch,
      step,
      beginDrag(entity) {
        state.draggedEntity = entity;
        if (entity.dynamics) {
          entity.dynamics.vx = 0;
          entity.dynamics.vy = 0;
        }
      },
      endDrag() {
        state.draggedEntity = null;
      },
      validatePatch,
      validation: () => lastValidation.slice(),
      getSolverMode: () => state.solverMode,
      setSolverMode(mode) {
        state.solverMode = mode === SOLVER_MODE_XPBD ? mode : SOLVER_MODE_PROPAGATION;
      }
    };
  }
  const api = { createSceneModel };
  if (isNode) module.exports = api;
  else global.MusicSpaceModel = api;
})(globalThis);
