const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");

function createCanvasContext() {
  const noop = () => {};
  return {
    arc: noop,
    beginPath: noop,
    clearRect: noop,
    closePath: noop,
    fill: noop,
    fillText: noop,
    lineTo: noop,
    moveTo: noop,
    rect: noop,
    restore: noop,
    rotate: noop,
    save: noop,
    setLineDash: noop,
    stroke: noop,
    translate: noop
  };
}

function createElement(id = "") {
  const element = {
    id,
    attributes: new Map(),
    children: [],
    classList: {
      add() {},
      remove() {},
      toggle() {}
    },
    dataset: {},
    disabled: false,
    files: [],
    hidden: false,
    options: [],
    style: {},
    textContent: "",
    value: "",
    addEventListener() {},
    append(child) {
      this.children.push(child);
      if (child && "value" in child) {
        this.options.push(child);
      }
    },
    click() {},
    focus() {},
    getBoundingClientRect() {
      return { height: 600, left: 0, top: 0, width: 800, x: 0, y: 0 };
    },
    getContext() {
      return createCanvasContext();
    },
    releasePointerCapture() {},
    replaceChildren(...children) {
      this.children = children;
      this.options = children.filter((child) => child && "value" in child);
    },
    scrollIntoView() {},
    setAttribute(name, value) {
      this.attributes.set(name, String(value));
    },
    setPointerCapture() {},
    toDataURL() {
      return "data:image/png;base64,";
    }
  };
  return element;
}

function createDocument() {
  const elements = new Map();
  return {
    createElement(tagName) {
      const element = createElement();
      element.tagName = tagName.toUpperCase();
      return element;
    },
    getElementById(id) {
      if (!elements.has(id)) {
        elements.set(id, createElement(id));
      }
      return elements.get(id);
    },
    querySelectorAll() {
      return [];
    }
  };
}

function createEngineHarness() {
  const document = createDocument();
  const sandbox = {
    Blob,
    URL,
    console,
    document,
    fetch: async () => {
      throw new Error("fetch is disabled in constraint-engine tests");
    },
    FileReader: class {},
    MusicSpaceTargets: {
      listTargetBackends() {
        return [
          { type: "subtractive", parameters: ["/osc/freq", "/filter/frequency", "/filter/q", "/output/gain"] },
          { type: "granular", parameters: ["/grain/rate", "/grain/size", "/grain/pitch", "/grain/spread", "/filter/frequency", "/filter/q", "/output/gain"] },
          { type: "midi-file", parameters: [] },
          { type: "faust-wasm", parameters: [] }
        ];
      }
    },
    MusicSpaceMidiFileClient: {
      createMidiFileClient() {
        return {
          loadPatch() {},
          serialize() {
            return {};
          },
          updateSpatial() {}
        };
      }
    },
    MusicSpaceParameterClient: {
      createParameterClient() {
        return {
          hasMappings() {
            return false;
          },
          loadPatch() {},
          mappedEntityNames() {
            return [];
          },
          serialize() {
            return {};
          },
          update() {}
        };
      }
    },
    window: {
      location: { href: "http://127.0.0.1/musicspace.html" }
    },
    cancelAnimationFrame() {},
    requestAnimationFrame() {
      return 1;
    }
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);

  const source = fs
    .readFileSync(path.join(ROOT, "musicspace.js"), "utf8")
    .replace(/\ninitializeApp\(\);\s*$/, "\n");
  const exposedSource = `${source}
globalThis.__musicspaceTestApi = {
  getLastPropagationReport,
  getObjectByName,
  loadPatch,
  measureConstraintResiduals,
  moveEntity,
  resumePropagationAfterPausedDrag,
  serializePatch,
  validatePatch
};`;
  vm.runInContext(exposedSource, sandbox, { filename: "musicspace.js" });

  const api = sandbox.__musicspaceTestApi;
  return {
    api,
    loadPatch(patch) {
      api.loadPatch(JSON.parse(JSON.stringify(patch)), { clearUndo: true, preserveAsActive: true });
    },
    move(name, x, y, options) {
      const entity = api.getObjectByName(name);
      assert.ok(entity, `Expected entity ${name} to exist`);
      api.moveEntity(entity, x, y, options);
      return api.getLastPropagationReport();
    },
    point(name) {
      const entity = api.getObjectByName(name);
      assert.ok(entity, `Expected entity ${name} to exist`);
      return { x: entity.x, y: entity.y };
    },
    report() {
      return api.getLastPropagationReport();
    },
    resumePropagationAfterPausedDrag() {
      api.resumePropagationAfterPausedDrag();
    },
    residuals() {
      return api.measureConstraintResiduals().map(({ measurement }) => measurement);
    }
  };
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function loadFixturePatch(fileName) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, "patches", fileName), "utf8"));
}

