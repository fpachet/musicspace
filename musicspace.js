// MusicSpace prototype: draggable sources and constraint nodes on a 2D canvas.

const WIDTH = 800;
const HEIGHT = 600;

const traceCanvas = document.getElementById("trace");
const traceCtx = traceCanvas.getContext("2d");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const stage = document.getElementById("stage");

const animationToggle = document.getElementById("animation-toggle");
const undoButton = document.getElementById("undo");
const traceSelectedButton = document.getElementById("trace-selected");
const traceNoneButton = document.getElementById("trace-none");
const patchSelect = document.getElementById("patch-select");
const savePatchButton = document.getElementById("save-patch");
const loadPatchButton = document.getElementById("load-patch");
const patchFileInput = document.getElementById("patch-file");
const clearTraceButton = document.getElementById("clear-trace");
const resetButton = document.getElementById("reset");
const saveTraceButton = document.getElementById("save-trace");
const targetToggleButton = document.getElementById("target-toggle");
const targetPanel = document.getElementById("target-panel");
const targetGrid = document.getElementById("target-grid");
const midiToggleButton = document.getElementById("midi-toggle");
const midiLoadSequenceButton = document.getElementById("midi-load-sequence");
const midiSequenceFileInput = document.getElementById("midi-sequence-file");
const midiModeSelect = document.getElementById("midi-mode");
const midiOutputSelect = document.getElementById("midi-output");
const midiPanel = document.getElementById("midi-panel");
const midiTrackList = document.getElementById("midi-track-list");
const midiStatus = document.getElementById("midi-status");
const patchSummary = document.getElementById("patch-summary");
const patchValidation = document.getElementById("patch-validation");
const patchJsonToggle = document.getElementById("patch-json-toggle");
const patchJsonEditor = document.getElementById("patch-json-editor");
const patchJsonTextarea = document.getElementById("patch-json");
const patchJsonApplyButton = document.getElementById("patch-json-apply");
const patchValidateButton = document.getElementById("patch-validate");
const constraintStatus = document.getElementById("constraint-status");
const solverModePropagationButton = document.getElementById("solver-mode-propagation");
const solverModeXpbdButton = document.getElementById("solver-mode-xpbd");
const listenerModeRetargetButton = document.getElementById("listener-mode-retarget");
const listenerModePreserveButton = document.getElementById("listener-mode-preserve");
const toolButtons = Array.from(document.querySelectorAll("[data-tool]"));
const rotationEditor = document.getElementById("rotation-editor");
const rotationRunningInput = document.getElementById("rotation-running");
const rotationDisplacementInput = document.getElementById("rotation-displacement");
const rotationPeriodInput = document.getElementById("rotation-period");
const rotationDirectionInput = document.getElementById("rotation-direction");
const rotationApplyButton = document.getElementById("rotation-apply");
const rotationCloseButton = document.getElementById("rotation-close");
const shuttleEditor = document.getElementById("shuttle-editor");
const shuttleStartRefInput = document.getElementById("shuttle-start-ref");
const shuttleEndRefInput = document.getElementById("shuttle-end-ref");
const shuttleStartXInput = document.getElementById("shuttle-start-x");
const shuttleStartYInput = document.getElementById("shuttle-start-y");
const shuttleEndXInput = document.getElementById("shuttle-end-x");
const shuttleEndYInput = document.getElementById("shuttle-end-y");
const shuttleSpeedInput = document.getElementById("shuttle-speed");
const shuttleShowPathInput = document.getElementById("shuttle-show-path");
const shuttleApplyButton = document.getElementById("shuttle-apply");
const shuttleCloseButton = document.getElementById("shuttle-close");

const LISTENER_MODE_RETARGET = "retarget";
const LISTENER_MODE_PRESERVE = "preserve";
const MIN_DISTANCE = 2;
const CONSTRAINT_EPSILON = 0.5;
const PRODUCT_EPSILON = 0.01;
const MAX_PROPAGATION_STEPS = 96;
const MAX_ENTITY_PROPAGATION_COUNT = 8;
const SOLVER_MODE_PROPAGATION = "propagation";
const SOLVER_MODE_XPBD = "xpbd";
const DEFAULT_SOLVER_MODE = SOLVER_MODE_PROPAGATION;
const XPBD_ITERATIONS_DRAG = 10;
const XPBD_ITERATIONS_RELEASE = 40;
const MAX_XPBD_COMPONENT_ENTITIES = 48;
const MAX_XPBD_COMPONENT_CONSTRAINTS = 96;
const ANGLE_EPSILON = 0.01;
const RATIO_EPSILON = 0.01;
const RELATIVE_PRODUCT_EPSILON = 0.001;
const TOOL_SELECT = "select";
const FRAMES_PER_SECOND = 60;
const DOUBLE_CLICK_MS = 450;
const DOUBLE_CLICK_DISTANCE = 12;

const PATCH_INDEX_URL = "patches/index.json";
let builtInPatches = [];

canvas.width = WIDTH;
canvas.height = HEIGHT;
traceCanvas.width = WIDTH;
traceCanvas.height = HEIGHT;

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

  draw(ctx) {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.stroke();
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

  draw(ctx) {
    super.draw(ctx);
    drawListenerGlyph(ctx, this.x, this.y);
  }
}

class SoundSource extends Entity {
  constructor(x, y, name) {
    super(x, y, "#dc2626");
    this.name = name;
    this.prevX = x;
    this.prevY = y;
  }

  draw(ctx) {
    super.draw(ctx);
    ctx.fillStyle = "#ffffff";
    ctx.font = "700 12px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(this.name, this.x, this.y);
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

  draw(ctx) {
    if (this.trajectory?.type === "rotator") {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius + 3, 0, Math.PI * 2);
      ctx.fillStyle = "#f97316";
      ctx.fill();
      ctx.strokeStyle = "#fed7aa";
      ctx.lineWidth = 4;
      ctx.stroke();
    } else {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(Math.PI / 4);
      ctx.beginPath();
      ctx.rect(-this.radius, -this.radius, this.radius * 2, this.radius * 2);
      ctx.fillStyle = this.color;
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }

    ctx.fillStyle = "#ffffff";
    ctx.font = "700 10px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(this.trajectory?.type === "rotator" ? "R" : "M", this.x, this.y);

    ctx.fillStyle = "#0f172a";
    ctx.font = "12px sans-serif";
    ctx.textBaseline = "bottom";
    ctx.fillText(this.name, this.x, this.y - 18);
  }

  tick() {
    const trajectory = this.trajectory || { type: "free" };
    trajectory.rotationDelta = 0;

    if (trajectory.type === "translation") {
      this.x += trajectory.vx;
      this.y += trajectory.vy;
      if (trajectory.bounce) {
        this.reflectWithinBounds(trajectory);
      }
      return true;
    }

    if (trajectory.type === "rotation") {
      trajectory.phase += trajectory.angularSpeed;
      this.x = trajectory.centerX + trajectory.radius * Math.cos(trajectory.phase);
      this.y = trajectory.centerY + trajectory.radius * Math.sin(trajectory.phase);
      return true;
    }

    if (trajectory.type === "shuttle") {
      trajectory.phase += trajectory.speed * trajectory.direction;
      if (trajectory.phase > 1 || trajectory.phase < 0) {
        trajectory.phase = clamp(trajectory.phase, 0, 1);
        trajectory.direction *= -1;
      }
      const start = resolveTrajectoryEndpoint(trajectory.start, trajectory.ax, trajectory.ay);
      const end = resolveTrajectoryEndpoint(trajectory.end, trajectory.bx, trajectory.by);
      this.x = start.x + (end.x - start.x) * trajectory.phase;
      this.y = start.y + (end.y - start.y) * trajectory.phase;
      return true;
    }

    if (trajectory.type === "bounce") {
      this.x += trajectory.vx;
      this.y += trajectory.vy;
      this.reflectWithinBounds(trajectory);
      return true;
    }

    if (trajectory.type === "rotator") {
      if (!trajectory.running) {
        return false;
      }

      trajectory.rotationDelta = rotatorFrameDelta(trajectory);
      trajectory.phase += trajectory.rotationDelta;
      return Math.abs(trajectory.rotationDelta) > 0;
    }

    return false;
  }

  reflectWithinBounds(trajectory) {
    if (this.x < this.radius || this.x > WIDTH - this.radius) {
      trajectory.vx *= -1;
      this.x = clamp(this.x, this.radius, WIDTH - this.radius);
    }

    if (this.y < this.radius || this.y > HEIGHT - this.radius) {
      trajectory.vy *= -1;
      this.y = clamp(this.y, this.radius, HEIGHT - this.radius);
    }
  }
}

class ConstraintNode extends Entity {
  constructor(x, y, label, color = "#d97706", glyph = label[0]) {
    super(x, y, color);
    this.label = label;
    this.glyph = glyph;
    this.isManual = false;
  }

