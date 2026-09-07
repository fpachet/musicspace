const assert = require("node:assert/strict");
const test = require("node:test");
const { runBrowserScript } = require("./helpers/engine-harness");
const { deferred, createAudioHarness } = require("./helpers/audio-harness");
const geometry = { getSource: () => ({ x: 200, y: 250 }), getListener: () => ({ x: 400, y: 300 }) };
const generator = {
  source: "A",
  type: "midi-ostinato",
  pitch: 60,
  periodMs: 500,
  durationMs: 100,
  velocity: 80,
  channel: 1
};
const binding = (source, url) => ({ source, type: "audio-file", url });
const settle = async () => {
  for (let i = 0; i < 12; i += 1) await Promise.resolve();
};

test("audio decodes concurrently, starts together with mute applied, and reuses buffers", async () => {
  const requests = new Map([
    ["a.wav", deferred()],
    ["b.wav", deferred()]
  ]);
  const fetched = [];
  let decodes = 0;
  const audio = createAudioHarness({
    decode: () => {
      decodes += 1;
      return {};
    }
  });
  const context = runBrowserScript("musicspace-source-audio-client.js", {
    ...audio.globals,
    fetch: async (url) => {
      fetched.push(url);
      await requests.get(url).promise;
      return { ok: true, arrayBuffer: async () => new ArrayBuffer(1) };
    }
  });
  const client = context.MusicSpaceSourceAudioClient.createSourceAudioClient(geometry);
  client.loadPatch({ sourceBindings: [binding("A", "a.wav"), { ...binding("B", "b.wav"), muted: true }] });
  const starting = client.setEnabled(true);
  await settle();
  assert.deepEqual(fetched, ["a.wav", "b.wav"]);
  requests.get("b.wav").resolve();
  await settle();
  assert.equal(audio.playingNodes().length, 0);
  requests.get("a.wav").resolve();
  assert.equal(await starting, true);
  const sources = audio.playingNodes();
  assert.equal(sources.length, 2);
  assert.equal(sources[0].startAt, sources[1].startAt);
  assert.equal(sources[1].connections[0].gain.value, 0);
  await client.setEnabled(false);
  await client.setEnabled(true);
  assert.equal(decodes, 2);
  assert.equal(fetched.length, 2);
  client.dispose();
  assert.equal(audio.playingNodes().length, 0);
  assert.equal(audio.contexts[0].state, "closed");
});

test("failed audio decode can be retried and does not claim playback", async () => {
  let attempt = 0;
  const audio = createAudioHarness({
    decode: () => {
      if (++attempt === 1) throw new Error("bad data");
      return {};
    }
  });
  const context = runBrowserScript("musicspace-source-audio-client.js", {
    ...audio.globals,
    fetch: async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(1) })
  });
  const client = context.MusicSpaceSourceAudioClient.createSourceAudioClient(geometry);
  client.loadPatch({ sourceBindings: [binding("A", "a.wav")] });
  assert.equal(await client.setEnabled(true), false);
  assert.equal(client.isEnabled(), false);
  assert.equal(await client.setEnabled(true), true);
  client.dispose();
});

for (const action of ["stop", "loadPatch", "dispose"]) {
  test(`generator ${action} cancels pending startup`, async () => {
    const resume = deferred();
    const audio = createAudioHarness({ resume: () => resume.promise });
    const context = runBrowserScript("musicspace-generator-client.js", audio.globals);
    const client = context.MusicSpaceGeneratorClient.createGeneratorClient(geometry);
    client.loadPatch({ sourceGenerators: [generator] });
    const starting = client.setEnabled(true);
    await settle();
    client[action]();
    resume.resolve();
    assert.equal(await starting, false);
    assert.equal(client.isEnabled(), false);
    assert.equal(audio.timers.size, 0);
    assert.equal(audio.playingNodes().length, 0);
  });
}

test("generator repeated playback releases timers and voices", async () => {
  const audio = createAudioHarness();
  const context = runBrowserScript("musicspace-generator-client.js", audio.globals);
  const client = context.MusicSpaceGeneratorClient.createGeneratorClient(geometry);
  client.loadPatch({ sourceGenerators: [generator] });
  for (let i = 0; i < 5; i += 1) {
    assert.equal(await client.setEnabled(true), true);
    assert.ok(audio.timers.size > 0);
    client.stop();
    assert.equal(audio.timers.size, 0);
  }
  client.dispose();
  assert.equal(audio.contexts.length, 1);
  assert.equal(audio.contexts[0].state, "closed");
});

