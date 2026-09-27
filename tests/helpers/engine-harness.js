const { createModelHarness } = require("./model-harness");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "../..");

function createCanvasContext() {
  const noop = () => {};
  return {
    arc: noop,
    beginPath: noop,
    clearRect: noop,
    closePath: noop,
    fill: noop,
    fillRect: noop,
    fillText: noop,
    lineTo: noop,
    moveTo: noop,
    rect: noop,
    restore: noop,
    rotate: noop,
    save: noop,
    setTransform(a, b, c, d, e, f) {
      this.lastTransform = [a, b, c, d, e, f];
    },
    setLineDash: noop,
    stroke: noop,
    translate: noop
  };
}

function createElement(id = "") {
  const listeners = new Map();
  const classes = new Set();
  const element = {
    id,
    attributes: new Map(),
    children: [],
    classList: {
      add(name) {
        classes.add(name);
      },
      remove(name) {
        classes.delete(name);
      },
      toggle(name, force) {
        const shouldAdd = force ?? !classes.has(name);
        if (shouldAdd) {
          classes.add(name);
        } else {
          classes.delete(name);
        }
        return shouldAdd;
      }
    },
    dataset: {},
    disabled: false,
    files: [],
    hidden: false,
    options: [],
    style: {},
    textContent: "",
    value: "",
    addEventListener(type, listener) {
      if (!listeners.has(type)) {
        listeners.set(type, []);
      }
      listeners.get(type).push(listener);
    },
    append(...nextChildren) {
      for (const child of nextChildren) {
        this.children.push(child);
        if (child && typeof child === "object") {
          child.parentNode = this;
        }
        if (child && typeof child === "object" && "value" in child) {
          this.options.push(child);
        }
      }
    },
    click() {
      for (const listener of listeners.get("click") || []) {
        listener({ target: this, preventDefault() {} });
      }
    },
    dispatchEvent(event) {
      const nextEvent = {
        target: this,
        preventDefault() {},
        ...event
      };
      for (const listener of listeners.get(nextEvent.type) || []) {
        listener(nextEvent);
      }
      return true;
    },
    focus(options) {
      this.lastFocusOptions = options || null;
    },
    getBoundingClientRect() {
      return this.rect || { height: 600, left: 0, top: 0, width: 800, x: 0, y: 0 };
    },
    getContext() {
      return createCanvasContext();
    },
    releasePointerCapture() {},
    replaceChildren(...children) {
      this.children = children;
      for (const child of children) {
        if (child && typeof child === "object") {
          child.parentNode = this;
        }
      }
      this.options = children.filter((child) => child && typeof child === "object" && "value" in child);
    },
    querySelector(selector) {
      return this.querySelectorAll(selector)[0] || null;
    },
    querySelectorAll(selector) {
      const matches = [];
      const visit = (child) => {
        if (!child || typeof child !== "object") {
          return;
        }
        if (matchesSelector(child, selector)) {
          matches.push(child);
        }
        for (const grandchild of child.children || []) {
          visit(grandchild);
        }
      };
      for (const child of this.children) {
        visit(child);
      }
      return matches;
    },
    remove() {
      if (!this.parentNode) {
        return;
      }
      this.parentNode.children = this.parentNode.children.filter((child) => child !== this);
      this.parentNode.options = this.parentNode.options.filter((child) => child !== this);
      this.parentNode = null;
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
  Object.defineProperty(element, "className", {
    get() {
      return Array.from(classes).join(" ");
    },
    set(value) {
      classes.clear();
      for (const name of String(value).split(/\s+/).filter(Boolean)) {
        classes.add(name);
      }
    }
  });
  Object.defineProperty(element, "lastElementChild", {
    get() {
      return this.children.filter((child) => child && typeof child === "object").at(-1) || null;
    }
  });
  return element;
}

function matchesSelector(element, selector) {
  if (selector.startsWith(".")) {
    return element.className.split(/\s+/).includes(selector.slice(1));
  }
  const dataMatch = selector.match(/^\[data-([a-z0-9-]+)=['"]([^'"]+)['"]\]$/i);
  if (dataMatch) {
    const key = dataMatch[1].replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    return element.dataset?.[key] === dataMatch[2];
  }
  return false;
}

function textContentDeep(node) {
  if (!node || typeof node !== "object") {
    return "";
  }

  return `${node.textContent || ""}${(node.children || []).map(textContentDeep).join("")}`;
}

function createDocument() {
  const elements = new Map();
  return {
    createElement(tagName) {
      const element = createElement();
      element.tagName = tagName.toUpperCase();
      return element;
    },
    createTextNode(text) {
      return {
        textContent: String(text),
        nodeType: 3
      };
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
    MusicSpaceMapping: require("../../musicspace-mapping"),
    MusicSpaceModel: require("../../musicspace-model"),
    MusicSpaceClock: require("../../musicspace-clock"),
    Blob,
    URL,
    console,
    devicePixelRatio: 1,
    document,
    fetch: async () => {
      throw new Error("fetch is disabled in constraint-engine tests");
    },
    FileReader: class {},
    addEventListener() {},
    MusicSpaceTargets: {
      listTargetBackends() {
        return [
          {
            type: "subtractive",
            parameters: ["/osc/freq", "/filter/frequency", "/filter/q", "/output/gain"]
          },
          {
            type: "granular",
            parameters: [
              "/grain/rate",
              "/grain/size",
              "/grain/pitch",
              "/grain/spread",
              "/filter/frequency",
              "/filter/q",
              "/output/gain"
            ]
          },
          { type: "midi-file", parameters: [] },
          { type: "faust-wasm", parameters: [] }
        ];
      }
    },
    MusicSpaceMidiFileClient: {
      createMidiFileClient() {
        let midiFile = null;
        let enabled = false;
        return {
          loadPatch(patch = {}) {
            midiFile = patch.midiFile ? JSON.parse(JSON.stringify(patch.midiFile)) : null;
            enabled = false;
          },
          renameSource(oldName, newName) {
            if (!midiFile?.trackBindings) {
              return;
            }
            midiFile.trackBindings = midiFile.trackBindings.map((binding) =>
              binding.source === oldName ? { ...binding, source: newName } : binding
            );
          },
          serialize() {
            return midiFile ? { midiFile: JSON.parse(JSON.stringify(midiFile)) } : {};
          },
          hasMidiFile() {
            return Boolean(midiFile);
          },
          hasPlayableSequence() {
            return Boolean(midiFile?.trackBindings?.length);
          },
          hasTrackBindingForSource(sourceName) {
            return Boolean(midiFile?.trackBindings?.find((binding) => binding.source === sourceName));
          },
          bindingsForSource(sourceName) {
            return (midiFile?.trackBindings || [])
              .filter((binding) => binding.source === sourceName)
              .map((binding) => ({ ...binding }));
          },
          updateTrackBinding(sourceName, updates = {}) {
            if (!midiFile?.trackBindings) {
              return null;
            }
            let updatedBinding = null;
            midiFile.trackBindings = midiFile.trackBindings.map((binding) => {
              if (binding.source !== sourceName) {
                return binding;
              }
              updatedBinding = { ...binding, ...updates };
              return updatedBinding;
            });
            return updatedBinding ? { ...updatedBinding } : null;
          },
          removeTrackBinding(sourceName) {
            if (!midiFile?.trackBindings) {
              return false;
            }
            const previousLength = midiFile.trackBindings.length;
            midiFile.trackBindings = midiFile.trackBindings.filter(
              (binding) => binding.source !== sourceName
            );
            return midiFile.trackBindings.length !== previousLength;
          },
          isEnabled() {
            return enabled;
          },
          async setEnabled(nextEnabled) {
            enabled = Boolean(nextEnabled && midiFile?.trackBindings?.length);
            return enabled;
          },
          stop() {
            enabled = false;
            return false;
          },
          updateSpatial() {}
        };
      }
    },
    MusicSpaceParameterClient: {
      createParameterClient() {
        let mappings = [];
        return {
          hasMappings() {
            return mappings.length > 0;
          },
          mappings() {
            return mappings.map((mapping) => ({ ...mapping }));
          },
          setMappings(nextMappings = []) {
            mappings = nextMappings
              .filter((mapping) => mapping?.source && mapping?.feature && mapping?.target)
              .map((mapping) => ({ ...mapping }));
            return mappings.map((mapping) => ({ ...mapping }));
          },
          loadPatch(patch = {}) {
            mappings = Array.isArray(patch.parameterMappings)
              ? patch.parameterMappings.map((mapping) => ({ ...mapping }))
              : [];
          },
          mappedEntityNames() {
            return Array.from(new Set(mappings.map((mapping) => mapping.source)));
          },
          renameSource(oldName, newName) {
            mappings = mappings.map((mapping) =>
              mapping.source === oldName ? { ...mapping, source: newName } : mapping
            );
          },
          serialize() {
            return { parameterMappings: mappings.map((mapping) => ({ ...mapping })) };
          },
          targetSpec() {
            return {
              type: "subtractive",
              parameters: {
                "/osc/freq": { default: 220, min: 110, max: 880, unit: "Hz", digits: 0 },
                "/filter/frequency": { default: 1600, min: 250, max: 4200, unit: "Hz", digits: 0 },
                "/filter/q": { default: 2, min: 0.5, max: 18, digits: 2 },
                "/output/gain": { default: 0.12, min: 0, max: 0.3, digits: 2 }
              }
            };
          },
          targetDefaults() {
            return {
              "/osc/freq": 220,
              "/filter/frequency": 1600,
              "/filter/q": 2,
              "/output/gain": 0.12
            };
          },
          targetMetadata() {
            return {
              parameters: ["/osc/freq", "/filter/frequency", "/filter/q", "/output/gain"]
            };
          },
          targetParameterConfig(target) {
            if (target === "/osc/freq" || target === "/filter/frequency") {
              return { suffix: " Hz", digits: 0 };
            }
            return { suffix: "", digits: 2 };
          },
          isEnabled() {
            return false;
          },
          async setEnabled() {
            return false;
          },
          update() {}
        };
      }
    },
    MusicSpaceSourceAudioClient: {
      createSourceAudioClient() {
        let bindings = [];
        let enabled = false;
        return {
          bindingsForSource(sourceName) {
            return bindings
              .filter((binding) => binding.source === sourceName)
              .map((binding) => ({ ...binding }));
          },
          hasBindings() {
            return bindings.length > 0;
          },
          isSourceMuted(sourceName) {
            return Boolean(bindings.find((binding) => binding.source === sourceName)?.muted);
          },
          isEnabled() {
            return enabled;
          },
          loadPatch(patch = {}) {
            bindings = Array.isArray(patch.sourceBindings)
              ? patch.sourceBindings.map((binding) => ({ ...binding, muted: Boolean(binding.muted) }))
              : [];
          },
          removeBinding(sourceName) {
            bindings = bindings.filter((binding) => binding.source !== sourceName);
          },
          renameSource(oldName, newName) {
            bindings = bindings.map((binding) =>
              binding.source === oldName ? { ...binding, source: newName } : binding
            );
          },
          removeBindingsForMissingSources(sourceNames) {
            const validNames = new Set(sourceNames);
            bindings = bindings.filter((binding) => validNames.has(binding.source));
          },
          serialize() {
            return { sourceBindings: bindings.map((binding) => ({ ...binding })) };
          },
          toggleSourceMuted(sourceName) {
            const binding = bindings.find((candidate) => candidate.source === sourceName);
            if (!binding) {
              return null;
            }
            binding.muted = !binding.muted;
            return { ...binding };
          },
          async setEnabled(nextEnabled) {
            enabled = Boolean(nextEnabled && bindings.length > 0);
            return enabled;
          },
          updateSpatial() {},
          upsertBinding(binding) {
            bindings = bindings.filter((candidate) => candidate.source !== binding.source);
            const normalized = { ...binding, muted: Boolean(binding.muted) };
            bindings.push(normalized);
            return { ...normalized };
          }
        };
      }
    },
    MusicSpaceGeneratorClient: {
      createGeneratorClient() {
        let generators = [];
        let generatorMappings = [];
        let enabled = false;
        return {
          loadPatch(patch = {}) {
            generators = Array.isArray(patch.sourceGenerators)
              ? patch.sourceGenerators.map((generator) => ({ ...generator }))
              : [];
            generatorMappings = Array.isArray(patch.sourceGeneratorMappings)
              ? patch.sourceGeneratorMappings.map((mapping) => ({ ...mapping }))
              : [];
            enabled = false;
          },
          serialize() {
            return {
              ...(generators.length > 0
                ? { sourceGenerators: generators.map((generator) => ({ ...generator })) }
                : {}),
              ...(generatorMappings.length > 0
                ? { sourceGeneratorMappings: generatorMappings.map((mapping) => ({ ...mapping })) }
                : {})
            };
          },
          generatorsForSource(sourceName) {
            return generators
              .filter((generator) => generator.source === sourceName)
              .map((generator) => ({ ...generator }));
          },
          mappingsForSource(sourceName) {
            return generatorMappings
              .filter((mapping) => mapping.source === sourceName)
              .map((mapping) => ({ ...mapping }));
          },
          effectiveGeneratorsForSource(sourceName) {
            return generators
              .filter((generator) => generator.source === sourceName)
              .map((generator) => ({ ...generator }));
          },
          hasGenerators() {
            return generators.length > 0;
          },
          hasGeneratorForSource(sourceName) {
            return generators.some((generator) => generator.source === sourceName);
          },
          isSourceMuted(sourceName) {
            const generator = generators.find((candidate) => candidate.source === sourceName);
            return generator ? Boolean(generator.muted) : false;
          },
          isEnabled() {
            return enabled;
          },
          upsertGenerator(generator) {
            generators = generators.filter((candidate) => candidate.source !== generator.source);
            const normalized = { ...generator, muted: Boolean(generator.muted) };
            generators.push(normalized);
            return { ...normalized };
          },
          setMappingsForSource(sourceName, mappings) {
            generatorMappings = [
              ...generatorMappings.filter((mapping) => mapping.source !== sourceName),
              ...mappings.map((mapping) => ({ ...mapping, source: sourceName }))
            ];
            return generatorMappings
              .filter((mapping) => mapping.source === sourceName)
              .map((mapping) => ({ ...mapping }));
          },
          toggleSourceMuted(sourceName) {
            const generator = generators.find((candidate) => candidate.source === sourceName);
            if (!generator) {
              return null;
            }
            generator.muted = !generator.muted;
            return { ...generator };
          },
          renameSource(oldName, newName) {
            generators = generators.map((generator) =>
              generator.source === oldName ? { ...generator, source: newName } : generator
            );
            generatorMappings = generatorMappings.map((mapping) =>
              mapping.source === oldName ? { ...mapping, source: newName } : mapping
            );
          },
          removeGenerator(sourceName) {
            generators = generators.filter((generator) => generator.source !== sourceName);
            generatorMappings = generatorMappings.filter((mapping) => mapping.source !== sourceName);
          },
          removeGeneratorsForMissingSources(sourceNames) {
            const validNames = new Set(sourceNames);
            generators = generators.filter((generator) => validNames.has(generator.source));
            generatorMappings = generatorMappings.filter((mapping) => validNames.has(mapping.source));
          },
          async setEnabled(nextEnabled) {
            enabled = Boolean(nextEnabled && generators.length > 0);
            return enabled;
          },
          async availableMidiOutputs() {
            return [
              { id: "midi-out-a", name: "MIDI Out A" },
              { id: "midi-out-b", name: "MIDI Out B" }
            ];
          },
          updateSpatial() {}
        };
      }
    },
    window: {
      location: { href: "http://127.0.0.1/musicspace.html" },
      history: {
        replaceState(_state, _title, href) {
          sandbox.window.location.href = href;
        }
      }
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
  pushUndoSnapshot,
  undoLastEdit,
  applyConstraintEditor,
  applySourceEditor,
  enforceConstraints: scene.enforceConstraints,
  enforceConstraintsWithXpbd: scene.enforceConstraintsWithXpbd,
  focusCanvasWithoutScrolling,
  getLastPropagationReport: scene.getLastPropagationReport,
  getObjectByName,
  getSolverMode: scene.getSolverMode,
  getUiMode: () => uiMode,
  handleEntityDoubleClick,
  handleToolButtonClick,
  handleToolClick,
  loadPatch,
  measureConstraintResiduals,
  moveEntity,
  refineXpbdAfterDrag,
  resumePropagationAfterPausedDrag,
  setSolverMode,
  setUiMode,
  setActiveTool,
  serializePatch,
  sourceEmitterCapability,
  stopAllDrawing,
  validatePatch,
  openConstraintEditorByIndex(index) {
    const constraint = state.constraints[index];
    if (!constraint) {
      return false;
    }
    openConstraintEditor(constraint);
    return true;
  }
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
    moveWithXpbdIterations(name, x, y, iterations) {
      const entity = api.getObjectByName(name);
      assert.ok(entity, `Expected entity ${name} to exist`);
      entity.x = x;
      entity.y = y;
      return api.enforceConstraintsWithXpbd(entity, { iterations });
    },
    refineXpbdAfterDrag(name) {
      const entity = api.getObjectByName(name);
      assert.ok(entity, `Expected entity ${name} to exist`);
      api.refineXpbdAfterDrag(entity);
      return api.getLastPropagationReport();
    },
    point(name) {
      const entity = api.getObjectByName(name);
      assert.ok(entity, `Expected entity ${name} to exist`);
      return { x: entity.x, y: entity.y };
    },
    points(names) {
      return Object.fromEntries(names.map((name) => [name, this.point(name)]));
    },
    report() {
      return api.getLastPropagationReport();
    },
    resumePropagationAfterPausedDrag() {
      api.resumePropagationAfterPausedDrag();
    },
    residuals() {
      return api.measureConstraintResiduals().map(({ measurement }) => measurement);
    },
    setSolverMode(mode) {
      api.setSolverMode(mode);
    },
    clickSolverMode(mode) {
      const id = mode === "xpbd" ? "solver-mode-xpbd" : "solver-mode-propagation";
      document.getElementById(id).click();
    },
    currentHref() {
      return sandbox.window.location.href;
    },
    focusCanvasWithoutScrolling() {
      api.focusCanvasWithoutScrolling();
      return document.getElementById("canvas").lastFocusOptions;
    },
    setCanvasDisplaySize(width, height, pixelRatio = 1) {
      sandbox.devicePixelRatio = pixelRatio;
      const rect = { height, left: 0, top: 0, width, x: 0, y: 0 };
      document.getElementById("canvas").rect = rect;
      document.getElementById("trace").rect = rect;
    },
    canvasBackingSize() {
      const canvas = document.getElementById("canvas");
      const trace = document.getElementById("trace");
      return {
        width: canvas.width,
        height: canvas.height,
        traceWidth: trace.width,
        traceHeight: trace.height
      };
    },
    clickFullscreenToggle() {
      document.getElementById("fullscreen-toggle").click();
    },
    fullscreenState() {
      const button = document.getElementById("fullscreen-toggle");
      const stage = document.getElementById("stage");
      return {
        pressed: button.attributes.get("aria-pressed"),
        text: button.textContent,
        stageClassName: stage.className
      };
    },
    solverButtonPressed(mode) {
      const id = mode === "xpbd" ? "solver-mode-xpbd" : "solver-mode-propagation";
      return document.getElementById(id).attributes.get("aria-pressed");
    },
    solverMode() {
      return api.getSolverMode();
    },
    uiMode() {
      return api.getUiMode();
    },
    setUiMode(mode) {
      api.setUiMode(mode);
    },
    soundButtonPressed() {
      return document.getElementById("target-toggle").attributes.get("aria-pressed") || "false";
    },
    moversButtonPressed() {
      return document.getElementById("animation-toggle").attributes.get("aria-pressed") || "false";
    },
    toolbarVisibility() {
      return {
        transportHidden: document.getElementById("transport-toolbar-group").hidden,
        moversHidden: document.getElementById("animation-toggle").hidden,
        moversDisabled: document.getElementById("animation-toggle").disabled,
        soundHidden: document.getElementById("target-toggle").hidden,
        soundDisabled: document.getElementById("target-toggle").disabled,
        midiHidden: document.getElementById("midi-toolbar-group").hidden
      };
    },
    patchInfoText() {
      return textContentDeep(document.getElementById("patch-info"));
    },
    selectionSummaryText() {
      return textContentDeep(document.getElementById("selection-summary"));
    },
    midiToolbarHidden() {
      return document.getElementById("midi-toolbar-group").hidden;
    },
    undoStatus() {
      const status = document.getElementById("undo-status");
      return {
        hidden: status.hidden,
        text: status.textContent,
        title: status.title
      };
    },
    patchInspectorState() {
      return {
        hidden: document.getElementById("patch-inspector").hidden,
        jsonHidden: document.getElementById("patch-json-editor").hidden,
        toolbarPressed: document.getElementById("patch-inspector-toggle").attributes.get("aria-pressed"),
        inlinePressed: document
          .getElementById("patch-inspector-inline-toggle")
          .attributes.get("aria-pressed"),
        jsonToolbarPressed: document.getElementById("patch-json-toggle").attributes.get("aria-pressed"),
        jsonInlinePressed: document.getElementById("patch-json-inline-toggle").attributes.get("aria-pressed"),
        mappingCount: document.getElementById("patch-mapping-list").querySelectorAll(".mapping-row").length,
        mappingReadouts: Array.from(
          document.getElementById("patch-mapping-list").querySelectorAll(".mapping-readout")
        ).map((output) => output.textContent),
        jsonText: document.getElementById("patch-json").value
      };
    },
    addPatchMapping(values = {}) {
      document.getElementById("patch-mapping-add").click();
      const list = document.getElementById("patch-mapping-list");
      const row = list.lastElementChild;
      if (values.source !== undefined) {
        row.querySelector("[data-mapping-field='source']").value = values.source;
      }
      if (values.feature !== undefined) {
        row.querySelector("[data-mapping-field='feature']").value = values.feature;
      }
      if (values.target !== undefined) {
        row.querySelector("[data-mapping-field='target']").value = values.target;
      }
      if (values.inputMin !== undefined) {
        row.querySelector("[data-mapping-field='input-min']").value = String(values.inputMin);
      }
      if (values.inputMax !== undefined) {
        row.querySelector("[data-mapping-field='input-max']").value = String(values.inputMax);
      }
      if (values.outputMin !== undefined) {
        row.querySelector("[data-mapping-field='output-min']").value = String(values.outputMin);
      }
      if (values.outputMax !== undefined) {
        row.querySelector("[data-mapping-field='output-max']").value = String(values.outputMax);
      }
      if (values.curve !== undefined) {
        row.querySelector("[data-mapping-field='curve']").value = values.curve;
      }
      if (values.quantize !== undefined) {
        row.querySelector("[data-mapping-field='quantize']").value = String(values.quantize);
      }
      if (values.values !== undefined) {
        row.querySelector("[data-mapping-field='values']").value = values.values.join(",");
      }
      return textContentDeep(row);
    },
    applyPatchMappings() {
      document.getElementById("patch-mapping-apply").click();
      return api.serializePatch();
    },
    clickInlinePatchInspector() {
      document.getElementById("patch-inspector-inline-toggle").click();
    },
    clickInlinePatchJson() {
      document.getElementById("patch-json-inline-toggle").click();
    },
    closePatchInspectorForTest() {
      document.getElementById("patch-inspector").hidden = true;
      document.getElementById("patch-json-editor").hidden = true;
      document.getElementById("patch-inspector-toggle").setAttribute("aria-pressed", "false");
      document.getElementById("patch-inspector-inline-toggle").setAttribute("aria-pressed", "false");
      document.getElementById("patch-json-toggle").setAttribute("aria-pressed", "false");
      document.getElementById("patch-json-inline-toggle").setAttribute("aria-pressed", "false");
    },
    openSourceInspector(name) {
      const entity = api.getObjectByName(name);
      assert.ok(entity, `Expected entity ${name} to exist`);
      return api.handleEntityDoubleClick(entity);
    },
    openListenerInspector() {
      const entity = api.getObjectByName("Listener");
      assert.ok(entity, "Expected listener to exist");
      return api.handleEntityDoubleClick(entity);
    },
    listenerInspectorState() {
      return {
        hidden: document.getElementById("listener-editor").hidden,
        x: document.getElementById("listener-x").value,
        y: document.getElementById("listener-y").value,
        drawTrace: Boolean(document.getElementById("listener-draw-trace").checked),
        retargetPressed: document.getElementById("listener-mode-retarget").attributes.get("aria-pressed"),
        preservePressed: document.getElementById("listener-mode-preserve").attributes.get("aria-pressed")
      };
    },
    applyOpenListener(values) {
      if (values.x !== undefined) {
        document.getElementById("listener-x").value = String(values.x);
      }
      if (values.y !== undefined) {
        document.getElementById("listener-y").value = String(values.y);
      }
      if (values.drawTrace !== undefined) {
        document.getElementById("listener-draw-trace").checked = Boolean(values.drawTrace);
      }
      document.getElementById("listener-apply").click();
      return api.serializePatch();
    },
    clickListenerMode(mode) {
      const id = mode === "preserve" ? "listener-mode-preserve" : "listener-mode-retarget";
      document.getElementById(id).click();
    },
    sourceInspectorState() {
      return {
        hidden: document.getElementById("source-editor").hidden,
        name: document.getElementById("source-name").value,
        outputType: document.getElementById("source-output-type").value,
        outputTypeDisabled: Boolean(document.getElementById("source-output-type").disabled),
        loop: Boolean(document.getElementById("source-loop").checked),
        loopDisabled: Boolean(document.getElementById("source-loop").disabled),
        muted: Boolean(document.getElementById("source-muted").checked),
        mutedHidden: Boolean(document.getElementById("source-muted-row").hidden),
        mutedDisabled: Boolean(document.getElementById("source-muted").disabled),
        generatorPitch: document.getElementById("source-generator-pitch").value,
        generatorPitchDisabled: Boolean(document.getElementById("source-generator-pitch").disabled),
        generatorPeriod: document.getElementById("source-generator-period").value,
        generatorDuration: document.getElementById("source-generator-duration").value,
        generatorVelocity: document.getElementById("source-generator-velocity").value,
        generatorWaveform: document.getElementById("source-generator-waveform").value,
        generatorOutputMode: document.getElementById("source-generator-output-mode").value,
        generatorOutputId: document.getElementById("source-generator-output").value,
        generatorChannel: document.getElementById("source-generator-channel").value,
        generatorChannelDisabled: Boolean(document.getElementById("source-generator-channel").disabled),
        midiTrack: document.getElementById("source-midi-track").value,
        midiChannel: document.getElementById("source-midi-channel").value,
        midiChannelDisabled: Boolean(document.getElementById("source-midi-channel").disabled),
        midiProgram: document.getElementById("source-midi-program").value,
        midiDrums: Boolean(document.getElementById("source-midi-drums").checked),
        removeHidden: Boolean(document.getElementById("source-remove-binding").hidden),
        removeDisabled: Boolean(document.getElementById("source-remove-binding").disabled),
        generatorMappingCount: document
          .getElementById("source-generator-mapping-list")
          .querySelectorAll(".mapping-row").length,
        generatorMappingReadouts: Array.from(
          document.getElementById("source-generator-mapping-list").querySelectorAll(".mapping-readout")
        ).map((output) => output.textContent),
        fileLabel: document.getElementById("source-audio-file-name").textContent
      };
    },
    openConstraintInspector(index = 0) {
      return api.openConstraintEditorByIndex(index);
    },
    constraintInspectorState() {
      return {
        hidden: document.getElementById("constraint-editor").hidden,
        summary: document.getElementById("constraint-editor-summary").textContent,
        manualNode: Boolean(document.getElementById("constraint-node-manual").checked),
        nodeX: document.getElementById("constraint-node-x").value,
        nodeY: document.getElementById("constraint-node-y").value,
        labelA: document.getElementById("constraint-value-a-label").textContent,
        valueA: document.getElementById("constraint-value-a").value,
        hiddenA: document.getElementById("constraint-value-a-row").hidden,
        labelB: document.getElementById("constraint-value-b-label").textContent,
        valueB: document.getElementById("constraint-value-b").value,
        hiddenB: document.getElementById("constraint-value-b-row").hidden,
        labelC: document.getElementById("constraint-value-c-label").textContent,
        valueC: document.getElementById("constraint-value-c").value,
        hiddenC: document.getElementById("constraint-value-c-row").hidden
      };
    },
    applyOpenConstraint(values) {
      if (values.manualNode !== undefined) {
        document.getElementById("constraint-node-manual").checked = Boolean(values.manualNode);
      }
      if (values.nodeX !== undefined) {
        document.getElementById("constraint-node-x").value = String(values.nodeX);
      }
      if (values.nodeY !== undefined) {
        document.getElementById("constraint-node-y").value = String(values.nodeY);
      }
      if (values.valueA !== undefined) {
        document.getElementById("constraint-value-a").value = String(values.valueA);
      }
      if (values.valueB !== undefined) {
        document.getElementById("constraint-value-b").value = String(values.valueB);
      }
      if (values.valueC !== undefined)
        document.getElementById("constraint-value-c").value = String(values.valueC);
      api.applyConstraintEditor();
      return api.serializePatch();
    },
    clickInspectorNext() {
      const buttons = [
        "listener-next",
        "source-next",
        "rotation-next",
        "shuttle-next",
        "constraint-next"
      ].map((id) => document.getElementById(id));
      const button = buttons.find((candidate) => !candidate.disabled);
      assert.ok(button, "Expected an enabled next inspector button");
      button.click();
    },
    clickInspectorPrevious() {
      const buttons = [
        "listener-prev",
        "source-prev",
        "rotation-prev",
        "shuttle-prev",
        "constraint-prev"
      ].map((id) => document.getElementById(id));
      const button = buttons.find((candidate) => !candidate.disabled);
      assert.ok(button, "Expected an enabled previous inspector button");
      button.click();
    },
    sourceEmitterCapability(name) {
      return api.sourceEmitterCapability(name);
    },
    pressCanvasKey(key, options = {}) {
      document.getElementById("canvas").dispatchEvent({ type: "keydown", key, ...options });
    },
    async pressCanvasKeyAndSettle(key) {
      this.pressCanvasKey(key);
      await Promise.resolve();
      await Promise.resolve();
      await new Promise((resolve) => setImmediate(resolve));
    },
    renameOpenSource(name) {
      document.getElementById("source-name").value = name;
      api.applySourceEditor();
      return api.serializePatch();
    },
    setOpenSourceLoop(loop) {
      document.getElementById("source-loop").checked = Boolean(loop);
      api.applySourceEditor();
      return api.serializePatch();
    },
    setOpenSourceOutputType(type) {
      document.getElementById("source-output-type").value = type;
      api.applySourceEditor();
      return api.serializePatch();
    },
    setOpenSourceGenerator(values) {
      document.getElementById("source-output-type").value = "midi-ostinato";
      document.getElementById("source-generator-pitch").value = String(values.pitch ?? 60);
      document.getElementById("source-generator-period").value = String(values.periodMs ?? 1000);
      document.getElementById("source-generator-duration").value = String(values.durationMs ?? 160);
      document.getElementById("source-generator-velocity").value = String(values.velocity ?? 80);
      document.getElementById("source-generator-waveform").value = values.waveform || "triangle";
      document.getElementById("source-generator-output-mode").value = values.outputMode || "internal";
      document.getElementById("source-generator-output").value = values.outputId || "";
      document.getElementById("source-generator-channel").value = String(values.channel ?? 1);
      document.getElementById("source-spatialization").value = values.spatialization || "pan-distance";
      document.getElementById("source-muted").checked = Boolean(values.muted);
      api.applySourceEditor();
      return api.serializePatch();
    },
    setOpenSourceAdditiveGenerator(values) {
      document.getElementById("source-output-type").value = "additive-synth";
      document.getElementById("source-generator-pitch").value = String(values.pitch ?? 60);
      document.getElementById("source-generator-velocity").value = String(values.velocity ?? 80);
      document.getElementById("source-spatialization").value = values.spatialization || "pan-distance";
      document.getElementById("source-muted").checked = Boolean(values.muted);
      api.applySourceEditor();
      return api.serializePatch();
    },
    setOpenSourceGeneratorMappings(mappings) {
      const list = document.getElementById("source-generator-mapping-list");
      list.replaceChildren();
      for (const mapping of mappings) {
        document.getElementById("source-generator-mapping-add").click();
        const row = list.lastElementChild;
        row.querySelector("[data-mapping-field='feature']").value = mapping.feature;
        row.querySelector("[data-mapping-field='parameter']").value = mapping.parameter;
        row.querySelector("[data-mapping-field='input-min']").value = String(mapping.inputMin);
        row.querySelector("[data-mapping-field='input-max']").value = String(mapping.inputMax);
        row.querySelector("[data-mapping-field='output-min']").value = String(mapping.outputMin);
        row.querySelector("[data-mapping-field='output-max']").value = String(mapping.outputMax);
        row.querySelector("[data-mapping-field='curve']").value = mapping.curve || "linear";
        row.querySelector("[data-mapping-field='quantize']").value = mapping.quantize
          ? String(mapping.quantize)
          : "";
        row.querySelector("[data-mapping-field='values']").value = Array.isArray(mapping.values)
          ? mapping.values.join(",")
          : "";
      }
      api.applySourceEditor();
      return api.serializePatch();
    },
    setOpenSourceMidiTrack(values) {
      if (values.channel !== undefined) {
        document.getElementById("source-midi-channel").value = String(values.channel);
      }
      if (values.program !== undefined) {
        document.getElementById("source-midi-program").value = String(values.program);
      }
      if (values.isDrums !== undefined) {
        document.getElementById("source-midi-drums").checked = Boolean(values.isDrums);
      }
      api.applySourceEditor();
      return api.serializePatch();
    },
    createConstraintWithTool(tool, names) {
      api.handleToolButtonClick(tool);
      let handled = false;
      for (const name of names) {
        const entity = api.getObjectByName(name);
        assert.ok(entity, `Expected entity ${name} to exist`);
        handled = api.handleToolClick(entity.x, entity.y, entity);
      }
      if (tool === "sum" || tool === "product") {
        api.handleToolButtonClick(tool);
      }
      return {
        handled,
        patch: api.serializePatch()
      };
    },
    stopAllDrawing() {
      api.stopAllDrawing();
      return api.serializePatch();
    },
    tickMover(name) {
      const mover = api.getObjectByName(name);
      assert.ok(mover, `Expected mover ${name} to exist`);
      const moved = mover.tick();
      if (moved) {
        api.enforceConstraints(mover, { preserveTrajectoryFrame: true });
      }
      return api.getLastPropagationReport();
    },
    tickMovers(names, count = 1) {
      let report = null;
      for (let step = 0; step < count; step += 1) {
        for (const name of names) {
          report = this.tickMover(name);
        }
      }
      return report;
    }
  };
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function loadFixturePatch(fileName) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, "patches", fileName), "utf8"));
}

function assertFinitePoint(point, label) {
  assert.ok(Number.isFinite(point.x), `${label}.x should be finite`);
  assert.ok(Number.isFinite(point.y), `${label}.y should be finite`);
}

function assertFiniteReport(report) {
  assert.ok(report, "expected a propagation report");
  assert.ok(report.residuals.every((residual) => Number.isFinite(residual.error)));
}

function runBrowserScript(fileName, sandbox) {
  sandbox = { MusicSpaceMapping: require("../../musicspace-mapping"), ...sandbox };
  const context = {
    console,
    window: null,
    ...sandbox
  };
  context.window = context.window || context;
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(ROOT, fileName), "utf8"), context, { filename: fileName });
  return context;
}

