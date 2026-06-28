// MusicSpace prototype: draggable sources and constraint nodes on a 2D canvas.

const WIDTH = 800;
const HEIGHT = 600;

const traceCanvas = document.getElementById("trace");
const traceCtx = traceCanvas.getContext("2d");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const stage = document.getElementById("stage");

const animationToggle = document.getElementById("animation-toggle");
const patchSelect = document.getElementById("patch-select");
const savePatchButton = document.getElementById("save-patch");
const loadPatchButton = document.getElementById("load-patch");
const patchFileInput = document.getElementById("patch-file");
const clearTraceButton = document.getElementById("clear-trace");
const resetButton = document.getElementById("reset");
const saveTraceButton = document.getElementById("save-trace");
const constraintStatus = document.getElementById("constraint-status");
const listenerModeRetargetButton = document.getElementById("listener-mode-retarget");
const listenerModePreserveButton = document.getElementById("listener-mode-preserve");

const LISTENER_MODE_RETARGET = "retarget";
const LISTENER_MODE_PRESERVE = "preserve";
const MIN_DISTANCE = 2;
const CONSTRAINT_EPSILON = 0.5;
const PRODUCT_EPSILON = 0.01;

const BUILT_IN_PATCHES = [
  {
    key: "angle-balance",
    name: "Angle + Balance",
    listener: { x: WIDTH / 2, y: HEIGHT / 2 },
    sources: [
      { name: "A", x: 300, y: 200 },
      { name: "B", x: 400, y: 200 },
      { name: "C", x: 350, y: 300 }
    ],
    constraints: [
      { type: "angle", sources: ["A", "B"] },
      { type: "sum", sources: ["A", "B", "C"] }
    ]
  },
  {
    key: "product-limit",
    name: "Product + Limit",
    listener: { x: 400, y: 300 },
    sources: [
      { name: "A", x: 300, y: 300 },
      { name: "B", x: 400, y: 190 },
      { name: "C", x: 520, y: 300 }
    ],
    constraints: [
      { type: "radialLimit", source: "B", minDistance: 60, maxDistance: 130 },
      { type: "product", sources: ["A", "B", "C"] }
    ]
  },
  {
    key: "open-trio",
    name: "Open Trio",
    listener: { x: 390, y: 320 },
    sources: [
      { name: "Voice", x: 390, y: 180 },
      { name: "Bass", x: 250, y: 360 },
      { name: "Drums", x: 520, y: 380 }
    ],
    constraints: [
      { type: "sum", sources: ["Voice", "Bass", "Drums"] }
    ]
  }
];

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

class ConstraintNode extends Entity {
  constructor(x, y, label, color = "#d97706") {
    super(x, y, color);
    this.label = label;
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
    ctx.fillText(this.label[0], this.x, this.y);
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

      this.a.x = this.listener.x + dist * Math.cos(newAngle);
      this.a.y = this.listener.y + dist * Math.sin(newAngle);
    } else {
      const baseAngle = Math.atan2(this.a.y - this.listener.y, this.a.x - this.listener.x);
      const newAngle = baseAngle + this.angle;
      const dist = Math.hypot(this.b.x - this.listener.x, this.b.y - this.listener.y);

      this.b.x = this.listener.x + dist * Math.cos(newAngle);
      this.b.y = this.listener.y + dist * Math.sin(newAngle);
    }

    this.updateNode();
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
        message: "Sum constraint reached its limit; source motion was backed off."
      };
    }

    if (!result.satisfied) {
      return {
        satisfied: true,
        message: "Sum constraint used backoff to keep distances non-negative."
      };
    }

    return { satisfied: true };
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
    this.node = new ConstraintNode(listener.x - 90, listener.y, "Product", "#7c3aed");
  }

  computeProduct() {
    return this.sources.reduce((product, source) => product * this.distanceToListener(source), 1);
  }

  distanceToListener(source) {
    return Math.max(MIN_DISTANCE, Math.hypot(source.x - this.listener.x, source.y - this.listener.y));
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
        message: "Product constraint has no solution within the active limits."
      };
    }

    if (result.usedBackoff) {
      return {
        satisfied: true,
        message: "Product constraint skipped a limited source and propagated to the remaining sources."
      };
    }

    return { satisfied: true };
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