test("sum constraint redistributes distance and reports no residuals", () => {
  const engine = createEngineHarness();
  engine.loadPatch({
    name: "Sum smoke",
    version: 1,
    listener: { x: 0, y: 0 },
    sources: [
      { name: "A", x: 100, y: 0 },
      { name: "B", x: 0, y: 100 },
      { name: "C", x: -100, y: 0 }
    ],
    constraints: [{ type: "sum", sources: ["A", "B", "C"] }]
  });

  const report = engine.move("A", 130, 0);
  const listener = engine.point("Listener");
  const total = ["A", "B", "C"]
    .map((name) => distance(engine.point(name), listener))
    .reduce((sum, value) => sum + value, 0);

  assert.equal(report.satisfied, true);
  assert.equal(report.residuals.length, 0);
  assert.ok(Math.abs(total - 300) <= 0.5);
});

test("shared sum and angle graph propagates through the shared source", () => {
  const engine = createEngineHarness();
  engine.loadPatch(loadFixturePatch("angle-balance.json"));
  const beforeB = engine.point("B");
  const beforeC = engine.point("C");

  const report = engine.move("D", 165, 147);
  const afterB = engine.point("B");
  const afterC = engine.point("C");

  assert.equal(report.hitStepCap, false);
  assert.ok(report.movedEntities.includes("A"), "shared source A should be propagated");
  assert.ok(distance(beforeB, afterB) > 1, "B should move after D pulls on shared A");
  assert.ok(distance(beforeC, afterC) > 1, "C should move after D pulls on shared A");
});

test("shift-style paused movement skips propagation and reports residuals", () => {
  const engine = createEngineHarness();
  engine.loadPatch(loadFixturePatch("angle-balance.json"));
  const beforeB = engine.point("B");
  const beforeC = engine.point("C");

  const report = engine.move("D", 165, 147, { skipPropagation: true });
  const afterB = engine.point("B");
  const afterC = engine.point("C");

  assert.equal(report.propagationPaused, true);
  assert.equal(report.satisfied, false);
  assert.equal(report.propagationSteps, 0);
  assert.ok(report.residuals.length > 0);
  assert.deepEqual(afterB, beforeB);
  assert.deepEqual(afterC, beforeC);
});

test("resuming after paused movement retargets constraints before normal propagation", () => {
  const engine = createEngineHarness();
  engine.loadPatch(loadFixturePatch("angle-balance.json"));

  engine.move("D", 165, 147, { skipPropagation: true });
  const shiftedB = engine.point("B");
  const shiftedC = engine.point("C");
  engine.resumePropagationAfterPausedDrag();

  const report = engine.move("D", 166, 148);
  const afterB = engine.point("B");
  const afterC = engine.point("C");

  assert.equal(report.propagationPaused, false);
  assert.equal(report.hitStepCap, false);
  assert.ok(distance(shiftedB, afterB) < 8, "B should not jump back to the pre-pause constraint state");
  assert.ok(distance(shiftedC, afterC) < 8, "C should not jump back to the pre-pause constraint state");
});

test("product constraint and radial limits can back off without residuals", () => {
  const engine = createEngineHarness();
  engine.loadPatch(loadFixturePatch("product-limit.json"));

  const report = engine.move("A", 200, 300);

  assert.equal(report.hitStepCap, false);
  assert.equal(report.residuals.length, 0);
  assert.equal(report.satisfied, true);
});

test("radial limits clamp an out-of-range source", () => {
  const engine = createEngineHarness();
  engine.loadPatch({
    name: "Radial limit smoke",
    version: 1,
    listener: { x: 0, y: 0 },
    sources: [{ name: "A", x: 100, y: 0 }],
    constraints: [{ type: "radialLimit", source: "A", minDistance: 50, maxDistance: 150 }]
  });

  const report = engine.move("A", 300, 0);
  const radius = distance(engine.point("A"), engine.point("Listener"));

  assert.equal(report.residuals.length, 0);
  assert.ok(Math.abs(radius - 150) <= 0.5);
});

