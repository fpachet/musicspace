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
          { type: "subtractive", parameters: ["/osc/freq", "/filter/frequency", "/filter/q", "/output/gain"] },
          { type: "granular", parameters: ["/grain/rate", "/grain/size", "/grain/pitch", "/grain/spread", "/filter/frequency", "/filter/q", "/output/gain"] },
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
            midiFile.trackBindings = midiFile.trackBindings.map((binding) => (
              binding.source === oldName ? { ...binding, source: newName } : binding
            ));
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
          loadPatch(patch = {}) {
            mappings = Array.isArray(patch.parameterMappings)
              ? patch.parameterMappings.map((mapping) => ({ ...mapping }))
              : [];
          },
          mappedEntityNames() {
            return Array.from(new Set(mappings.map((mapping) => mapping.source)));
          },
          renameSource(oldName, newName) {
            mappings = mappings.map((mapping) => (
              mapping.source === oldName ? { ...mapping, source: newName } : mapping
            ));
          },
          serialize() {
            return { parameterMappings: mappings.map((mapping) => ({ ...mapping })) };
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
            return bindings.filter((binding) => binding.source === sourceName).map((binding) => ({ ...binding }));
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
            bindings = bindings.map((binding) => (
              binding.source === oldName ? { ...binding, source: newName } : binding
            ));
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
              ...(generators.length > 0 ? { sourceGenerators: generators.map((generator) => ({ ...generator })) } : {}),
              ...(generatorMappings.length > 0 ? { sourceGeneratorMappings: generatorMappings.map((mapping) => ({ ...mapping })) } : {})
            };
          },
          generatorsForSource(sourceName) {
            return generators.filter((generator) => generator.source === sourceName).map((generator) => ({ ...generator }));
          },
          mappingsForSource(sourceName) {
            return generatorMappings.filter((mapping) => mapping.source === sourceName).map((mapping) => ({ ...mapping }));
          },
          effectiveGeneratorsForSource(sourceName) {
            return generators.filter((generator) => generator.source === sourceName).map((generator) => ({ ...generator }));
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
            return generatorMappings.filter((mapping) => mapping.source === sourceName).map((mapping) => ({ ...mapping }));
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
            generators = generators.map((generator) => (
              generator.source === oldName ? { ...generator, source: newName } : generator
            ));
            generatorMappings = generatorMappings.map((mapping) => (
              mapping.source === oldName ? { ...mapping, source: newName } : mapping
            ));
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
  applyConstraintEditor,
  applySourceEditor,
  enforceConstraints,
  enforceConstraintsWithXpbd,
  focusCanvasWithoutScrolling,
  getLastPropagationReport,
  getObjectByName,
  getSolverMode,
  getUiMode,
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
    const constraint = constraints[index];
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
        inlinePressed: document.getElementById("patch-inspector-inline-toggle").attributes.get("aria-pressed"),
        jsonToolbarPressed: document.getElementById("patch-json-toggle").attributes.get("aria-pressed"),
        jsonInlinePressed: document.getElementById("patch-json-inline-toggle").attributes.get("aria-pressed"),
        jsonText: document.getElementById("patch-json").value
      };
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
        loop: Boolean(document.getElementById("source-loop").checked),
        muted: Boolean(document.getElementById("source-muted").checked),
        generatorPitch: document.getElementById("source-generator-pitch").value,
        generatorPeriod: document.getElementById("source-generator-period").value,
        generatorDuration: document.getElementById("source-generator-duration").value,
        generatorVelocity: document.getElementById("source-generator-velocity").value,
        generatorWaveform: document.getElementById("source-generator-waveform").value,
        generatorOutputMode: document.getElementById("source-generator-output-mode").value,
        generatorOutputId: document.getElementById("source-generator-output").value,
        generatorChannel: document.getElementById("source-generator-channel").value,
        generatorMappingCount: document.getElementById("source-generator-mapping-list").querySelectorAll(".mapping-row").length,
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
        hiddenB: document.getElementById("constraint-value-b-row").hidden
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
  const engine = createEngineHarness();
  engine.setSolverMode(mode);
  engine.loadPatch(patch);
  const report = scenario(engine);
  return { engine, report };
}