test("granular target stop during resume cannot leave a scheduler running", async () => {
  const resume = deferred();
  const audio = createAudioHarness({ resume: () => resume.promise });
  const context = runBrowserScript("musicspace-targets.js", audio.globals);
  const target = context.MusicSpaceTargets.createTargetController({ type: "granular" });
  const starting = target.setEnabled(true);
  await target.setEnabled(false);
  resume.resolve();
  assert.equal(await starting, false);
  assert.equal(target.isEnabled(), false);
  assert.equal(audio.timers.size, 0);
  target.dispose();
});

test("disabling an unused target does not allocate an audio context", async () => {
  const audio = createAudioHarness();
  const context = runBrowserScript("musicspace-targets.js", audio.globals);
  const target = context.MusicSpaceTargets.createTargetController({ type: "subtractive" });
  assert.equal(await target.setEnabled(false), false);
  assert.equal(audio.contexts.length, 0);
});

test("pending external MIDI permission cannot start a stopped sequence", async () => {
  const permission = deferred();
  const audio = createAudioHarness();
  const sent = [];
  const context = runBrowserScript("musicspace-midi-file-client.js", {
    ...audio.globals,
    navigator: { requestMIDIAccess: () => permission.promise }
  });
  const client = context.MusicSpaceMidiFileClient.createMidiFileClient({
    ...geometry,
    modeSelect: { value: "external", addEventListener() {} }
  });
  await client.loadPatch({
    midiFile: {
      sequenceData: {
        musicalTracks: [{ index: 0, name: "A", channels: [1], noteCount: 1 }],
        events: [],
        durationSeconds: 1
      },
      trackBindings: [{ source: "A", trackIndex: 0, channel: 1 }]
    }
  });
  const starting = client.setEnabled(true);
  client.stop();
  permission.resolve({ outputs: new Map([["fake", { id: "fake", send: (bytes) => sent.push(bytes) }]]) });
  assert.equal(await starting, false);
  assert.equal(sent.length, 0);
  assert.equal(audio.timers.size, 0);
  assert.equal(client.isEnabled(), false);
});

test("additive mute, unmute and removal release the corresponding voices", async () => {
  const audio = createAudioHarness();
  const context = runBrowserScript("musicspace-generator-client.js", audio.globals);
  const client = context.MusicSpaceGeneratorClient.createGeneratorClient(geometry);
  client.loadPatch({
    sourceGenerators: [
      {
        source: "A",
        type: "additive-synth",
        frequencyHz: 220,
        gain: 0.2,
        partials: [{ ratio: 1, amplitude: 1 }]
      }
    ]
  });
  assert.equal(await client.setEnabled(true), true);
  assert.equal(audio.playingNodes().length, 1);
  client.toggleSourceMuted("A");
  assert.equal(audio.playingNodes().length, 0);
  client.toggleSourceMuted("A");
  assert.equal(audio.playingNodes().length, 1);
  client.removeGenerator("A");
  assert.equal(audio.playingNodes().length, 0);
  client.dispose();
});

test("internal sequence completion releases its context and reports stopped state", async () => {
  const audio = createAudioHarness();
  const states = [];
  const context = runBrowserScript("musicspace-midi-file-client.js", audio.globals);
  const client = context.MusicSpaceMidiFileClient.createMidiFileClient({
    ...geometry,
    onStateChange: (enabled) => states.push(enabled)
  });
  await client.loadPatch({
    midiFile: {
      sequenceData: {
        musicalTracks: [{ index: 0, name: "A", channels: [1], noteCount: 1 }],
        events: [],
        durationSeconds: 1
      },
      trackBindings: [{ source: "A", trackIndex: 0, channel: 1 }]
    }
  });
  assert.equal(await client.setEnabled(true), true);
  audio.advance(2);
  assert.equal(client.isEnabled(), false);
  assert.equal(audio.timers.size, 0);
  assert.equal(audio.contexts[0].state, "closed");
  assert.deepEqual(states, [false]);
});

test("capture registry releases disposed contexts and media tracks", async () => {
  let stopped = 0;
  const track = {
    stop() {
      stopped += 1;
    }
  };
  const audioContext = {
    createMediaStreamDestination: () => ({
      stream: { getTracks: () => [track], getAudioTracks: () => [track] }
    })
  };
  const context = runBrowserScript("musicspace-audio-capture.js", {});
  const capture = context.MusicSpaceAudioCapture;
  capture.registerContext(audioContext);
  assert.equal(capture.trackCount(), 1);
  capture.unregisterContext(audioContext);
  capture.unregisterContext(audioContext);
  assert.equal(capture.trackCount(), 0);
  assert.equal(stopped, 1);
});
