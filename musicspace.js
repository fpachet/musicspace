// MusicSpace prototype: draggable sources and constraint nodes on a 2D canvas.

const WIDTH = 800;
const HEIGHT = 600;

const traceCanvas = document.getElementById("trace");
const traceCtx = traceCanvas.getContext("2d");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const animationToggle = document.getElementById("animation-toggle");
const clearTraceButton = document.getElementById("clear-trace");
const resetButton = document.getElementById("reset");
const saveTraceButton = document.getElementById("save-trace");

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

  enforce(moved) {
    if (moved !== this.a && moved !== this.b && moved !== this.listener && moved !== this.node) {
      return;
    }

    const baseAngle = Math.atan2(this.a.y - this.listener.y, this.a.x - this.listener.x);
    const newAngle = baseAngle + this.angle;
    const dist = Math.hypot(this.b.x - this.listener.x, this.b.y - this.listener.y);

    this.b.x = this.listener.x + dist * Math.cos(newAngle);
    this.b.y = this.listener.y + dist * Math.sin(newAngle);

    if (moved !== this.node && !this.node.isManual) {
      this.node.x = (this.a.x + this.b.x) / 2;
      this.node.y = (this.a.y + this.b.y) / 2;
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

  enforce(moved) {
    if (moved === this.listener || !this.sources.includes(moved)) {
      return;
    }

    const others = this.sources.filter((source) => source !== moved);
    const remaining = this.totalDistance - this.distanceToListener(moved);
    const share = remaining / others.length;

    for (const source of others) {
      const angle = Math.atan2(source.y - this.listener.y, source.x - this.listener.x);
      source.x = this.listener.x + share * Math.cos(angle);
      source.y = this.listener.y + share * Math.sin(angle);
    }
  }

  draw(ctx) {
    for (const source of this.sources) {
      drawConnector(ctx, this.node, source, "#059669");
    }
    drawConnector(ctx, this.node, this.listener, "#059669");
    this.node.draw(ctx);
  }
}

let listener;
let sources;
let constraints;
let dragged = null;
let isAnimating = false;
let animationFrame = null;
let velocity = { x: 0, y: 0 };

function resetScene() {
  listener = new Listener(WIDTH / 2, HEIGHT / 2);
  sources = [
    new SoundSource(300, 200, "A"),
    new SoundSource(400, 200, "B"),
    new SoundSource(350, 300, "C")
  ];
  constraints = [
    new AngleConstraint(listener, sources[0], sources[1]),
    new SumConstraint(listener, sources)
  ];
  dragged = null;
  velocity = { x: 0, y: 0 };
  clearTrace();
  drawAll();
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

function enforceConstraints(moved) {
  for (const constraint of constraints) {
    constraint.enforce(moved);
  }
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
      constraint.node.isManual = true;
      return constraint.node;
    }
  }

  return null;
}

function moveEntity(entity, x, y) {
  entity.x = clamp(x, 0, WIDTH);
  entity.y = clamp(y, 0, HEIGHT);
  enforceConstraints(entity);
  syncTracePositions();
  drawAll();
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
  syncTracePositions();
  animationFrame = requestAnimationFrame(animate);
}

function stopAnimation() {
  isAnimating = false;
  animationToggle.textContent = "Start";

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

canvas.addEventListener("mousedown", (event) => {
  const { x, y } = getPointerPosition(event);
  dragged = findEntityAt(x, y);
});

canvas.addEventListener("mousemove", (event) => {
  if (!dragged) {
    return;
  }

  const { x, y } = getPointerPosition(event);
  moveEntity(dragged, x, y);
});

window.addEventListener("mouseup", () => {
  dragged = null;
});

animationToggle.addEventListener("click", () => {
  if (isAnimating) {
    stopAnimation();
  } else {
    startAnimation();
  }
});

clearTraceButton.addEventListener("click", clearTrace);
saveTraceButton.addEventListener("click", saveTrace);
resetButton.addEventListener("click", () => {
  stopAnimation();
  resetScene();
});

resetScene();