function compareSolvers(patch, scenario, watchedNames) {
  const results = {};

  for (const mode of ["propagation", "xpbd"]) {
    const engine = createEngineHarness();
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
    const engine = createEngineHarness();
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
    const displacementBySource = Object.fromEntries(watchedNames.map((name) => [
      name,
      distance(before[name], after[name])
    ]));
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

  results.finalDistanceBetweenModes = Object.fromEntries(watchedNames.map((name) => [
    name,
    distance(results.propagation.after[name], results.xpbd.after[name])
  ]));

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
    const engine = createEngineHarness();
    engine.setSolverMode("xpbd");
    engine.loadPatch(patch);
    const before = engine.points(watchedNames);
    const start = process.hrtime.bigint();
    const report = engine.moveWithXpbdIterations(move.name, move.x, move.y, iterations);
    const elapsedMs = Number(process.hrtime.bigint() - start) / 1e6;
    const after = engine.points(watchedNames);
    const displacementBySource = Object.fromEntries(watchedNames.map((name) => [
      name,
      distance(before[name], after[name])
    ]));
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

test("built-in patches do not enable trace drawing by default", () => {
  const index = JSON.parse(fs.readFileSync(path.join(ROOT, "patches", "index.json"), "utf8"));

  for (const entry of index.patches) {
    const patch = loadFixturePatch(entry.file);
    const traceDefaults = [
      patch.listener,
      ...(patch.sources || []),
      ...(patch.movingObjects || []),
      ...(patch.constraints || []).map((constraint) => constraint.node)
    ].filter(Boolean);
    const enabled = traceDefaults.filter((entity) => entity.drawTrace === true);

    assert.equal(enabled.length, 0, `${entry.file} should not set drawTrace: true`);
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

test("source audio bindings serialize with the patch", () => {
  const engine = createEngineHarness();
  engine.loadPatch({
    name: "Source Audio",
    version: 1,
    listener: { x: 400, y: 300 },
    sources: [{ name: "A", x: 250, y: 300 }],
    sourceBindings: [
      {
        source: "A",
        type: "audio-file",
        name: "voice.wav",
        mimeType: "audio/wav",
        dataUrl: "data:audio/wav;base64,AAAA",
        loop: true,
        gain: 0.75,
        spatialization: "pan-distance"
      }
    ],
    constraints: []
  });

  const patch = engine.api.serializePatch();
  assert.equal(patch.sourceBindings.length, 1);
  assert.equal(patch.sourceBindings[0].source, "A");
  assert.equal(patch.sourceBindings[0].type, "audio-file");
  assert.equal(patch.sourceBindings[0].name, "voice.wav");
  assert.equal(patch.sourceBindings[0].gain, 0.75);
  assert.equal(patch.sourceBindings[0].muted, false);
});

test("source emitter capability distinguishes audio, midi, and geometric sources", () => {
  const engine = createEngineHarness();
  engine.loadPatch({
    name: "Emitter Capability",
    version: 1,
    listener: { x: 400, y: 300 },
    sources: [
      { name: "Audio", x: 250, y: 300 },
      { name: "Midi", x: 400, y: 300 },
      { name: "Generator", x: 475, y: 300 },
      { name: "Control", x: 550, y: 300 }
    ],
    sourceBindings: [
      {
        source: "Audio",
        type: "audio-file",
        name: "voice.wav",
        mimeType: "audio/wav",
        dataUrl: "data:audio/wav;base64,AAAA",
        loop: true,
        gain: 0.75,
        spatialization: "pan-distance"
      }
    ],
    midiFile: {
      url: "Midifiles/example.mid",
      trackBindings: [{ track: "Lead", source: "Midi", channel: 1, program: 1 }]
    },
    sourceGenerators: [
      {
        source: "Generator",
        type: "midi-ostinato",
        pitch: 60,
        periodMs: 1200,
        durationMs: 160,
        velocity: 80,
        channel: 1
      }
    ],
    constraints: []
  });

  const audioCapability = engine.sourceEmitterCapability("Audio");
  assert.equal(audioCapability.audio, true);
  assert.equal(audioCapability.midi, false);
  assert.equal(audioCapability.emits, true);

  const midiCapability = engine.sourceEmitterCapability("Midi");
  assert.equal(midiCapability.audio, false);
  assert.equal(midiCapability.midi, true);
  assert.equal(midiCapability.emits, true);

  const generatorCapability = engine.sourceEmitterCapability("Generator");
  assert.equal(generatorCapability.audio, false);
  assert.equal(generatorCapability.midi, true);
  assert.equal(generatorCapability.generator, true);
  assert.equal(generatorCapability.emits, true);

  const controlCapability = engine.sourceEmitterCapability("Control");
  assert.equal(controlCapability.audio, false);
  assert.equal(controlCapability.midi, false);
  assert.equal(controlCapability.emits, false);
});

test("patch info and selection summary describe the active context", () => {
  const engine = createEngineHarness();
  engine.loadPatch({
    name: "Readable Patch",
    description: "Shows the current patch and selected source.",
    tags: ["audio", "mappings"],
    version: 1,
    listener: { x: 400, y: 300 },
    sources: [{ name: "Voice", x: 250, y: 300 }],
    sourceBindings: [
      {
        source: "Voice",
        type: "audio-file",
        name: "voice.wav",
        mimeType: "audio/wav",
        dataUrl: "data:audio/wav;base64,AAAA",
        loop: true,
        gain: 0.75,
        spatialization: "pan-distance"
      }
    ],
    constraints: []
  });

  assert.match(engine.patchInfoText(), /Readable Patch/);
  assert.match(engine.patchInfoText(), /Shows the current patch/);
  assert.match(engine.patchInfoText(), /audio/);

  assert.equal(engine.openSourceInspector("Voice"), true);
  assert.match(engine.selectionSummaryText(), /Source: Voice/);
  assert.match(engine.selectionSummaryText(), /Audio: voice\.wav/);
});

test("source generators serialize with the patch", () => {
  const engine = createEngineHarness();
  engine.loadPatch({
    name: "Source Generator",
    version: 1,
    listener: { x: 400, y: 300 },
    sources: [{ name: "Pulse", x: 250, y: 300 }],
    sourceGenerators: [
      {
        source: "Pulse",
        type: "midi-ostinato",
        pitch: 60,
        periodMs: 1200,
        durationMs: 180,
        velocity: 80,
        channel: 1,
        waveform: "triangle",
        spatialization: "pan-distance"
      }
    ],
    sourceGeneratorMappings: [
      {
        source: "Pulse",
        feature: "distance",
        parameter: "pitch",
        inputMin: 0,
        inputMax: 400,
        outputMin: 48,
        outputMax: 72
      }
    ],
    constraints: []
  });

  const patch = engine.api.serializePatch();
  assert.equal(patch.sourceGenerators.length, 1);
  assert.equal(patch.sourceGenerators[0].source, "Pulse");
  assert.equal(patch.sourceGenerators[0].type, "midi-ostinato");
  assert.equal(patch.sourceGenerators[0].pitch, 60);
  assert.equal(patch.sourceGenerators[0].periodMs, 1200);
  assert.equal(patch.sourceGeneratorMappings.length, 1);
  assert.equal(patch.sourceGeneratorMappings[0].parameter, "pitch");
});

test("source generator mappings drive effective MIDI parameters", () => {
  const sourcePoint = { name: "Pulse", x: 600, y: 300 };
  const listenerPoint = { name: "Listener", x: 400, y: 300 };
  const generatorContext = runBrowserScript("musicspace-generator-client.js", {});
  const generatorClient = generatorContext.MusicSpaceGeneratorClient.createGeneratorClient({
    getSource: () => sourcePoint,
    getListener: () => listenerPoint
  });

  generatorClient.loadPatch({
    sourceGenerators: [
      {
        source: "Pulse",
        type: "midi-ostinato",
        pitch: 60,
        periodMs: 1200,
        durationMs: 160,
        velocity: 80,
        channel: 1
      }
    ],
    sourceGeneratorMappings: [
      {
        source: "Pulse",
        feature: "distance",
        parameter: "pitch",
        inputMin: 0,
        inputMax: 400,
        outputMin: 48,
        outputMax: 72
      },
      {
        source: "Pulse",
        feature: "x",
        parameter: "periodMs",
        inputMin: 0,
        inputMax: 800,
        outputMin: 400,
        outputMax: 1600
      },
      {
        source: "Pulse",
        feature: "angle",
        parameter: "velocity",
        inputMin: -Math.PI,
        inputMax: Math.PI,
        outputMin: 20,
        outputMax: 100
      }
    ]
  });

  let [effective] = generatorClient.effectiveGeneratorsForSource("Pulse");
  assert.equal(effective.pitch, 60);
  assert.equal(effective.periodMs, 1300);
  assert.equal(effective.velocity, 60);

  sourcePoint.x = 800;
  sourcePoint.y = 300;
  [effective] = generatorClient.effectiveGeneratorsForSource("Pulse");
  assert.equal(effective.pitch, 72);
  assert.equal(effective.periodMs, 1600);
});

test("source inspector edits MIDI ostinato generator parameters", () => {
  const engine = createEngineHarness();
  engine.loadPatch({
    name: "Edit Generator",
    version: 1,
    listener: { x: 400, y: 300 },
    sources: [{ name: "Pulse", x: 250, y: 300 }],
    sourceGenerators: [
      {
        source: "Pulse",
        type: "midi-ostinato",
        pitch: 60,
        periodMs: 1200,
        durationMs: 160,
        velocity: 80,
        channel: 1,
        waveform: "triangle",
        outputMode: "internal",
        spatialization: "pan-distance"
      }
    ],
    constraints: []
  });

  assert.equal(engine.openSourceInspector("Pulse"), true);
  const state = engine.sourceInspectorState();
  assert.equal(state.outputType, "midi-ostinato");
  assert.equal(state.generatorPitch, "60");
  assert.equal(state.generatorPeriod, "1200");

  const patch = engine.setOpenSourceGenerator({
    pitch: 67,
    periodMs: 750,
    durationMs: 90,
    velocity: 96,
    channel: 2,
    waveform: "square",
    outputMode: "external",
    outputId: "midi-out-a",
    spatialization: "stereo-pan",
    muted: true
  });
  assert.equal(patch.sourceGenerators.length, 1);
  assert.equal(patch.sourceGenerators[0].pitch, 67);
  assert.equal(patch.sourceGenerators[0].periodMs, 750);
  assert.equal(patch.sourceGenerators[0].durationMs, 90);
  assert.equal(patch.sourceGenerators[0].velocity, 96);
  assert.equal(patch.sourceGenerators[0].channel, 2);
  assert.equal(patch.sourceGenerators[0].waveform, "square");
  assert.equal(patch.sourceGenerators[0].outputMode, "external");
  assert.equal(patch.sourceGenerators[0].outputId, "midi-out-a");
  assert.equal(patch.sourceGenerators[0].muted, true);
  assert.equal(patch.sourceBindings?.length || 0, 0);
});

test("source inspector edits MIDI ostinato control mappings", () => {
  const engine = createEngineHarness();
  engine.loadPatch({
    name: "Edit Generator Mappings",
    version: 1,
    listener: { x: 400, y: 300 },
    sources: [{ name: "Pulse", x: 250, y: 300 }],
    sourceGenerators: [
      {
        source: "Pulse",
        type: "midi-ostinato",
        pitch: 60,
        periodMs: 1200,
        durationMs: 160,
        velocity: 80,
        channel: 1
      }
    ],
    sourceGeneratorMappings: [
      {
        source: "Pulse",
        feature: "distance",
        parameter: "pitch",
        inputMin: 0,
        inputMax: 400,
        outputMin: 48,
        outputMax: 72
      }
    ],
    constraints: []
  });

  assert.equal(engine.openSourceInspector("Pulse"), true);
  let state = engine.sourceInspectorState();
  assert.equal(state.generatorMappingCount, 1);
  assert.match(state.generatorMappingReadouts[0], /Current: Distance 150 px -> Pitch 57/);

  const patch = engine.setOpenSourceGeneratorMappings([
    {
      feature: "angle",
      parameter: "pitch",
      inputMin: 0,
      inputMax: 400,
      outputMin: 48,
      outputMax: 260
    },
    {
      feature: "y",
      parameter: "periodMs",
      inputMin: 120,
      inputMax: 520,
      outputMin: 360,
      outputMax: 1300,
      curve: "exp"
    }
  ]);

  assert.equal(patch.sourceGeneratorMappings.length, 2);
  assert.equal(patch.sourceGeneratorMappings[0].source, "Pulse");
  assert.equal(patch.sourceGeneratorMappings[0].feature, "angle");
  assert.equal(patch.sourceGeneratorMappings[0].parameter, "pitch");
  assert.equal(patch.sourceGeneratorMappings[0].inputMax, Math.PI);
  assert.equal(patch.sourceGeneratorMappings[0].outputMax, 127);
  assert.equal(patch.sourceGeneratorMappings[1].parameter, "periodMs");
  assert.equal(patch.sourceGeneratorMappings[1].curve, "exp");

  assert.equal(engine.openSourceInspector("Pulse"), true);
  state = engine.sourceInspectorState();
  assert.match(state.generatorMappingReadouts[0], /Angle/);
  assert.match(state.generatorMappingReadouts[1], /Period/);
});

test("source inspector creates a MIDI ostinato generator for a plain source", () => {
  const engine = createEngineHarness();
  engine.loadPatch({
    name: "Create Generator",
    version: 1,
    listener: { x: 400, y: 300 },
    sources: [{ name: "Pulse", x: 250, y: 300 }],
    constraints: []
  });

  assert.equal(engine.openSourceInspector("Pulse"), true);
  const patch = engine.setOpenSourceGenerator({
    pitch: 72,
    periodMs: 500,
    durationMs: 100,
    velocity: 70,
    channel: 3
  });

  assert.equal(patch.sourceGenerators.length, 1);
  assert.equal(patch.sourceGenerators[0].source, "Pulse");
  assert.equal(patch.sourceGenerators[0].type, "midi-ostinato");
  assert.equal(patch.sourceGenerators[0].pitch, 72);
  assert.equal(patch.sourceGenerators[0].channel, 3);
});

test("source inspector edits the audio loop parameter", () => {
  const engine = createEngineHarness();
  engine.loadPatch({
    name: "Source Loop",
    version: 1,
    listener: { x: 400, y: 300 },
    sources: [{ name: "A", x: 250, y: 300 }],
    sourceBindings: [
      {
        source: "A",
        type: "audio-file",
        name: "voice.wav",
        mimeType: "audio/wav",
        dataUrl: "data:audio/wav;base64,AAAA",
        gain: 0.75,
        muted: false,
        spatialization: "pan-distance"
      }
    ],
    constraints: []
  });

  assert.equal(engine.openSourceInspector("A"), true);
  assert.equal(engine.sourceInspectorState().loop, true);

  const patch = engine.setOpenSourceLoop(false);
  assert.equal(patch.sourceBindings[0].loop, false);

  engine.openSourceInspector("A");
  assert.equal(engine.sourceInspectorState().loop, false);
});

test("m key toggles mute for the selected source audio binding", () => {
  const engine = createEngineHarness();
  engine.loadPatch({
    name: "Source Mute",
    version: 1,
    listener: { x: 400, y: 300 },
    sources: [{ name: "A", x: 250, y: 300 }],
    sourceBindings: [
      {
        source: "A",
        type: "audio-file",
        name: "voice.wav",
        mimeType: "audio/wav",
        dataUrl: "data:audio/wav;base64,AAAA",
        loop: true,
        gain: 0.75,
        muted: false,
        spatialization: "pan-distance"
      }
    ],
    constraints: []
  });

  assert.equal(engine.openSourceInspector("A"), true);
  engine.pressCanvasKey("m");

  let patch = engine.api.serializePatch();
  assert.equal(patch.sourceBindings[0].muted, true);
  assert.equal(engine.sourceInspectorState().muted, true);

  engine.pressCanvasKey("m");
  patch = engine.api.serializePatch();
  assert.equal(patch.sourceBindings[0].muted, false);
  assert.equal(engine.sourceInspectorState().muted, false);
});

test("m key toggles mute for the selected MIDI ostinato generator", () => {
  const engine = createEngineHarness();
  engine.loadPatch({
    name: "Generator Mute",
    version: 1,
    listener: { x: 400, y: 300 },
    sources: [{ name: "Pulse", x: 250, y: 300 }],
    sourceGenerators: [
      {
        source: "Pulse",
        type: "midi-ostinato",
        pitch: 60,
        periodMs: 1200,
        durationMs: 160,
        velocity: 80,
        channel: 1,
        muted: false
      }
    ],
    constraints: []
  });

  assert.equal(engine.openSourceInspector("Pulse"), true);
  engine.pressCanvasKey("m");

  let patch = engine.api.serializePatch();
  assert.equal(patch.sourceGenerators[0].muted, true);
  assert.equal(engine.sourceInspectorState().muted, true);

  engine.pressCanvasKey("m");
  patch = engine.api.serializePatch();
  assert.equal(patch.sourceGenerators[0].muted, false);
  assert.equal(engine.sourceInspectorState().muted, false);
});

test("spacebar toggles sound playback for source audio bindings", async () => {
  const engine = createEngineHarness();
  engine.loadPatch({
    name: "Space Playback",
    version: 1,
    listener: { x: 400, y: 300 },
    sources: [{ name: "A", x: 250, y: 300 }],
    sourceBindings: [
      {
        source: "A",
        type: "audio-file",
        name: "voice.wav",
        mimeType: "audio/wav",
        dataUrl: "data:audio/wav;base64,AAAA",
        loop: true,
        gain: 0.75,
        spatialization: "pan-distance"
      }
    ],
    constraints: []
  });

  assert.equal(engine.soundButtonPressed(), "false");
  await engine.pressCanvasKeyAndSettle(" ");
  assert.equal(engine.soundButtonPressed(), "true");

  await engine.pressCanvasKeyAndSettle(" ");
  assert.equal(engine.soundButtonPressed(), "false");
});

test("spacebar toggles sound playback for source generators", async () => {
  const engine = createEngineHarness();
  engine.loadPatch({
    name: "Generator Playback",
    version: 1,
    listener: { x: 400, y: 300 },
    sources: [{ name: "Pulse", x: 250, y: 300 }],
    sourceGenerators: [
      {
        source: "Pulse",
        type: "midi-ostinato",
        pitch: 60,
        periodMs: 1200,
        durationMs: 180,
        velocity: 80,
        channel: 1
      }
    ],
    constraints: []
  });

  assert.equal(engine.soundButtonPressed(), "false");
  await engine.pressCanvasKeyAndSettle(" ");
  assert.equal(engine.soundButtonPressed(), "true");

  await engine.pressCanvasKeyAndSettle(" ");
  assert.equal(engine.soundButtonPressed(), "false");
});

test("spacebar toggles MIDI sequence playback through Play Sound", async () => {
  const engine = createEngineHarness();
  engine.loadPatch({
    name: "Sequence Playback",
    version: 1,
    listener: { x: 400, y: 300 },
    sources: [{ name: "Lead", x: 250, y: 300 }],
    midiFile: {
      name: "lead.mid",
      preferredMode: "internal",
      trackBindings: [{ source: "Lead", track: "Lead", trackIndex: 0, channel: 1 }]
    },
    constraints: []
  });

  assert.equal(engine.soundButtonPressed(), "false");
  assert.equal(engine.midiToolbarHidden(), false);

  await engine.pressCanvasKeyAndSettle(" ");
  assert.equal(engine.soundButtonPressed(), "true");

  await engine.pressCanvasKeyAndSettle(" ");
  assert.equal(engine.soundButtonPressed(), "false");
});

test("toolbar hides patch-specific transport and MIDI controls", () => {
  const engine = createEngineHarness();
  assert.equal(engine.uiMode(), "play");
  engine.setUiMode("edit");
  assert.equal(engine.uiMode(), "edit");
  engine.setUiMode("play");

  engine.loadPatch({
    name: "Geometry Only",
    version: 1,
    listener: { x: 400, y: 300 },
    sources: [{ name: "A", x: 250, y: 300 }],
    constraints: []
  });

  let toolbar = engine.toolbarVisibility();
  assert.equal(toolbar.transportHidden, true);
  assert.equal(toolbar.moversHidden, true);
  assert.equal(toolbar.soundHidden, true);
  assert.equal(toolbar.midiHidden, true);

  engine.loadPatch({
    name: "Mover Only",
    version: 1,
    listener: { x: 400, y: 300 },
    sources: [{ name: "A", x: 250, y: 300 }],
    movingObjects: [{ name: "Wheel", x: 500, y: 300 }],
    constraints: []
  });

  toolbar = engine.toolbarVisibility();
  assert.equal(toolbar.transportHidden, false);
  assert.equal(toolbar.moversHidden, false);
  assert.equal(toolbar.soundHidden, true);
  assert.equal(toolbar.midiHidden, true);

  engine.loadPatch({
    name: "Audio Only",
    version: 1,
    listener: { x: 400, y: 300 },
    sources: [{ name: "A", x: 250, y: 300 }],
    sourceBindings: [
      {
        source: "A",
        type: "audio-file",
        name: "voice.wav",
        mimeType: "audio/wav",
        dataUrl: "data:audio/wav;base64,AAAA",
        loop: true,
        gain: 0.75,
        spatialization: "pan-distance"
      }
    ],
    constraints: []
  });

  toolbar = engine.toolbarVisibility();
  assert.equal(toolbar.transportHidden, false);
  assert.equal(toolbar.moversHidden, true);
  assert.equal(toolbar.soundHidden, false);
  assert.equal(toolbar.midiHidden, true);
});

test("MIDI output controls are hidden for non-sequence patches", () => {
  const engine = createEngineHarness();
  engine.loadPatch({
    name: "Geometry Only",
    version: 1,
    listener: { x: 400, y: 300 },
    sources: [{ name: "A", x: 250, y: 300 }],
    constraints: []
  });

  assert.equal(engine.midiToolbarHidden(), true);
});

test("shift space toggles movers without toggling sound", () => {
  const engine = createEngineHarness();
  engine.loadPatch({
    name: "Shift Space Movers",
    version: 1,
    listener: { x: 400, y: 300 },
    sources: [{ name: "A", x: 250, y: 300 }],
    movingObjects: [{ name: "Mover", x: 500, y: 300 }],
    constraints: []
  });

  assert.equal(engine.moversButtonPressed(), "false");
  assert.equal(engine.soundButtonPressed(), "false");

  engine.pressCanvasKey(" ", { shiftKey: true });
  assert.equal(engine.moversButtonPressed(), "true");
  assert.equal(engine.soundButtonPressed(), "false");

  engine.pressCanvasKey(" ", { shiftKey: true });
  assert.equal(engine.moversButtonPressed(), "false");
  assert.equal(engine.soundButtonPressed(), "false");
});

test("source audio pan-distance spatialization adds distance-based reverb send", async () => {
  const nodes = [];
  const sourcePoint = { x: 400, y: 300 };
  const listenerPoint = { x: 400, y: 300 };
  const makeParam = (initial = 0) => ({
    value: initial,
    setTargetAtTime(value) {
      this.value = value;
    }
  });
  class FakeNode {
    constructor(kind) {
      this.kind = kind;
      this.connections = [];
    }
    connect(node) {
      this.connections.push(node);
    }
    disconnect() {
      this.disconnected = true;
    }
  }
  class FakeGain extends FakeNode {
    constructor() {
      super("gain");
      this.gain = makeParam(1);
    }
  }
  class FakeDelay extends FakeNode {
    constructor() {
      super("delay");
      this.delayTime = makeParam(0);
    }
  }
  class FakeFilter extends FakeNode {
    constructor() {
      super("filter");
      this.frequency = makeParam(0);
      this.type = "";
    }
  }
  class FakePan extends FakeNode {
    constructor() {
      super("pan");
      this.pan = makeParam(0);
    }
  }
  class FakeSource extends FakeNode {
    constructor() {
      super("source");
      this.loop = false;
    }
    start() {
      this.started = true;
    }
    stop() {
      this.stopped = true;
    }
  }
  class FakeAudioContext {
    constructor() {
      this.currentTime = 0;
      this.destination = new FakeNode("destination");
    }
    createBufferSource() {
      const node = new FakeSource();
      nodes.push(node);
      return node;
    }
    createGain() {
      const node = new FakeGain();
      nodes.push(node);
      return node;
    }
    createDelay() {
      const node = new FakeDelay();
      nodes.push(node);
      return node;
    }
    createBiquadFilter() {
      const node = new FakeFilter();
      nodes.push(node);
      return node;
    }
    createStereoPanner() {
      const node = new FakePan();
      nodes.push(node);
      return node;
    }
    async decodeAudioData() {
      return {};
    }
    async resume() {}
  }

  const sourceAudioContext = runBrowserScript("musicspace-source-audio-client.js", {
    AudioContext: FakeAudioContext,
    atob(value) {
      return Buffer.from(value, "base64").toString("binary");
    }
  });
  const sourceAudioClient = sourceAudioContext.MusicSpaceSourceAudioClient.createSourceAudioClient({
    getSource: () => sourcePoint,
    getListener: () => listenerPoint
  });
  sourceAudioClient.loadPatch({
    sourceBindings: [
      {
        source: "A",
        type: "audio-file",
        name: "voice.wav",
        dataUrl: "data:audio/wav;base64,AAAA",
        loop: true,
        gain: 0.75,
        spatialization: "pan-distance"
      }
    ]
  });

  assert.equal(await sourceAudioClient.setEnabled(true), true);
  const gainNodes = nodes.filter((node) => node.kind === "gain");
  const sourceGain = gainNodes.at(-3);
  const directGain = gainNodes.at(-2);
  const reverbSend = gainNodes.at(-1);

  assert.equal(sourceGain.gain.value, 0.75);
  assert.equal(directGain.gain.value, 1);
  assert.equal(reverbSend.gain.value, 0);

  sourcePoint.x = 800;
  sourceAudioClient.updateSpatial();

  assert.ok(directGain.gain.value < 1, "distance should attenuate direct gain");
  assert.ok(reverbSend.gain.value > 0, "distance should raise reverb send");
});

test("canvas pointer focus does not request page scrolling", () => {
  const engine = createEngineHarness();
  const focusOptions = engine.focusCanvasWithoutScrolling();
  assert.equal(focusOptions.preventScroll, true);
});

test("canvas backing store matches displayed size and device pixel ratio", () => {
  const engine = createEngineHarness();
  engine.setCanvasDisplaySize(1600, 1200, 2);
  engine.loadPatch({
    name: "HiDPI Canvas",
    version: 1,
    listener: { x: 400, y: 300 },
    sources: [{ name: "A", x: 250, y: 300 }],
    constraints: []
  });

  assert.deepEqual(engine.canvasBackingSize(), {
    width: 3200,
    height: 2400,
    traceWidth: 3200,
    traceHeight: 2400
  });
});

test("fullscreen canvas mode toggles and escape exits", () => {
  const engine = createEngineHarness();
  engine.clickFullscreenToggle();
  assert.equal(engine.fullscreenState().pressed, "true");
  assert.ok(engine.fullscreenState().stageClassName.includes("is-fullscreen"));

  engine.pressCanvasKey("Escape");
  assert.equal(engine.fullscreenState().pressed, "false");
  assert.ok(!engine.fullscreenState().stageClassName.includes("is-fullscreen"));
});

test("undo status shows pending undo without a toolbar command button", () => {
  const engine = createEngineHarness();
  engine.loadPatch({
    name: "Undo Status",
    version: 1,
    listener: { x: 400, y: 300 },
    sources: [{ name: "A", x: 250, y: 300 }],
    constraints: []
  });

  assert.equal(engine.undoStatus().hidden, true);

  engine.pressCanvasKey("ArrowRight");
  assert.equal(engine.undoStatus().hidden, false);
  assert.equal(engine.undoStatus().text, "Undo: nudge Listener");
  assert.equal(engine.undoStatus().title, "Press Cmd/Ctrl+Z to undo.");

  engine.pressCanvasKey("z", { metaKey: true });
  assert.equal(engine.undoStatus().hidden, true);
});

test("edit toolbar opens patch inspector and JSON editor", () => {
  const engine = createEngineHarness();
  engine.loadPatch({
    name: "Patch Inspector Buttons",
    version: 1,
    listener: { x: 400, y: 300 },
    sources: [{ name: "A", x: 250, y: 300 }],
    constraints: []
  });

  engine.closePatchInspectorForTest();

  assert.equal(engine.patchInspectorState().hidden, true);
  engine.clickInlinePatchInspector();

  let state = engine.patchInspectorState();
  assert.equal(state.hidden, false);
  assert.equal(state.toolbarPressed, "true");
  assert.equal(state.inlinePressed, "true");

  engine.clickInlinePatchJson();
  state = engine.patchInspectorState();
  assert.equal(state.hidden, false);
  assert.equal(state.jsonHidden, false);
  assert.equal(state.jsonToolbarPressed, "true");
  assert.equal(state.jsonInlinePressed, "true");
  assert.match(state.jsonText, /Patch Inspector Buttons/);
});

test("sound clients do not enable without mappings or source bindings", async () => {
  let parameterSetEnabledCalls = 0;
  let audioContextConstructed = 0;
  const parameterContext = runBrowserScript("musicspace-parameter-client.js", {
    MusicSpaceMapping: {
      normalizeMappings(mappings) {
        return mappings;
      },
      valuesForMappings() {
        return {};
      }
    },
    MusicSpaceTargets: {
      normalizeTargetSpec(spec = {}) {
        return { ...spec, type: spec.type || "subtractive" };
      },
      createTargetController() {
        return {
          apply() {},
          defaults() {
            return {};
          },
          dispose() {},
          hasParameter() {
            return true;
          },
          isEnabled() {
            return false;
          },
          parameterConfig() {
            return { suffix: "", digits: 2 };
          },
          async setEnabled(enabled) {
            parameterSetEnabledCalls += 1;
            assert.equal(enabled, false);
            return false;
          }
        };
      }
    }
  });
  const sourceAudioContext = runBrowserScript("musicspace-source-audio-client.js", {
    AudioContext: class {
      constructor() {
        audioContextConstructed += 1;
      }
    },
    atob(value) {
      return Buffer.from(value, "base64").toString("binary");
    }
  });

  const parameterClient = parameterContext.MusicSpaceParameterClient.createParameterClient();
  const sourceAudioClient = sourceAudioContext.MusicSpaceSourceAudioClient.createSourceAudioClient();

  parameterClient.loadPatch({ parameterMappings: [] });
  sourceAudioClient.loadPatch({ sourceBindings: [] });

  assert.equal(await parameterClient.setEnabled(true), false);
  assert.equal(await sourceAudioClient.setEnabled(true), false);
  assert.equal(parameterSetEnabledCalls, 1);
  assert.equal(audioContextConstructed, 0);
});

test("double-clicking a source opens the source inspector", () => {
  const engine = createEngineHarness();
  engine.loadPatch({
    name: "Source Inspector",
    version: 1,
    listener: { x: 400, y: 300 },
    sources: [{ name: "A", x: 250, y: 300 }],
    constraints: []
  });

  assert.equal(engine.openSourceInspector("A"), true);
  const inspector = engine.sourceInspectorState();
  assert.equal(inspector.hidden, false);
  assert.equal(inspector.name, "A");
  assert.equal(inspector.outputType, "none");
  assert.equal(inspector.fileLabel, "No audio file assigned.");
});

test("double-clicking the listener opens the listener inspector", () => {
  const engine = createEngineHarness();
  engine.loadPatch({
    name: "Listener Inspector",
    version: 1,
    listener: { x: 400, y: 300 },
    sources: [{ name: "A", x: 250, y: 300 }],
    constraints: []
  });

  assert.equal(engine.openListenerInspector(), true);
  let inspector = engine.listenerInspectorState();
  assert.equal(inspector.hidden, false);
  assert.equal(inspector.x, "400");
  assert.equal(inspector.y, "300");
  assert.equal(inspector.drawTrace, false);
  assert.equal(inspector.retargetPressed, "true");
  assert.equal(inspector.preservePressed, "false");

  engine.clickListenerMode("preserve");
  inspector = engine.listenerInspectorState();
  assert.equal(inspector.retargetPressed, "false");
  assert.equal(inspector.preservePressed, "true");

  const patch = engine.applyOpenListener({ x: 420, y: 310, drawTrace: true });
  assert.equal(patch.listener.x, 420);
  assert.equal(patch.listener.y, 310);
  assert.equal(patch.listener.drawTrace, true);
});

test("constraint inspector edits radial limit distances", () => {
  const engine = createEngineHarness();
  engine.loadPatch({
    name: "Constraint Inspector Limit",
    version: 1,
    listener: { x: 400, y: 300 },
    sources: [{ name: "A", x: 250, y: 300 }],
    constraints: [
      { type: "radialLimit", source: "A", minDistance: 50, maxDistance: 250 }
    ]
  });

  assert.equal(engine.openConstraintInspector(0), true);
  const state = engine.constraintInspectorState();
  assert.equal(state.hidden, false);
  assert.equal(state.labelA, "Minimum distance");
  assert.equal(state.valueA, "50");
  assert.equal(state.labelB, "Maximum distance");
  assert.equal(state.valueB, "250");

  const patch = engine.applyOpenConstraint({ valueA: 80, valueB: 180, manualNode: true, nodeX: 360, nodeY: 220 });
  assert.equal(patch.constraints[0].minDistance, 80);
  assert.equal(patch.constraints[0].maxDistance, 180);
  assert.equal(patch.constraints[0].node.isManual, true);
  assert.equal(patch.constraints[0].node.x, 360);
  assert.equal(patch.constraints[0].node.y, 220);
});

test("constraint inspector edits angle sector degrees", () => {
  const engine = createEngineHarness();
  engine.loadPatch({
    name: "Constraint Inspector Sector",
    version: 1,
    listener: { x: 400, y: 300 },
    sources: [{ name: "A", x: 500, y: 300 }],
    constraints: [
      { type: "angleSector", source: "A", centerAngle: 0, width: Math.PI / 2 }
    ]
  });

  assert.equal(engine.openConstraintInspector(0), true);
  const state = engine.constraintInspectorState();
  assert.equal(state.labelA, "Center angle (deg)");
  assert.equal(state.valueA, "0");
  assert.equal(state.labelB, "Width (deg)");
  assert.equal(state.valueB, "90");

  const patch = engine.applyOpenConstraint({ valueA: 45, valueB: 60 });
  assert.ok(Math.abs(patch.constraints[0].centerAngle - Math.PI / 4) < 0.000001);
  assert.ok(Math.abs(patch.constraints[0].width - Math.PI / 3) < 0.000001);
});

test("inspector arrows navigate sources and constraint nodes in order", () => {
  const engine = createEngineHarness();
  engine.loadPatch({
    name: "Inspector Navigation",
    version: 1,
    listener: { x: 400, y: 300 },
    sources: [
      { name: "A", x: 250, y: 300 },
      { name: "B", x: 500, y: 300 }
    ],
    constraints: [
      { type: "radialLimit", source: "A", minDistance: 50, maxDistance: 250 }
    ]
  });

  assert.equal(engine.openSourceInspector("A"), true);
  assert.equal(engine.sourceInspectorState().name, "A");

  engine.clickInspectorNext();
  assert.equal(engine.sourceInspectorState().hidden, false);
  assert.equal(engine.sourceInspectorState().name, "B");

  engine.clickInspectorNext();
  assert.equal(engine.sourceInspectorState().hidden, true);
  assert.equal(engine.constraintInspectorState().hidden, false);
  assert.equal(engine.constraintInspectorState().labelA, "Minimum distance");

  engine.clickInspectorPrevious();
  assert.equal(engine.constraintInspectorState().hidden, true);
  assert.equal(engine.sourceInspectorState().hidden, false);
  assert.equal(engine.sourceInspectorState().name, "B");
});

test("source inspector rename updates patch references", () => {
  const engine = createEngineHarness();
  engine.loadPatch({
    name: "Rename source",
    version: 1,
    listener: { x: 400, y: 300 },
    sources: [
      { name: "A", x: 250, y: 300 },
      { name: "B", x: 500, y: 300 }
    ],
    movingObjects: [
      {
        name: "Lift",
        x: 350,
        y: 300,
        trajectory: {
          type: "shuttle",
          start: { type: "object", name: "A", x: 250, y: 300 },
          end: { type: "object", name: "B", x: 500, y: 300 },
          speed: 0.01
        }
      }
    ],
    constraints: [
      { type: "radialLimit", source: "A", minDistance: 50, maxDistance: 250 },
      { type: "solid", carrier: "Lift", attached: "A" }
    ],
    sourceBindings: [
      {
        source: "A",
        type: "audio-file",
        name: "voice.wav",
        mimeType: "audio/wav",
        dataUrl: "data:audio/wav;base64,AAAA",
        loop: true,
        gain: 0.75,
        spatialization: "pan-distance"
      }
    ],
    parameterMappings: [
      {
        source: "A",
        feature: "distance",
        target: "/osc/freq",
        inputMin: 0,
        inputMax: 400,
        outputMin: 110,
        outputMax: 880
      }
    ],
    midiFile: {
      sequenceData: { title: "Stub" },
      trackBindings: [{ track: "Lead", source: "A", channel: 1, program: 1 }]
    },
    sourceGenerators: [
      {
        source: "A",
        type: "midi-ostinato",
        pitch: 60,
        periodMs: 1200,
        durationMs: 180,
        velocity: 80,
        channel: 1
      }
    ],
    sourceGeneratorMappings: [
      {
        source: "A",
        feature: "distance",
        parameter: "pitch",
        inputMin: 0,
        inputMax: 400,
        outputMin: 48,
        outputMax: 72
      }
    ]
  });

  assert.equal(engine.openSourceInspector("A"), true);
  const patch = engine.renameOpenSource("Lead");

  assert.ok(engine.api.getObjectByName("Lead"));
  assert.equal(engine.api.getObjectByName("A"), null);
  assert.deepEqual(patch.sources.map((source) => source.name), ["Lead", "B"]);
  assert.equal(patch.constraints.find((constraint) => constraint.type === "radialLimit").source, "Lead");
  assert.equal(patch.constraints.find((constraint) => constraint.type === "solid").attached, "Lead");
  assert.equal(patch.sourceBindings[0].source, "Lead");
  assert.equal(patch.parameterMappings[0].source, "Lead");
  assert.equal(patch.midiFile.trackBindings[0].source, "Lead");
  assert.equal(patch.sourceGenerators[0].source, "Lead");
  assert.equal(patch.sourceGeneratorMappings[0].source, "Lead");
  assert.equal(patch.movingObjects[0].trajectory.start.name, "Lead");
});

test("patch validation checks source audio bindings", () => {
  const engine = createEngineHarness();
  const findings = engine.api.validatePatch({
    name: "Broken source audio",
    version: 1,
    listener: { x: 400, y: 300 },
    sources: [{ name: "A", x: 250, y: 300 }],
    sourceBindings: [
      { source: "Missing", type: "audio-file", name: "missing.wav", dataUrl: "data:audio/wav;base64,AAAA" },
      { source: "A", type: "audio-file", name: "empty.wav" },
      { source: "A", type: "stream", url: "stream://" }
    ],
    constraints: []
  });

  assert.ok(findings.some((finding) => finding.message.includes("unknown object Missing")));
  assert.ok(findings.some((finding) => finding.message.includes("needs a dataUrl or url")));
  assert.ok(findings.some((finding) => finding.message.includes("Unsupported source binding type")));
});

test("patch validation checks source generators", () => {
  const engine = createEngineHarness();
  const findings = engine.api.validatePatch({
    name: "Broken source generators",
    version: 1,
    listener: { x: 400, y: 300 },
    sources: [{ name: "A", x: 250, y: 300 }],
    sourceGenerators: [
      { source: "Missing", type: "midi-ostinato", pitch: 60, periodMs: 1200, durationMs: 180, velocity: 80, channel: 1 },
      { source: "A", type: "loop", pitch: 60, periodMs: 1200, durationMs: 180, velocity: 80, channel: 1 },
      { source: "A", type: "midi-ostinato", pitch: 140, periodMs: -1, durationMs: 0, velocity: 200, channel: 20 }
    ],
    sourceGeneratorMappings: [
      { source: "Missing", feature: "distance", parameter: "pitch", inputMin: 0, inputMax: 400, outputMin: 48, outputMax: 72 },
      { source: "A", feature: "speed", parameter: "pitch", inputMin: 0, inputMax: 400, outputMin: 48, outputMax: 72 },
      { source: "A", feature: "distance", parameter: "program", inputMin: 0, inputMax: 400, outputMin: 1, outputMax: 8 },
      { source: "A", feature: "distance", parameter: "periodMs", inputMin: 0, inputMax: 400, outputMin: 0, outputMax: 1000, curve: "exp" }
    ],
    constraints: []
  });

  assert.ok(findings.some((finding) => finding.message.includes("unknown object Missing")));
  assert.ok(findings.some((finding) => finding.message.includes("Unsupported source generator type")));
  assert.ok(findings.some((finding) => finding.message.includes("sourceGenerators.pitch")));
  assert.ok(findings.some((finding) => finding.message.includes("sourceGenerators.periodMs")));
  assert.ok(findings.some((finding) => finding.message.includes("sourceGenerators.velocity")));
  assert.ok(findings.some((finding) => finding.message.includes("Unsupported source generator mapping feature")));
  assert.ok(findings.some((finding) => finding.message.includes("Unsupported source generator mapping parameter")));
  assert.ok(findings.some((finding) => finding.message.includes("Exponential source generator mapping")));
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

test("infeasible product with radial limits reports conflict diagnostics", () => {
  const engine = createEngineHarness();
  engine.loadPatch({
    name: "Product limit conflict",
    version: 1,
    listener: { x: 0, y: 0 },
    sources: [
      { name: "A", x: 100, y: 0 },
      { name: "B", x: 0, y: 100 },
      { name: "C", x: -100, y: 0 }
    ],
    constraints: [
      { type: "pin", target: "A", x: 300, y: 0 },
      { type: "radialLimit", source: "B", minDistance: 10, maxDistance: 50 },
      { type: "radialLimit", source: "C", minDistance: 10, maxDistance: 50 },
      { type: "product", sources: ["A", "B", "C"] }
    ]
  });

  const report = engine.move("A", 300, 0);
  const listener = engine.point("Listener");
  const diagnosticLabels = new Set(report.residuals.map((residual) => residual.label));
  const diagnosticText = report.messages.join(" ");

  assert.equal(report.satisfied, false);
  assert.ok(
    diagnosticLabels.has("Product") ||
      diagnosticLabels.has("Pin") ||
      diagnosticLabels.has("Limit") ||
      diagnosticText.includes("Product constraint has no solution")
  );
  assert.ok(distance(engine.point("B"), listener) <= 50.5);
  assert.ok(distance(engine.point("C"), listener) <= 50.5);
});

test("ratio and radial limit conflict stays bounded and reports diagnostics", () => {
  const engine = createEngineHarness();
  engine.loadPatch({
    name: "Ratio limit conflict",
    version: 1,
    listener: { x: 0, y: 0 },
    sources: [
      { name: "A", x: 100, y: 0 },
      { name: "B", x: 100, y: 0 }
    ],
    constraints: [
      { type: "pin", target: "B", x: 100, y: 0 },
      { type: "radialLimit", source: "A", minDistance: 50, maxDistance: 120 },
      { type: "distanceRatio", sources: ["A", "B"], ratio: 4 }
    ]
  });

  const report = engine.move("B", 100, 0);
  const listener = engine.point("Listener");
  const diagnosticLabels = new Set(report.residuals.map((residual) => residual.label));

  assert.equal(report.satisfied, false);
  assert.equal(report.hitStepCap, false);
  assert.ok(diagnosticLabels.has("Ratio") || diagnosticLabels.has("Limit") || diagnosticLabels.has("Pin"));
  assert.ok(distance(engine.point("A"), listener) <= 120.5);
});

test("pin versus radial limit conflict reports a hard-constraint residual", () => {
  const engine = createEngineHarness();
  engine.loadPatch({
    name: "Pin limit conflict",
    version: 1,
    listener: { x: 0, y: 0 },
    sources: [{ name: "A", x: 100, y: 0 }],
    constraints: [
      { type: "pin", target: "A", x: 100, y: 0 },
      { type: "radialLimit", source: "A", minDistance: 200, maxDistance: 250 }
    ]
  });

  const report = engine.move("A", 240, 0);
  const residualLabels = report.residuals.map((residual) => residual.label);

  assert.equal(report.satisfied, false);
  assert.ok(residualLabels.includes("Pin") || residualLabels.includes("Limit"));
});

test("impossible fixed-distance triangle exposes residuals without unbounded propagation", () => {
  const engine = createEngineHarness();
  engine.loadPatch({
    name: "Impossible triangle",
    version: 1,
    listener: { x: 0, y: 0 },
    sources: [
      { name: "A", x: 0, y: 0 },
      { name: "B", x: 100, y: 0 },
      { name: "C", x: 50, y: 86.6025 }
    ],
    constraints: [
      { type: "pin", target: "A", x: 0, y: 0 },
      { type: "pin", target: "B", x: 100, y: 0 },
      { type: "fixedDistance", anchor: "A", target: "C", distance: 60 },
      { type: "fixedDistance", anchor: "B", target: "C", distance: 60 },
      { type: "fixedDistance", anchor: "A", target: "B", distance: 150 }
    ]
  });

  const report = engine.move("C", 50, 20);
  const residualLabels = report.residuals.map((residual) => residual.label);

  assert.equal(report.satisfied, false);
  assert.equal(report.hitStepCap, false);
  assert.ok(residualLabels.includes("Distance") || residualLabels.includes("Pin"));
});

test("solid-link chain dragged into a radial boundary remains bounded", () => {
  const engine = createEngineHarness();
  engine.loadPatch({
    name: "Link chain limit",
    version: 1,
    listener: { x: 0, y: 0 },
    sources: [
      { name: "A", x: 80, y: 0 },
      { name: "B", x: 130, y: 0 },
      { name: "C", x: 180, y: 0 }
    ],
    constraints: [
      { type: "solid", carrier: "A", attached: "B", offsetX: 50, offsetY: 0 },
      { type: "solid", carrier: "B", attached: "C", offsetX: 50, offsetY: 0 },
      { type: "radialLimit", source: "C", minDistance: 40, maxDistance: 160 }
    ]
  });

  const report = engine.move("A", 140, 0);
  const listener = engine.point("Listener");

  assert.equal(report.hitStepCap, false);
  assert.ok(distance(engine.point("C"), listener) <= 160.5);
  assert.ok(report.residuals.every((residual) => Number.isFinite(residual.error)));
});

test("trajectory-style repeated pushes through a radial limit stay finite", () => {
  const engine = createEngineHarness();
  engine.loadPatch({
    name: "Repeated trajectory pressure",
    version: 1,
    listener: { x: 0, y: 0 },
    sources: [
      { name: "Driver", x: 60, y: 0 },
      { name: "Q", x: 100, y: 0 }
    ],
    constraints: [
      { type: "solid", carrier: "Driver", attached: "Q", offsetX: 40, offsetY: 0 },
      { type: "radialLimit", source: "Q", minDistance: 40, maxDistance: 120 }
    ]
  });

  let report;
  for (let step = 0; step < 24; step += 1) {
    report = engine.move("Driver", 80 + step * 5, 0);
  }

  const listener = engine.point("Listener");
  assert.ok(report);
  assert.equal(report.hitStepCap, false);
  assert.ok(distance(engine.point("Q"), listener) <= 120.5);
  assert.ok(report.residuals.every((residual) => Number.isFinite(residual.error)));
});

test("large synthetic component respects the bounded propagation budget", () => {
  const engine = createEngineHarness();
  const sources = Array.from({ length: 24 }, (_, index) => ({
    name: `S${index}`,
    x: 120 + index * 8,
    y: index % 2 === 0 ? 40 : -40
  }));
  const constraints = [];

  for (let index = 0; index < sources.length - 1; index += 1) {
    constraints.push({
      type: "fixedDistance",
      anchor: `S${index}`,
      target: `S${index + 1}`,
      distance: 60
    });
  }
  constraints.push({ type: "sum", sources: sources.map((source) => source.name) });

  engine.loadPatch({
    name: "Large bounded component",
    version: 1,
    listener: { x: 0, y: 0 },
    sources,
    constraints
  });

  const start = process.hrtime.bigint();
  const report = engine.move("S0", 200, 80);
  const elapsedMs = Number(process.hrtime.bigint() - start) / 1e6;

  assert.ok(report.propagationSteps <= 96);
  assert.ok(elapsedMs < 50, `large component solve took ${elapsedMs.toFixed(2)}ms`);
  assert.ok(report.residuals.every((residual) => Number.isFinite(residual.error)));
});

test("tiny repeated moves keep the constrained solution continuous", () => {
  const engine = createEngineHarness();
  engine.loadPatch(loadFixturePatch("angle-balance.json"));

  let previousB = engine.point("B");
  let previousC = engine.point("C");

  for (let step = 0; step < 20; step += 1) {
    const report = engine.move("D", 160 + step, 145 + step * 0.5);
    const nextB = engine.point("B");
    const nextC = engine.point("C");

    assert.equal(report.hitStepCap, false);
    assert.ok(distance(previousB, nextB) < 35, `B jumped on step ${step}`);
    assert.ok(distance(previousC, nextC) < 35, `C jumped on step ${step}`);
    previousB = nextB;
    previousC = nextC;
  }
});

test("xpbd mode clamps radial limits without propagation caps", () => {
  const engine = createEngineHarness();
  engine.setSolverMode("xpbd");
  engine.loadPatch({
    name: "XPBD radial clamp",
    version: 1,
    listener: { x: 0, y: 0 },
    sources: [{ name: "A", x: 100, y: 0 }],
    constraints: [{ type: "radialLimit", source: "A", minDistance: 50, maxDistance: 150 }]
  });

  const report = engine.move("A", 300, 0);
  const radius = distance(engine.point("A"), engine.point("Listener"));

  assert.equal(report.solverMode, "xpbd");
  assert.equal(report.hitEntityCap, false);
  assert.equal(report.hitStepCap, false);
  assert.equal(report.residuals.length, 0);
  assert.ok(Math.abs(radius - 150) <= 0.5);
});

test("xpbd mode satisfies simple fixed-distance constraints", () => {
  const engine = createEngineHarness();
  engine.setSolverMode("xpbd");
  engine.loadPatch({
    name: "XPBD distance",
    version: 1,
    listener: { x: 0, y: 0 },
    sources: [
      { name: "A", x: 0, y: 0 },
      { name: "B", x: 100, y: 0 }
    ],
    constraints: [{ type: "fixedDistance", anchor: "A", target: "B", distance: 100 }]
  });

  const report = engine.move("A", 50, 0);
  const currentDistance = distance(engine.point("A"), engine.point("B"));

  assert.equal(report.solverMode, "xpbd");
  assert.equal(report.hitEntityCap, false);
  assert.equal(report.hitStepCap, false);
  assert.ok(Math.abs(currentDistance - 100) <= 0.5);
});

test("xpbd mode keeps product plus radial limit bounded", () => {
  const engine = createEngineHarness();
  engine.setSolverMode("xpbd");
  engine.loadPatch(loadFixturePatch("product-limit.json"));

  const report = engine.move("A", 200, 300);
  const listener = engine.point("Listener");
  const bRadius = distance(engine.point("B"), listener);

  assert.equal(report.solverMode, "xpbd");
  assert.equal(report.hitEntityCap, false);
  assert.equal(report.hitStepCap, false);
  assert.ok(bRadius >= 59.5 && bRadius <= 130.5);
  assert.ok(report.residuals.every((residual) => Number.isFinite(residual.error)));
});

test("xpbd mode reports best-fit diagnostics for pin and limit conflict", () => {
  const engine = createEngineHarness();
  engine.setSolverMode("xpbd");
  engine.loadPatch({
    name: "XPBD hard conflict",
    version: 1,
    listener: { x: 0, y: 0 },
    sources: [{ name: "A", x: 100, y: 0 }],
    constraints: [
      { type: "pin", target: "A", x: 100, y: 0 },
      { type: "radialLimit", source: "A", minDistance: 200, maxDistance: 250 }
    ]
  });

  const report = engine.move("A", 240, 0);
  const residualLabels = report.residuals.map((residual) => residual.label);

  assert.equal(report.solverMode, "xpbd");
  assert.equal(report.satisfied, false);
  assert.equal(report.hitEntityCap, false);
  assert.equal(report.hitStepCap, false);
  assert.ok(residualLabels.includes("Pin") || residualLabels.includes("Limit"));
});

test("xpbd mode rotates solid attachments on rotator trajectory ticks", () => {
  const engine = createEngineHarness();
  engine.setSolverMode("xpbd");
  engine.loadPatch(loadFixturePatch("simple-rotator.json"));

  const before = engine.point("S1");
  const report = engine.tickMover("Spin");
  const after = engine.point("S1");

  assert.equal(report.solverMode, "xpbd");
  assert.equal(report.hitEntityCap, false);
  assert.equal(report.hitStepCap, false);
  assert.ok(distance(before, after) > 0.5, "rotator-attached source should move after a rotator tick");
  assert.ok(report.residuals.every((residual) => Number.isFinite(residual.error)));
});

test("xpbd mode preserves object-referenced shuttle endpoints during trajectory ticks", () => {
  const engine = createEngineHarness();
  engine.setSolverMode("xpbd");
  engine.loadPatch(loadFixturePatch("shuttle-spin.json"));

  const lift = engine.api.getObjectByName("Lift");
  const before = {
    ax: lift.trajectory.ax,
    ay: lift.trajectory.ay,
    bx: lift.trajectory.bx,
    by: lift.trajectory.by,
    start: { ...lift.trajectory.start },
    end: { ...lift.trajectory.end }
  };

  const report = engine.tickMover("Lift");

  assert.equal(report.solverMode, "xpbd");
  assert.equal(lift.trajectory.ax, before.ax);
  assert.equal(lift.trajectory.ay, before.ay);
  assert.equal(lift.trajectory.bx, before.bx);
  assert.equal(lift.trajectory.by, before.by);
  assert.equal(lift.trajectory.start.type, before.start.type);
  assert.equal(lift.trajectory.start.name, before.start.name);
  assert.equal(lift.trajectory.start.x, before.start.x);
  assert.equal(lift.trajectory.start.y, before.start.y);
  assert.equal(lift.trajectory.end.type, before.end.type);
  assert.equal(lift.trajectory.end.name, before.end.name);
  assert.equal(lift.trajectory.end.x, before.end.x);
  assert.equal(lift.trajectory.end.y, before.end.y);
});

test("tool workflow can add constraints in propagation mode", () => {
  const engine = createEngineHarness();
  engine.loadPatch(loadFixturePatch("open-trio.json"));

  const before = engine.api.serializePatch().constraints.length;
  const result = engine.createConstraintWithTool("fixedDistance", ["Voice", "Bass"]);

  assert.equal(result.handled, true);
  assert.equal(result.patch.constraints.length, before + 1);
  assert.equal(result.patch.constraints.at(-1).type, "fixedDistance");
});

test("tool workflow can add constraints in xpbd mode", () => {
  const engine = createEngineHarness();
  engine.setSolverMode("xpbd");
  engine.loadPatch(loadFixturePatch("open-trio.json"));

  const before = engine.api.serializePatch().constraints.length;
  const result = engine.createConstraintWithTool("radialLimit", ["Voice"]);

  assert.equal(result.handled, true);
  assert.equal(result.patch.constraints.length, before + 1);
  assert.equal(result.patch.constraints.at(-1).type, "radialLimit");
});

test("tool workflow can add a two-source sum constraint", () => {
  const engine = createEngineHarness();
  engine.loadPatch(loadFixturePatch("open-trio.json"));

  const result = engine.createConstraintWithTool("sum", ["Voice", "Bass"]);
  const constraint = result.patch.constraints.at(-1);

  assert.equal(result.handled, true);
  assert.equal(constraint.type, "sum");
  assert.equal(JSON.stringify(constraint.sources), JSON.stringify(["Voice", "Bass"]));
});

test("tool workflow can add a product constraint with more than three sources", () => {
  const engine = createEngineHarness();
  engine.loadPatch({
    name: "Four source product",
    version: 1,
    listener: { x: 0, y: 0 },
    sources: [
      { name: "A", x: 100, y: 0 },
      { name: "B", x: 0, y: 110 },
      { name: "C", x: -120, y: 0 },
      { name: "D", x: 0, y: -130 }
    ],
    constraints: []
  });

  const result = engine.createConstraintWithTool("product", ["A", "B", "C", "D"]);
  const constraint = result.patch.constraints.at(-1);

  assert.equal(result.handled, true);
  assert.equal(constraint.type, "product");
  assert.equal(JSON.stringify(constraint.sources), JSON.stringify(["A", "B", "C", "D"]));
});

test("stop all drawing clears every trace flag without selecting objects one by one", () => {
  const engine = createEngineHarness();
  engine.loadPatch({
    name: "Trace flags",
    version: 1,
    listener: { x: 0, y: 0, drawTrace: true },
    sources: [
      { name: "A", x: 100, y: 0, drawTrace: true },
      { name: "B", x: 0, y: 100, drawTrace: false }
    ],
    movingObjects: [
      { name: "M1", x: 50, y: 50, drawTrace: true, trajectory: { type: "free" } }
    ],
    constraints: [
      {
        type: "fixedDistance",
        anchor: "A",
        target: "B",
        distance: 120,
        node: { x: 50, y: 50, drawTrace: true }
      }
    ]
  });

  const patch = engine.stopAllDrawing();

  assert.equal(patch.listener.drawTrace, false);
  assert.ok(patch.sources.every((source) => source.drawTrace === false));
  assert.ok(patch.movingObjects.every((mover) => mover.drawTrace === false));
  assert.ok(patch.constraints.every((constraint) => constraint.node.drawTrace === false));
});

test("patch validation rejects one-source sum and product constraints", () => {
  const engine = createEngineHarness();
  const findings = engine.api.validatePatch({
    name: "Bad arity",
    version: 1,
    listener: { x: 0, y: 0 },
    sources: [{ name: "A", x: 100, y: 0 }],
    constraints: [
      { type: "sum", sources: ["A"] },
      { type: "product", sources: ["A"] }
    ]
  });

  assert.equal(findings.filter((finding) => finding.message.includes("at least 2")).length, 2);
});

test("propagation and xpbd both keep representative edit scenarios finite", () => {
  const scenarios = [
    {
      file: "product-limit.json",
      moved: "A",
      x: 200,
      y: 300,
      check(engine) {
        const listener = engine.point("Listener");
        const bRadius = distance(engine.point("B"), listener);
        assert.ok(bRadius >= 59.5 && bRadius <= 130.5);
      }
    },
    {
      file: "angle-balance.json",
      moved: "D",
      x: 165,
      y: 147,
      check(engine) {
        assertFinitePoint(engine.point("B"), "B");
        assertFinitePoint(engine.point("C"), "C");
      }
    },
    {
      file: "faust-control-study.json",
      moved: "Q",
      x: 610,
      y: 455,
      check(engine) {
        assertFinitePoint(engine.point("Q"), "Q");
        assertFinitePoint(engine.point("Cutoff"), "Cutoff");
      }
    },
    {
      file: "granular-cloud-study.json",
      moved: "Spray",
      x: 665,
      y: 430,
      check(engine) {
        const listener = engine.point("Listener");
        const sprayRadius = distance(engine.point("Spray"), listener);
        assert.ok(sprayRadius >= 79.5 && sprayRadius <= 210.5);
      }
    }
  ];

  for (const scenario of scenarios) {
    const patch = loadFixturePatch(scenario.file);
    for (const mode of ["propagation", "xpbd"]) {
      const { engine, report } = runScenarioInMode(mode, patch, (candidate) =>
        candidate.move(scenario.moved, scenario.x, scenario.y)
      );

      assertFiniteReport(report);
      assert.equal(report.hitStepCap, false, `${mode} hit step cap in ${scenario.file}`);
      if (mode === "xpbd") {
        assert.equal(report.hitEntityCap, false, `xpbd hit entity cap in ${scenario.file}`);
      }
      scenario.check(engine, report, mode);
    }
  }
});

test("xpbd trajectory patches stay finite and preserve authored frames over repeated ticks", () => {
  const scenarios = [
    {
      file: "simple-rotator.json",
      movers: ["Spin"],
      watched: ["S1", "S2", "S3", "S4"],
      ticks: 24
    },
    {
      file: "nested-rotators.json",
      movers: ["Parent", "Child"],
      watched: ["Lead", "Echo", "Pad"],
      ticks: 20
    },
    {
      file: "cycloid-rotator.json",
      movers: ["Orbit", "Spin"],
      watched: ["A", "B", "C"],
      ticks: 20
    },
    {
      file: "shuttle-spin.json",
      movers: ["Lift", "Spin"],
      watched: ["Vox", "Beat", "Bass"],
      ticks: 20,
      preserveShuttle: "Lift"
    },
    {
      file: "bouncing-constellation.json",
      movers: ["Bounce", "Spin"],
      watched: ["One", "Two", "Three"],
      ticks: 20
    }
  ];

  for (const scenario of scenarios) {
    const engine = createEngineHarness();
    engine.setSolverMode("xpbd");
    engine.loadPatch(loadFixturePatch(scenario.file));
    const before = engine.points(scenario.watched);
    const shuttle = scenario.preserveShuttle ? engine.api.getObjectByName(scenario.preserveShuttle) : null;
    const shuttleFrame = shuttle ? {
      ax: shuttle.trajectory.ax,
      ay: shuttle.trajectory.ay,
      bx: shuttle.trajectory.bx,
      by: shuttle.trajectory.by,
      startName: shuttle.trajectory.start?.name,
      endName: shuttle.trajectory.end?.name
    } : null;

    const report = engine.tickMovers(scenario.movers, scenario.ticks);
    const after = engine.points(scenario.watched);

    assertFiniteReport(report);
    assert.equal(report.hitStepCap, false, `xpbd hit step cap in ${scenario.file}`);
    assert.equal(report.hitEntityCap, false, `xpbd hit entity cap in ${scenario.file}`);

    for (const [name, point] of Object.entries(after)) {
      assertFinitePoint(point, `${scenario.file}:${name}`);
      assert.ok(distance(before[name], point) < 600, `${scenario.file}:${name} moved implausibly far`);
    }

    if (shuttleFrame) {
      assert.equal(shuttle.trajectory.ax, shuttleFrame.ax);
      assert.equal(shuttle.trajectory.ay, shuttleFrame.ay);
      assert.equal(shuttle.trajectory.bx, shuttleFrame.bx);
      assert.equal(shuttle.trajectory.by, shuttleFrame.by);
      assert.equal(shuttle.trajectory.start?.name, shuttleFrame.startName);
      assert.equal(shuttle.trajectory.end?.name, shuttleFrame.endName);
    }
  }
});

test("solver comparison metrics summarize propagation and xpbd behavior", () => {
  const metrics = compareSolvers(
    loadFixturePatch("product-limit.json"),
    (engine) => engine.move("A", 200, 300),
    ["A", "B", "C"]
  );

  for (const mode of ["propagation", "xpbd"]) {
    assert.equal(typeof metrics[mode].elapsedMs, "number");
    assert.equal(typeof metrics[mode].hitEntityCap, "boolean");
    assert.equal(typeof metrics[mode].hitStepCap, "boolean");
    assert.equal(typeof metrics[mode].movedCount, "number");
    assert.equal(typeof metrics[mode].residualCount, "number");
    assert.equal(typeof metrics[mode].satisfied, "boolean");
    assert.equal(typeof metrics[mode].totalDisplacement, "number");
    assert.equal(typeof metrics[mode].worstResidual, "number");
    assert.ok(Number.isFinite(metrics[mode].elapsedMs));
    assert.ok(Number.isFinite(metrics[mode].totalDisplacement));
    assert.ok(Number.isFinite(metrics[mode].worstResidual));
  }

  assert.equal(metrics.xpbd.hitEntityCap, false);
  assert.equal(metrics.xpbd.hitStepCap, false);
});

test("solver selector reflects the active solver mode", () => {
  const engine = createEngineHarness();

  engine.setSolverMode("propagation");
  assert.equal(engine.solverMode(), "propagation");
  assert.equal(engine.solverButtonPressed("propagation"), "true");
  assert.equal(engine.solverButtonPressed("xpbd"), "false");
  engine.setSolverMode("xpbd");
  assert.equal(engine.solverMode(), "xpbd");
  assert.equal(engine.solverButtonPressed("propagation"), "false");
  assert.equal(engine.solverButtonPressed("xpbd"), "true");
  engine.clickSolverMode("propagation");
  assert.equal(engine.solverMode(), "propagation");
  assert.equal(engine.solverButtonPressed("propagation"), "true");
  assert.equal(engine.solverButtonPressed("xpbd"), "false");
  assert.equal(engine.currentHref(), "http://127.0.0.1/musicspace.html");
  engine.clickSolverMode("xpbd");
  assert.equal(engine.solverMode(), "xpbd");
  assert.equal(engine.solverButtonPressed("propagation"), "false");
  assert.equal(engine.solverButtonPressed("xpbd"), "true");
  assert.equal(engine.currentHref(), "http://127.0.0.1/musicspace.html?solver=xpbd");
});

test("solver series comparison tracks propagated sources and cpu", () => {
  const scenarios = [
    {
      name: "product-limit/A radial sweep",
      patch: loadFixturePatch("product-limit.json"),
      watched: ["A", "B", "C"],
      moves: [
        { name: "A", x: 260, y: 300 },
        { name: "A", x: 230, y: 330 },
        { name: "A", x: 200, y: 300 },
        { name: "A", x: 235, y: 260 },
        { name: "A", x: 300, y: 300 }
      ]
    },
    {
      name: "angle-balance/D diagonal",
      patch: loadFixturePatch("angle-balance.json"),
      watched: ["A", "B", "C", "D"],
      moves: Array.from({ length: 8 }, (_, index) => ({
        name: "D",
        x: 150 + index * 5,
        y: 140 + index * 4
      }))
    },
    {
      name: "granular-cloud/Spray limit pressure",
      patch: loadFixturePatch("granular-cloud-study.json"),
      watched: ["Rate", "Size", "Pitch", "Spray", "Tone", "Level"],
      moves: [
        { name: "Spray", x: 620, y: 390 },
        { name: "Spray", x: 650, y: 430 },
        { name: "Spray", x: 690, y: 455 },
        { name: "Spray", x: 580, y: 370 },
        { name: "Spray", x: 540, y: 330 }
      ]
    }
  ];
  const summaries = {};

  for (const scenario of scenarios) {
    const comparison = compareSolverMoveSeries(scenario.patch, scenario.moves, scenario.watched);
    summaries[scenario.name] = {
      propagation: {
        elapsedMs: Number(comparison.propagation.elapsedMs.toFixed(3)),
        maxStepMs: Number(comparison.propagation.maxStepMs.toFixed(3)),
        residualCount: comparison.propagation.residualCount,
        hitEntityCapCount: comparison.propagation.hitEntityCapCount,
        hitStepCapCount: comparison.propagation.hitStepCapCount,
        cumulativePathBySource: Object.fromEntries(Object.entries(comparison.propagation.cumulativePathBySource)
          .map(([name, value]) => [name, Number(value.toFixed(3))])),
        displacementBySource: Object.fromEntries(Object.entries(comparison.propagation.displacementBySource)
          .map(([name, value]) => [name, Number(value.toFixed(3))]))
      },
      xpbd: {
        elapsedMs: Number(comparison.xpbd.elapsedMs.toFixed(3)),
        maxStepMs: Number(comparison.xpbd.maxStepMs.toFixed(3)),
        residualCount: comparison.xpbd.residualCount,
        hitEntityCapCount: comparison.xpbd.hitEntityCapCount,
        hitStepCapCount: comparison.xpbd.hitStepCapCount,
        cumulativePathBySource: Object.fromEntries(Object.entries(comparison.xpbd.cumulativePathBySource)
          .map(([name, value]) => [name, Number(value.toFixed(3))])),
        displacementBySource: Object.fromEntries(Object.entries(comparison.xpbd.displacementBySource)
          .map(([name, value]) => [name, Number(value.toFixed(3))]))
      },
      finalDistanceBetweenModes: Object.fromEntries(Object.entries(comparison.finalDistanceBetweenModes)
        .map(([name, value]) => [name, Number(value.toFixed(3))]))
    };

    for (const mode of ["propagation", "xpbd"]) {
      assert.equal(comparison[mode].hitStepCapCount, 0, `${scenario.name} ${mode} hit step caps`);
      assert.ok(comparison[mode].maxStepMs < 20, `${scenario.name} ${mode} max step too slow`);
      assert.ok(Number.isFinite(comparison[mode].worstResidual));
      for (const point of Object.values(comparison[mode].after)) {
        assertFinitePoint(point, `${scenario.name}:${mode}`);
      }
    }

    assert.equal(comparison.xpbd.hitEntityCapCount, 0, `${scenario.name} xpbd hit entity caps`);
  }

  if (process.env.MUSICSPACE_PRINT_SOLVER_COMPARISON === "1") {
    console.log(JSON.stringify(summaries, null, 2));
  }
});

test("xpbd iteration sweep reports convergence and cpu tradeoffs", () => {
  const sweep = sweepXpbdIterations(
    loadFixturePatch("granular-cloud-study.json"),
    { name: "Spray", x: 690, y: 455 },
    ["Rate", "Size", "Pitch", "Spray", "Tone", "Level"],
    [4, 6, 8, 10, 16, 24, 40]
  );

  for (const row of sweep) {
    assert.ok(Number.isFinite(row.elapsedMs));
    assert.ok(Number.isFinite(row.worstResidual));
    assert.ok(Number.isFinite(row.maxDisplacement));
    assert.ok(Number.isFinite(row.nonFiniteResidualCount));
    assert.ok(row.elapsedMs < 20, `${row.iterations} iterations took ${row.elapsedMs.toFixed(3)}ms`);
  }

  assert.equal(sweep.at(-1).nonFiniteResidualCount, 0);

  if (process.env.MUSICSPACE_PRINT_XPBD_SWEEP === "1") {
    console.log(JSON.stringify(sweep.map((row) => ({
      iterations: row.iterations,
      elapsedMs: Number(row.elapsedMs.toFixed(3)),
      nonFiniteResidualCount: row.nonFiniteResidualCount,
      residualCount: row.residualCount,
      worstResidual: Number(row.worstResidual.toFixed(3)),
      maxDisplacement: Number(row.maxDisplacement.toFixed(3)),
      displacementBySource: Object.fromEntries(Object.entries(row.displacementBySource)
        .map(([name, value]) => [name, Number(value.toFixed(3))]))
    })), null, 2));
  }
});

test("xpbd release refinement improves residuals after drag-budget solve", () => {
  const engine = createEngineHarness();
  engine.setSolverMode("xpbd");
  engine.loadPatch(loadFixturePatch("granular-cloud-study.json"));

  const dragReport = engine.moveWithXpbdIterations("Spray", 690, 455, 10);
  const releaseReport = engine.refineXpbdAfterDrag("Spray");

  assert.ok(dragReport.residuals.length > 0);
  assert.equal(releaseReport.hitEntityCap, false);
  assert.equal(releaseReport.hitStepCap, false);
  assert.ok(releaseReport.residuals.length <= dragReport.residuals.length);
  assert.ok(worstResidual(releaseReport) <= worstResidual(dragReport));
});
