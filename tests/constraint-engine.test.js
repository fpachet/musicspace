const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "..");

const { createEngineHarness, loadFixturePatch, runBrowserScript } = require("./helpers/engine-harness");

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

    assert.equal(
      problems.length,
      0,
      `${entry.file}: ${problems.map((finding) => finding.message).join("; ")}`
    );
  }
});

test("generic parameter mappings can snap continuous features", () => {
  const context = runBrowserScript("musicspace-mapping.js", {});
  const mappings = context.MusicSpaceMapping.normalizeMappings([
    {
      source: "Ratio",
      feature: "distance",
      target: "/mod/ratio",
      inputMin: 0,
      inputMax: 400,
      outputMin: 1,
      outputMax: 8,
      values: [1, 2, 3, 5, 8]
    },
    {
      source: "Step",
      feature: "x",
      target: "/integer/control",
      inputMin: 0,
      inputMax: 400,
      outputMin: 0,
      outputMax: 10,
      quantize: 1
    }
  ]);

  const values = context.MusicSpaceMapping.valuesForMappings({
    mappings,
    defaults: { "/mod/ratio": 1, "/integer/control": 0 },
    getEntity(name) {
      return (
        {
          Ratio: { distance: 220 },
          Step: { x: 230 }
        }[name] || null
      );
    },
    getFeature(feature, entity) {
      return entity[feature];
    }
  });

  assert.equal(values["/mod/ratio"], 5);
  assert.equal(values["/integer/control"], 6);
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
        outputMax: 100,
        values: [20, 50, 80, 100]
      }
    ]
  });

  let [effective] = generatorClient.effectiveGeneratorsForSource("Pulse");
  assert.equal(effective.pitch, 60);
  assert.equal(effective.periodMs, 1300);
  assert.equal(effective.velocity, 50);

  sourcePoint.x = 800;
  sourcePoint.y = 300;
  [effective] = generatorClient.effectiveGeneratorsForSource("Pulse");
  assert.equal(effective.pitch, 72);
  assert.equal(effective.periodMs, 1600);
});