let listener;
let sources;
let constraints;
let dragged = null;
let selectedEntity = null;
let hoveredEntity = null;
let listenerMode = LISTENER_MODE_RETARGET;
let isAnimating = false;
let animationFrame = null;
let velocity = { x: 0, y: 0 };
let activePatch = clonePatch(BUILT_IN_PATCHES[0]);

function resetScene() {
  loadPatch(activePatch, { preserveAsActive: false });
}

function clonePatch(patch) {
  return JSON.parse(JSON.stringify(patch));
}

function populatePatchSelect() {
  patchSelect.replaceChildren();

  for (const patch of BUILT_IN_PATCHES) {
    const option = document.createElement("option");
    option.value = patch.key;
    option.textContent = patch.name;
    patchSelect.append(option);
  }
}

function loadBuiltInPatch(key) {
  const patch = BUILT_IN_PATCHES.find((candidate) => candidate.key === key) || BUILT_IN_PATCHES[0];
  loadPatch(clonePatch(patch), { preserveAsActive: true });
}

function loadPatch(patch, { preserveAsActive = true } = {}) {
  if (!patch || !patch.listener || !Array.isArray(patch.sources)) {
    setConstraintStatus("Patch file is missing listener or sources.");
    return;
  }

  if (preserveAsActive) {
    activePatch = clonePatch(patch);
  }

  listener = new Listener(patch.listener.x, patch.listener.y);
  sources = patch.sources.map((source) => new SoundSource(source.x, source.y, source.name));
  const sourceByName = new Map(sources.map((source) => [source.name, source]));
  constraints = (patch.constraints || [])
    .map((constraint) => createConstraintFromSpec(constraint, sourceByName))
    .filter(Boolean);
  dragged = null;
  selectedEntity = listener;
  hoveredEntity = null;
  velocity = { x: 0, y: 0 };
  setConstraintStatus("");
  clearTrace();
  drawAll();
}

