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
const patchSelect = document.getElementById("patch-select");
const savePatchButton = document.getElementById("save-patch");
const loadPatchButton = document.getElementById("load-patch");
const patchFileInput = document.getElementById("patch-file");
const clearTraceButton = document.getElementById("clear-trace");
const resetButton = document.getElementById("reset");
const saveTraceButton = document.getElementById("save-trace");
const audioToggleButton = document.getElementById("audio-toggle");
const audioPanel = document.getElementById("audio-panel");
const audioGrid = document.getElementById("audio-grid");
const constraintStatus = document.getElementById("constraint-status");
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
const TOOL_SELECT = "select";
const FRAMES_PER_SECOND = 60;

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
  },
  {
    key: "simple-rotator",
    name: "Simple Rotator",
    listener: { x: 400, y: 300 },
    sources: [
      { name: "S1", x: 500, y: 300 },
      { name: "S2", x: 430, y: 382 },
      { name: "S3", x: 330, y: 352 },
      { name: "S4", x: 335, y: 245 }
    ],
    movingObjects: [
      {
        name: "Spin",
        x: 410,
        y: 310,
        trajectory: {
          type: "rotator",
          running: true,
          periodSeconds: 18,
          direction: 1,
          displacementInducesRotation: true,
          phase: 0,
          rotationDelta: 0
        }
      }
    ],
    constraints: [
      { type: "solid", carrier: "Spin", attached: "S1" },
      { type: "solid", carrier: "Spin", attached: "S2" },
      { type: "solid", carrier: "Spin", attached: "S3" },
      { type: "solid", carrier: "Spin", attached: "S4" }
    ]
  },
  {
    key: "nested-rotators",
    name: "Nested Rotators",
    listener: { x: 400, y: 300 },
    sources: [
      { name: "Lead", x: 560, y: 300 },
      { name: "Echo", x: 465, y: 380 },
      { name: "Pad", x: 285, y: 300 }
    ],
    movingObjects: [
      {
        name: "Parent",
        x: 400,
        y: 300,
        trajectory: {
          type: "rotator",
          running: true,
          periodSeconds: 24,
          direction: 1,
          displacementInducesRotation: true,
          phase: 0,
          rotationDelta: 0
        }
      },
      {
        name: "Child",
        x: 480,
        y: 300,
        trajectory: {
          type: "rotator",
          running: true,
          periodSeconds: 9,
          direction: -1,
          displacementInducesRotation: true,
          phase: 0,
          rotationDelta: 0
        }
      }
    ],
    constraints: [
      { type: "solid", carrier: "Parent", attached: "Child" },
      { type: "solid", carrier: "Child", attached: "Lead" },
      { type: "solid", carrier: "Child", attached: "Echo" },
      { type: "solid", carrier: "Parent", attached: "Pad" }
    ]
  },
  {
    key: "cycloid-rotator",
    name: "Cycloid Rotator",
    listener: { x: 400, y: 300 },
    sources: [
      { name: "A", x: 580, y: 300, drawTrace: true },
      { name: "B", x: 520, y: 360, drawTrace: true },
      { name: "C", x: 460, y: 300, drawTrace: true }
    ],
    movingObjects: [
      {
        name: "Orbit",
        x: 520,
        y: 300,
        drawTrace: true,
        trajectory: {
          type: "rotation",
          centerX: 400,
          centerY: 300,
          radius: 120,
          phase: 0,
          angularSpeed: 0.012
        }
      },
      {
        name: "Spin",
        x: 520,
        y: 300,
        trajectory: {
          type: "rotator",
          running: true,
          periodSeconds: 8,
          direction: 1,
          displacementInducesRotation: true,
          phase: 0,
          rotationDelta: 0
        }
      }
    ],
    constraints: [
      { type: "solid", carrier: "Orbit", attached: "Spin" },
      { type: "solid", carrier: "Spin", attached: "A" },
      { type: "solid", carrier: "Spin", attached: "B" },
      { type: "solid", carrier: "Spin", attached: "C" }
    ]
  },
  {
    key: "shuttle-spin",
    name: "Shuttle Spin",
    listener: { x: 400, y: 300 },
    sources: [
      { name: "Start", x: 230, y: 210 },
      { name: "End", x: 570, y: 390 },
      { name: "Vox", x: 305, y: 250 },
      { name: "Beat", x: 250, y: 310 },
      { name: "Bass", x: 300, y: 365 }
    ],
    movingObjects: [
      {
        name: "Lift",
        x: 300,
        y: 310,
        trajectory: {
          type: "shuttle",
          start: { type: "object", name: "Start" },
          end: { type: "object", name: "End" },
          ax: 230,
          ay: 210,
          bx: 570,
          by: 390,
          phase: 0.2,
          speed: 0.006,
          direction: 1
        }
      },
      {
        name: "Spin",
        x: 300,
        y: 310,
        trajectory: {
          type: "rotator",
          running: true,
          periodSeconds: 12,
          direction: -1,
          displacementInducesRotation: true,
          phase: 0,
          rotationDelta: 0
        }
      }
    ],
    constraints: [
      { type: "solid", carrier: "Lift", attached: "Spin" },
      { type: "solid", carrier: "Spin", attached: "Vox" },
      { type: "solid", carrier: "Spin", attached: "Beat" },
      { type: "solid", carrier: "Spin", attached: "Bass" }
    ]
  },
  {
    key: "bouncing-constellation",
    name: "Bouncing Constellation",
    listener: { x: 400, y: 300 },
    sources: [
      { name: "One", x: 575, y: 250 },
      { name: "Two", x: 520, y: 320 },
      { name: "Three", x: 590, y: 355 }
    ],
    movingObjects: [
      {
        name: "Bounce",
        x: 545,
        y: 315,
        trajectory: {
          type: "bounce",
          vx: 1.6,
          vy: 1.1
        }
      },
      {
        name: "Spin",
        x: 545,
        y: 315,
        trajectory: {
          type: "rotator",
          running: true,
          periodSeconds: 10,
          direction: 1,
          displacementInducesRotation: true,
          phase: 0,
          rotationDelta: 0
        }
      }
    ],
    constraints: [
      { type: "solid", carrier: "Bounce", attached: "Spin" },
      { type: "solid", carrier: "Spin", attached: "One" },
      { type: "solid", carrier: "Spin", attached: "Two" },
      { type: "solid", carrier: "Spin", attached: "Three" },
      { type: "separation", sources: ["One", "Two"], minDistance: 50 },
      { type: "separation", sources: ["Two", "Three"], minDistance: 50 }
    ]
  },
  {
    key: "beatles-trajectory-study",
    name: "Beatles Trajectory Study",
    listener: { x: 400, y: 300 },
    sources: [
      { name: "Voice", x: 520, y: 300 },
      { name: "Bass", x: 260, y: 380 },
      { name: "Drums", x: 430, y: 180 },
      { name: "Guitar", x: 585, y: 335 }
    ],
    movingObjects: [
      {
        name: "Spin",
        x: 430,
        y: 275,
        trajectory: {
          type: "rotator",
          running: true,
          periodSeconds: 20,
          direction: 1,
          displacementInducesRotation: true,
          phase: 0,
          rotationDelta: 0
        }
      },
      {
        name: "Shuttle",
        x: 260,
        y: 380,
        trajectory: {
          type: "shuttle",
          ax: 220,
          ay: 380,
          bx: 580,
          by: 380,
          phase: 0.12,
          speed: 0.006,
          direction: 1
        }
      }
    ],
    constraints: [
      { type: "solid", carrier: "Spin", attached: "Voice" },
      { type: "solid", carrier: "Spin", attached: "Drums" },
      { type: "solid", carrier: "Spin", attached: "Guitar" },
      { type: "solid", carrier: "Shuttle", attached: "Bass" },
      { type: "angle", sources: ["Voice", "Drums"] },
      { type: "sum", sources: ["Voice", "Bass", "Drums"] }
    ]
  },
  {
    key: "faust-control-study",
    name: "Faust Control Study",
    listener: { x: 400, y: 300 },
    sources: [
      { name: "Freq", x: 250, y: 230, drawTrace: true },
      { name: "Cutoff", x: 570, y: 260, drawTrace: true },
      { name: "Q", x: 530, y: 385, drawTrace: true },
      { name: "Gain", x: 325, y: 405 }
    ],
    movingObjects: [
      {
        name: "Sweep",
        x: 250,
        y: 230,
        drawTrace: true,
        trajectory: {
          type: "shuttle",
          ax: 210,
          ay: 210,
          bx: 610,
          by: 250,
          phase: 0.1,
          speed: 0.0045,
          direction: 1,
          showPath: true
        }
      },
      {
        name: "Orbit",
        x: 520,
        y: 340,
        trajectory: {
          type: "rotation",
          centerX: 400,
          centerY: 300,
          radius: 135,
          phase: 0.3,
          angularSpeed: 0.009
        }
      },
      {
        name: "ResoSpin",
        x: 520,
        y: 340,
        trajectory: {
          type: "rotator",
          running: true,
          periodSeconds: 7,
          direction: -1,
          displacementInducesRotation: true,
          phase: 0,
          rotationDelta: 0
        }
      }
    ],
    constraints: [
      { type: "solid", carrier: "Sweep", attached: "Freq" },
      { type: "solid", carrier: "Orbit", attached: "ResoSpin" },
      { type: "solid", carrier: "ResoSpin", attached: "Q" },
      { type: "fixedDistance", anchor: "Freq", target: "Gain", distance: 190 },
      { type: "distanceRatio", sources: ["Cutoff", "Q"], ratio: 1.35 },
      { type: "radialLimit", source: "Q", minDistance: 75, maxDistance: 185 },
      { type: "sum", sources: ["Freq", "Cutoff", "Gain"] }
    ],
    audioMappings: [
      {
        source: "Freq",
        feature: "x",
        target: "/osc/freq",
        inputMin: 180,
        inputMax: 640,
        outputMin: 110,
        outputMax: 880,
        curve: "exp"
      },
      {
        source: "Cutoff",
        feature: "distance",
        target: "/filter/frequency",
        inputMin: 70,
        inputMax: 260,
        outputMin: 250,
        outputMax: 4200,
        curve: "exp"
      },
      {
        source: "Q",
        feature: "distance",
        target: "/filter/q",
        inputMin: 70,
        inputMax: 190,
        outputMin: 0.5,
        outputMax: 18,
        curve: "linear"
      },
      {
        source: "Gain",
        feature: "y",
        target: "/output/gain",
        inputMin: 500,
        inputMax: 150,
        outputMin: 0.03,
        outputMax: 0.22,
        curve: "linear"
      }
    ]
  },
  {
    key: "granular-cloud-study",
    name: "Granular Cloud Study",
    listener: { x: 400, y: 300 },
    sources: [
      { name: "Rate", x: 235, y: 205, drawTrace: true },
      { name: "Size", x: 330, y: 430, drawTrace: true },
      { name: "Pitch", x: 555, y: 225, drawTrace: true },
      { name: "Spray", x: 585, y: 370, drawTrace: true },
      { name: "Tone", x: 420, y: 145 },
      { name: "Level", x: 270, y: 350 }
    ],
    movingObjects: [
      {
        name: "DensityLift",
        x: 235,
        y: 205,
        drawTrace: true,
        trajectory: {
          type: "shuttle",
          start: { type: "object", name: "Level" },
          end: { type: "fixed", x: 620, y: 190 },
          ax: 270,
          ay: 350,
          bx: 620,
          by: 190,
          phase: 0.18,
          speed: 0.0035,
          direction: 1,
          showPath: true
        }
      },
      {
        name: "PitchOrbit",
        x: 540,
        y: 300,
        trajectory: {
          type: "rotation",
          centerX: 400,
          centerY: 300,
          radius: 140,
          phase: -0.5,
          angularSpeed: 0.006
        }
      },
      {
        name: "PitchSpin",
        x: 540,
        y: 300,
        trajectory: {
          type: "rotator",
          running: true,
          periodSeconds: 11,
          direction: 1,
          displacementInducesRotation: true,
          phase: 0,
          rotationDelta: 0
        }
      }
    ],
    constraints: [
      { type: "solid", carrier: "DensityLift", attached: "Rate" },
      { type: "solid", carrier: "PitchOrbit", attached: "PitchSpin" },
      { type: "solid", carrier: "PitchSpin", attached: "Pitch" },
      { type: "solid", carrier: "PitchSpin", attached: "Spray" },
      { type: "fixedDistance", anchor: "Rate", target: "Size", distance: 250 },
      { type: "distanceRatio", sources: ["Tone", "Pitch"], ratio: 0.85 },
      { type: "angleSector", source: "Tone", centerAngle: -1.55, width: 1.75 },
      { type: "radialLimit", source: "Spray", minDistance: 80, maxDistance: 210 },
      { type: "sum", sources: ["Rate", "Size", "Level"] }
    ],
    target: { type: "granular" },
    audioMappings: [
      {
        source: "Rate",
        feature: "x",
        target: "/grain/rate",
        inputMin: 210,
        inputMax: 640,
        outputMin: 6,
        outputMax: 44,
        curve: "linear"
      },
      {
        source: "Size",
        feature: "distance",
        target: "/grain/size",
        inputMin: 90,
        inputMax: 280,
        outputMin: 0.025,
        outputMax: 0.22,
        curve: "linear"
      },
      {
        source: "Pitch",
        feature: "y",
        target: "/grain/pitch",
        inputMin: 500,
        inputMax: 120,
        outputMin: 0.45,
        outputMax: 2.4,
        curve: "exp"
      },
      {
        source: "Spray",
        feature: "distance",
        target: "/grain/spread",
        inputMin: 80,
        inputMax: 215,
        outputMin: 0.02,
        outputMax: 0.9,
        curve: "linear"
      },
      {
        source: "Tone",
        feature: "distance",
        target: "/filter/frequency",
        inputMin: 70,
        inputMax: 230,
        outputMin: 450,
        outputMax: 6200,
        curve: "exp"
      },
      {
        source: "Spray",
        feature: "angle",
        target: "/filter/q",
        inputMin: -3.14,
        inputMax: 3.14,
        outputMin: 0.6,
        outputMax: 12,
        curve: "linear"
      },
      {
        source: "Level",
        feature: "y",
        target: "/output/gain",
        inputMin: 500,
        inputMax: 160,
        outputMin: 0.08,
        outputMax: 0.34,
        curve: "linear"
      }
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
    this.node = new ConstraintNode(listener.x - 90, listener.y, "Product", "#7c3aed", "π");
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
let activeRotationMover = null;
let activeShuttleMover = null;
let undoStack = [];
let listenerMode = LISTENER_MODE_RETARGET;
let isAnimating = false;
let animationFrame = null;
let velocity = { x: 0, y: 0 };
let activePatch = clonePatch(BUILT_IN_PATCHES[0]);
let audioMappings = [];
let targetController = null;
let targetSpec = MusicSpaceTargets.normalizeTargetSpec();
let targetParamValues = {};

function resetScene() {
  pushUndoSnapshot("reset");
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

function loadBuiltInPatch(key, options = {}) {
  const patch = BUILT_IN_PATCHES.find((candidate) => candidate.key === key) || BUILT_IN_PATCHES[0];
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
  resetTargetController(patch.target || patch.audioSynth);
  audioMappings = normalizeParameterMappings(patch.audioMappings || []);
  dragged = null;
  selectedEntity = listener;
  hoveredEntity = null;
  pendingToolEntities = [];
  activeRotationMover = null;
  activeShuttleMover = null;
  rotationEditor.hidden = true;
  shuttleEditor.hidden = true;
  velocity = { x: 0, y: 0 };
  setConstraintStatus("");
  clearTrace();
  updateAudioMappings({ immediate: true });
  drawAll();
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
    target: { ...targetSpec },
    audioMappings: audioMappings.map((mapping) => ({ ...mapping }))
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

function resetTargetController(spec) {
  if (targetController) {
    targetController.dispose();
  }

  targetSpec = MusicSpaceTargets.normalizeTargetSpec(spec);
  targetController = MusicSpaceTargets.createTargetController(targetSpec, {
    onStatus: setConstraintStatus
  });
  targetParamValues = targetController.defaults();
  updateAudioToggle();
}

function normalizeParameterMappings(mappings) {
  return MusicSpaceMapping.normalizeMappings(mappings, {
    isSupportedTarget: (target) => targetController?.hasParameter(target)
  });
}

function updateAudioMappings({ immediate = false } = {}) {
  targetParamValues = MusicSpaceMapping.valuesForMappings({
    mappings: audioMappings,
    defaults: targetController?.defaults() || {},
    getEntity: getObjectByName,
    getFeature: parameterFeatureValue
  });

  updateAudioPanel();
  targetController?.apply(targetParamValues, { immediate });
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

function updateAudioPanel() {
  audioPanel.hidden = audioMappings.length === 0;

  audioGrid.replaceChildren();
  for (const [target, value] of Object.entries(targetParamValues)) {
    const config = targetController?.parameterConfig(target) || { suffix: "", digits: 2 };
    const row = document.createElement("div");
    const label = document.createElement("span");
    const output = document.createElement("output");

    row.className = "audio-param";
    label.textContent = target;
    output.value = `${value.toFixed(config.digits)}${config.suffix}`;
    row.append(label, output);
    audioGrid.append(row);
  }
}

async function toggleAudio() {
  const nextEnabled = !targetController?.isEnabled();
  await targetController?.setEnabled(nextEnabled);
  updateAudioToggle();
}

function updateAudioToggle() {
  const enabled = Boolean(targetController?.isEnabled());
  audioToggleButton.textContent = enabled ? "Sound On" : "Sound Off";
  audioToggleButton.setAttribute("aria-pressed", String(enabled));
}

function drawAudioMappingCues(ctx) {
  if (audioMappings.length === 0) {
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
  for (const mapping of audioMappings) {
    const entity = getObjectByName(mapping.source);
    if (!entity || drawnSources.has(entity)) {
      continue;
    }

    ctx.beginPath();
    ctx.moveTo(listener.x, listener.y);
    ctx.lineTo(entity.x, entity.y);
    ctx.stroke();
    ctx.fillText("DSP", entity.x, entity.y + entity.radius + 6);
    drawnSources.add(entity);
  }

  ctx.restore();
}

function drawAll() {
  updateTraceSelectedButton();
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  drawGrid(ctx);
  updateAudioMappings();

  for (const constraint of constraints) {
    constraint.draw(ctx);
  }

  drawAudioMappingCues(ctx);

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
  const queue = moved ? [moved] : [];
  const seenEntities = new Set();
  let propagationSteps = 0;

  while (queue.length > 0 && propagationSteps < 24) {
    const currentMoved = queue.shift();
    if (seenEntities.has(currentMoved)) {
      continue;
    }
    seenEntities.add(currentMoved);
    propagationSteps += 1;
    for (const constraint of constraints) {
      const result = constraint.enforce(currentMoved);
      if (result && result.message && !messages.includes(result.message)) {
        messages.push(result.message);
      }
      if (result && result.movedEntity && result.movedEntity !== currentMoved && !seenEntities.has(result.movedEntity)) {
        queue.push(result.movedEntity);
      }
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

function setActiveTool(tool) {
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
    sum: "Sum: click three sources or movers.",
    product: "Product: click three sources or movers.",
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
    sum: 3,
    product: 3,
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
  return true;
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

function moveEntity(entity, x, y) {
  const nextX = clamp(x, 0, WIDTH);
  const nextY = clamp(y, 0, HEIGHT);
  translateEntity(entity, nextX - entity.x, nextY - entity.y);

  if (entity === listener && listenerMode === LISTENER_MODE_RETARGET) {
    refreshConstraints();
  } else {
    enforceConstraints(entity);
  }

  drawTracesForChangedEntities();
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
        enforceConstraints(mover);
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

function updateHoverState(entity) {
  hoveredEntity = entity;
  canvas.style.cursor = activeTool === TOOL_SELECT
    ? (hoveredEntity ? "grab" : "default")
    : "crosshair";
}

function beginDrag(event) {
  const { x, y } = getPointerPosition(event);
  const entity = findEntityAt(x, y);

  if (activeTool !== TOOL_SELECT) {
    handleToolClick(x, y, entity);
    event.preventDefault();
    return;
  }

  if (!entity) {
    selectedEntity = null;
    drawAll();
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
    didSnapshot: false
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

canvas.addEventListener("dblclick", (event) => {
  const { x, y } = getPointerPosition(event);
  const entity = findDoubleClickEntityAt(x, y);

  if (entity instanceof MovingObject && entity.trajectory?.type === "rotator") {
    openRotationEditor(entity);
    selectedEntity = entity;
    drawAll();
    event.preventDefault();
  } else if (entity instanceof MovingObject && entity.trajectory?.type === "shuttle") {
    openShuttleEditor(entity);
    selectedEntity = entity;
    drawAll();
    event.preventDefault();
  } else if (entity instanceof MovingObject) {
    setConstraintStatus("Use Spin to convert this mover into a rotative object.");
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
    setActiveTool(button.dataset.tool);
  });
}

animationToggle.addEventListener("click", () => {
  if (isAnimating) {
    stopAnimation();
  } else {
    startAnimation();
  }
});
audioToggleButton.addEventListener("click", () => {
  toggleAudio();
});
undoButton.addEventListener("click", undoLastEdit);
traceSelectedButton.addEventListener("click", toggleSelectedTrace);

listenerModeRetargetButton.addEventListener("click", () => {
  setListenerMode(LISTENER_MODE_RETARGET);
});
listenerModePreserveButton.addEventListener("click", () => {
  setListenerMode(LISTENER_MODE_PRESERVE);
});
patchSelect.addEventListener("change", () => {
  stopAnimation();
  loadBuiltInPatch(patchSelect.value, { clearUndo: true });
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
rotationApplyButton.addEventListener("click", applyRotationEditor);
rotationCloseButton.addEventListener("click", closeRotationEditor);
shuttleApplyButton.addEventListener("click", applyShuttleEditor);
shuttleCloseButton.addEventListener("click", closeShuttleEditor);

populatePatchSelect();
setActiveTool(TOOL_SELECT);
setListenerMode(LISTENER_MODE_RETARGET);
updateAudioToggle();
resetScene();
