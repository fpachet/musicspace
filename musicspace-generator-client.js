// Lightweight musical generators for MusicSpace sources.
//
// This client is intentionally separate from the constraint engine: the scene
// owns source geometry, while this module owns generator clocks and note output.

(function exposeMusicSpaceGeneratorClient(global) {
  const MIDI_OSTINATO_TYPE = "midi-ostinato";
  const ADDITIVE_SYNTH_TYPE = "additive-synth";
  const SCHEDULE_AHEAD_SECONDS = 0.12;
  const SCHEDULER_INTERVAL_MS = 30;
  const SPATIAL_INTERVAL_MS = 60;
  const MAX_SPATIAL_DISTANCE = 360;
  const GENERATOR_PARAMETERS = new Set(["pitch", "periodMs", "durationMs", "velocity", "channel", "frequencyHz", "gain"]);
  const MAPPING_FEATURES = new Set(["x", "y", "distance", "angle"]);
  const DEFAULT_ADDITIVE_PARTIALS = [
    { ratio: 1, amplitude: 1, amplitudeLfoHz: 0.05, amplitudeLfoDepth: 0.06 },
    { ratio: 2, amplitude: 0.42, detuneCents: 1.5, detuneLfoHz: 0.04, detuneLfoCents: 3 },
    { ratio: 3, amplitude: 0.24, detuneCents: -2, amplitudeLfoHz: 0.07, amplitudeLfoDepth: 0.1 },
    { ratio: 5, amplitude: 0.12, detuneLfoHz: 0.03, detuneLfoCents: 5 },
    { ratio: 8, amplitude: 0.07, detuneCents: 3, amplitudeLfoHz: 0.09, amplitudeLfoDepth: 0.16 }
  ];

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
        startSustainedGenerators(startAt);
        if (generators.some((generator) => generator.type === MIDI_OSTINATO_TYPE && !generator.muted)) {
          schedulerTimer = global.setInterval(scheduleDueNotes, SCHEDULER_INTERVAL_MS);
        }
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
      if (typeof generator.source !== "string" || generator.source.trim() === "") {
        return null;
      }

      if (generator.type === MIDI_OSTINATO_TYPE) {
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

      if (generator.type === ADDITIVE_SYNTH_TYPE) {
        const frequencyHz = clampNumber(
          generator.frequencyHz ?? midiToFrequency(clampInteger(generator.pitch, 0, 127, 57)),
          20,
          16000,
          220
        );
        const partials = normalizePartials(generator.partials);
        return {
          source: generator.source,
          type: ADDITIVE_SYNTH_TYPE,
          frequencyHz,
          pitch: clamp(Math.round(frequencyToMidi(frequencyHz)), 0, 127),
          gain: clampNumber(generator.gain ?? Number(generator.velocity) / 127, 0, 1, 0.18),
          attackMs: clampNumber(generator.attackMs, 1, 5000, 90),
          releaseMs: clampNumber(generator.releaseMs, 1, 10000, 450),
          muted: Boolean(generator.muted),
          spatialization: generator.spatialization === "stereo-pan" ? "stereo-pan" : "pan-distance",
          partials,
          nextAt: 0
        };
      }

      return null;
    }

    function normalizePartials(partials) {
      const normalized = Array.isArray(partials)
        ? partials.map(normalizePartial).filter(Boolean)
        : [];
      return (normalized.length > 0 ? normalized : DEFAULT_ADDITIVE_PARTIALS).slice(0, 32).map(normalizePartial).filter(Boolean);
    }

    function normalizePartial(partial, index = 0) {
      if (!partial || typeof partial !== "object") {
        return null;
      }
      const ratio = clampNumber(partial.ratio ?? partial.frequencyRatio, 0.01, 64, index + 1);
      const frequencyHz = partial.frequencyHz === undefined
        ? null
        : clampNumber(partial.frequencyHz, 20, 16000, null);
      return {
        ratio,
        ...(frequencyHz ? { frequencyHz } : {}),
        amplitude: clampNumber(partial.amplitude, 0, 1, 1 / Math.max(1, ratio)),
        detuneCents: clampNumber(partial.detuneCents, -4800, 4800, 0),
        amplitudeLfoHz: clampNumber(partial.amplitudeLfoHz, 0, 40, 0),
        amplitudeLfoDepth: clampNumber(partial.amplitudeLfoDepth, 0, 1, 0),
        detuneLfoHz: clampNumber(partial.detuneLfoHz, 0, 40, 0),
        detuneLfoCents: clampNumber(partial.detuneLfoCents, 0, 4800, 0),
        swellHz: clampNumber(partial.swellHz, 0, 20, 0),
        swellDepth: clampNumber(partial.swellDepth, 0, 1, 0),
        swellShape: clampNumber(partial.swellShape, 0.25, 8, 2),
        lfoPhase: clampNumber(partial.lfoPhase, -Math.PI * 2, Math.PI * 2, 0)
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
        curve: mapping.curve === "exp" ? "exp" : "linear",
        ...(finitePositive(mapping.quantize) ? { quantize: Number(mapping.quantize) } : {}),
        ...(finiteValues(mapping.values).length > 0 ? { values: finiteValues(mapping.values) } : {})
      };
    }

    function serializeGenerator(generator) {
      if (generator.type === ADDITIVE_SYNTH_TYPE) {
        return {
          source: generator.source,
          type: generator.type,
          frequencyHz: generator.frequencyHz,
          gain: generator.gain,
          attackMs: generator.attackMs,
          releaseMs: generator.releaseMs,
          muted: generator.muted,
          spatialization: generator.spatialization,
          partials: generator.partials.map((partial) => ({ ...partial }))
        };
      }

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
      const needsInternal = activeGenerators.some((generator) => (
        generator.type === ADDITIVE_SYNTH_TYPE || generator.outputMode !== "external"
      ));
      const needsExternal = activeGenerators.some((generator) => (
        generator.type === MIDI_OSTINATO_TYPE && generator.outputMode === "external"
      ));

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
        if (generator.type !== MIDI_OSTINATO_TYPE) {
          return generator;
        }
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
        const normalizedValue = normalizeGeneratorParameter(mapping.parameter, mappedValue, nextGenerator[mapping.parameter]);
        if (mapping.parameter === "pitch" && nextGenerator.type === ADDITIVE_SYNTH_TYPE) {
          return {
            ...nextGenerator,
            pitch: normalizedValue,
            frequencyHz: midiToFrequency(normalizedValue)
          };
        }
        if (mapping.parameter === "frequencyHz" && nextGenerator.type === ADDITIVE_SYNTH_TYPE) {
          return {
            ...nextGenerator,
            frequencyHz: normalizedValue,
            pitch: clamp(Math.round(frequencyToMidi(normalizedValue)), 0, 127)
          };
        }
        return {
          ...nextGenerator,
          [mapping.parameter]: normalizedValue
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
        return snappedMappingValue(mapping, mapping.outputMin);
      }
      const low = Math.min(mapping.inputMin, mapping.inputMax);
      const high = Math.max(mapping.inputMin, mapping.inputMax);
      const normalized = clamp((value - low) / Math.max(0.000001, high - low), 0, 1);
      const t = mapping.inputMin <= mapping.inputMax ? normalized : 1 - normalized;

      let mappedValue;
      if (mapping.curve === "exp" && mapping.outputMin > 0 && mapping.outputMax > 0) {
        const logMin = Math.log(mapping.outputMin);
        const logMax = Math.log(mapping.outputMax);
        mappedValue = Math.exp(logMin + (logMax - logMin) * t);
      } else {
        mappedValue = mapping.outputMin + (mapping.outputMax - mapping.outputMin) * t;
      }

      return snappedMappingValue(mapping, mappedValue);
    }

    function snappedMappingValue(mapping, value) {
      const outputLow = Math.min(mapping.outputMin, mapping.outputMax);
      const outputHigh = Math.max(mapping.outputMin, mapping.outputMax);

      if (Array.isArray(mapping.values) && mapping.values.length > 0) {
        const nearest = mapping.values.reduce((best, candidate) => (
          Math.abs(candidate - value) < Math.abs(best - value) ? candidate : best
        ), mapping.values[0]);
        return clamp(nearest, outputLow, outputHigh);
      }

      if (finitePositive(mapping.quantize)) {
        const step = Number(mapping.quantize);
        return clamp(Math.round(value / step) * step, outputLow, outputHigh);
      }

      return value;
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
      if (parameter === "frequencyHz") {
        return clampNumber(value, 20, 16000, fallback);
      }
      if (parameter === "gain") {
        return clampNumber(value, 0, 1, fallback);
      }
      return fallback;
    }

    function startSustainedGenerators(startAt) {
      for (const generator of generators) {
        const effectiveGenerator = generatorWithMappings(generator);
        if (
          effectiveGenerator.type === ADDITIVE_SYNTH_TYPE
          && !effectiveGenerator.muted
          && getSource(effectiveGenerator.source)
        ) {
          startAdditiveVoice(effectiveGenerator, startAt);
        }
      }
    }

    function startAdditiveVoice(generator, startTime) {
      if (!context) {
        return;
      }

      const panNode = context.createStereoPanner ? context.createStereoPanner() : null;
      const outputGain = context.createGain();
      const destination = panNode || context.destination;
      const spatial = spatialValuesForSource(getSource(generator.source), generator.spatialization);
      const targetGain = additiveOutputGain(generator, spatial);
      const partialNodes = [];

      outputGain.gain.setValueAtTime(0.0001, startTime);
      outputGain.gain.linearRampToValueAtTime(Math.max(0.0001, targetGain), startTime + generator.attackMs / 1000);
      if (panNode) {
        panNode.pan.setValueAtTime(spatial.pan, startTime);
      }

      for (const partial of generator.partials) {
        const oscillator = context.createOscillator();
        const partialGain = context.createGain();
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(partialFrequency(generator, partial, startTime), startTime);
        partialGain.gain.setValueAtTime(partialAmplitude(partial, startTime), startTime);
        oscillator.connect(partialGain);
        partialGain.connect(outputGain);
        oscillator.start(startTime);
        partialNodes.push({ oscillator, gain: partialGain, partial });
      }

      outputGain.connect(destination);
      if (panNode) {
        panNode.connect(context.destination);
        captureConnect(context, panNode);
      } else {
        captureConnect(context, outputGain);
      }

      activeVoices.push({
        source: generator.source,
        type: ADDITIVE_SYNTH_TYPE,
        outputGain,
        panNode,
        partialNodes,
        stopped: false
      });
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
        const now = context?.currentTime || 0;
        const gainParam = voice.outputGain?.gain || voice.envelope?.gain;
        gainParam?.cancelScheduledValues?.(now);
        gainParam?.setTargetAtTime?.(0.0001, now, 0.01);
        for (const partialNode of voice.partialNodes || []) {
          partialNode.oscillator?.stop?.(now + 0.12);
        }
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
        const effectiveGenerator = generator ? generatorWithMappings(generator) : null;
        const spatial = spatialValuesForSource(getSource(voice.source), effectiveGenerator?.spatialization);
        voice.panNode?.pan?.setTargetAtTime?.(spatial.pan, context.currentTime, 0.04);
        if (voice.type === ADDITIVE_SYNTH_TYPE && effectiveGenerator) {
          updateAdditiveVoice(voice, effectiveGenerator, spatial);
        }
      }
    }

    function updateAdditiveVoice(voice, generator, spatial) {
      const now = context.currentTime;
      voice.outputGain?.gain?.setTargetAtTime?.(additiveOutputGain(generator, spatial), now, 0.08);
      for (let index = 0; index < voice.partialNodes.length; index += 1) {
        const partialNode = voice.partialNodes[index];
        const partial = generator.partials[index];
        if (!partial) {
          partialNode.gain?.gain?.setTargetAtTime?.(0.0001, now, 0.04);
          continue;
        }
        partialNode.oscillator?.frequency?.setTargetAtTime?.(partialFrequency(generator, partial, now), now, 0.08);
        partialNode.gain?.gain?.setTargetAtTime?.(partialAmplitude(partial, now), now, 0.08);
      }
    }

    function additiveOutputGain(generator, spatial) {
      return clamp(generator.gain * 0.5 * spatial.gain, 0.0001, 0.8);
    }

    function partialFrequency(generator, partial, time = 0) {
      const baseFrequency = Number.isFinite(partial.frequencyHz)
        ? partial.frequencyHz
        : generator.frequencyHz * partial.ratio;
      const detune = partial.detuneCents + lfoValue(time, partial.detuneLfoHz, partial.detuneLfoCents, partial.lfoPhase);
      return clamp(baseFrequency * Math.pow(2, detune / 1200), 20, 20000);
    }

    function partialAmplitude(partial, time = 0) {
      const movement = lfoValue(time, partial.amplitudeLfoHz, partial.amplitudeLfoDepth, partial.lfoPhase);
      const swell = swellValue(time, partial.swellHz, partial.swellDepth, partial.swellShape, partial.lfoPhase);
      return clamp(partial.amplitude * (1 + movement) * swell, 0.0001, 1);
    }

    function lfoValue(time, frequencyHz = 0, depth = 0, phase = 0) {
      if (!frequencyHz || !depth) {
        return 0;
      }
      return Math.sin(time * Math.PI * 2 * frequencyHz + phase) * depth;
    }

    function swellValue(time, frequencyHz = 0, depth = 0, shape = 2, phase = 0) {
      if (!frequencyHz || !depth) {
        return 1;
      }
      const unipolar = (Math.sin(time * Math.PI * 2 * frequencyHz + phase) + 1) / 2;
      const shaped = Math.pow(unipolar, shape);
      return 1 - depth + shaped * depth;
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

  function frequencyToMidi(frequencyHz) {
    return 69 + 12 * Math.log2(frequencyHz / 440);
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

    function finitePositive(value) {
      return Number.isFinite(Number(value)) && Number(value) > 0;
    }

    function finiteValues(values) {
      return Array.isArray(values)
        ? values.map(Number).filter((value) => Number.isFinite(value))
        : [];
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