function createConstraintFromSpec(spec, sourceByName) {
  let constraint = null;

  if (spec.type === "angle") {
    constraint = new AngleConstraint(listener, sourceByName.get(spec.sources[0]), sourceByName.get(spec.sources[1]));
  } else if (spec.type === "sum") {
    constraint = new SumConstraint(listener, spec.sources.map((name) => sourceByName.get(name)));
  } else if (spec.type === "product") {
    constraint = new ProductConstraint(listener, spec.sources.map((name) => sourceByName.get(name)));
  } else if (spec.type === "radialLimit") {
    constraint = new RadialLimitConstraint(
      listener,
      sourceByName.get(spec.source),
      spec.minDistance,
      spec.maxDistance
    );
  }

  if (!constraint || hasMissingConstraintSources(constraint)) {
    return null;
  }

  if (spec.node) {
    constraint.node.x = spec.node.x;
    constraint.node.y = spec.node.y;
    constraint.node.isManual = Boolean(spec.node.isManual);
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

  return true;
}

function serializePatch() {
  return {
    version: 1,
    name: activePatch.name || "MusicSpace Patch",
    listener: { x: listener.x, y: listener.y },
    sources: sources.map((source) => ({
      name: source.name,
      x: source.x,
      y: source.y
    })),
    constraints: constraints.map(serializeConstraint).filter(Boolean)
  };
}

function serializeConstraint(constraint) {
  const node = {
    x: constraint.node.x,
    y: constraint.node.y,
    isManual: constraint.node.isManual
  };

  if (constraint instanceof AngleConstraint) {
    return { type: "angle", sources: [constraint.a.name, constraint.b.name], node };
  }

  if (constraint instanceof SumConstraint) {
    return { type: "sum", sources: constraint.sources.map((source) => source.name), node };
  }

  if (constraint instanceof ProductConstraint) {
    return { type: "product", sources: constraint.sources.map((source) => source.name), node };
  }

  if (constraint instanceof RadialLimitConstraint) {
    return {
      type: "radialLimit",
      source: constraint.source.name,
      minDistance: constraint.minDistance,
      maxDistance: constraint.maxDistance,
      node
    };
  }

  return null;
}

function drawAll() {
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  drawGrid(ctx);

  for (const constraint of constraints) {
    constraint.draw(ctx);
  }

  listener.draw(ctx);
  for (const source of sources) {
    source.draw(ctx);
  }

  if (selectedEntity) {
    drawSelection(ctx, selectedEntity);
  }
}

function drawGrid(ctx) {
  ctx.fillStyle = "#fbfbf8";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
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

function distanceBetween(a, b) {
  return Math.max(MIN_DISTANCE, Math.hypot(a.x - b.x, a.y - b.y));
}

function setSourceDistance(source, anchor, distance) {
  const currentDistance = Math.hypot(source.x - anchor.x, source.y - anchor.y);
  const angle = currentDistance === 0
    ? 0
    : Math.atan2(source.y - anchor.y, source.x - anchor.x);

  source.x = anchor.x + distance * Math.cos(angle);
  source.y = anchor.y + distance * Math.sin(angle);
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
        appliedDelta += MIN_DISTANCE - currentDistance;
        activeSources.splice(index, 1);
        clampedAny = true;
      }
    }

    if (!clampedAny) {
      for (const source of activeSources) {
        const currentDistance = Math.hypot(source.x - anchor.x, source.y - anchor.y);
        setSourceDistance(source, anchor, currentDistance + share);
      }
      remainingDelta = 0;
      break;
    }

    remainingDelta -= appliedDelta;
  }

  return {
    satisfied: Math.abs(remainingDelta) <= CONSTRAINT_EPSILON,
    remainingDelta
  };
}

function distributeProduct(sourcesToAdjust, targetProduct, allSources, anchor) {
  const activeSources = [...sourcesToAdjust];
  let usedBackoff = false;

  while (activeSources.length > 0) {
    const fixedProduct = allSources
      .filter((source) => !activeSources.includes(source))
      .reduce((product, source) => product * distanceBetween(source, anchor), 1);
    const targetActiveProduct = targetProduct / fixedProduct;
    const currentActiveProduct = activeSources
      .reduce((product, source) => product * distanceBetween(source, anchor), 1);

    if (targetActiveProduct <= 0 || currentActiveProduct <= 0) {
      return { satisfied: false, usedBackoff };
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
        activeSources.splice(index, 1);
        clampedAny = true;
        usedBackoff = true;
      }
    }

    if (!clampedAny) {
      for (const source of activeSources) {
        setSourceDistance(source, anchor, distanceBetween(source, anchor) * factor);
      }
      return { satisfied: true, usedBackoff };
    }
  }

  return { satisfied: false, usedBackoff };
}

function enforceConstraints(moved) {
  const messages = [];

  for (const constraint of constraints) {
    const result = constraint.enforce(moved);
    if (result && result.message) {
      messages.push(result.message);
    }
  }

  setConstraintStatus(messages[0] || "");
}

function refreshConstraints() {
  for (const constraint of constraints) {
    constraint.refresh();
  }
  setConstraintStatus("");
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

  for (const constraint of constraints) {
    if (constraint.node.isInside(x, y)) {
      return constraint.node;
    }
  }

  return null;
}

