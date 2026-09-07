// Fixed simulation steps driven by elapsed time, independent of display refresh.
(function exposeClock(global) {
  function createClock({ stepSeconds = 1 / 60, maxSteps = 8 } = {}) {
    let previous = null;
    let accumulated = 0;
    return {
      reset(timestamp = null) {
        previous = timestamp;
        accumulated = 0;
      },
      advance(timestamp, step) {
        if (!Number.isFinite(timestamp)) return 0;
        if (previous === null) {
          previous = timestamp;
          return 0;
        }
        const elapsed = Math.max(0, (timestamp - previous) / 1000);
        previous = timestamp;
        accumulated = Math.min(accumulated + elapsed, maxSteps * stepSeconds);
        let count = 0;
        while (accumulated + 1e-10 >= stepSeconds && count < maxSteps) {
          step(stepSeconds);
          accumulated -= stepSeconds;
          count += 1;
        }
        accumulated = Math.max(0, accumulated);
        return count;
      }
    };
  }
  const api = { createClock };
  if (typeof module === "object" && module.exports) module.exports = api;
  else global.MusicSpaceClock = api;
})(globalThis);
