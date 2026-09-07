const assert = require("node:assert/strict");
const test = require("node:test");
const { createClock } = require("../musicspace-clock");

test("30, 60 and 120 Hz run the same number of simulation steps", () => {
  for (const hz of [30, 60, 120]) {
    const clock = createClock();
    clock.reset(0);
    let elapsed = 0;
    for (let frame = 1; frame <= hz * 18; frame += 1) {
      clock.advance((frame * 1000) / hz, (dt) => {
        elapsed += dt;
      });
    }
    assert.ok(Math.abs(elapsed - 18) < 1e-8, `${hz} Hz advanced ${elapsed}s`);
  }
});

test("background gaps have bounded catch-up and reset discards paused time", () => {
  const clock = createClock();
  clock.reset(0);
  assert.equal(
    clock.advance(60000, () => {}),
    8
  );
  clock.reset();
  assert.equal(
    clock.advance(120000, () => {}),
    0
  );
  assert.equal(
    clock.advance(120000 + 1000 / 60, () => {}),
    1
  );
});