test("distance ratio propagation preserves listener-relative ratio", () => {
  const engine = createEngineHarness();
  engine.loadPatch({
    name: "Ratio smoke",
    version: 1,
    listener: { x: 0, y: 0 },
    sources: [
      { name: "A", x: 100, y: 0 },
      { name: "B", x: 50, y: 0 }
    ],
    constraints: [{ type: "distanceRatio", sources: ["A", "B"], ratio: 2 }]
  });

  const report = engine.move("B", 70, 0);
  const listener = engine.point("Listener");
  const ratio = distance(engine.point("A"), listener) / distance(engine.point("B"), listener);

  assert.equal(report.residuals.length, 0);
  assert.ok(Math.abs(ratio - 2) <= 0.01);
});

test("solid link carries the attached object with its carrier", () => {
  const engine = createEngineHarness();
  engine.loadPatch({
    name: "Solid link smoke",
    version: 1,
    listener: { x: 0, y: 0 },
    sources: [
      { name: "A", x: 100, y: 0 },
      { name: "B", x: 150, y: 20 }
    ],
    constraints: [{ type: "solid", carrier: "A", attached: "B", offsetX: 50, offsetY: 20 }]
  });

  const report = engine.move("A", 130, 10);
  const b = engine.point("B");

  assert.equal(report.residuals.length, 0);
  assert.ok(Math.abs(b.x - 180) <= 0.5);
  assert.ok(Math.abs(b.y - 30) <= 0.5);
});

test("patch validation accepts coherent patch JSON", () => {
  const engine = createEngineHarness();
  const findings = engine.api.validatePatch(loadFixturePatch("jazz-trio-midi.json"));

  assert.equal(findings.length, 1);
  assert.equal(findings[0].level, "ok");
});

test("patch validation accepts every built-in patch", () => {
  const engine = createEngineHarness();
  const index = JSON.parse(fs.readFileSync(path.join(ROOT, "patches", "index.json"), "utf8"));

  for (const entry of index.patches) {
    const findings = engine.api.validatePatch(loadFixturePatch(entry.file));
    const problems = findings.filter((finding) => finding.level !== "ok");

    assert.equal(problems.length, 0, `${entry.file}: ${problems.map((finding) => finding.message).join("; ")}`);
  }
});

test("patch validation reports dangling constraints and backend mistakes", () => {
  const engine = createEngineHarness();
  const findings = engine.api.validatePatch({
    name: "Broken patch",
    version: 1,
    listener: { x: 400, y: 300 },
    sources: [{ name: "A", x: 200, y: 200 }],
    constraints: [
      { type: "angle", sources: ["A", "Missing"] },
      { type: "radialLimit", source: "A", minDistance: 200, maxDistance: 100 }
    ],
    target: { type: "faust-wasm" },
    parameterMappings: [
      {
        source: "Missing",
        feature: "distance",
        target: "/osc/freq",
        inputMin: 0,
        inputMax: 100,
        outputMin: 0,
        outputMax: 880,
        curve: "exp"
      }
    ]
  });

  assert.ok(findings.some((finding) => finding.message.includes("unknown object Missing")));
  assert.ok(findings.some((finding) => finding.message.includes("min must be less than or equal to max")));
  assert.ok(findings.some((finding) => finding.message.includes("adapter module")));
  assert.ok(findings.some((finding) => finding.message.includes("positive outputMin/outputMax")));
});

test("over-constrained graphs expose residual diagnostics", () => {
  const engine = createEngineHarness();
  engine.loadPatch({
    name: "Conflict smoke",
    version: 1,
    listener: { x: 0, y: 0 },
    sources: [{ name: "A", x: 100, y: 0 }],
    constraints: [
      { type: "pin", target: "A", x: 100, y: 0 },
      { type: "radialLimit", source: "A", minDistance: 200, maxDistance: 250 }
    ]
  });

  const report = engine.move("A", 120, 0);

  assert.equal(report.satisfied, false);
  assert.ok(report.residuals.length >= 1);
  assert.ok(report.residuals.some((residual) => residual.label === "Pin" || residual.label === "Limit"));
});
