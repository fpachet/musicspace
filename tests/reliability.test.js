const assert = require("node:assert/strict");
const test = require("node:test");
const { createEngineHarness, loadFixturePatch, runBrowserScript } = require("./helpers/engine-harness");

test("undo owns its nested trajectory snapshot", () => {
  const engine = createEngineHarness();
  engine.loadPatch(loadFixturePatch("simple-rotator.json"));
  const mover = engine.api.getObjectByName("Spin");
  const phase = mover.trajectory.phase;
  engine.api.pushUndoSnapshot("move");
  mover.tick();
  engine.api.undoLastEdit();
  assert.equal(engine.api.getObjectByName("Spin").trajectory.phase, phase);
});

test("invalid patch loading preserves scene and undo", () => {
  const engine = createEngineHarness();
  engine.loadPatch(loadFixturePatch("simple-rotator.json"));
  engine.api.pushUndoSnapshot("before import");
  const before = JSON.stringify(engine.api.serializePatch());
  assert.equal(
    engine.api.loadPatch(
      { ...JSON.parse(before), name: "Bad", movingObjects: "invalid" },
      { clearUndo: true }
    ),
    false
  );
  assert.equal(JSON.stringify(engine.api.serializePatch()), before);
  engine.api.undoLastEdit();
  assert.equal(JSON.stringify(engine.api.serializePatch()), before);
});

function deferred() {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

test("stopping while audio loads prevents a late player from starting", async () => {
  const request = deferred();
  const started = deferred();
  const nodes = [];
  const node = () => ({ gain: { value: 1, setTargetAtTime() {} }, connect() {}, disconnect() {} });
  class AudioContext {
    constructor() {
      this.currentTime = 0;
      this.destination = {};
    }
    resume() {
      return Promise.resolve();
    }
    createGain() {
      return node();
    }
    createBufferSource() {
      const source = {
        ...node(),
        started: false,
        stopped: false,
        start() {
          this.started = true;
        },
        stop() {
          this.stopped = true;
        }
      };
      nodes.push(source);
      return source;
    }
    decodeAudioData() {
      return Promise.resolve({});
    }
  }
  const context = runBrowserScript("musicspace-source-audio-client.js", {
    AudioContext,
    fetch: async () => {
      started.resolve();
      await request.promise;
      return { ok: true, arrayBuffer: async () => new ArrayBuffer(1) };
    }
  });
  const client = context.MusicSpaceSourceAudioClient.createSourceAudioClient({
    getSource: () => ({ x: 1, y: 1 }),
    getListener: () => ({ x: 0, y: 0 })
  });
  client.loadPatch({ sourceBindings: [{ source: "A", type: "audio-file", url: "deferred.wav" }] });
  const enabling = client.setEnabled(true);
  await started.promise;
  await client.setEnabled(false);
  request.resolve();
  await enabling;
  assert.equal(client.isEnabled(), false);
  assert.equal(nodes.filter((source) => source.started && !source.stopped).length, 0);
});