function runScenarioInMode(mode, patch, scenario) {
  const engine = createModelHarness();
  engine.setSolverMode(mode);
  engine.loadPatch(patch);
  const report = scenario(engine);
  return { engine, report };
}

function compareSolvers(patch, scenario, watchedNames) {
  const results = {};

  for (const mode of ["propagation", "xpbd"]) {
    const engine = createModelHarness();
    engine.setSolverMode(mode);
    engine.loadPatch(patch);
    const before = engine.points(watchedNames);
    const start = process.hrtime.bigint();
    const report = scenario(engine);
    const elapsedMs = Number(process.hrtime.bigint() - start) / 1e6;
    const after = engine.points(watchedNames);
    const displacements = watchedNames.map((name) => distance(before[name], after[name]));
    const residualErrors = report.residuals.map((residual) => residual.error);

    results[mode] = {
      elapsedMs,
      hitEntityCap: report.hitEntityCap,
      hitStepCap: report.hitStepCap,
      movedCount: report.movedEntities.length,
      residualCount: report.residuals.length,
      satisfied: report.satisfied,
      totalDisplacement: displacements.reduce((sum, value) => sum + value, 0),
      worstResidual: residualErrors.length > 0 ? Math.max(...residualErrors) : 0
    };
  }

  return results;
}