test("additive source generators serialize and map frequency/gain", () => {
  const sourcePoint = { name: "Tone", x: 600, y: 300 };
  const listenerPoint = { name: "Listener", x: 400, y: 300 };
  const generatorContext = runBrowserScript("musicspace-generator-client.js", {});
  const generatorClient = generatorContext.MusicSpaceGeneratorClient.createGeneratorClient({
    getSource: () => sourcePoint,
    getListener: () => listenerPoint
  });

  generatorClient.loadPatch({
    sourceGenerators: [
      {
        source: "Tone",
        type: "additive-synth",
        frequencyHz: 220,
        gain: 0.16,
        partials: [
          {
            ratio: 1,
            amplitude: 1,
            amplitudeLfoHz: 0.05,
            amplitudeLfoDepth: 0.1,
            swellHz: 0.04,
            swellDepth: 0.25,
            swellShape: 2.5
          },
          {
            ratio: 2.01,
            amplitude: 0.35,
            detuneCents: 4,
            detuneLfoHz: 0.07,
            detuneLfoCents: 6,
            lfoPhase: 1.2
          },
          { ratio: 3, amplitude: 0.18 }
        ]
      }
    ],
    sourceGeneratorMappings: [
      {
        source: "Tone",
        feature: "distance",
        parameter: "frequencyHz",
        inputMin: 0,
        inputMax: 400,
        outputMin: 110,
        outputMax: 440,
        curve: "exp"
      },
      {
        source: "Tone",
        feature: "x",
        parameter: "gain",
        inputMin: 0,
        inputMax: 800,
        outputMin: 0.04,
        outputMax: 0.24
      }
    ]
  });

  const serialized = generatorClient.serialize();
  assert.equal(serialized.sourceGenerators[0].type, "additive-synth");
  assert.equal(serialized.sourceGenerators[0].partials.length, 3);
  assert.equal(serialized.sourceGenerators[0].partials[0].amplitudeLfoDepth, 0.1);
  assert.equal(serialized.sourceGenerators[0].partials[0].swellDepth, 0.25);
  assert.equal(serialized.sourceGenerators[0].partials[1].detuneLfoCents, 6);

  let [effective] = generatorClient.effectiveGeneratorsForSource("Tone");
  assert.ok(Math.abs(effective.frequencyHz - 220) < 0.001);
  assert.equal(effective.gain, 0.19);

  sourcePoint.x = 800;
  [effective] = generatorClient.effectiveGeneratorsForSource("Tone");
  assert.ok(Math.abs(effective.frequencyHz - 440) < 0.001);
  assert.equal(effective.gain, 0.24);
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
  assert.equal(state.generatorChannelDisabled, false);
  assert.equal(state.midiChannelDisabled, true);
  assert.equal(state.mutedHidden, false);
  assert.equal(state.removeDisabled, false);
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

test("source inspector edits additive synth generator parameters", () => {
  const engine = createEngineHarness();
  engine.loadPatch({
    name: "Edit Additive Generator",
    version: 1,
    listener: { x: 400, y: 300 },
    sources: [{ name: "Tone", x: 250, y: 300 }],
    sourceGenerators: [
      {
        source: "Tone",
        type: "additive-synth",
        frequencyHz: 220,
        gain: 0.2,
        attackMs: 120,
        releaseMs: 600,
        spatialization: "pan-distance",
        partials: [
          { ratio: 1, amplitude: 1 },
          { ratio: 2, amplitude: 0.4 }
        ]
      }
    ],
    constraints: []
  });

  assert.equal(engine.openSourceInspector("Tone"), true);
  const state = engine.sourceInspectorState();
  assert.equal(state.outputType, "additive-synth");
  assert.equal(state.generatorPitch, "57");
  assert.equal(state.generatorPeriod, "1000");
  assert.equal(state.generatorChannelDisabled, true);
  assert.equal(state.mutedHidden, false);
  assert.match(state.fileLabel, /Additive synth/);

  const patch = engine.setOpenSourceAdditiveGenerator({
    pitch: 60,
    velocity: 64,
    spatialization: "stereo-pan",
    muted: true
  });
  assert.equal(patch.sourceGenerators.length, 1);
  assert.equal(patch.sourceGenerators[0].type, "additive-synth");
  assert.ok(Math.abs(patch.sourceGenerators[0].frequencyHz - 261.625565) < 0.001);
  assert.ok(Math.abs(patch.sourceGenerators[0].gain - 64 / 127) < 0.001);
  assert.equal(patch.sourceGenerators[0].spatialization, "stereo-pan");
  assert.equal(patch.sourceGenerators[0].muted, true);
  assert.equal(patch.sourceGenerators[0].partials.length, 2);
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
  let state = engine.sourceInspectorState();
  assert.equal(state.loop, true);
  assert.equal(state.loopDisabled, false);
  assert.equal(state.generatorPitchDisabled, true);
  assert.equal(state.midiChannelDisabled, true);
  assert.equal(state.mutedHidden, false);
  assert.equal(state.removeDisabled, false);

  const patch = engine.setOpenSourceLoop(false);
  assert.equal(patch.sourceBindings[0].loop, false);

  engine.openSourceInspector("A");
  assert.equal(engine.sourceInspectorState().loop, false);
});

test("source inspector edits MIDI file track channel bindings", () => {
  const engine = createEngineHarness();
  engine.loadPatch({
    name: "MIDI Track Source",
    version: 1,
    listener: { x: 400, y: 300 },
    sources: [{ name: "Bass", x: 250, y: 300 }],
    target: { type: "midi-file" },
    midiFile: {
      url: "Midifiles/triojazz.mid",
      trackBindings: [{ track: "Bass", source: "Bass", channel: 2, program: 33 }]
    },
    constraints: []
  });

  assert.equal(engine.openSourceInspector("Bass"), true);
  const inspector = engine.sourceInspectorState();
  assert.equal(inspector.outputType, "midi-file");
  assert.equal(inspector.outputTypeDisabled, false);
  assert.equal(inspector.midiTrack, "Bass");
  assert.equal(inspector.midiChannel, "2");
  assert.equal(inspector.midiChannelDisabled, false);
  assert.equal(inspector.midiProgram, "33");
  assert.equal(inspector.loopDisabled, true);
  assert.equal(inspector.generatorPitchDisabled, true);
  assert.equal(inspector.mutedHidden, true);
  assert.equal(inspector.removeHidden, true);

  const patch = engine.setOpenSourceMidiTrack({ channel: 5, program: 34, isDrums: true });
  assert.equal(patch.midiFile.trackBindings[0].channel, 5);
  assert.equal(patch.midiFile.trackBindings[0].program, 34);
  assert.equal(patch.midiFile.trackBindings[0].isDrums, true);

  engine.openSourceInspector("Bass");
  const removedPatch = engine.setOpenSourceOutputType("none");
  assert.equal(removedPatch.midiFile.trackBindings.length, 0);
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
      url: "lead.mid",
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

test("patch inspector edits generic parameter mappings", () => {
  const engine = createEngineHarness();
  engine.loadPatch({
    name: "Mapping Editor",
    version: 1,
    listener: { x: 400, y: 300 },
    sources: [{ name: "A", x: 250, y: 300 }],
    constraints: []
  });

  engine.closePatchInspectorForTest();
  engine.clickInlinePatchInspector();
  assert.equal(engine.patchInspectorState().mappingCount, 0);

  const rowText = engine.addPatchMapping({
    source: "A",
    feature: "distance",
    target: "/filter/frequency",
    inputMin: 0,
    inputMax: 400,
    outputMin: 300,
    outputMax: 3000,
    curve: "exp",
    quantize: 100,
    values: [300, 600, 1200, 2400]
  });
  assert.match(rowText, /Current:/);

  const patch = engine.applyPatchMappings();
  assert.equal(patch.parameterMappings.length, 1);
  assert.equal(
    JSON.stringify(patch.parameterMappings[0]),
    JSON.stringify({
      source: "A",
      feature: "distance",
      target: "/filter/frequency",
      inputMin: 0,
      inputMax: 400,
      outputMin: 300,
      outputMax: 3000,
      curve: "exp",
      quantize: 100,
      values: [300, 600, 1200, 2400]
    })
  );
  assert.equal(engine.patchInspectorState().mappingCount, 1);
  assert.match(engine.patchInspectorState().mappingReadouts[0], /\/filter\/frequency/);
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
  assert.equal(inspector.outputTypeDisabled, false);
  assert.equal(inspector.loopDisabled, true);
  assert.equal(inspector.generatorPitchDisabled, true);
  assert.equal(inspector.midiChannelDisabled, true);
  assert.equal(inspector.mutedHidden, true);
  assert.equal(inspector.removeDisabled, true);
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
    constraints: [{ type: "radialLimit", source: "A", minDistance: 50, maxDistance: 250 }]
  });

  assert.equal(engine.openConstraintInspector(0), true);
  const state = engine.constraintInspectorState();
  assert.equal(state.hidden, false);
  assert.equal(state.labelA, "Minimum distance");
  assert.equal(state.valueA, "50");
  assert.equal(state.labelB, "Maximum distance");
  assert.equal(state.valueB, "250");

  const patch = engine.applyOpenConstraint({
    valueA: 80,
    valueB: 180,
    manualNode: true,
    nodeX: 360,
    nodeY: 220
  });
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
    constraints: [{ type: "angleSector", source: "A", centerAngle: 0, width: Math.PI / 2 }]
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
    constraints: [{ type: "radialLimit", source: "A", minDistance: 50, maxDistance: 250 }]
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
  assert.deepEqual(
    patch.sources.map((source) => source.name),
    ["Lead", "B"]
  );
  assert.equal(patch.constraints.find((constraint) => constraint.type === "radialLimit").source, "Lead");
  assert.equal(patch.constraints.find((constraint) => constraint.type === "solid").attached, "Lead");
  assert.equal(patch.sourceBindings[0].source, "Lead");
  assert.equal(patch.parameterMappings[0].source, "Lead");
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
      {
        source: "Missing",
        type: "midi-ostinato",
        pitch: 60,
        periodMs: 1200,
        durationMs: 180,
        velocity: 80,
        channel: 1
      },
      { source: "A", type: "loop", pitch: 60, periodMs: 1200, durationMs: 180, velocity: 80, channel: 1 },
      {
        source: "A",
        type: "midi-ostinato",
        pitch: 140,
        periodMs: -1,
        durationMs: 0,
        velocity: 200,
        channel: 20
      },
      {
        source: "A",
        type: "additive-synth",
        frequencyHz: 8,
        gain: 2,
        partials: [
          { ratio: -1, amplitude: 0.5, amplitudeLfoHz: -0.1, swellHz: -0.2 },
          { ratio: 2, amplitude: 1.5, amplitudeLfoDepth: 2, detuneLfoHz: -1, swellDepth: 2, swellShape: -1 }
        ]
      }
    ],
    sourceGeneratorMappings: [
      {
        source: "Missing",
        feature: "distance",
        parameter: "pitch",
        inputMin: 0,
        inputMax: 400,
        outputMin: 48,
        outputMax: 72
      },
      {
        source: "A",
        feature: "speed",
        parameter: "pitch",
        inputMin: 0,
        inputMax: 400,
        outputMin: 48,
        outputMax: 72
      },
      {
        source: "A",
        feature: "distance",
        parameter: "program",
        inputMin: 0,
        inputMax: 400,
        outputMin: 1,
        outputMax: 8
      },
      {
        source: "A",
        feature: "distance",
        parameter: "periodMs",
        inputMin: 0,
        inputMax: 400,
        outputMin: 0,
        outputMax: 1000,
        curve: "exp"
      }
    ],
    constraints: []
  });

  assert.ok(findings.some((finding) => finding.message.includes("unknown object Missing")));
  assert.ok(findings.some((finding) => finding.message.includes("Unsupported source generator type")));
  assert.ok(findings.some((finding) => finding.message.includes("sourceGenerators.pitch")));
  assert.ok(findings.some((finding) => finding.message.includes("sourceGenerators.periodMs")));
  assert.ok(findings.some((finding) => finding.message.includes("sourceGenerators.velocity")));
  assert.ok(findings.some((finding) => finding.message.includes("sourceGenerators.frequencyHz")));
  assert.ok(findings.some((finding) => finding.message.includes("sourceGenerators.gain")));
  assert.ok(findings.some((finding) => finding.message.includes("partials[0]")));
  assert.ok(findings.some((finding) => finding.message.includes("partials[1]")));
  assert.ok(findings.some((finding) => finding.message.includes("amplitudeLfoHz")));
  assert.ok(findings.some((finding) => finding.message.includes("amplitudeLfoDepth")));
  assert.ok(findings.some((finding) => finding.message.includes("detuneLfoHz")));
  assert.ok(findings.some((finding) => finding.message.includes("swellHz")));
  assert.ok(findings.some((finding) => finding.message.includes("swellDepth")));
  assert.ok(findings.some((finding) => finding.message.includes("swellShape")));
  assert.ok(
    findings.some((finding) => finding.message.includes("Unsupported source generator mapping feature"))
  );
  assert.ok(
    findings.some((finding) => finding.message.includes("Unsupported source generator mapping parameter"))
  );
  assert.ok(findings.some((finding) => finding.message.includes("Exponential source generator mapping")));
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
    movingObjects: [{ name: "M1", x: 50, y: 50, drawTrace: true, trajectory: { type: "free" } }],
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
