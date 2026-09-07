const assert = require("node:assert/strict");
const test = require("node:test");
const { runBrowserScript } = require("./helpers/engine-harness");

function midi(track, division = 480) {
  const bytes = Buffer.from([
    77,
    84,
    104,
    100,
    0,
    0,
    0,
    6,
    0,
    0,
    0,
    1,
    division >> 8,
    division & 255,
    77,
    84,
    114,
    107,
    0,
    0,
    track.length >> 8,
    track.length & 255,
    ...track
  ]);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}
const parse = (buffer) =>
  runBrowserScript("musicspace-midi-file-client.js", {}).MusicSpaceMidiFileClient.parseMidiFile(buffer);

test("MIDI running status and tempo changes preserve note durations", () => {
  const sequence = parse(
    midi([
      0, 0xff, 0x51, 3, 7, 0xa1, 0x20, 0, 0x90, 60, 80, 0, 64, 80, 0x83, 0x60, 0x80, 60, 0, 0, 64, 0, 0, 0xff,
      0x51, 3, 0x0f, 0x42, 0x40, 0, 0x90, 67, 80, 0x83, 0x60, 0x80, 67, 0, 0, 0xff, 0x2f, 0
    ])
  );
  const notes = sequence.events.filter((event) => event.type === "noteOn");
  assert.deepEqual(
    JSON.parse(
      JSON.stringify(notes.map(({ note, seconds, durationSeconds }) => [note, seconds, durationSeconds]))
    ),
    [
      [60, 0, 0.5],
      [64, 0, 0.5],
      [67, 0.5, 1]
    ]
  );
});

test("malformed MIDI data produces a bounded failure", () => {
  for (const buffer of [
    new ArrayBuffer(0),
    midi([0, 60, 80]),
    midi([0xff, 0xff, 0xff, 0xff, 0xff]),
    midi([0, 0xff, 0x2f, 0], 0)
  ]) {
    assert.throws(() => parse(buffer));
  }
});