function compareSolverMoveSeries(patch, moves, watchedNames) {
  const results = {};

  for (const mode of ["propagation", "xpbd"]) {
    const engine = createModelHarness();
    engine.setSolverMode(mode);
    engine.loadPatch(patch);
    const before = engine.points(watchedNames);
    let previous = before;
    const cumulativePathBySource = Object.fromEntries(watchedNames.map((name) => [name, 0]));
    const stepTimes = [];
    const reports = [];

    for (const move of moves) {
      const start = process.hrtime.bigint();
      const report = engine.move(move.name, move.x, move.y);
      stepTimes.push(Number(process.hrtime.bigint() - start) / 1e6);
      reports.push(report);
      const current = engine.points(watchedNames);
      for (const name of watchedNames) {
        cumulativePathBySource[name] += distance(previous[name], current[name]);
      }
      previous = current;
    }

    const after = engine.points(watchedNames);
    const displacementBySource = Object.fromEntries(
      watchedNames.map((name) => [name, distance(before[name], after[name])])
    );
    const residualErrors = reports.flatMap((report) => report.residuals.map((residual) => residual.error));

    results[mode] = {
      after,
      cumulativePathBySource,
      displacementBySource,
      elapsedMs: stepTimes.reduce((sum, value) => sum + value, 0),
      maxStepMs: Math.max(...stepTimes),
      meanStepMs: stepTimes.reduce((sum, value) => sum + value, 0) / stepTimes.length,
      moveCount: moves.length,
      residualCount: reports.at(-1)?.residuals.length || 0,
      hitEntityCapCount: reports.filter((report) => report.hitEntityCap).length,
      hitStepCapCount: reports.filter((report) => report.hitStepCap).length,
      worstResidual: residualErrors.length > 0 ? Math.max(...residualErrors) : 0
    };
  }

  results.finalDistanceBetweenModes = Object.fromEntries(
    watchedNames.map((name) => [name, distance(results.propagation.after[name], results.xpbd.after[name])])
  );

  return results;
}

