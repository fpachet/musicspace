// Independent target backends for MusicSpace parameter mappings.
//
// MusicSpace emits named parameter values. A target backend decides what those
// values mean: Web Audio synth parameters today, compiled Faust/MIDI/OSC later.

(function exposeMusicSpaceTargets(global) {
  const DEFAULT_TARGET_TYPE = "subtractive";
  const targetBackends = new Map();

  function registerTargetBackend(backend) {
    if (!backend || !backend.type || typeof backend.createRuntime !== "function") {
      throw new Error("Target backends need at least { type, createRuntime }.");
    }

    targetBackends.set(backend.type, {
      label: backend.label || backend.type,
      defaults: backend.defaults || {},
      defaultsForSpec: backend.defaultsForSpec || null,
      parameterConfig: backend.parameterConfig || {},
      parameterConfigForSpec: backend.parameterConfigForSpec || null,
      createRuntime: backend.createRuntime,
      hasParameter: backend.hasParameter || null,
      apply: backend.apply || (() => {}),
      setEnabled: backend.setEnabled || defaultSetEnabled,
      dispose: backend.dispose || defaultDispose,
      metadata: backend.metadata || (() => ({})),
      type: backend.type
    });
  }

  function listTargetBackends() {
    return Array.from(targetBackends.values()).map((backend) => ({
      type: backend.type,
      label: backend.label,
      parameters: Object.keys(backend.defaults),
      metadata: backend.metadata()
    }));
  }

  function normalizeTargetSpec(spec = {}) {
    const requestedType = spec?.type || DEFAULT_TARGET_TYPE;
    const type = targetBackends.has(requestedType) ? requestedType : DEFAULT_TARGET_TYPE;
    return { ...spec, type };
  }

  function createTargetController(spec, options = {}) {
    const targetSpec = normalizeTargetSpec(spec);
    const backend = targetBackends.get(targetSpec.type) || targetBackends.get(DEFAULT_TARGET_TYPE);
    const onStatus = options.onStatus || (() => {});
    let runtime = null;
    let enabled = false;
    let values = defaultsFor(backend, targetSpec);

    return {
      spec() {
        return { ...targetSpec };
      },
      metadata() {
        return {
          type: backend.type,
          label: backend.label,
          parameters: Object.keys(defaultsFor(backend, targetSpec)),
          ...backend.metadata(targetSpec)
        };
      },
      defaults() {
        return defaultsFor(backend, targetSpec);
      },
      hasParameter(target) {
        if (typeof backend.hasParameter === "function") {
          return backend.hasParameter(target, targetSpec);
        }
        return Object.prototype.hasOwnProperty.call(defaultsFor(backend, targetSpec), target);
      },
      parameterConfig(target) {
        if (typeof backend.parameterConfigForSpec === "function") {
          return backend.parameterConfigForSpec(target, targetSpec);
        }
        return backend.parameterConfig[target] || { suffix: "", digits: 2 };
      },
      isEnabled() {
        return enabled;
      },
      apply(nextValues, options = {}) {
        values = { ...defaultsFor(backend, targetSpec), ...nextValues };
        backend.apply(runtime, values, enabled, Boolean(options.immediate), targetSpec);
      },
      async setEnabled(nextEnabled) {
        const nextRuntime = ensureRuntime(runtime, backend, targetSpec, onStatus);
        if (!nextRuntime) {
          return false;
        }

        runtime = nextRuntime;
        enabled = Boolean(nextEnabled);

        try {
          await backend.setEnabled(runtime, enabled, values, targetSpec);
        } catch (error) {
          enabled = false;
          backend.apply(runtime, values, false, true, targetSpec);
          onStatus("The target backend could not be started.");
          return false;
        }

        backend.apply(runtime, values, enabled, true, targetSpec);
        return enabled;
      },
      dispose() {
        backend.dispose(runtime, targetSpec);
        runtime = null;
        enabled = false;
      }
    };
  }

  function defaultsFor(backend, targetSpec = {}) {
    if (typeof backend.defaultsForSpec === "function") {
      return backend.defaultsForSpec(targetSpec);
    }
    return { ...backend.defaults };
  }

  function ensureRuntime(runtime, backend, targetSpec, onStatus) {
    if (runtime && runtime.type === backend.type) {
      return runtime;
    }

    backend.dispose(runtime, targetSpec);

    try {
      return backend.createRuntime({ spec: targetSpec, onStatus });
    } catch (error) {
      onStatus(error.message || "The target backend could not be created.");
      return null;
    }
  }

  async function defaultSetEnabled(runtime, enabled) {
    if (!runtime?.context) {
      return;
    }

    if (enabled) {
      await runtime.context.resume();
    } else {
      await runtime.context.suspend();
    }
  }

  function defaultDispose(runtime) {
    if (runtime?.context && runtime.context.state !== "closed") {
      runtime.context.close();
    }
  }

  const SHARED_PARAMETER_CONFIG = {
    "/filter/frequency": { suffix: " Hz", digits: 0 },
    "/filter/q": { suffix: "", digits: 2 },
    "/output/gain": { suffix: "", digits: 2 }
  };

  registerTargetBackend({
    type: "subtractive",
    label: "Web Audio Subtractive",
    defaults: {
      "/osc/freq": 220,
      "/filter/frequency": 1600,
      "/filter/q": 2,
      "/output/gain": 0.12
    },
    parameterConfig: {
      "/osc/freq": { suffix: " Hz", digits: 0 },
      ...SHARED_PARAMETER_CONFIG
    },
    metadata() {
      return {
        family: "webaudio",
        description: "Local sawtooth oscillator through a resonant low-pass filter."
      };
    },
    createRuntime({ onStatus }) {
      const context = createAudioContext(onStatus);
      const oscillator = context.createOscillator();
      const filter = context.createBiquadFilter();
      const gain = context.createGain();

      oscillator.type = "sawtooth";
      filter.type = "lowpass";
      gain.gain.value = 0;
      oscillator.connect(filter);
      filter.connect(gain);
      gain.connect(context.destination);
      oscillator.start();

      return { type: "subtractive", context, oscillator, filter, gain };
    },
    apply(runtime, values, enabled, immediate = false) {
      if (!runtime) {
        return;
      }

      const { context, oscillator, filter, gain } = runtime;
      const time = context.currentTime;
      const rampTime = immediate ? 0.005 : 0.035;
      setAudioParam(oscillator.frequency, values["/osc/freq"], time, rampTime);
      applySharedFilterAndGain({ context, filter, gain }, values, enabled, immediate);
    },
    dispose(runtime) {
      if (!runtime) {
        return;
      }

      try {
        runtime.oscillator.stop();
      } catch (error) {
        // The oscillator may already be stopped if the browser is tearing down audio.
      }
      defaultDispose(runtime);
    }
  });

  registerTargetBackend({
    type: "granular",
    label: "Web Audio Granular",
    defaults: {
      "/grain/rate": 18,
      "/grain/size": 0.08,
      "/grain/pitch": 1,
      "/grain/spread": 0.25,
      "/filter/frequency": 3000,
      "/filter/q": 2,
      "/output/gain": 0.18
    },
    parameterConfig: {
      "/grain/rate": { suffix: " /s", digits: 1 },
      "/grain/size": { suffix: " s", digits: 3 },
      "/grain/pitch": { suffix: "x", digits: 2 },
      "/grain/spread": { suffix: "", digits: 2 },
      ...SHARED_PARAMETER_CONFIG
    },
    metadata() {
      return {
        family: "webaudio",
        description: "Local granular cloud with filter, compressor, and output gain."
      };
    },
    createRuntime({ onStatus }) {
      const context = createAudioContext(onStatus);
      const filter = context.createBiquadFilter();
      const compressor = context.createDynamicsCompressor();
      const gain = context.createGain();

      filter.type = "lowpass";
      compressor.threshold.value = -18;
      compressor.knee.value = 18;
      compressor.ratio.value = 4;
      compressor.attack.value = 0.006;
      compressor.release.value = 0.12;
      gain.gain.value = 0;
      filter.connect(compressor);
      compressor.connect(gain);
      gain.connect(context.destination);

      return {
        type: "granular",
        context,
        filter,
        compressor,
        gain,
        grainBuffer: createGranularBuffer(context),
        grainTimer: null,
        nextGrainTime: 0,
        getValues: () => ({})
      };
    },
    async setEnabled(runtime, enabled, values) {
      runtime.getValues = () => values;
      if (enabled) {
        await runtime.context.resume();
        startGranularScheduler(runtime, () => runtime.getValues(), () => runtime.enabled);
      } else {
        stopGranularScheduler(runtime);
        await runtime.context.suspend();
      }
      runtime.enabled = enabled;
    },
    apply(runtime, values, enabled, immediate = false) {
      if (!runtime) {
        return;
      }

      runtime.getValues = () => values;
      runtime.enabled = enabled;
      applySharedFilterAndGain(runtime, values, enabled, immediate);
    },
    dispose(runtime) {
      stopGranularScheduler(runtime);
      defaultDispose(runtime);
    }
  });

  registerTargetBackend({
    type: "midi-file",
    label: "MIDI/MusicXML File",
    metadata() {
      return {
        family: "midi",
        description: "Sequence-file playback is handled by the MusicSpace MIDI/MusicXML client."
      };
    },
    createRuntime() {
      return { type: "midi-file" };
    }
  });

  registerTargetBackend({
    type: "faust-wasm",
    label: "Faust WebAssembly",
    defaultsForSpec: faustDefaultsForSpec,
    hasParameter(target, spec) {
      const specs = faustParameterSpecs(spec);
      if (Object.keys(specs).length === 0) {
        return true;
      }
      return Object.prototype.hasOwnProperty.call(specs, target);
    },
    parameterConfigForSpec(target, spec) {
      const config = faustParameterSpecs(spec)[target] || {};
      return {
        suffix: config.unit || config.suffix || "",
        digits: Number.isInteger(config.digits) ? config.digits : 2
      };
    },
    metadata(spec = {}) {
      return {
        family: "faust",
        description: "Compiled Faust DSP loaded through a patch-provided adapter module.",
        module: spec.module || "",
        wasm: spec.wasm || "",
        json: spec.json || spec.metadata || ""
      };
    },
    createRuntime({ spec, onStatus }) {
      const context = createAudioContext(onStatus);
      return {
        type: "faust-wasm",
        context,
        controller: null,
        connected: false,
        loading: null,
        onStatus,
        values: faustDefaultsForSpec(spec)
      };
    },
    async setEnabled(runtime, enabled, values, spec) {
      runtime.values = { ...faustDefaultsForSpec(spec), ...values };
      if (enabled) {
        await runtime.context.resume();
        await ensureFaustController(runtime, spec);
        connectFaustController(runtime);
        applyFaustValues(runtime, runtime.values);
      } else {
        disconnectFaustController(runtime);
        await runtime.context.suspend();
      }
    },
    apply(runtime, values, enabled, immediate, spec) {
      if (!runtime) {
        return;
      }

      runtime.values = { ...faustDefaultsForSpec(spec), ...values };
      if (runtime.controller) {
        applyFaustValues(runtime, runtime.values);
      }
    },
    dispose(runtime) {
      if (!runtime) {
        return;
      }
      disconnectFaustController(runtime);
      destroyFaustController(runtime.controller);
      defaultDispose(runtime);
    }
  });

  function createAudioContext(onStatus) {
    const AudioContextClass = global.AudioContext || global.webkitAudioContext;
    if (!AudioContextClass) {
      throw new Error("Web Audio is not available in this browser.");
    }

    try {
      return new AudioContextClass();
    } catch (error) {
      onStatus("The browser could not create an audio context.");
      throw error;
    }
  }

  function applySharedFilterAndGain(runtime, values, enabled, immediate = false) {
    const { context, filter, gain } = runtime;
    const time = context.currentTime;
    const rampTime = immediate ? 0.005 : 0.035;
    const outputGain = enabled ? values["/output/gain"] : 0;

    setAudioParam(filter.frequency, values["/filter/frequency"], time, rampTime);
    setAudioParam(filter.Q, values["/filter/q"], time, rampTime);
    setAudioParam(gain.gain, outputGain, time, rampTime);
  }

  function setAudioParam(param, value, time, rampTime) {
    param.cancelScheduledValues(time);
    param.setTargetAtTime(value, time, rampTime);
  }

  function createGranularBuffer(context) {
    const length = context.sampleRate * 2;
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);

    for (let index = 0; index < length; index += 1) {
      const phase = index / context.sampleRate;
      const harmonic = Math.sin(phase * Math.PI * 2 * 110) * 0.45 +
        Math.sin(phase * Math.PI * 2 * 220) * 0.25 +
        Math.sin(phase * Math.PI * 2 * 330) * 0.15;
      const shimmer = (Math.random() * 2 - 1) * 0.18;
      data[index] = (harmonic + shimmer) * 0.65;
    }

    return buffer;
  }

  function faustDefaultsForSpec(spec = {}) {
    const specs = faustParameterSpecs(spec);
    return Object.fromEntries(Object.entries(specs).map(([path, config]) => [
      path,
      Number.isFinite(config.default) ? config.default : 0
    ]));
  }

  function faustParameterSpecs(spec = {}) {
    const explicit = spec.parameters || spec.params || spec.defaults || {};
    if (Array.isArray(explicit)) {
      return Object.fromEntries(explicit
        .filter((parameter) => parameter && (parameter.path || parameter.address))
        .map((parameter) => {
          const path = parameter.path || parameter.address;
          return [path, normalizeFaustParameterConfig(parameter)];
        }));
    }

    return Object.fromEntries(Object.entries(explicit)
      .filter(([path]) => path)
      .map(([path, config]) => [
        path,
        typeof config === "number"
          ? { default: config }
          : normalizeFaustParameterConfig(config)
      ]));
  }

  function normalizeFaustParameterConfig(config = {}) {
    const defaultValue = config.default ?? config.init ?? config.value;
    return {
      default: Number(defaultValue),
      min: Number(config.min),
      max: Number(config.max),
      unit: config.unit || "",
      suffix: config.suffix || "",
      digits: Number(config.digits)
    };
  }

  async function ensureFaustController(runtime, spec = {}) {
    if (runtime.controller) {
      return runtime.controller;
    }

    if (!runtime.loading) {
      runtime.loading = createFaustController(runtime, spec);
    }

    runtime.controller = await runtime.loading;
    return runtime.controller;
  }

  async function createFaustController(runtime, spec = {}) {
    if (!spec.module) {
      throw new Error("Faust targets need target.module pointing to a Faust adapter module.");
    }

    const moduleUrl = new URL(spec.module, global.location.href).href;
    const adapterModule = await import(moduleUrl);
    const createFaustNode = adapterModule.createFaustNode || adapterModule.default;

    if (typeof createFaustNode !== "function") {
      throw new Error("Faust adapter modules must export createFaustNode(context, target) or a default factory.");
    }

    const controller = normalizeFaustController(await createFaustNode(runtime.context, {
      ...spec,
      module: moduleUrl,
      wasm: spec.wasm ? new URL(spec.wasm, global.location.href).href : "",
      json: spec.json ? new URL(spec.json, global.location.href).href : "",
      metadata: spec.metadata ? new URL(spec.metadata, global.location.href).href : ""
    }));

    if (!controller.node && !controller.output) {
      throw new Error("Faust adapter did not return an AudioNode or controller object.");
    }

    runtime.onStatus(`Loaded Faust target ${spec.name || spec.module}.`);
    return controller;
  }

  function normalizeFaustController(result) {
    if (!result) {
      return {};
    }

    if (result.node || result.output || result.setParamValue) {
      return {
        ...result,
        node: result.node || result.output || null,
        output: result.output || result.node || null
      };
    }

    return {
      node: result,
      output: result
    };
  }

  function connectFaustController(runtime) {
    if (runtime.connected || !runtime.controller) {
      return;
    }

    const output = runtime.controller.output || runtime.controller.node;
    if (typeof output?.connect === "function") {
      output.connect(runtime.context.destination);
      runtime.connected = true;
    }
  }

  function disconnectFaustController(runtime) {
    if (!runtime?.connected || !runtime.controller) {
      return;
    }

    const output = runtime.controller.output || runtime.controller.node;
    if (typeof output?.disconnect === "function") {
      try {
        output.disconnect(runtime.context.destination);
      } catch (error) {
        output.disconnect();
      }
    }
    runtime.connected = false;
  }

  function applyFaustValues(runtime, values) {
    const controller = runtime.controller;
    if (!controller) {
      return;
    }

    const setterOwner = typeof controller.setParamValue === "function"
      ? controller
      : controller.node;
    const setParamValue = setterOwner?.setParamValue;

    for (const [path, value] of Object.entries(values)) {
      if (!Number.isFinite(value)) {
        continue;
      }

      if (typeof setParamValue === "function") {
        setParamValue.call(setterOwner, path, value);
      } else if (controller.parameters?.[path] instanceof AudioParam) {
        controller.parameters[path].setTargetAtTime(value, runtime.context.currentTime, 0.01);
      }
    }
  }

  function destroyFaustController(controller) {
    if (!controller) {
      return;
    }

    const destroy = controller.destroy || controller.dispose || controller.node?.destroy || controller.node?.dispose;
    if (typeof destroy === "function") {
      destroy.call(controller.destroy || controller.dispose ? controller : controller.node);
    }
  }

  function startGranularScheduler(runtime, getValues, isEnabled) {
    if (!runtime || runtime.type !== "granular" || runtime.grainTimer) {
      return;
    }

    runtime.nextGrainTime = runtime.context.currentTime + 0.02;
    scheduleGranularFrame(runtime, getValues, isEnabled);
    runtime.grainTimer = global.setInterval(() => {
      scheduleGranularFrame(runtime, getValues, isEnabled);
    }, 35);
  }

  function stopGranularScheduler(runtime) {
    if (!runtime || runtime.type !== "granular" || !runtime.grainTimer) {
      return;
    }

    global.clearInterval(runtime.grainTimer);
    runtime.grainTimer = null;
  }

  function scheduleGranularFrame(runtime, getValues, isEnabled) {
    if (!runtime || runtime.type !== "granular" || !isEnabled()) {
      return;
    }

    const values = getValues();
    const { context } = runtime;
    const rate = clamp(values["/grain/rate"] || 18, 2, 70);
    const baseInterval = 1 / rate;
    const horizon = context.currentTime + 0.14;

    if (runtime.nextGrainTime < context.currentTime) {
      runtime.nextGrainTime = context.currentTime + 0.015;
    }

    while (runtime.nextGrainTime < horizon) {
      scheduleGrain(runtime, values, runtime.nextGrainTime, rate);
      runtime.nextGrainTime += baseInterval * (0.7 + Math.random() * 0.6);
    }
  }

  function scheduleGrain(runtime, values, startTime, rate) {
    const { context, grainBuffer, filter } = runtime;
    const source = context.createBufferSource();
    const envelope = context.createGain();
    const size = clamp(values["/grain/size"] || 0.08, 0.012, 0.35);
    const pitch = clamp(values["/grain/pitch"] || 1, 0.25, 4);
    const spread = clamp(values["/grain/spread"] || 0.25, 0, 1);
    const pitchJitter = 1 + (Math.random() * 2 - 1) * spread;
    const offsetMax = Math.max(0.01, grainBuffer.duration - size);
    const offset = Math.random() * offsetMax;
    const level = clamp(0.62 / Math.sqrt(rate), 0.055, 0.2);

    source.buffer = grainBuffer;
    source.playbackRate.value = Math.max(0.05, pitch * pitchJitter);
    envelope.gain.setValueAtTime(0.0001, startTime);
    envelope.gain.linearRampToValueAtTime(level, startTime + Math.min(0.018, size * 0.3));
    envelope.gain.linearRampToValueAtTime(0.0001, startTime + size);

    source.connect(envelope);
    envelope.connect(filter);
    source.start(startTime, offset, size);
    source.stop(startTime + size + 0.03);
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  global.MusicSpaceTargets = {
    createTargetController,
    listTargetBackends,
    normalizeTargetSpec,
    registerTargetBackend
  };
})(window);
