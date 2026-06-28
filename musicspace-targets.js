// Independent target backends for MusicSpace parameter mappings.
//
// A target exposes parameter metadata, defaults, and an apply(values) method.
// MusicSpace itself should only speak through this interface.

(function exposeMusicSpaceTargets(global) {
  const TARGET_DEFAULTS = {
    subtractive: {
      "/osc/freq": 220,
      "/filter/frequency": 1600,
      "/filter/q": 2,
      "/output/gain": 0.12
    },
    granular: {
      "/grain/rate": 18,
      "/grain/size": 0.08,
      "/grain/pitch": 1,
      "/grain/spread": 0.25,
      "/filter/frequency": 3000,
      "/filter/q": 2,
      "/output/gain": 0.18
    }
  };

  const PARAMETER_CONFIG = {
    "/osc/freq": { suffix: " Hz", digits: 0 },
    "/grain/rate": { suffix: " /s", digits: 1 },
    "/grain/size": { suffix: " s", digits: 3 },
    "/grain/pitch": { suffix: "x", digits: 2 },
    "/grain/spread": { suffix: "", digits: 2 },
    "/filter/frequency": { suffix: " Hz", digits: 0 },
    "/filter/q": { suffix: "", digits: 2 },
    "/output/gain": { suffix: "", digits: 2 }
  };

  function normalizeTargetSpec(spec) {
    const type = spec?.type === "granular" ? "granular" : "subtractive";
    return { type };
  }

  function createTargetController(spec, options = {}) {
    const targetSpec = normalizeTargetSpec(spec);
    const onStatus = options.onStatus || (() => {});
    let engine = null;
    let enabled = false;
    let values = defaultsFor(targetSpec);

    return {
      spec() {
        return { ...targetSpec };
      },
      defaults() {
        return defaultsFor(targetSpec);
      },
      hasParameter(target) {
        return values[target] !== undefined;
      },
      parameterConfig(target) {
        return PARAMETER_CONFIG[target] || { suffix: "", digits: 2 };
      },
      isEnabled() {
        return enabled;
      },
      apply(nextValues, options = {}) {
        values = { ...defaultsFor(targetSpec), ...nextValues };
        applyValues(engine, targetSpec, values, enabled, Boolean(options.immediate));
      },
      async setEnabled(nextEnabled) {
        const nextEngine = ensureEngine(engine, targetSpec, onStatus);
        if (!nextEngine) {
          return false;
        }

        engine = nextEngine;
        enabled = Boolean(nextEnabled);
        applyValues(engine, targetSpec, values, enabled, true);

        if (enabled) {
          try {
            await engine.context.resume();
            startGranularScheduler(engine, () => values, () => enabled);
          } catch (error) {
            enabled = false;
            applyValues(engine, targetSpec, values, enabled, true);
            onStatus("The browser blocked audio start.");
          }
        } else {
          stopGranularScheduler(engine);
          await engine.context.suspend();
        }

        return enabled;
      },
      dispose() {
        disposeEngine(engine);
        engine = null;
        enabled = false;
      }
    };
  }

  function defaultsFor(spec) {
    return { ...(TARGET_DEFAULTS[spec.type] || TARGET_DEFAULTS.subtractive) };
  }

  function ensureEngine(engine, spec, onStatus) {
    if (engine && engine.type === spec.type) {
      return engine;
    }

    disposeEngine(engine);
    const AudioContextClass = global.AudioContext || global.webkitAudioContext;
    if (!AudioContextClass) {
      onStatus("Web Audio is not available in this browser.");
      return null;
    }

    const context = new AudioContextClass();
    return spec.type === "granular"
      ? createGranularEngine(context)
      : createSubtractiveEngine(context);
  }

  function createSubtractiveEngine(context) {
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
  }

  function createGranularEngine(context) {
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
      nextGrainTime: 0
    };
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

  function disposeEngine(engine) {
    if (!engine) {
      return;
    }

    stopGranularScheduler(engine);
    if (engine.oscillator) {
      try {
        engine.oscillator.stop();
      } catch (error) {
        // The oscillator may already be stopped if the browser is tearing down audio.
      }
    }

    if (engine.context && engine.context.state !== "closed") {
      engine.context.close();
    }
  }

  function applyValues(engine, spec, values, enabled, immediate = false) {
    if (!engine) {
      return;
    }

    const { context, filter, gain } = engine;
    const time = context.currentTime;
    const rampTime = immediate ? 0.005 : 0.035;
    const outputGain = enabled ? values["/output/gain"] : 0;

    if (spec.type === "subtractive") {
      setAudioParam(engine.oscillator.frequency, values["/osc/freq"], time, rampTime);
    }

    setAudioParam(filter.frequency, values["/filter/frequency"], time, rampTime);
    setAudioParam(filter.Q, values["/filter/q"], time, rampTime);
    setAudioParam(gain.gain, outputGain, time, rampTime);
  }

  function setAudioParam(param, value, time, rampTime) {
    param.cancelScheduledValues(time);
    param.setTargetAtTime(value, time, rampTime);
  }

  function startGranularScheduler(engine, getValues, isEnabled) {
    if (!engine || engine.type !== "granular" || engine.grainTimer) {
      return;
    }

    engine.nextGrainTime = engine.context.currentTime + 0.02;
    scheduleGranularFrame(engine, getValues, isEnabled);
    engine.grainTimer = global.setInterval(() => {
      scheduleGranularFrame(engine, getValues, isEnabled);
    }, 35);
  }

  function stopGranularScheduler(engine) {
    if (!engine || engine.type !== "granular" || !engine.grainTimer) {
      return;
    }

    global.clearInterval(engine.grainTimer);
    engine.grainTimer = null;
  }

  function scheduleGranularFrame(engine, getValues, isEnabled) {
    if (!engine || engine.type !== "granular" || !isEnabled()) {
      return;
    }

    const values = getValues();
    const { context } = engine;
    const rate = clamp(values["/grain/rate"] || 18, 2, 70);
    const baseInterval = 1 / rate;
    const horizon = context.currentTime + 0.14;

    if (engine.nextGrainTime < context.currentTime) {
      engine.nextGrainTime = context.currentTime + 0.015;
    }

    while (engine.nextGrainTime < horizon) {
      scheduleGrain(engine, values, engine.nextGrainTime, rate);
      engine.nextGrainTime += baseInterval * (0.7 + Math.random() * 0.6);
    }
  }

  function scheduleGrain(engine, values, startTime, rate) {
    const { context, grainBuffer, filter } = engine;
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
    normalizeTargetSpec
  };
})(window);
