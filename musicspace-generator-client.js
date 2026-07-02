// Lightweight musical generators for MusicSpace sources.
//
// This client is intentionally separate from the constraint engine: the scene
// owns source geometry, while this module owns generator clocks and note output.

(function exposeMusicSpaceGeneratorClient(global) {
  const MIDI_OSTINATO_TYPE = "midi-ostinato";
  const SCHEDULE_AHEAD_SECONDS = 0.12;
  const SCHEDULER_INTERVAL_MS = 30;
  const SPATIAL_INTERVAL_MS = 60;
  const MAX_SPATIAL_DISTANCE = 360;
  const GENERATOR_PARAMETERS = new Set(["pitch", "periodMs", "durationMs", "velocity", "channel"]);
  const MAPPING_FEATURES = new Set(["x", "y", "distance", "angle"]);

  function createGeneratorClient(options = {}) {
    const onStatus = options.onStatus || (() => {});
    const getSource = options.getSource || (() => null);
    const getListener = options.getListener || (() => null);

    let generators = [];
    let generatorMappings = [];
    let enabled = false;
    let context = null;
    let midiAccess = null;
    let midiOutputs = [];
    let schedulerTimer = null;
    let spatialTimer = null;
    let activeVoices = [];

    return {
      loadPatch(patch = {}) {
        stop();
        generators = normalizeGenerators(patch.sourceGenerators || []);
        generatorMappings = normalizeGeneratorMappings(patch.sourceGeneratorMappings || []);
      },
      serialize() {
        return {
          ...(generators.length > 0 ? { sourceGenerators: generators.map(serializeGenerator) } : {}),
          ...(generatorMappings.length > 0 ? { sourceGeneratorMappings: generatorMappings.map(serializeGeneratorMapping) } : {})
        };
      },
      generatorsForSource(sourceName) {
        return generators.filter((generator) => generator.source === sourceName).map(serializeGenerator);
      },
      mappingsForSource(sourceName) {
        return generatorMappings.filter((mapping) => mapping.source === sourceName).map(serializeGeneratorMapping);
      },
      effectiveGeneratorsForSource(sourceName) {
        return generators
          .filter((generator) => generator.source === sourceName)
          .map((generator) => serializeGenerator(generatorWithMappings(generator)));
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
        const normalized = normalizeGenerator(generator);
        if (!normalized) {
          return null;
        }
        generators = generators.filter((candidate) => candidate.source !== normalized.source);
        generators.push({ ...normalized, nextAt: enabled ? clockSeconds() + 0.04 : 0 });
        return serializeGenerator(normalized);
      },
      setMappingsForSource(sourceName, mappings) {
        const normalizedMappings = normalizeGeneratorMappings(
          Array.isArray(mappings)
            ? mappings.map((mapping) => ({ ...mapping, source: sourceName }))
            : []
        );
        generatorMappings = [
          ...generatorMappings.filter((mapping) => mapping.source !== sourceName),
          ...normalizedMappings
        ];
        return normalizedMappings.map(serializeGeneratorMapping);
      },
      toggleSourceMuted(sourceName) {
        let updated = null;
        generators = generators.map((generator) => {
          if (generator.source !== sourceName) {
            return generator;
          }
          updated = { ...generator, muted: !generator.muted };
          return updated;
        });
        return updated ? serializeGenerator(updated) : null;
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
        if (enabled) {
          stop();
        }
        enabled = Boolean(nextEnabled) && generators.length > 0;
        if (!enabled) {
          stop();
          return false;
        }

        const canPlay = await ensureOutputsForGenerators();
        if (!canPlay) {
          enabled = false;
          return false;
        }

        if (context?.resume) {
          await context.resume();
        }
        const startAt = clockSeconds() + 0.04;
        generators = generators.map((generator, index) => ({
          ...generator,
          nextAt: startAt + index * 0.035
        }));
        schedulerTimer = global.setInterval(scheduleDueNotes, SCHEDULER_INTERVAL_MS);
        spatialTimer = global.setInterval(updateSpatial, SPATIAL_INTERVAL_MS);
        scheduleDueNotes();
        updateSpatial();
        onStatus("Source generators playing.");
        return true;
      },
      async availableMidiOutputs() {
        await refreshMidiOutputs();
        return midiOutputs.map(serializeMidiOutput);
      },
      updateSpatial
    };

    function stop() {
      if (schedulerTimer) {
        global.clearInterval(schedulerTimer);
        schedulerTimer = null;
      }
      if (spatialTimer) {
        global.clearInterval(spatialTimer);
        spatialTimer = null;
      }
      for (const voice of activeVoices) {
        stopVoice(voice);
      }
      activeVoices = [];
      enabled = false;
    }

    function normalizeGenerators(nextGenerators) {
      if (!Array.isArray(nextGenerators)) {
        return [];
      }

      return nextGenerators.map(normalizeGenerator).filter(Boolean);
    }

    function normalizeGenerator(generator) {
      if (!generator || typeof generator !== "object") {
        return null;
      }
      if (generator.type !== MIDI_OSTINATO_TYPE) {
        return null;
      }
      if (typeof generator.source !== "string" || generator.source.trim() === "") {
        return null;
      }

      return {
        source: generator.source,
        type: MIDI_OSTINATO_TYPE,
        pitch: clampInteger(generator.pitch, 0, 127, 60),
        periodMs: clampNumber(generator.periodMs, 40, 60000, 1000),
        durationMs: clampNumber(generator.durationMs, 10, 10000, 160),
        velocity: clampInteger(generator.velocity, 1, 127, 80),
        channel: clampInteger(generator.channel, 1, 16, 1),
        muted: Boolean(generator.muted),
        waveform: ["sine", "triangle", "sawtooth", "square"].includes(generator.waveform) ? generator.waveform : "triangle",
        outputMode: generator.outputMode === "external" ? "external" : "internal",
        outputId: typeof generator.outputId === "string" ? generator.outputId : "",
        outputName: typeof generator.outputName === "string" ? generator.outputName : "",
        spatialization: generator.spatialization === "stereo-pan" ? "stereo-pan" : "pan-distance",
        nextAt: 0
      };
    }

    function normalizeGeneratorMappings(nextMappings) {
      if (!Array.isArray(nextMappings)) {
        return [];
      }

      return nextMappings.map(normalizeGeneratorMapping).filter(Boolean);
    }

    function normalizeGeneratorMapping(mapping) {
      if (!mapping || typeof mapping !== "object") {
        return null;
      }
      if (typeof mapping.source !== "string" || mapping.source.trim() === "") {
        return null;
      }
      const parameter = mapping.parameter || mapping.target;
      if (!GENERATOR_PARAMETERS.has(parameter) || !MAPPING_FEATURES.has(mapping.feature)) {
        return null;
      }

      return {
        source: mapping.source,
        feature: mapping.feature,
        parameter,
        inputMin: finiteNumber(mapping.inputMin, 0),
        inputMax: finiteNumber(mapping.inputMax, 1),
        outputMin: finiteNumber(mapping.outputMin, 0),
        outputMax: finiteNumber(mapping.outputMax, 1),
        curve: mapping.curve === "exp" ? "exp" : "linear"
      };
    }

    function serializeGenerator(generator) {
      return {
        source: generator.source,
        type: generator.type,
        pitch: generator.pitch,
        periodMs: generator.periodMs,
        durationMs: generator.durationMs,
        velocity: generator.velocity,
        channel: generator.channel,
        muted: generator.muted,
        waveform: generator.waveform,
        outputMode: generator.outputMode,
        outputId: generator.outputId,
        outputName: generator.outputName,
        spatialization: generator.spatialization
      };
    }

    function serializeGeneratorMapping(mapping) {
      return { ...mapping };
    }

    async function ensureOutputsForGenerators() {
      const activeGenerators = generators.filter((generator) => !generator.muted);
      const needsInternal = activeGenerators.some((generator) => generator.outputMode !== "external");
      const needsExternal = activeGenerators.some((generator) => generator.outputMode === "external");

      if (needsInternal) {
        await ensureContext();
        if (!context) {
          return false;
        }
      }
      if (needsExternal) {
        await refreshMidiOutputs();
        if (midiOutputs.length === 0) {
          onStatus("No external MIDI output is available for source generators.");
          return Boolean(context);
        }
      }

      return needsInternal || (needsExternal && midiOutputs.length > 0) || generators.length > 0;
    }

    async function ensureContext() {
      if (context) {
        return context;
      }

      const AudioContextClass = global.AudioContext || global.webkitAudioContext;
      if (!AudioContextClass) {
        onStatus("Web Audio is not available in this browser.");
        return null;
      }

      context = new AudioContextClass();
      return context;
    }

    async function refreshMidiOutputs() {
      if (!global.navigator?.requestMIDIAccess) {
        midiOutputs = [];
        return midiOutputs;
      }

      try {
        midiAccess = midiAccess || await global.navigator.requestMIDIAccess();
        midiOutputs = Array.from(midiAccess.outputs.values());
      } catch (error) {
        midiOutputs = [];
        onStatus("Web MIDI outputs are not available.");
      }
      return midiOutputs;
    }

    function scheduleDueNotes() {
      if (!enabled) {
        return;
      }

      const now = clockSeconds();
      const horizon = now + SCHEDULE_AHEAD_SECONDS;
      generators = generators.map((generator) => {
        const effectiveGenerator = generatorWithMappings(generator);
        let nextAt = generator.nextAt || now;
        while (nextAt <= horizon) {
          if (!effectiveGenerator.muted && getSource(effectiveGenerator.source)) {
            scheduleNote(effectiveGenerator, nextAt);
          }
          nextAt += effectiveGenerator.periodMs / 1000;
        }
        return { ...generator, nextAt };
      });
    }

    function generatorWithMappings(generator) {
      const mappings = generatorMappings.filter((mapping) => mapping.source === generator.source);
      if (mappings.length === 0) {
        return generator;
      }

      const source = getSource(generator.source);
      if (!source) {
        return generator;
      }

      return mappings.reduce((nextGenerator, mapping) => {
        const featureValue = generatorFeatureValue(mapping.feature, source);
        if (!Number.isFinite(featureValue)) {
          return nextGenerator;
        }
        const mappedValue = mappedGeneratorValue(mapping, featureValue);
        return {
          ...nextGenerator,
          [mapping.parameter]: normalizeGeneratorParameter(mapping.parameter, mappedValue, nextGenerator[mapping.parameter])
        };
      }, generator);
    }

    function generatorFeatureValue(feature, source) {
      const listener = getListener();
      if (feature === "x") {
        return source.x;
      }
      if (feature === "y") {
        return source.y;
      }
      if (feature === "angle") {
        return listener ? Math.atan2(source.y - listener.y, source.x - listener.x) : 0;
      }
      return listener ? Math.hypot(source.x - listener.x, source.y - listener.y) : 0;
    }

    function mappedGeneratorValue(mapping, value) {
      if (mapping.inputMin === mapping.inputMax) {
        return mapping.outputMin;
      }
      const low = Math.min(mapping.inputMin, mapping.inputMax);
      const high = Math.max(mapping.inputMin, mapping.inputMax);
      const normalized = clamp((value - low) / Math.max(0.000001, high - low), 0, 1);
      const t = mapping.inputMin <= mapping.inputMax ? normalized : 1 - normalized;

      if (mapping.curve === "exp" && mapping.outputMin > 0 && mapping.outputMax > 0) {
        const logMin = Math.log(mapping.outputMin);
        const logMax = Math.log(mapping.outputMax);
        return Math.exp(logMin + (logMax - logMin) * t);
      }

      return mapping.outputMin + (mapping.outputMax - mapping.outputMin) * t;
    }

    function normalizeGeneratorParameter(parameter, value, fallback) {
      if (parameter === "pitch") {
        return clamp(Math.round(value), 0, 127);
      }
      if (parameter === "velocity") {
        return clamp(Math.round(value), 1, 127);
      }
      if (parameter === "channel") {
        return clamp(Math.round(value), 1, 16);
      }
      if (parameter === "periodMs") {
        return clampNumber(value, 40, 60000, fallback);
      }
      if (parameter === "durationMs") {
        return clampNumber(value, 10, 10000, fallback);
      }
      return fallback;
    }

    function scheduleNote(generator, startTime) {
      if (generator.outputMode === "external") {
        scheduleExternalNote(generator, startTime);
        return;
      }
      if (!context) {
        return;
      }

      const oscillator = context.createOscillator();
      const envelope = context.createGain();
      const panNode = context.createStereoPanner ? context.createStereoPanner() : null;
      const destination = panNode || context.destination;
      const spatial = spatialValuesForSource(getSource(generator.source), generator.spatialization);
      const durationSeconds = Math.max(0.01, generator.durationMs / 1000);
      const peak = (generator.velocity / 127) * 0.18 * spatial.gain;

      oscillator.type = generator.waveform;
      oscillator.frequency.setValueAtTime(midiToFrequency(generator.pitch), startTime);
      envelope.gain.setValueAtTime(0.0001, startTime);
      envelope.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak), startTime + 0.012);
      envelope.gain.exponentialRampToValueAtTime(0.0001, startTime + durationSeconds);
      if (panNode) {
        panNode.pan.setValueAtTime(spatial.pan, startTime);
      }

      oscillator.connect(envelope);
      envelope.connect(destination);
      if (panNode) {
        panNode.connect(context.destination);
        captureConnect(context, panNode);
      } else {
        captureConnect(context, envelope);
      }
      oscillator.start(startTime);
      oscillator.stop(startTime + durationSeconds + 0.02);

      const voice = { source: generator.source, envelope, panNode, stopped: false };
      activeVoices.push(voice);
      oscillator.addEventListener?.("ended", () => {
        activeVoices = activeVoices.filter((candidate) => candidate !== voice);
      });
    }

    function scheduleExternalNote(generator, startTime) {
      const output = midiOutputForGenerator(generator);
      if (!output) {
        return;
      }

      const channelIndex = clampInteger(generator.channel, 1, 16, 1) - 1;
      const pitch = clampInteger(generator.pitch, 0, 127, 60);
      const velocity = clampInteger(generator.velocity, 1, 127, 80);
      const noteDelay = Math.max(0, (startTime - clockSeconds()) * 1000);
      const offDelay = noteDelay + Math.max(10, generator.durationMs);
      const voice = {
        source: generator.source,
        external: true,
        output,
        pitch,
        channelIndex,
        timeoutIds: [],
        noteStarted: false,
        stopped: false
      };

      const noteOnTimer = global.setTimeout(() => {
        if (voice.stopped) {
          return;
        }
        try {
          output.send([0x90 + channelIndex, pitch, velocity]);
          voice.noteStarted = true;
        } catch (error) {
          // MIDI outputs can disappear while a patch is playing.
        }
      }, noteDelay);
      const noteOffTimer = global.setTimeout(() => {
        if (voice.stopped) {
          return;
        }
        try {
          output.send([0x80 + channelIndex, pitch, 0]);
        } catch (error) {
          // Best effort for transient MIDI devices.
        }
        voice.stopped = true;
        activeVoices = activeVoices.filter((candidate) => candidate !== voice);
      }, offDelay);

      voice.timeoutIds.push(noteOnTimer, noteOffTimer);
      activeVoices.push(voice);
    }

    function stopVoice(voice) {
      if (voice.stopped) {
        return;
      }
      voice.stopped = true;
      if (voice.external) {
        for (const timeoutId of voice.timeoutIds || []) {
          global.clearTimeout(timeoutId);
        }
        if (voice.noteStarted) {
          try {
            voice.output?.send?.([0x80 + voice.channelIndex, voice.pitch, 0]);
          } catch (error) {
            // Best-effort MIDI cleanup; the output may have disappeared.
          }
        }
        return;
      }
      try {
        voice.envelope?.gain?.cancelScheduledValues?.(context?.currentTime || 0);
        voice.envelope?.gain?.setTargetAtTime?.(0.0001, context?.currentTime || 0, 0.01);
      } catch (error) {
        // Best-effort cleanup for browser audio nodes.
      }
    }

    function captureConnect(context, node) {
      global.MusicSpaceAudioCapture?.connect?.(context, node);
    }

    function updateSpatial() {
      if (!enabled || !context || activeVoices.length === 0) {
        return;
      }

      for (const voice of activeVoices) {
        if (voice.external) {
          continue;
        }
        const generator = generators.find((candidate) => candidate.source === voice.source);
        const spatial = spatialValuesForSource(getSource(voice.source), generator?.spatialization);
        voice.panNode?.pan?.setTargetAtTime?.(spatial.pan, context.currentTime, 0.04);
      }
    }

    function spatialValuesForSource(source, spatialization = "pan-distance") {
      const listener = getListener();
      if (!source || !listener) {
        return { pan: 0, gain: 0.8 };
      }

      const dx = source.x - listener.x;
      const dy = source.y - listener.y;
      const distance = Math.hypot(dx, dy);
      const normalizedDistance = clamp(distance / MAX_SPATIAL_DISTANCE, 0, 1);
      const pan = clamp(dx / (MAX_SPATIAL_DISTANCE * 0.85), -1, 1);
      const gain = spatialization === "stereo-pan"
        ? 0.85
        : clamp(1 - normalizedDistance * 0.72 - Math.max(0, dy) / 600 * 0.12, 0.16, 1);

      return { pan, gain };
    }

    function midiOutputForGenerator(generator) {
      if (midiOutputs.length === 0) {
        return null;
      }
      return midiOutputs.find((output) => output.id === generator.outputId)
        || midiOutputs.find((output) => output.name === generator.outputName)
        || midiOutputs[0];
    }

    function serializeMidiOutput(output) {
      return {
        id: output.id || output.name || "",
        name: output.name || output.id || "MIDI output"
      };
    }

    function clockSeconds() {
      if (context) {
        return context.currentTime;
      }
      const performanceNow = global.performance?.now?.();
      if (Number.isFinite(performanceNow)) {
        return performanceNow / 1000;
      }
      return Date.now() / 1000;
    }
  }

  function midiToFrequency(pitch) {
    return 440 * Math.pow(2, (pitch - 69) / 12);
  }

  function clampNumber(value, min, max, fallback) {
    const number = Number(value);
    if (!Number.isFinite(number)) {
      return fallback;
    }
    return clamp(number, min, max);
  }

  function finiteNumber(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function clampInteger(value, min, max, fallback) {
    const number = Number(value);
    if (!Number.isInteger(number)) {
      return fallback;
    }
    return clamp(number, min, max);
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  global.MusicSpaceGeneratorClient = {
    createGeneratorClient
  };
})(globalThis);