function moveEntity(entity, x, y) {
  entity.x = clamp(x, 0, WIDTH);
  entity.y = clamp(y, 0, HEIGHT);

  if (entity === listener && listenerMode === LISTENER_MODE_RETARGET) {
    refreshConstraints();
  } else {
    enforceConstraints(entity);
  }

  syncTracePositions();
  drawAll();
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

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function syncTracePositions() {
  for (const source of sources) {
    source.prevX = source.x;
    source.prevY = source.y;
  }
}

function animate() {
  if (!isAnimating) {
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

  traceCtx.beginPath();
  traceCtx.moveTo(source.prevX, source.prevY);
  traceCtx.lineTo(nextX, nextY);
  traceCtx.strokeStyle = "rgba(17, 24, 39, 0.55)";
  traceCtx.lineWidth = 2;
  traceCtx.stroke();

  source.x = nextX;
  source.y = nextY;
  source.prevX = nextX;
  source.prevY = nextY;

  enforceConstraints(source);
  drawAll();
  animationFrame = requestAnimationFrame(animate);
}

function startAnimation() {
  if (isAnimating) {
    return;
  }

  isAnimating = true;
  animationToggle.textContent = "Stop";
  setAnimationPressedState(true);
  syncTracePositions();
  animationFrame = requestAnimationFrame(animate);
}

function stopAnimation() {
  isAnimating = false;
  animationToggle.textContent = "Start";
  setAnimationPressedState(false);

  if (animationFrame !== null) {
    cancelAnimationFrame(animationFrame);
    animationFrame = null;
  }
}

function clearTrace() {
  traceCtx.clearRect(0, 0, WIDTH, HEIGHT);
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
      loadPatch(patch, { preserveAsActive: true });
      patchSelect.value = "";
    } catch (error) {
      setConstraintStatus("Could not load patch JSON.");
    }
  });
  reader.readAsText(file);
}

function updateHoverState(entity) {
  hoveredEntity = entity;
  canvas.style.cursor = hoveredEntity ? "grab" : "default";
}

function beginDrag(event) {
  const { x, y } = getPointerPosition(event);
  const entity = findEntityAt(x, y);

  if (!entity) {
    selectedEntity = null;
    drawAll();
    return;
  }

  if (constraints.some((constraint) => constraint.node === entity)) {
    entity.isManual = true;
  }

  canvas.focus();
  selectedEntity = entity;
  dragged = {
    entity,
    pointerId: event.pointerId,
    offsetX: x - entity.x,
    offsetY: y - entity.y
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
  moveEntity(dragged.entity, x - dragged.offsetX, y - dragged.offsetY);
}

function endDrag(event) {
  if (!dragged || event.pointerId !== dragged.pointerId) {
    return;
  }

  if (canvas.hasPointerCapture(event.pointerId)) {
    canvas.releasePointerCapture(event.pointerId);
  }

  stage.classList.remove("is-dragging");
  dragged = null;
  const { x, y } = getPointerPosition(event);
  updateHoverState(findEntityAt(x, y));
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

canvas.addEventListener("keydown", (event) => {
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
  selectedEntity = entity;
  moveEntity(entity, entity.x + direction.x * step, entity.y + direction.y * step);
  event.preventDefault();
});

animationToggle.addEventListener("click", () => {
  if (isAnimating) {
    stopAnimation();
  } else {
    startAnimation();
  }
});

listenerModeRetargetButton.addEventListener("click", () => {
  setListenerMode(LISTENER_MODE_RETARGET);
});
listenerModePreserveButton.addEventListener("click", () => {
  setListenerMode(LISTENER_MODE_PRESERVE);
});
patchSelect.addEventListener("change", () => {
  stopAnimation();
  loadBuiltInPatch(patchSelect.value);
});
savePatchButton.addEventListener("click", savePatch);
loadPatchButton.addEventListener("click", () => {
  patchFileInput.click();
});
patchFileInput.addEventListener("change", () => {
  loadPatchFile(patchFileInput.files[0]);
  patchFileInput.value = "";
});
clearTraceButton.addEventListener("click", clearTrace);
saveTraceButton.addEventListener("click", saveTrace);
resetButton.addEventListener("click", () => {
  stopAnimation();
  resetScene();
});

populatePatchSelect();
setListenerMode(LISTENER_MODE_RETARGET);
resetScene();