function residualErrorValue(residual) {
  return residual?.measurement?.error ?? residual?.error;
}

function worstResidual(report) {
  const errors = report.residuals.map(residualErrorValue).filter(Number.isFinite);
  return errors.length > 0 ? Math.max(...errors) : 0;
}

function sweepXpbdIterations(patch, move, watchedNames, iterationCounts) {
  return iterationCounts.map((iterations) => {
    const engine = createModelHarness();
    engine.setSolverMode("xpbd");
    engine.loadPatch(patch);
    const before = engine.points(watchedNames);
    const start = process.hrtime.bigint();
    const report = engine.moveWithXpbdIterations(move.name, move.x, move.y, iterations);
    const elapsedMs = Number(process.hrtime.bigint() - start) / 1e6;
    const after = engine.points(watchedNames);
    const displacementBySource = Object.fromEntries(
      watchedNames.map((name) => [name, distance(before[name], after[name])])
    );
    const residualErrors = report.residuals.map(residualErrorValue);
    const finiteResidualErrors = residualErrors.filter(Number.isFinite);

    return {
      iterations,
      elapsedMs,
      maxDisplacement: Math.max(...Object.values(displacementBySource)),
      nonFiniteResidualCount: residualErrors.length - finiteResidualErrors.length,
      residualCount: report.residuals.length,
      worstResidual: finiteResidualErrors.length > 0 ? Math.max(...finiteResidualErrors) : 0,
      displacementBySource
    };
  });
}

module.exports = {
  createCanvasContext,
  createElement,
  matchesSelector,
  textContentDeep,
  createDocument,
  createEngineHarness,
  distance,
  loadFixturePatch,
  assertFinitePoint,
  assertFiniteReport,
  runBrowserScript,
  runScenarioInMode,
  compareSolvers,
  compareSolverMoveSeries,
  residualErrorValue,
  worstResidual,
  sweepXpbdIterations
};