  draw(ctx) {
    super.draw(ctx);
    ctx.fillStyle = "#111827";
    ctx.font = "12px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText(this.label, this.x, this.y - 18);

    ctx.fillStyle = "#ffffff";
    ctx.font = "700 11px sans-serif";
    ctx.textBaseline = "middle";
    ctx.fillText(this.glyph, this.x, this.y);
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
    return Math.atan2(this.b.y - this.listener.y, this.b.x - this.listener.x) -
      Math.atan2(this.a.y - this.listener.y, this.a.x - this.listener.x);
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

  draw(ctx) {
    drawConnector(ctx, this.node, this.a, "#2563eb");
    drawConnector(ctx, this.node, this.b, "#2563eb");
    drawConnector(ctx, this.node, this.listener, "#2563eb");
    this.node.draw(ctx);
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

    const adjustableSources = moved === this.listener
      ? [...this.sources]
      : this.sources.filter((source) => source !== moved);
    const currentTotal = this.computeTotalDistance();
    const delta = this.totalDistance - currentTotal;
    const result = distributeDistanceDelta(adjustableSources, delta, this.listener);

    if (!result.satisfied && moved !== this.listener && this.sources.includes(moved)) {
      const movedDistance = this.distanceToListener(moved);
      setSourceDistance(moved, this.listener, Math.max(MIN_DISTANCE, movedDistance + result.remainingDelta));
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

  draw(ctx) {
    for (const source of this.sources) {
      drawConnector(ctx, this.node, source, "#059669");
    }
    drawConnector(ctx, this.node, this.listener, "#059669");
    this.node.draw(ctx);
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

    const adjustableSources = moved === this.listener
      ? [...this.sources]
      : this.sources.filter((source) => source !== moved);
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

  draw(ctx) {
    for (const source of this.sources) {
      drawConnector(ctx, this.node, source, "#7c3aed");
    }
    drawConnector(ctx, this.node, this.listener, "#7c3aed");
    this.node.draw(ctx);
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

  draw(ctx) {
    drawRadialLimit(ctx, this.listener, this.minDistance, this.maxDistance, "#ea580c");
    drawConnector(ctx, this.node, this.source, "#ea580c");
    drawConnector(ctx, this.node, this.listener, "#ea580c");
    this.node.draw(ctx);
  }
}

class FixedDistanceConstraint {
  constructor(anchor, target, distance = distanceBetween(anchor, target)) {
    this.anchor = anchor;
    this.target = target;
    this.distance = distance;
    this.node = new ConstraintNode((anchor.x + target.x) / 2, (anchor.y + target.y) / 2, "Distance", "#0f766e");
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

  draw(ctx) {
    drawConnector(ctx, this.node, this.anchor, "#0f766e");
    drawConnector(ctx, this.node, this.target, "#0f766e");
    this.node.draw(ctx);
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
    const currentRatio = distanceBetween(this.a, this.listener) / Math.max(MIN_DISTANCE, distanceBetween(this.b, this.listener));
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

  draw(ctx) {
    drawConnector(ctx, this.node, this.a, "#9333ea");
    drawConnector(ctx, this.node, this.b, "#9333ea");
    drawConnector(ctx, this.node, this.listener, "#9333ea");
    this.node.draw(ctx);
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

  draw(ctx) {
    drawConnector(ctx, this.node, this.target, "#475569");
    this.node.draw(ctx);
  }
}

class SolidAttachmentConstraint {
  constructor(carrier, attached, offsetX = attached.x - carrier.x, offsetY = attached.y - carrier.y) {
    this.carrier = carrier;
    this.attached = attached;
    this.offsetX = offsetX;
    this.offsetY = offsetY;
    this.node = new ConstraintNode((carrier.x + attached.x) / 2, (carrier.y + attached.y) / 2, "Link", "#0369a1");
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

  draw(ctx) {
    drawConnector(ctx, this.node, this.carrier, "#0369a1");
    drawConnector(ctx, this.node, this.attached, "#0369a1");
    this.node.draw(ctx);
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

  draw(ctx) {
    drawConnector(ctx, this.node, this.a, "#be123c");
    drawConnector(ctx, this.node, this.b, "#be123c");
    this.node.draw(ctx);
  }
}

class AngleSectorConstraint {
  constructor(listener, source, centerAngle = Math.atan2(source.y - listener.y, source.x - listener.x), width = Math.PI / 2) {
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

  draw(ctx) {
    drawAngleSector(ctx, this.listener, this.centerAngle, this.width, "#c2410c");
    drawConnector(ctx, this.node, this.source, "#c2410c");
    drawConnector(ctx, this.node, this.listener, "#c2410c");
    this.node.draw(ctx);
  }
}

let listener;
let sources;
let movingObjects;
let constraints;
let dragged = null;
let selectedEntity = null;
let hoveredEntity = null;
let activeTool = TOOL_SELECT;
let pendingToolEntities = [];
let lastCanvasClick = null;
let activeRotationMover = null;
let activeShuttleMover = null;
let undoStack = [];
let listenerMode = LISTENER_MODE_RETARGET;
let isAnimating = false;
let animationFrame = null;
let velocity = { x: 0, y: 0 };
let activePatch = null;
let lastPropagationReport = null;
let propagationPaused = false;
let solverMode = getInitialSolverMode();
const loadedSequencePatches = new Map();
const parameterClient = MusicSpaceParameterClient.createParameterClient({
  toggleButton: targetToggleButton,
  panel: targetPanel,
  grid: targetGrid,
  onStatus: setConstraintStatus,
  getEntity: getObjectByName,
  getFeature: parameterFeatureValue
});
const midiFileClient = MusicSpaceMidiFileClient.createMidiFileClient({
  playButton: midiToggleButton,
  modeSelect: midiModeSelect,
  outputSelect: midiOutputSelect,
  panel: midiPanel,
  trackList: midiTrackList,
  status: midiStatus,
  onStatus: setConstraintStatus,
  getSource: getObjectByName,
  getListener: () => listener
});

function resetScene() {
  if (!activePatch) {
    setConstraintStatus("No patch is loaded.");
    return;
  }

  pushUndoSnapshot("reset");
  loadPatch(activePatch, { preserveAsActive: false });
}

function clonePatch(patch) {
  return JSON.parse(JSON.stringify(patch));
}

function populatePatchSelect() {
  patchSelect.replaceChildren();

  for (const patch of builtInPatches) {
    const option = document.createElement("option");
    option.value = patch.key;
    option.textContent = patch.name;
    patchSelect.append(option);
  }
}

async function loadBuiltInPatchLibrary() {
  const index = await fetchJson(PATCH_INDEX_URL);
  const entries = Array.isArray(index.patches) ? index.patches : [];
  const baseUrl = new URL(PATCH_INDEX_URL, window.location.href);

  builtInPatches = await Promise.all(entries.map(async (entry) => {
    const file = entry.file || `${entry.key}.json`;
    const patchUrl = new URL(file, baseUrl);
    const patch = await fetchJson(patchUrl.href);
    return {
      ...patch,
      version: patch.version || index.version || 1,
      key: patch.key || entry.key,
      name: patch.name || entry.name || entry.key
    };
  }));

  if (builtInPatches.length === 0) {
    throw new Error("Patch index did not list any patches.");
  }
}

async function fetchJson(url) {
  const response = await fetch(url, { cache: "no-cache" });
  if (!response.ok) {
    throw new Error(`Could not load ${url} (${response.status} ${response.statusText})`);
  }
  return response.json();
}

function getInitialSolverMode() {
  try {
    const mode = new URL(window.location.href).searchParams.get("solver");
    return mode === SOLVER_MODE_XPBD ? SOLVER_MODE_XPBD : DEFAULT_SOLVER_MODE;
  } catch (error) {
    return DEFAULT_SOLVER_MODE;
  }
}

function selectPatchOptionForPatch(patch) {
  const key = patch.key || `loaded-sequence-${Date.now()}`;
  let option = Array.from(patchSelect.options).find((candidate) => candidate.value === key);
  patch.key = key;

  if (!option) {
    option = document.createElement("option");
    option.value = key;
    patchSelect.append(option);
  }

  option.textContent = patch.name || "Loaded Sequence";
  patchSelect.value = key;
  loadedSequencePatches.set(key, clonePatch(patch));
}

function loadMenuPatch(key, options = {}) {
  const patch = loadedSequencePatches.get(key) ||
    builtInPatches.find((candidate) => candidate.key === key) ||
    builtInPatches[0];

  if (!patch) {
    setConstraintStatus("No patch is available to load.");
    return;
  }

  loadPatch(clonePatch(patch), { preserveAsActive: true, clearUndo: options.clearUndo ?? true });
}

function loadPatch(patch, { preserveAsActive = true, clearUndo = false } = {}) {
  if (!patch || !patch.listener || !Array.isArray(patch.sources)) {
    setConstraintStatus("Patch file is missing listener or sources.");
    return;
  }

  if (preserveAsActive) {
    activePatch = clonePatch(patch);
  }

  if (clearUndo) {
    undoStack = [];
  }

  listener = new Listener(patch.listener.x, patch.listener.y);
  listener.drawTrace = Boolean(patch.listener.drawTrace);
  sources = patch.sources.map((source) => {
    const nextSource = new SoundSource(source.x, source.y, source.name);
    nextSource.drawTrace = Boolean(source.drawTrace);
    return nextSource;
  });
  movingObjects = (patch.movingObjects || [])
    .map((mover) => {
      const nextMover = new MovingObject(mover.x, mover.y, mover.name, mover.trajectory);
      nextMover.drawTrace = Boolean(mover.drawTrace);
      return nextMover;
    });
  const objectByName = createObjectMap();
  constraints = (patch.constraints || [])
    .map((constraint) => createConstraintFromSpec(constraint, objectByName))
    .filter(Boolean);
  parameterClient.loadPatch(patch);
  midiFileClient.loadPatch(patch);
  dragged = null;
  selectedEntity = listener;
  hoveredEntity = null;
  lastPropagationReport = null;
  propagationPaused = false;
  pendingToolEntities = [];
  activeRotationMover = null;
  activeShuttleMover = null;
  rotationEditor.hidden = true;
  shuttleEditor.hidden = true;
  velocity = { x: 0, y: 0 };
  setConstraintStatus("");
  clearTrace();
  drawAll();
  updatePatchInspector();
}

function pushUndoSnapshot(reason = "edit") {
  if (!listener || !sources || !movingObjects || !constraints) {
    return;
  }

  undoStack.push({
    reason,
    patch: serializePatch()
  });

  if (undoStack.length > 60) {
    undoStack.shift();
  }
}

function undoLastEdit() {
  const snapshot = undoStack.pop();
  if (!snapshot) {
    setConstraintStatus("Nothing to undo.");
    return;
  }

  stopAnimation();
  loadPatch(snapshot.patch, { preserveAsActive: true, clearUndo: false });
  setConstraintStatus(`Undid ${snapshot.reason}.`);
}

function createObjectMap() {
  const objectByName = new Map([[listener.name, listener]]);
  for (const source of sources) {
    objectByName.set(source.name, source);
  }
  for (const mover of movingObjects) {
    objectByName.set(mover.name, mover);
  }
  return objectByName;
}

function createConstraintFromSpec(spec, objectByName) {
  let constraint = null;

  if (spec.type === "angle") {
    constraint = new AngleConstraint(listener, objectByName.get(spec.sources[0]), objectByName.get(spec.sources[1]));
  } else if (spec.type === "sum") {
    constraint = new SumConstraint(listener, spec.sources.map((name) => objectByName.get(name)));
  } else if (spec.type === "product") {
    constraint = new ProductConstraint(listener, spec.sources.map((name) => objectByName.get(name)));
  } else if (spec.type === "radialLimit") {
    constraint = new RadialLimitConstraint(
      listener,
      objectByName.get(spec.source),
      spec.minDistance,
      spec.maxDistance
    );
  } else if (spec.type === "fixedDistance") {
    constraint = new FixedDistanceConstraint(
      objectByName.get(spec.anchor),
      objectByName.get(spec.target),
      spec.distance
    );
  } else if (spec.type === "distanceRatio") {
    constraint = new DistanceRatioConstraint(
      listener,
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
      listener,
      objectByName.get(spec.source),
      spec.centerAngle,
      spec.width
    );
  }

  if (!constraint || hasMissingConstraintSources(constraint)) {
    return null;
  }

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

  if (constraint instanceof FixedDistanceConstraint) {
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

  if (constraint instanceof FixedDistanceConstraint) {
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

function serializePatch() {
  const parameterState = parameterClient.serialize();
  const midiState = midiFileClient.serialize();

  return {
    version: 1,
    name: activePatch.name || "MusicSpace Patch",
    listener: { x: listener.x, y: listener.y, drawTrace: listener.drawTrace },
    sources: sources.map((source) => ({
      name: source.name,
      x: source.x,
      y: source.y,
      drawTrace: source.drawTrace
    })),
    movingObjects: movingObjects.map((mover) => ({
      name: mover.name,
      x: mover.x,
      y: mover.y,
      drawTrace: mover.drawTrace,
      trajectory: mover.trajectory
    })),
    constraints: constraints.map(serializeConstraint).filter(Boolean),
    ...parameterState,
    ...midiState
  };
}

function serializeConstraint(constraint) {
  const node = {
    x: constraint.node.x,
    y: constraint.node.y,
    isManual: constraint.node.isManual,
    drawTrace: constraint.node.drawTrace
  };

  if (constraint instanceof AngleConstraint) {
    return { type: "angle", sources: [entityLabel(constraint.a), entityLabel(constraint.b)], node };
  }

  if (constraint instanceof SumConstraint) {
    return { type: "sum", sources: constraint.sources.map(entityLabel), node };
  }

  if (constraint instanceof ProductConstraint) {
    return { type: "product", sources: constraint.sources.map(entityLabel), node };
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

function currentPatchSnapshot() {
  if (!listener || !sources || !movingObjects || !constraints) {
    return activePatch ? clonePatch(activePatch) : null;
  }

  const patch = serializePatch();
  if (activePatch?.$schema) {
    patch.$schema = activePatch.$schema;
  }
  if (activePatch?.key) {
    patch.key = activePatch.key;
  }
  return patch;
}

function updatePatchInspector({ refreshJson = true } = {}) {
  if (!patchSummary || !patchValidation) {
    return;
  }

  const patch = currentPatchSnapshot();
  renderPatchSummary(patch);
  renderPatchValidation(validatePatch(patch));

  if (
    patchJsonTextarea &&
    patch &&
    refreshJson &&
    !patchJsonEditor.hidden &&
    document.activeElement !== patchJsonTextarea
  ) {
    patchJsonTextarea.value = JSON.stringify(patch, null, 2);
  }
}

function renderPatchSummary(patch) {
  patchSummary.replaceChildren();

  if (!patch) {
    patchSummary.append(createInspectorSection("Patch", ["No patch loaded."]));
    return;
  }

  const constraintLines = (patch.constraints || []).map(describeConstraintSpec);
  const mappingLines = (patch.parameterMappings || []).map(describeParameterMapping);
  const midiLines = (patch.midiFile?.trackBindings || []).map(describeMidiBinding);
  const backendLines = describePatchBackend(patch);

  patchSummary.append(
    createInspectorSection("Patch", [
      `Name: ${patch.name || "Untitled"}`,
      `Key: ${patch.key || "unsaved"}`,
      `Version: ${patch.version || 1}`
    ]),
    createInspectorSection("Scene", [
      `Sources: ${(patch.sources || []).length}`,
      `Moving objects: ${(patch.movingObjects || []).length}`,
      `Constraints: ${(patch.constraints || []).length}`
    ]),
    createInspectorSection("Backend", backendLines),
    createInspectorSection("Constraints", constraintLines.length ? constraintLines : ["None"]),
    createInspectorSection("Mappings", mappingLines.length ? mappingLines : ["None"]),
    createInspectorSection("MIDI", midiLines.length ? midiLines : ["None"])
  );
}

function createInspectorSection(title, lines) {
  const section = document.createElement("section");
  const heading = document.createElement("h3");
  const list = document.createElement("ul");

  section.className = "inspector-section";
  heading.textContent = title;
  list.className = "inspector-list";

  for (const line of lines) {
    const item = document.createElement("li");
    item.textContent = line;
    list.append(item);
  }

  section.append(heading, list);
  return section;
}

function describePatchBackend(patch) {
  const target = patch.target || patch.audioSynth || null;
  const type = target?.type || (patch.midiFile ? "midi-file?" : "subtractive");
  const lines = [`Type: ${type}`];

  if (target?.name) {
    lines.push(`Name: ${target.name}`);
  }
  if (target?.module) {
    lines.push(`Module: ${target.module}`);
  }
  if (target?.dsp) {
    lines.push(`DSP: ${target.dsp}`);
  }
  if (target?.wasm) {
    lines.push(`WASM: ${target.wasm}`);
  }
  if (target?.json || target?.metadata) {
    lines.push(`Metadata: ${target.json || target.metadata}`);
  }
  if (patch.midiFile?.url) {
    lines.push(`Sequence: ${patch.midiFile.url}`);
  }
  return lines;
}

function describeConstraintSpec(spec) {
  if (!spec || !spec.type) {
    return "Invalid constraint";
  }
  if (spec.type === "angle") {
    return `Angle: ${(spec.sources || []).join(" / ")}`;
  }
  if (spec.type === "sum" || spec.type === "product") {
    return `${capitalize(spec.type)}: ${(spec.sources || []).join(", ")}`;
  }
  if (spec.type === "radialLimit") {
    return `Radial limit: ${spec.source} in [${spec.minDistance}, ${spec.maxDistance}]`;
  }
  if (spec.type === "fixedDistance") {
    return `Fixed distance: ${spec.anchor} to ${spec.target} = ${spec.distance}`;
  }
  if (spec.type === "distanceRatio") {
    return `Distance ratio: ${(spec.sources || []).join(" / ")} = ${spec.ratio}`;
  }
  if (spec.type === "pin") {
    return `Pin: ${spec.target} at (${spec.x}, ${spec.y})`;
  }
  if (spec.type === "solid") {
    return `Solid: ${spec.attached} follows ${spec.carrier}`;
  }
  if (spec.type === "separation") {
    return `Separation: ${(spec.sources || []).join(" / ")} >= ${spec.minDistance}`;
  }
  if (spec.type === "angleSector") {
    return `Angle sector: ${spec.source} center ${spec.centerAngle}, width ${spec.width}`;
  }
  return `Unknown: ${spec.type}`;
}

function describeParameterMapping(mapping) {
  return `${mapping.source}.${mapping.feature} -> ${mapping.target} (${mapping.outputMin}..${mapping.outputMax})`;
}

function describeMidiBinding(binding) {
  const channel = binding.channel ? ` ch ${binding.channel}` : "";
  const program = Number.isFinite(Number(binding.program)) ? ` program ${binding.program}` : "";
  return `${binding.track || `track ${binding.trackIndex ?? "?"}`} -> ${binding.source}${channel}${program}`;
}

function renderPatchValidation(findings) {
  patchValidation.replaceChildren();

  for (const finding of findings) {
    const item = document.createElement("div");
    item.className = `validation-item ${finding.level}`;
    item.textContent = `${finding.level.toUpperCase()}: ${finding.message}`;
    patchValidation.append(item);
  }
}

function validatePatch(patch) {
  const findings = [];
  const add = (level, message) => findings.push({ level, message });

  if (!patch || typeof patch !== "object") {
    add("error", "Patch is not a JSON object.");
    return findings;
  }

  if (!patch.listener || !isFinitePoint(patch.listener)) {
    add("error", "Patch needs a listener with finite x/y coordinates.");
  }

  const scene = validateSceneObjects(patch, add);
  validateConstraintSpecs(patch.constraints || [], scene.names, add);
  validateBackendSpec(patch, add);
  validateParameterMappings(patch.parameterMappings || patch.audioMappings || [], scene.names, patch.target || patch.audioSynth, add);
  validateMidiSpec(patch.midiFile, scene.names, patch.target || patch.audioSynth, add);

  if (!findings.some((finding) => finding.level === "error" || finding.level === "warning")) {
    add("ok", "Patch structure, references, constraints, mappings, and backend declaration look coherent.");
  }

  return findings;
}

function validateSceneObjects(patch, add) {
  const names = new Set(["Listener"]);
  const seen = new Set();

  validateObjectArray(patch.sources, "source", names, seen, add);
  validateObjectArray(patch.movingObjects || [], "moving object", names, seen, add);

  if (!Array.isArray(patch.sources) || patch.sources.length === 0) {
    add("error", "Patch needs at least one source.");
  }

  return { names };
}

function validateObjectArray(objects, label, names, seen, add) {
  if (!Array.isArray(objects)) {
    add("error", `Patch ${label}s must be an array.`);
    return;
  }

  for (const object of objects) {
    if (!object || typeof object.name !== "string" || object.name.trim() === "") {
      add("error", `Every ${label} needs a non-empty name.`);
      continue;
    }
    if (seen.has(object.name)) {
      add("error", `Duplicate scene object name: ${object.name}.`);
    }
    if (!isFinitePoint(object)) {
      add("error", `${capitalize(label)} ${object.name} needs finite x/y coordinates.`);
    }
    seen.add(object.name);
    names.add(object.name);
  }
}

function validateConstraintSpecs(constraints, names, add) {
  if (!Array.isArray(constraints)) {
    add("error", "Patch constraints must be an array.");
    return;
  }

  for (const spec of constraints) {
    if (!spec || typeof spec.type !== "string") {
      add("error", "Every constraint needs a type.");
      continue;
    }

    if (spec.type === "angle") {
      validateNamedList(spec.sources, 2, spec.type, names, add);
    } else if (spec.type === "sum" || spec.type === "product") {
      validateNamedList(spec.sources, 2, spec.type, names, add);
    } else if (spec.type === "radialLimit") {
      validateReference(spec.source, "radialLimit.source", names, add);
      validateMinMax(spec.minDistance, spec.maxDistance, "radialLimit distance", add);
    } else if (spec.type === "fixedDistance") {
      validateReference(spec.anchor, "fixedDistance.anchor", names, add);
      validateReference(spec.target, "fixedDistance.target", names, add);
      validateNonNegativeNumber(spec.distance, "fixedDistance.distance", add);
    } else if (spec.type === "distanceRatio") {
      validateNamedList(spec.sources, 2, spec.type, names, add);
      validatePositiveNumber(spec.ratio, "distanceRatio.ratio", add);
    } else if (spec.type === "pin") {
      validateReference(spec.target, "pin.target", names, add);
      if (!Number.isFinite(Number(spec.x)) || !Number.isFinite(Number(spec.y))) {
        add("error", "pin needs finite x/y coordinates.");
      }
    } else if (spec.type === "solid") {
      validateReference(spec.carrier, "solid.carrier", names, add);
      validateReference(spec.attached, "solid.attached", names, add);
    } else if (spec.type === "separation") {
      validateNamedList(spec.sources, 2, spec.type, names, add);
      validateNonNegativeNumber(spec.minDistance, "separation.minDistance", add);
    } else if (spec.type === "angleSector") {
      validateReference(spec.source, "angleSector.source", names, add);
      validateNumber(spec.centerAngle, "angleSector.centerAngle", add);
      validatePositiveNumber(spec.width, "angleSector.width", add);
    } else {
      add("error", `Unknown constraint type: ${spec.type}.`);
    }
  }
}

function validateBackendSpec(patch, add) {
  const target = patch.target || patch.audioSynth || null;
  const targetApi = globalThis.MusicSpaceTargets;
  const knownBackends = new Set((targetApi?.listTargetBackends?.() || []).map((backend) => backend.type));

  if (target?.type && knownBackends.size > 0 && !knownBackends.has(target.type)) {
    add("error", `Unknown target backend: ${target.type}.`);
  }

  if (patch.midiFile && target?.type !== "midi-file") {
    add("warning", "Patch has midiFile data but target.type is not midi-file.");
  }
  if (target?.type === "midi-file" && !patch.midiFile) {
    add("error", "midi-file target needs a midiFile block.");
  }
  if (target?.type === "faust-wasm") {
    if (!target.module) {
      add("error", "faust-wasm target needs an adapter module.");
    }
    if (!target.dsp && !target.wasm && !target.json && !target.metadata) {
      add("warning", "faust-wasm target has no DSP, WASM, or metadata artifact reference.");
    }
  }
  if ((patch.parameterMappings || patch.audioMappings || []).length > 0 && !target) {
    add("warning", "Parameter mappings use the default subtractive backend because target is omitted.");
  }
}

function validateParameterMappings(mappings, names, target, add) {
  if (!Array.isArray(mappings)) {
    add("error", "parameterMappings must be an array.");
    return;
  }

  const supportedParameters = targetParameterNames(target);
  const supportedFeatures = new Set(["x", "y", "angle", "distance"]);

  for (const mapping of mappings) {
    if (!mapping || typeof mapping !== "object") {
      add("error", "Every parameter mapping must be an object.");
      continue;
    }

    validateReference(mapping.source, "mapping.source", names, add);
    if (!supportedFeatures.has(mapping.feature)) {
      add("error", `Unsupported mapping feature: ${mapping.feature || "(missing)"}.`);
    }
    if (!mapping.target) {
      add("error", "Every parameter mapping needs a target.");
    } else if (supportedParameters.size > 0 && !supportedParameters.has(mapping.target)) {
      add("error", `Mapping target ${mapping.target} is not declared by backend ${target?.type || "subtractive"}.`);
    }

    validateNumber(mapping.inputMin, "mapping.inputMin", add);
    validateNumber(mapping.inputMax, "mapping.inputMax", add);
    validateNumber(mapping.outputMin, "mapping.outputMin", add);
    validateNumber(mapping.outputMax, "mapping.outputMax", add);
    if (mapping.inputMin === mapping.inputMax) {
      add("warning", `Mapping ${mapping.target || ""} has identical inputMin/inputMax.`);
    }
    if (mapping.curve === "exp" && (Number(mapping.outputMin) <= 0 || Number(mapping.outputMax) <= 0)) {
      add("error", `Exponential mapping ${mapping.target || ""} needs positive outputMin/outputMax.`);
    }
  }
}

function validateMidiSpec(midiFile, names, target, add) {
  if (!midiFile) {
    return;
  }

  if (!midiFile.url && !midiFile.sequenceData) {
    add("error", "midiFile needs either a url or embedded sequenceData.");
  }
  if (target?.type && target.type !== "midi-file") {
    add("warning", "MIDI sequence playback should use target.type = midi-file.");
  }
  if (!Array.isArray(midiFile.trackBindings) || midiFile.trackBindings.length === 0) {
    add("warning", "midiFile has no trackBindings.");
    return;
  }

  for (const binding of midiFile.trackBindings) {
    validateReference(binding?.source, "midiFile.trackBindings.source", names, add);
    if (binding?.channel !== undefined) {
      const channel = Number(binding.channel);
      if (!Number.isInteger(channel) || channel < 1 || channel > 16) {
        add("error", `MIDI channel must be an integer from 1 to 16 for ${binding.source || "binding"}.`);
      }
    }
    if (binding?.program !== undefined) {
      const program = Number(binding.program);
      if (!Number.isInteger(program) || program < 0 || program > 127) {
        add("error", `MIDI program must be an integer from 0 to 127 for ${binding.source || "binding"}.`);
      }
    }
  }
}

function targetParameterNames(target) {
  if (target?.parameters && typeof target.parameters === "object") {
    return new Set(Object.keys(target.parameters));
  }

  const targetApi = globalThis.MusicSpaceTargets;
  const targetType = target?.type || "subtractive";
  const backend = (targetApi?.listTargetBackends?.() || []).find((candidate) => candidate.type === targetType);
  return new Set(backend?.parameters || []);
}

function validateNamedList(values, expectedLength, label, names, add) {
  if (!Array.isArray(values) || values.length < expectedLength) {
    add("error", `${label} constraint needs at least ${expectedLength} source reference(s).`);
    return;
  }
  for (const value of values) {
    validateReference(value, `${label}.sources`, names, add);
  }
}

function validateReference(name, label, names, add) {
  if (typeof name !== "string" || name.trim() === "") {
    add("error", `${label} needs a non-empty object name.`);
    return;
  }
  if (!names.has(name)) {
    add("error", `${label} references unknown object ${name}.`);
  }
}

function validateMinMax(min, max, label, add) {
  validateNumber(min, `${label} min`, add);
  validateNumber(max, `${label} max`, add);
  if (Number.isFinite(Number(min)) && Number.isFinite(Number(max)) && Number(min) > Number(max)) {
    add("error", `${label} min must be less than or equal to max.`);
  }
}

function validatePositiveNumber(value, label, add) {
  validateNumber(value, label, add);
  if (Number.isFinite(Number(value)) && Number(value) <= 0) {
    add("error", `${label} must be positive.`);
  }
}

function validateNonNegativeNumber(value, label, add) {
  validateNumber(value, label, add);
  if (Number.isFinite(Number(value)) && Number(value) < 0) {
    add("error", `${label} must be non-negative.`);
  }
}

function validateNumber(value, label, add) {
  if (!Number.isFinite(Number(value))) {
    add("error", `${label} must be a finite number.`);
  }
}

function isFinitePoint(point) {
  return Number.isFinite(Number(point?.x)) && Number.isFinite(Number(point?.y));
}

function capitalize(value) {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

function parameterFeatureValue(feature, entity) {
  if (feature === "x") {
    return entity.x;
  }

  if (feature === "y") {
    return entity.y;
  }

  if (feature === "angle") {
    return Math.atan2(entity.y - listener.y, entity.x - listener.x);
  }

  return distanceBetween(entity, listener);
}

function drawParameterMappingCues(ctx) {
  if (!parameterClient.hasMappings()) {
    return;
  }

  ctx.save();
  ctx.setLineDash([4, 5]);
  ctx.strokeStyle = "rgba(217, 119, 6, 0.5)";
  ctx.fillStyle = "#92400e";
  ctx.font = "700 11px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";

  const drawnSources = new Set();
  for (const name of parameterClient.mappedEntityNames()) {
    const entity = getObjectByName(name);
    if (!entity || drawnSources.has(entity)) {
      continue;
    }

    ctx.beginPath();
    ctx.moveTo(listener.x, listener.y);
    ctx.lineTo(entity.x, entity.y);
    ctx.stroke();
    ctx.fillText("Param", entity.x, entity.y + entity.radius + 6);
    drawnSources.add(entity);
  }

  ctx.restore();
}

function drawAll() {
  updateTraceSelectedButton();
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  drawGrid(ctx);
  parameterClient.update();
  midiFileClient.updateSpatial();

  for (const constraint of constraints) {
    constraint.draw(ctx);
  }
  drawConstraintDiagnostics(ctx);

  drawParameterMappingCues(ctx);

  for (const mover of movingObjects) {
    drawMoverTrajectory(ctx, mover);
  }

  for (const mover of movingObjects) {
    mover.draw(ctx);
  }

  listener.draw(ctx);
  for (const source of sources) {
    source.draw(ctx);
  }

  if (selectedEntity) {
    drawSelection(ctx, selectedEntity);
  }

  if (propagationPaused) {
    drawPropagationPausedBadge(ctx);
  }
}

function drawGrid(ctx) {
  ctx.strokeStyle = "#e5e7eb";
  ctx.lineWidth = 1;

  for (let x = 40; x < WIDTH; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, HEIGHT);
    ctx.stroke();
  }

  for (let y = 40; y < HEIGHT; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(WIDTH, y);
    ctx.stroke();
  }
}

function drawConnector(ctx, from, to, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
}

function drawConstraintDiagnostics(ctx) {
  const residuals = lastPropagationReport?.residuals || measureConstraintResiduals();
  for (const residual of residuals) {
    const node = residual.constraint.node;
    ctx.save();
    ctx.beginPath();
    ctx.arc(node.x, node.y, node.radius + 6, 0, Math.PI * 2);
    ctx.strokeStyle = "#ef4444";
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 3]);
    ctx.stroke();
    ctx.restore();
  }
}

function drawPropagationPausedBadge(ctx) {
  const width = 248;
  const height = 34;
  const x = WIDTH - width - 18;
  const y = 18;

  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, width, height);
  ctx.fillStyle = "rgba(17, 24, 39, 0.9)";
  ctx.fill();
  ctx.strokeStyle = "#f59e0b";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "#ffffff";
  ctx.font = "700 13px sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("Shift: propagation paused", x + 12, y + height / 2);
  ctx.restore();
}

function drawMoverTrajectory(ctx, mover) {
  if (mover.trajectory?.type !== "shuttle" || !mover.trajectory.showPath) {
    return;
  }

  const start = resolveTrajectoryEndpoint(mover.trajectory.start, mover.trajectory.ax, mover.trajectory.ay);
  const end = resolveTrajectoryEndpoint(mover.trajectory.end, mover.trajectory.bx, mover.trajectory.by);

  ctx.save();
  ctx.strokeStyle = "#0f766e";
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 6]);
  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(end.x, end.y);
  ctx.stroke();
  ctx.restore();
}

function drawListenerGlyph(ctx, x, y) {
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, 6, -Math.PI / 2, Math.PI / 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x - 2, y, 3, -Math.PI / 2, Math.PI / 2);
  ctx.stroke();
}

function drawSelection(ctx, entity) {
  ctx.beginPath();
  ctx.arc(entity.x, entity.y, entity.radius + 6, 0, Math.PI * 2);
  ctx.strokeStyle = "#f59e0b";
  ctx.lineWidth = 3;
  ctx.stroke();
}

function drawRadialLimit(ctx, anchor, minDistance, maxDistance, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 6]);

  for (const distance of [minDistance, maxDistance]) {
    ctx.beginPath();
    ctx.arc(anchor.x, anchor.y, distance, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}

function drawAngleSector(ctx, anchor, centerAngle, width, color) {
  const radius = 130;
  const start = centerAngle - width / 2;
  const end = centerAngle + width / 2;

  ctx.save();
  ctx.fillStyle = "rgba(194, 65, 12, 0.08)";
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 6]);
  ctx.beginPath();
  ctx.moveTo(anchor.x, anchor.y);
  ctx.arc(anchor.x, anchor.y, radius, start, end);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function distanceBetween(a, b) {
  return Math.max(MIN_DISTANCE, Math.hypot(a.x - b.x, a.y - b.y));
}

function setEntityDistance(entity, anchor, distance) {
  const currentDistance = Math.hypot(entity.x - anchor.x, entity.y - anchor.y);
  const angle = currentDistance === 0
    ? 0
    : Math.atan2(entity.y - anchor.y, entity.x - anchor.x);

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
  trajectory.rotationDelta = trajectory.direction * displacement / radius;
  trajectory.phase += trajectory.rotationDelta;
}

function averageAttachmentRadius(mover) {
  const radii = constraints
    .filter((constraint) => constraint instanceof SolidAttachmentConstraint && constraint.carrier === mover)
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

function rotatorFrameDelta(trajectory) {
  const periodSeconds = Math.max(0.5, trajectory.periodSeconds || 20);
  return trajectory.direction * (Math.PI * 2) / (periodSeconds * FRAMES_PER_SECOND);
}

function resolveTrajectoryEndpoint(endpoint, fallbackX, fallbackY) {
  if (endpoint?.type === "object") {
    const object = getObjectByName(endpoint.name);
    if (object) {
      return { x: object.x, y: object.y };
    }
  }

  return {
    x: endpoint?.x ?? fallbackX,
    y: endpoint?.y ?? fallbackY
  };
}

function getObjectByName(name) {
  if (!name) {
    return null;
  }

  if (listener?.name === name) {
    return listener;
  }

  return (sources || []).find((source) => source.name === name) ||
    (movingObjects || []).find((mover) => mover.name === name) ||
    null;
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

function normalizeTrajectory(trajectory, x, y) {
  const type = trajectory && trajectory.type ? trajectory.type : "free";

  if (type === "translation") {
    return {
      type,
      vx: trajectory.vx ?? 1.2,
      vy: trajectory.vy ?? 0.6,
      bounce: trajectory.bounce ?? true
    };
  }

  if (type === "rotation") {
    const centerX = trajectory.centerX ?? listener?.x ?? WIDTH / 2;
    const centerY = trajectory.centerY ?? listener?.y ?? HEIGHT / 2;
    return {
      type,
      centerX,
      centerY,
      radius: trajectory.radius ?? Math.max(40, Math.hypot(x - centerX, y - centerY)),
      phase: trajectory.phase ?? Math.atan2(y - centerY, x - centerX),
      angularSpeed: trajectory.angularSpeed ?? 0.018
    };
  }

  if (type === "shuttle") {
    const start = normalizeTrajectoryEndpoint(trajectory.start, trajectory.ax ?? x - 80, trajectory.ay ?? y);
    const end = normalizeTrajectoryEndpoint(trajectory.end, trajectory.bx ?? x + 80, trajectory.by ?? y);
    return {
      type,
      start,
      end,
      ax: start.x,
      ay: start.y,
      bx: end.x,
      by: end.y,
      phase: trajectory.phase ?? 0.5,
      speed: trajectory.speed ?? 0.01,
      direction: trajectory.direction ?? 1,
      showPath: trajectory.showPath ?? true
    };
  }

  if (type === "bounce") {
    return {
      type,
      vx: trajectory.vx ?? 1.8,
      vy: trajectory.vy ?? 1.1
    };
  }

  if (type === "rotator") {
    return {
      type,
      running: trajectory.running ?? true,
      periodSeconds: trajectory.periodSeconds ?? 20,
      direction: trajectory.direction ?? 1,
      displacementInducesRotation: trajectory.displacementInducesRotation ?? true,
      phase: trajectory.phase ?? 0,
      rotationDelta: 0
    };
  }

  return { type: "free" };
}

function normalizeTrajectoryEndpoint(endpoint, fallbackX, fallbackY) {
  if (endpoint?.type === "object") {
    const object = getObjectByName(endpoint.name);
    return {
      type: "object",
      name: endpoint.name,
      x: object?.x ?? endpoint.x ?? fallbackX,
      y: object?.y ?? endpoint.y ?? fallbackY
    };
  }

  return {
    type: "fixed",
    x: endpoint?.x ?? fallbackX,
    y: endpoint?.y ?? fallbackY
  };
}

function getRadialLimitsForSource(source) {
  const limit = constraints.find((constraint) =>
    constraint instanceof RadialLimitConstraint && constraint.source === source
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
    const currentActiveProduct = activeSources
      .reduce((product, source) => product * distanceBetween(source, anchor), 1);

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

function enforceConstraints(moved, options = {}) {
  if (solverMode === SOLVER_MODE_XPBD) {
    const xpbdReport = enforceConstraintsWithXpbd(moved, options);
    if (xpbdReport) {
      lastPropagationReport = xpbdReport;
      setConstraintStatus(formatPropagationStatus(lastPropagationReport));
      return;
    }
  }

  enforceConstraintsByPropagation(moved);
}

function refineXpbdAfterDrag(entity) {
  if (solverMode !== SOLVER_MODE_XPBD || !entity) {
    return false;
  }

  const xpbdReport = enforceConstraintsWithXpbd(entity, { iterations: XPBD_ITERATIONS_RELEASE });
  if (!xpbdReport) {
    return false;
  }

  lastPropagationReport = xpbdReport;
  setConstraintStatus(formatPropagationStatus(lastPropagationReport));
  return true;
}

function enforceConstraintsWithXpbd(moved, {
  iterations = XPBD_ITERATIONS_DRAG,
  preserveTrajectoryFrame = false
} = {}) {
  const component = buildConstraintComponent(moved);
  if (!component ||
    component.entities.length > MAX_XPBD_COMPONENT_ENTITIES ||
    component.constraints.length > MAX_XPBD_COMPONENT_CONSTRAINTS) {
    return null;
  }

  applyXpbdRotatorFrameDeltas(component.constraints);

  const positions = component.entities.map((entity) => ({ x: entity.x, y: entity.y }));
  const originalPositions = component.entities.map((entity) => ({ x: entity.x, y: entity.y }));
  const mobility = createXpbdMobility(component, moved);
  const intent = moved && component.indexByEntity.has(moved)
    ? {
        index: component.indexByEntity.get(moved),
        x: moved.x,
        y: moved.y,
        stiffness: 0.35
      }
    : null;

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    applyXpbdSoftIntent(positions, mobility, intent);

    for (const constraint of orderedXpbdConstraints(component.constraints)) {
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
    if (Math.hypot(next.x - originalPositions[index].x, next.y - originalPositions[index].y) > CONSTRAINT_EPSILON) {
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
    if (constraint instanceof PinConstraint ||
      constraint instanceof RadialLimitConstraint ||
      constraint instanceof AngleSectorConstraint) {
      hard.push(constraint);
    } else if (constraint instanceof SolidAttachmentConstraint ||
      constraint instanceof FixedDistanceConstraint ||
      constraint instanceof MinimumSeparationConstraint) {
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

  while (queue.length > 0) {
    const entity = queue.shift();
    for (const constraint of constraints) {
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

    if (entity === listener && entity !== moved) {
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
  if (constraint instanceof PinConstraint ||
    constraint instanceof RadialLimitConstraint ||
    constraint instanceof AngleSectorConstraint) {
    projectXpbdHardConstraint(constraint, indexByEntity, positions, mobility);
    return;
  }

  if (constraint instanceof FixedDistanceConstraint) {
    projectXpbdDistance(indexByEntity.get(constraint.anchor), indexByEntity.get(constraint.target), constraint.distance, positions, mobility);
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
    return sum + Math.log(Math.max(MIN_DISTANCE, Math.hypot(positions[index].x - anchor.x, positions[index].y - anchor.y)));
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
  if (listenerIndex === undefined || aIndex === undefined || bIndex === undefined || constraint.ratio <= 0) {
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
    setXpbdPolarDistance(a, anchor, distanceA * Math.exp(-logResidual * (mobility[aIndex] / mobilitySum)));
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

  while (queue.length > 0 && propagationSteps < MAX_PROPAGATION_STEPS) {
    const currentMoved = queue.shift();
    queuedEntities.delete(currentMoved);

    const processCount = processCounts.get(currentMoved) || 0;
    if (processCount >= MAX_ENTITY_PROPAGATION_COUNT) {
      hitEntityCap = true;
      continue;
    }
    processCounts.set(currentMoved, processCount + 1);
    movedEntities.add(currentMoved);
    propagationSteps += 1;

    for (const constraint of constraints) {
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

  lastPropagationReport = createPropagationReport({
    hitEntityCap: hitEntityCap || [...processCounts.values()].some((count) => count >= MAX_ENTITY_PROPAGATION_COUNT),
    hitStepCap: queue.length > 0,
    messages,
    movedEntities: [...movedEntities],
    processCounts,
    propagationSteps
  });
  setConstraintStatus(formatPropagationStatus(lastPropagationReport));
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
  return constraints
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
  const roundedError = measurement.error >= 10
    ? measurement.error.toFixed(1)
    : measurement.error.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
  const roundedTolerance = measurement.tolerance >= 10
    ? measurement.tolerance.toFixed(1)
    : measurement.tolerance.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
  const unit = measurement.unit ? ` ${measurement.unit}` : "";
  return `${roundedError}${unit} > ${roundedTolerance}${unit}`;
}

function getLastPropagationReport() {
  if (!lastPropagationReport) {
    return null;
  }

  return {
    hitEntityCap: lastPropagationReport.hitEntityCap,
    hitStepCap: lastPropagationReport.hitStepCap,
    messages: [...lastPropagationReport.messages],
    movedEntities: lastPropagationReport.movedEntities.map(entityLabel),
    propagationPaused: lastPropagationReport.propagationPaused,
    propagationSteps: lastPropagationReport.propagationSteps,
    residuals: lastPropagationReport.residuals.map(({ measurement }) => ({
      error: measurement.error,
      label: measurement.label,
      tolerance: measurement.tolerance,
      unit: measurement.unit
    })),
    solverMode: lastPropagationReport.solverMode,
    satisfied: lastPropagationReport.satisfied
  };
}

function setSolverMode(nextMode, { updateUrl = false } = {}) {
  solverMode = nextMode === SOLVER_MODE_XPBD ? SOLVER_MODE_XPBD : SOLVER_MODE_PROPAGATION;
  updateSolverIndicator();
  if (updateUrl) {
    updateSolverModeUrl();
  }
}

function getSolverMode() {
  return solverMode;
}

function updateSolverIndicator() {
  const isXpbd = solverMode === SOLVER_MODE_XPBD;
  solverModePropagationButton?.setAttribute("aria-pressed", String(!isXpbd));
  solverModeXpbdButton?.setAttribute("aria-pressed", String(isXpbd));
}

function updateSolverModeUrl() {
  if (!window.history?.replaceState) {
    return;
  }

  const url = new URL(window.location.href);
  if (solverMode === SOLVER_MODE_XPBD) {
    url.searchParams.set("solver", SOLVER_MODE_XPBD);
  } else {
    url.searchParams.delete("solver");
  }
  window.history.replaceState(null, "", url.href);
}

function refreshConstraints() {
  for (const constraint of constraints) {
    constraint.refresh();
  }
  propagationPaused = false;
  lastPropagationReport = null;
  setConstraintStatus("");
}

function setActiveTool(tool) {
  if (tool !== TOOL_SELECT) {
    stopAnimation();
  }

  activeTool = tool;
  pendingToolEntities = [];

  for (const button of toolButtons) {
    button.setAttribute("aria-pressed", String(button.dataset.tool === activeTool));
  }

  if (activeTool === TOOL_SELECT) {
    setConstraintStatus("");
  } else {
    setConstraintStatus(toolPrompt(activeTool));
  }
}

function toolPrompt(tool) {
  const prompts = {
    source: "Click empty space to create a source.",
    mover: "Click empty space to create a moving object.",
    angle: "Angle: click two sources or movers.",
    sum: "Sum: click two or more sources or movers; click Sum again to finish.",
    product: "Product: click two or more sources or movers; click Product again to finish.",
    radialLimit: "Limit: click one source or mover.",
    fixedDistance: "Distance: click anchor, then target.",
    distanceRatio: "Ratio: click two sources or movers.",
    pin: "Pin: click one object.",
    solid: "Link: click carrier, then attached object.",
    separation: "Separation: click two sources or movers.",
    angleSector: "Sector: click one source or mover.",
    translateTrajectory: "Move: click a mover, or empty space to create one.",
    rotateTrajectory: "Orbit: click a mover, or empty space to create one. The mover itself travels around the listener.",
    rotatorTrajectory: "Spin: click a mover, or empty space to create a rotative object.",
    shuttleTrajectory: "Shuttle: click a mover, or empty space to create one, then set endpoints.",
    bounceTrajectory: "Bounce: click a mover, or empty space to create one."
  };
  return prompts[tool] || "";
}

function requiredEntityCount(tool) {
  const counts = {
    angle: 2,
    sum: 2,
    product: 2,
    radialLimit: 1,
    fixedDistance: 2,
    distanceRatio: 2,
    pin: 1,
    solid: 2,
    separation: 2,
    angleSector: 1
  };
  return counts[tool] || 0;
}

function isVariableArityConstraintTool(tool) {
  return tool === "sum" || tool === "product";
}

function canUseEntityForTool(tool, entity) {
  if (!entity || constraints.some((constraint) => constraint.node === entity)) {
    return false;
  }

  if (tool === "radialLimit" || tool === "angleSector") {
    return entity !== listener;
  }

  if (tool === "sum" || tool === "product" || tool === "angle" || tool === "distanceRatio" || tool === "separation") {
    return entity !== listener;
  }

  return true;
}

function handleToolClick(x, y, entity) {
  if (activeTool === "source") {
    pushUndoSnapshot("create source");
    const source = new SoundSource(x, y, nextSourceName());
    sources.push(source);
    selectedEntity = source;
    setActiveTool(TOOL_SELECT);
    drawAll();
    return true;
  }

  if (activeTool === "mover") {
    pushUndoSnapshot("create mover");
    const mover = new MovingObject(x, y, nextMoverName(), { type: "free" });
    movingObjects.push(mover);
    selectedEntity = mover;
    setActiveTool(TOOL_SELECT);
    drawAll();
    return true;
  }

  if (isTrajectoryTool(activeTool)) {
    pushUndoSnapshot("assign trajectory");
    const mover = entity instanceof MovingObject
      ? entity
      : new MovingObject(x, y, nextMoverName(), { type: "free" });
    if (!movingObjects.includes(mover)) {
      movingObjects.push(mover);
    }
    assignTrajectoryFromTool(mover, activeTool);
    selectedEntity = mover;
    setActiveTool(TOOL_SELECT);
    drawAll();
    return true;
  }

  if (!canUseEntityForTool(activeTool, entity)) {
    setConstraintStatus(toolPrompt(activeTool));
    return true;
  }

  if (pendingToolEntities.includes(entity)) {
    setConstraintStatus("That object is already selected for this constraint.");
    return true;
  }

  pendingToolEntities.push(entity);
  const requiredCount = requiredEntityCount(activeTool);

  if (pendingToolEntities.length < requiredCount) {
    setConstraintStatus(`${toolPrompt(activeTool)} (${pendingToolEntities.length}/${requiredCount})`);
    drawAll();
    return true;
  }

  if (isVariableArityConstraintTool(activeTool)) {
    setConstraintStatus(`${capitalize(activeTool)}: ${pendingToolEntities.length} selected. Click more, or click ${capitalize(activeTool)} again to finish.`);
    drawAll();
    return true;
  }

  finishPendingConstraintTool();
  return true;
}

function finishPendingConstraintTool() {
  const constraint = createConstraintFromTool(activeTool, pendingToolEntities);
  let addedMessage = "";
  if (constraint) {
    pushUndoSnapshot("create constraint");
    constraints.push(constraint);
    selectedEntity = constraint.node;
    addedMessage = `${constraint.node.label} constraint added.`;
  }
  pendingToolEntities = [];
  setActiveTool(TOOL_SELECT);
  setConstraintStatus(addedMessage);
  drawAll();
}

function handleToolButtonClick(tool) {
  if (
    tool === activeTool &&
    isVariableArityConstraintTool(tool) &&
    pendingToolEntities.length >= requiredEntityCount(tool)
  ) {
    finishPendingConstraintTool();
    return;
  }

  setActiveTool(tool);
}

function createConstraintFromTool(tool, entities) {
  if (tool === "angle") {
    return new AngleConstraint(listener, entities[0], entities[1]);
  }

  if (tool === "sum") {
    return new SumConstraint(listener, entities);
  }

  if (tool === "product") {
    return new ProductConstraint(listener, entities);
  }

  if (tool === "radialLimit") {
    const distance = distanceBetween(entities[0], listener);
    return new RadialLimitConstraint(listener, entities[0], Math.max(MIN_DISTANCE, distance * 0.55), distance * 1.35);
  }

  if (tool === "fixedDistance") {
    return new FixedDistanceConstraint(entities[0], entities[1]);
  }

  if (tool === "distanceRatio") {
    return new DistanceRatioConstraint(listener, entities[0], entities[1]);
  }

  if (tool === "pin") {
    return new PinConstraint(entities[0]);
  }

  if (tool === "solid") {
    return new SolidAttachmentConstraint(entities[0], entities[1]);
  }

  if (tool === "separation") {
    return new MinimumSeparationConstraint(entities[0], entities[1], Math.max(50, distanceBetween(entities[0], entities[1])));
  }

  if (tool === "angleSector") {
    return new AngleSectorConstraint(listener, entities[0]);
  }

  return null;
}

function isTrajectoryTool(tool) {
  return tool === "translateTrajectory" ||
    tool === "rotateTrajectory" ||
    tool === "rotatorTrajectory" ||
    tool === "shuttleTrajectory" ||
    tool === "bounceTrajectory";
}

function assignTrajectoryFromTool(mover, tool) {
  if (tool === "translateTrajectory") {
    mover.trajectory = normalizeTrajectory({ type: "translation", vx: 1.4, vy: 0.7, bounce: true }, mover.x, mover.y);
  } else if (tool === "rotateTrajectory") {
    const radius = Math.max(40, distanceBetween(mover, listener));
    mover.trajectory = normalizeTrajectory({
      type: "rotation",
      centerX: listener.x,
      centerY: listener.y,
      radius,
      phase: Math.atan2(mover.y - listener.y, mover.x - listener.x),
      angularSpeed: 0.018
    }, mover.x, mover.y);
  } else if (tool === "shuttleTrajectory") {
    mover.trajectory = normalizeTrajectory({
      type: "shuttle",
      ax: clamp(mover.x - 120, 0, WIDTH),
      ay: mover.y,
      bx: clamp(mover.x + 120, 0, WIDTH),
      by: mover.y,
      phase: 0.5,
      speed: 0.008,
      direction: 1
    }, mover.x, mover.y);
    openShuttleEditor(mover);
  } else if (tool === "rotatorTrajectory") {
    mover.trajectory = normalizeTrajectory({
      type: "rotator",
      running: true,
      periodSeconds: 20,
      direction: 1,
      displacementInducesRotation: true
    }, mover.x, mover.y);
    openRotationEditor(mover);
  } else if (tool === "bounceTrajectory") {
    mover.trajectory = normalizeTrajectory({ type: "bounce", vx: 1.8, vy: 1.1 }, mover.x, mover.y);
  }
}

function openRotationEditor(mover) {
  if (!(mover instanceof MovingObject)) {
    return;
  }

  if (mover.trajectory?.type !== "rotator") {
    mover.trajectory = normalizeTrajectory({ type: "rotator" }, mover.x, mover.y);
  }

  shuttleEditor.hidden = true;
  activeShuttleMover = null;
  activeRotationMover = mover;
  rotationRunningInput.checked = Boolean(mover.trajectory.running);
  rotationDisplacementInput.checked = Boolean(mover.trajectory.displacementInducesRotation);
  rotationPeriodInput.value = String(mover.trajectory.periodSeconds || 20);
  rotationDirectionInput.value = String(mover.trajectory.direction || 1);
  rotationEditor.hidden = false;
  setConstraintStatus(`Editing rotative object ${mover.name}.`);
  revealEditor(rotationEditor);
}

function applyRotationEditor() {
  if (!activeRotationMover) {
    return;
  }

  pushUndoSnapshot("edit rotative object");
  const periodSeconds = Number(rotationPeriodInput.value);
  activeRotationMover.trajectory = normalizeTrajectory({
    ...activeRotationMover.trajectory,
    type: "rotator",
    running: rotationRunningInput.checked,
    periodSeconds: Number.isFinite(periodSeconds) ? Math.max(0.5, periodSeconds) : 20,
    direction: Number(rotationDirectionInput.value) < 0 ? -1 : 1,
    displacementInducesRotation: rotationDisplacementInput.checked
  }, activeRotationMover.x, activeRotationMover.y);
  setConstraintStatus(`Rotative object ${activeRotationMover.name} updated.`);
  drawAll();
}

function closeRotationEditor() {
  rotationEditor.hidden = true;
  activeRotationMover = null;
}

function openShuttleEditor(mover) {
  if (!(mover instanceof MovingObject)) {
    return;
  }

  if (mover.trajectory?.type !== "shuttle") {
    mover.trajectory = normalizeTrajectory({ type: "shuttle" }, mover.x, mover.y);
  }

  rotationEditor.hidden = true;
  activeRotationMover = null;
  activeShuttleMover = mover;
  populateEndpointSelect(shuttleStartRefInput, mover);
  populateEndpointSelect(shuttleEndRefInput, mover);
  const trajectory = mover.trajectory;
  const start = trajectory.start || { type: "fixed", x: trajectory.ax, y: trajectory.ay };
  const end = trajectory.end || { type: "fixed", x: trajectory.bx, y: trajectory.by };

  shuttleStartRefInput.value = start.type === "object" ? start.name : "";
  shuttleEndRefInput.value = end.type === "object" ? end.name : "";
  shuttleStartXInput.value = String(start.x ?? trajectory.ax);
  shuttleStartYInput.value = String(start.y ?? trajectory.ay);
  shuttleEndXInput.value = String(end.x ?? trajectory.bx);
  shuttleEndYInput.value = String(end.y ?? trajectory.by);
  shuttleSpeedInput.value = String(trajectory.speed ?? 0.01);
  shuttleShowPathInput.checked = trajectory.showPath !== false;
  shuttleEditor.hidden = false;
  setConstraintStatus(`Editing shuttle trajectory ${mover.name}.`);
  revealEditor(shuttleEditor);
}

function revealEditor(editor) {
  requestAnimationFrame(() => {
    editor.scrollIntoView({ block: "nearest", behavior: "smooth" });
  });
}

function populateEndpointSelect(select, mover) {
  select.replaceChildren();
  const fixedOption = document.createElement("option");
  fixedOption.value = "";
  fixedOption.textContent = "Fixed point";
  select.append(fixedOption);

  for (const entity of selectableEndpointObjects(mover)) {
    const option = document.createElement("option");
    option.value = entityLabel(entity);
    option.textContent = entityLabel(entity);
    select.append(option);
  }
}

function selectableEndpointObjects(excludedMover) {
  return [listener, ...sources, ...movingObjects.filter((mover) => mover !== excludedMover)];
}

function applyShuttleEditor() {
  if (!activeShuttleMover) {
    return;
  }

  pushUndoSnapshot("edit shuttle trajectory");
  const current = activeShuttleMover.trajectory;
  const speed = Number(shuttleSpeedInput.value);
  activeShuttleMover.trajectory = normalizeTrajectory({
    ...current,
    type: "shuttle",
    start: endpointFromEditor(shuttleStartRefInput, shuttleStartXInput, shuttleStartYInput),
    end: endpointFromEditor(shuttleEndRefInput, shuttleEndXInput, shuttleEndYInput),
    speed: Number.isFinite(speed) ? Math.max(0.001, speed) : current.speed,
    showPath: shuttleShowPathInput.checked
  }, activeShuttleMover.x, activeShuttleMover.y);
  setConstraintStatus(`Shuttle trajectory ${activeShuttleMover.name} updated.`);
  drawAll();
}

function endpointFromEditor(refInput, xInput, yInput) {
  const refName = refInput.value;
  const x = Number(xInput.value);
  const y = Number(yInput.value);
  const fallbackX = Number.isFinite(x) ? x : 0;
  const fallbackY = Number.isFinite(y) ? y : 0;
  const object = getObjectByName(refName);

  if (refName && object) {
    return {
      type: "object",
      name: refName,
      x: object.x,
      y: object.y
    };
  }

  return {
    type: "fixed",
    x: fallbackX,
    y: fallbackY
  };
}

function closeShuttleEditor() {
  shuttleEditor.hidden = true;
  activeShuttleMover = null;
}

function deleteSelectedEntity() {
  if (!selectedEntity) {
    setConstraintStatus("Select an object or constraint to delete.");
    return;
  }

  if (selectedEntity === listener) {
    setConstraintStatus("The listener cannot be deleted.");
    return;
  }

  const entity = selectedEntity;
  pushUndoSnapshot(`delete ${entityLabel(entity)}`);

  const constraintIndex = constraints.findIndex((constraint) => constraint.node === entity);
  if (constraintIndex >= 0) {
    const [removed] = constraints.splice(constraintIndex, 1);
    selectedEntity = null;
    setConstraintStatus(`${removed.node.label} constraint deleted.`);
    drawAll();
    return;
  }

  sources = sources.filter((source) => source !== entity);
  movingObjects = movingObjects.filter((mover) => mover !== entity);
  constraints = constraints.filter((constraint) => !constraintReferencesEntity(constraint, entity));

  if (activeRotationMover === entity) {
    closeRotationEditor();
  }
  if (activeShuttleMover === entity) {
    closeShuttleEditor();
  }

  selectedEntity = null;
  pendingToolEntities = pendingToolEntities.filter((candidate) => candidate !== entity);
  setConstraintStatus(`${entityLabel(entity)} deleted.`);
  drawAll();
}

function nextSourceName() {
  const usedNames = new Set(sources.map((source) => source.name));
  for (let index = 0; index < 26; index += 1) {
    const candidate = String.fromCharCode(65 + index);
    if (!usedNames.has(candidate)) {
      return candidate;
    }
  }
  return `S${sources.length + 1}`;
}

function nextMoverName() {
  let index = movingObjects.length + 1;
  const usedNames = new Set(movingObjects.map((mover) => mover.name));
  while (usedNames.has(`M${index}`)) {
    index += 1;
  }
  return `M${index}`;
}

function getPointerPosition(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * WIDTH,
    y: ((event.clientY - rect.top) / rect.height) * HEIGHT
  };
}

function findEntityAt(x, y) {
  if (listener.isInside(x, y)) {
    return listener;
  }

  for (const source of sources) {
    if (source.isInside(x, y)) {
      return source;
    }
  }

  for (const mover of movingObjects) {
    if (mover.isInside(x, y)) {
      return mover;
    }
  }

  for (const constraint of constraints) {
    if (constraint.node.isInside(x, y)) {
      return constraint.node;
    }
  }

  return null;
}

function findDoubleClickEntityAt(x, y) {
  for (const mover of movingObjects) {
    const trajectoryType = mover.trajectory?.type;
    if ((trajectoryType === "rotator" || trajectoryType === "shuttle") && mover.isInside(x, y)) {
      return mover;
    }
  }

  return findEntityAt(x, y);
}

function isRepeatedCanvasClick(event, x, y, entity) {
  if (!lastCanvasClick || !entity || lastCanvasClick.entity !== entity) {
    return false;
  }

  return event.timeStamp - lastCanvasClick.time <= DOUBLE_CLICK_MS &&
    Math.hypot(x - lastCanvasClick.x, y - lastCanvasClick.y) <= DOUBLE_CLICK_DISTANCE;
}

function handleEntityDoubleClick(entity) {
  if (entity instanceof MovingObject && entity.trajectory?.type === "rotator") {
    openRotationEditor(entity);
    selectedEntity = entity;
    drawAll();
    return true;
  }

  if (entity instanceof MovingObject && entity.trajectory?.type === "shuttle") {
    openShuttleEditor(entity);
    selectedEntity = entity;
    drawAll();
    return true;
  }

  if (entity instanceof MovingObject) {
    setConstraintStatus("Use Spin to convert this mover into a rotative object.");
    return true;
  }

  return false;
}

function moveEntity(entity, x, y, { skipPropagation = false } = {}) {
  const nextX = clamp(x, 0, WIDTH);
  const nextY = clamp(y, 0, HEIGHT);
  translateEntity(entity, nextX - entity.x, nextY - entity.y);

  if (skipPropagation) {
    pausePropagation(entity);
  } else if (entity === listener && listenerMode === LISTENER_MODE_RETARGET) {
    propagationPaused = false;
    refreshConstraints();
  } else {
    propagationPaused = false;
    enforceConstraints(entity);
  }

  drawTracesForChangedEntities();
  drawAll();
}

function pausePropagation(entity) {
  propagationPaused = true;
  lastPropagationReport = createPropagationReport({
    hitEntityCap: false,
    hitStepCap: false,
    messages: ["Propagation paused (Shift). Constraints are not being enforced."],
    movedEntities: entity ? [entity] : [],
    processCounts: new Map(),
    propagationPaused: true,
    propagationSteps: 0
  });
  setConstraintStatus(formatPropagationStatus(lastPropagationReport));
}

function resumePropagationAfterPausedDrag() {
  propagationPaused = false;
  refreshConstraints();
  setConstraintStatus("Propagation resumed; constraints retargeted to paused positions.");
}

function setConstraintStatus(message) {
  constraintStatus.textContent = message;
}

function setListenerMode(nextMode) {
  listenerMode = nextMode;
  listenerModeRetargetButton.setAttribute(
    "aria-pressed",
    String(listenerMode === LISTENER_MODE_RETARGET)
  );
  listenerModePreserveButton.setAttribute(
    "aria-pressed",
    String(listenerMode === LISTENER_MODE_PRESERVE)
  );
}

function setAnimationPressedState(isPressed) {
  animationToggle.setAttribute("aria-pressed", String(isPressed));
}

function updateTraceSelectedButton() {
  const canTrace = selectedEntity && selectedEntity !== null;
  traceSelectedButton.disabled = !canTrace;
  traceSelectedButton.setAttribute("aria-pressed", String(Boolean(selectedEntity?.drawTrace)));
}

function toggleSelectedTrace() {
  if (!selectedEntity) {
    setConstraintStatus("Select an object to toggle drawing.");
    updateTraceSelectedButton();
    return;
  }

  pushUndoSnapshot(`toggle drawing for ${entityLabel(selectedEntity)}`);
  selectedEntity.drawTrace = !selectedEntity.drawTrace;
  selectedEntity.prevX = selectedEntity.x;
  selectedEntity.prevY = selectedEntity.y;
  updateTraceSelectedButton();
  setConstraintStatus(`${entityLabel(selectedEntity)} drawing ${selectedEntity.drawTrace ? "on" : "off"}.`);
}

function stopAllDrawing() {
  const traceableEntities = getTraceableEntities();
  const enabledCount = traceableEntities.filter((entity) => entity.drawTrace).length;
  if (enabledCount === 0) {
    setConstraintStatus("No objects are drawing.");
    updateTraceSelectedButton();
    return;
  }

  pushUndoSnapshot("stop all drawing");
  for (const entity of traceableEntities) {
    entity.drawTrace = false;
    entity.prevX = entity.x;
    entity.prevY = entity.y;
  }
  updateTraceSelectedButton();
  setConstraintStatus(`Drawing stopped for ${enabledCount} object${enabledCount === 1 ? "" : "s"}.`);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function syncTracePositions() {
  for (const entity of getTraceableEntities()) {
    entity.prevX = entity.x;
    entity.prevY = entity.y;
  }
}

function getTraceableEntities() {
  return [
    listener,
    ...sources,
    ...movingObjects,
    ...constraints.map((constraint) => constraint.node)
  ].filter(Boolean);
}

function drawTracesForChangedEntities() {
  for (const entity of getTraceableEntities()) {
    if (entity.prevX === undefined || entity.prevY === undefined) {
      entity.prevX = entity.x;
      entity.prevY = entity.y;
    }

    const distance = Math.hypot(entity.x - entity.prevX, entity.y - entity.prevY);
    if (distance > 0.25 && entity.drawTrace) {
      drawTraceSegment(entity, entity.x, entity.y, traceColorForEntity(entity));
    } else {
      entity.prevX = entity.x;
      entity.prevY = entity.y;
    }
  }
}

function drawTraceSegment(entity, nextX = entity.x, nextY = entity.y, color = traceColorForEntity(entity)) {
  if (entity.prevX === undefined || entity.prevY === undefined) {
    entity.prevX = entity.x;
    entity.prevY = entity.y;
  }

  traceCtx.beginPath();
  traceCtx.moveTo(entity.prevX, entity.prevY);
  traceCtx.lineTo(nextX, nextY);
  traceCtx.strokeStyle = color;
  traceCtx.lineWidth = 2;
  traceCtx.stroke();

  entity.prevX = nextX;
  entity.prevY = nextY;
}

function traceColorForEntity(entity) {
  if (entity instanceof MovingObject) {
    return "rgba(8, 145, 178, 0.45)";
  }

  if (entity instanceof ConstraintNode) {
    return "rgba(124, 58, 237, 0.45)";
  }

  if (entity === listener) {
    return "rgba(17, 24, 39, 0.45)";
  }

  return "rgba(220, 38, 38, 0.45)";
}

function animate() {
  if (!isAnimating) {
    return;
  }

  if (movingObjects.length > 0) {
    for (const mover of movingObjects) {
      const moved = mover.tick();
      if (moved) {
        enforceConstraints(mover, { preserveTrajectoryFrame: true });
      }
    }

    drawTracesForChangedEntities();
    drawAll();
    animationFrame = requestAnimationFrame(animate);
    return;
  }

  const source = sources[0];
  velocity.x += (Math.random() - 0.5) * 0.5;
  velocity.y += (Math.random() - 0.5) * 0.5;

  const maxSpeed = 2;
  const speed = Math.hypot(velocity.x, velocity.y);
  if (speed > maxSpeed) {
    velocity.x *= maxSpeed / speed;
    velocity.y *= maxSpeed / speed;
  }

  const nextX = clamp(source.x + velocity.x, 0, WIDTH);
  const nextY = clamp(source.y + velocity.y, 0, HEIGHT);

  source.x = nextX;
  source.y = nextY;

  enforceConstraints(source);
  drawTracesForChangedEntities();
  drawAll();
  animationFrame = requestAnimationFrame(animate);
}

function startAnimation() {
  if (isAnimating) {
    return;
  }

  isAnimating = true;
  animationToggle.textContent = "Stop Movers";
  setAnimationPressedState(true);
  syncTracePositions();
  animationFrame = requestAnimationFrame(animate);
}

function stopAnimation() {
  isAnimating = false;
  animationToggle.textContent = "Start Movers";
  setAnimationPressedState(false);

  if (animationFrame !== null) {
    cancelAnimationFrame(animationFrame);
    animationFrame = null;
  }
}

function clearTrace() {
  traceCtx.clearRect(0, 0, WIDTH, HEIGHT);
  syncTracePositions();
}

function saveTrace() {
  const link = document.createElement("a");
  link.download = "musicspace_trace.png";
  link.href = traceCanvas.toDataURL("image/png");
  link.click();
}

function savePatch() {
  const patch = serializePatch();
  const link = document.createElement("a");
  const blob = new Blob([JSON.stringify(patch, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  link.download = `${slugify(patch.name || "musicspace-patch")}.json`;
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "musicspace-patch";
}

function loadPatchFile(file) {
  if (!file) {
    return;
  }

  const reader = new FileReader();
  reader.addEventListener("load", () => {
    try {
      const patch = JSON.parse(reader.result);
      patch.name = patch.name || file.name.replace(/\.json$/i, "");
      loadPatch(patch, { preserveAsActive: true, clearUndo: true });
      patchSelect.value = "";
    } catch (error) {
      setConstraintStatus("Could not load patch JSON.");
    }
  });
  reader.readAsText(file);
}

function togglePatchJsonEditor() {
  const isOpening = patchJsonEditor.hidden;
  patchJsonEditor.hidden = !isOpening;
  patchJsonToggle.setAttribute("aria-pressed", String(isOpening));

  if (isOpening) {
    const patch = currentPatchSnapshot();
    patchJsonTextarea.value = patch ? JSON.stringify(patch, null, 2) : "";
    patchJsonTextarea.focus();
  }
}

function validatePatchEditor() {
  const patch = patchJsonEditor.hidden ? currentPatchSnapshot() : parsePatchJsonEditor();
  if (!patch) {
    return;
  }
  renderPatchValidation(validatePatch(patch));
}

function applyPatchJsonEditor() {
  const patch = parsePatchJsonEditor();
  if (!patch) {
    return;
  }

  patch.name = patch.name || "Edited Patch";
  if (!patch.key || builtInPatches.some((candidate) => candidate.key === patch.key)) {
    patch.key = `edited-${slugify(patch.name)}-${Date.now()}`;
  }

  stopAnimation();
  selectPatchOptionForPatch(patch);
  loadPatch(clonePatch(patch), { preserveAsActive: true, clearUndo: true });
  patchJsonTextarea.value = JSON.stringify(currentPatchSnapshot(), null, 2);
  setConstraintStatus("Patch JSON applied.");
}

function parsePatchJsonEditor() {
  try {
    return JSON.parse(patchJsonTextarea.value);
  } catch (error) {
    renderPatchValidation([{ level: "error", message: "Patch JSON could not be parsed." }]);
    return null;
  }
}

function updateHoverState(entity) {
  hoveredEntity = entity;
  canvas.style.cursor = activeTool === TOOL_SELECT
    ? (hoveredEntity ? "grab" : "default")
    : "crosshair";
}

function beginDrag(event) {
  const { x, y } = getPointerPosition(event);
  const entity = findEntityAt(x, y);
  const doubleClickEntity = findDoubleClickEntityAt(x, y);

  if (activeTool !== TOOL_SELECT) {
    lastCanvasClick = null;
    handleToolClick(x, y, entity);
    event.preventDefault();
    return;
  }

  if (!entity) {
    lastCanvasClick = null;
    selectedEntity = null;
    drawAll();
    return;
  }

  if (isRepeatedCanvasClick(event, x, y, doubleClickEntity) && handleEntityDoubleClick(doubleClickEntity)) {
    lastCanvasClick = null;
    event.preventDefault();
    return;
  }

  canvas.focus();
  selectedEntity = entity;
  dragged = {
    entity,
    pointerId: event.pointerId,
    offsetX: x - entity.x,
    offsetY: y - entity.y,
    startX: x,
    startY: y,
    doubleClickEntity,
    didSnapshot: false,
    skipPropagation: false
  };
  stage.classList.add("is-dragging");
  canvas.style.cursor = "grabbing";
  canvas.setPointerCapture(event.pointerId);
  event.preventDefault();
  drawAll();
}

function continueDrag(event) {
  if (!dragged || event.pointerId !== dragged.pointerId) {
    const { x, y } = getPointerPosition(event);
    updateHoverState(findEntityAt(x, y));
    return;
  }

  const { x, y } = getPointerPosition(event);
  const dragDistance = Math.hypot(x - dragged.startX, y - dragged.startY);
  if (!dragged.didSnapshot && dragDistance <= 2) {
    return;
  }

  if (!dragged.didSnapshot && dragDistance > 2) {
    pushUndoSnapshot(`move ${entityLabel(dragged.entity)}`);
    if (constraints.some((constraint) => constraint.node === dragged.entity)) {
      dragged.entity.isManual = true;
    }
    dragged.didSnapshot = true;
  }
  dragged.skipPropagation = dragged.skipPropagation || event.shiftKey;
  moveEntity(dragged.entity, x - dragged.offsetX, y - dragged.offsetY, { skipPropagation: dragged.skipPropagation });
}

function endDrag(event) {
  if (!dragged || event.pointerId !== dragged.pointerId) {
    return;
  }

  const clickEntity = dragged.doubleClickEntity || dragged.entity;
  const wasClick = !dragged.didSnapshot;
  const releasedEntity = dragged.entity;
  const startX = dragged.startX;
  const startY = dragged.startY;
  const wasPropagationPaused = propagationPaused;

  if (canvas.hasPointerCapture(event.pointerId)) {
    canvas.releasePointerCapture(event.pointerId);
  }

  stage.classList.remove("is-dragging");
  dragged = null;
  const { x, y } = getPointerPosition(event);
  if (wasClick && Math.hypot(x - startX, y - startY) <= DOUBLE_CLICK_DISTANCE) {
    lastCanvasClick = {
      entity: clickEntity,
      time: event.timeStamp,
      x,
      y
    };
  } else {
    lastCanvasClick = null;
  }
  updateHoverState(findEntityAt(x, y));
  if (wasPropagationPaused) {
    resumePropagationAfterPausedDrag();
  } else {
    propagationPaused = false;
  }
  if (!wasClick && !wasPropagationPaused && refineXpbdAfterDrag(releasedEntity)) {
    drawTracesForChangedEntities();
    drawAll();
  }
  if (wasPropagationPaused) {
    drawAll();
  }
}

canvas.addEventListener("pointerdown", beginDrag);
canvas.addEventListener("pointermove", continueDrag);
canvas.addEventListener("pointerup", endDrag);
canvas.addEventListener("pointercancel", endDrag);
canvas.addEventListener("pointerleave", () => {
  if (!dragged) {
    updateHoverState(null);
  }
});

canvas.addEventListener("dblclick", (event) => {
  const { x, y } = getPointerPosition(event);
  const entity = findDoubleClickEntityAt(x, y);

  if (handleEntityDoubleClick(entity)) {
    lastCanvasClick = null;
    event.preventDefault();
  }
});

canvas.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
    undoLastEdit();
    event.preventDefault();
    return;
  }

  if (event.key === "Backspace" || event.key === "Delete") {
    deleteSelectedEntity();
    event.preventDefault();
    return;
  }

  const directions = {
    ArrowUp: { x: 0, y: -1 },
    ArrowDown: { x: 0, y: 1 },
    ArrowLeft: { x: -1, y: 0 },
    ArrowRight: { x: 1, y: 0 }
  };
  const direction = directions[event.key];

  if (!direction) {
    return;
  }

  const entity = selectedEntity || listener;
  const step = event.shiftKey ? 10 : 4;
  pushUndoSnapshot(`nudge ${entityLabel(entity)}`);
  selectedEntity = entity;
  moveEntity(entity, entity.x + direction.x * step, entity.y + direction.y * step);
  event.preventDefault();
});

for (const button of toolButtons) {
  button.addEventListener("click", () => {
    handleToolButtonClick(button.dataset.tool);
  });
}

animationToggle.addEventListener("click", () => {
  if (isAnimating) {
    stopAnimation();
  } else {
    startAnimation();
  }
});
undoButton.addEventListener("click", undoLastEdit);
traceSelectedButton.addEventListener("click", toggleSelectedTrace);
traceNoneButton.addEventListener("click", stopAllDrawing);

listenerModeRetargetButton.addEventListener("click", () => {
  setListenerMode(LISTENER_MODE_RETARGET);
});
listenerModePreserveButton.addEventListener("click", () => {
  setListenerMode(LISTENER_MODE_PRESERVE);
});
solverModePropagationButton.addEventListener("click", () => {
  setSolverMode(SOLVER_MODE_PROPAGATION, { updateUrl: true });
});
solverModeXpbdButton.addEventListener("click", () => {
  setSolverMode(SOLVER_MODE_XPBD, { updateUrl: true });
});
patchSelect.addEventListener("change", () => {
  stopAnimation();
  loadMenuPatch(patchSelect.value, { clearUndo: true });
});
savePatchButton.addEventListener("click", savePatch);
loadPatchButton.addEventListener("click", () => {
  patchFileInput.click();
});
patchFileInput.addEventListener("change", () => {
  loadPatchFile(patchFileInput.files[0]);
  patchFileInput.value = "";
});
patchJsonToggle.addEventListener("click", togglePatchJsonEditor);
patchJsonApplyButton.addEventListener("click", applyPatchJsonEditor);
patchValidateButton.addEventListener("click", validatePatchEditor);
midiLoadSequenceButton.addEventListener("click", () => {
  midiSequenceFileInput.click();
});
midiSequenceFileInput.addEventListener("change", async () => {
  const file = midiSequenceFileInput.files[0];
  midiSequenceFileInput.value = "";
  if (!file) {
    return;
  }

  try {
    stopAnimation();
    const patch = await MusicSpaceMidiFileClient.createPatchFromSequenceFile(file);
    selectPatchOptionForPatch(patch);
    loadPatch(patch, { preserveAsActive: true, clearUndo: true });
  } catch (error) {
    setConstraintStatus(error.message || "Could not load MIDI/MusicXML file.");
  }
});
clearTraceButton.addEventListener("click", clearTrace);
saveTraceButton.addEventListener("click", saveTrace);
resetButton.addEventListener("click", () => {
  stopAnimation();
  resetScene();
});
rotationApplyButton.addEventListener("click", applyRotationEditor);
rotationCloseButton.addEventListener("click", closeRotationEditor);
shuttleApplyButton.addEventListener("click", applyShuttleEditor);
shuttleCloseButton.addEventListener("click", closeShuttleEditor);

async function initializeApp() {
  patchSelect.disabled = true;
  patchSelect.replaceChildren();
  const loadingOption = document.createElement("option");
  loadingOption.textContent = "Loading patches...";
  patchSelect.append(loadingOption);

  setActiveTool(TOOL_SELECT);
  setListenerMode(LISTENER_MODE_RETARGET);
  updateSolverIndicator();

  try {
    await loadBuiltInPatchLibrary();
    populatePatchSelect();
    patchSelect.disabled = false;
    activePatch = clonePatch(builtInPatches[0]);
    resetScene();
  } catch (error) {
    console.error(error);
    patchSelect.replaceChildren();
    const errorOption = document.createElement("option");
    errorOption.textContent = "Patch JSON unavailable";
    patchSelect.append(errorOption);
    setConstraintStatus(`Could not load built-in patch JSON: ${error.message}. Serve this directory over HTTP, then reload.`);
  }
}

initializeApp();
