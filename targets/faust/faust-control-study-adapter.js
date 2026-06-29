export async function createFaustNode(context, target) {
  const oscillator = context.createOscillator();
  const filter = context.createBiquadFilter();
  const gain = context.createGain();
  const defaults = defaultsFromTarget(target);

  oscillator.type = "sawtooth";
  filter.type = "lowpass";
  oscillator.frequency.value = defaults["/osc/freq"] ?? 220;
  filter.frequency.value = defaults["/filter/frequency"] ?? 1600;
  filter.Q.value = defaults["/filter/q"] ?? 2;
  gain.gain.value = 0;

  oscillator.connect(filter);
  filter.connect(gain);
  oscillator.start();

  return {
    node: gain,
    output: gain,
    setParamValue(path, value) {
      const time = context.currentTime;
      if (path === "/osc/freq") {
        setAudioParam(oscillator.frequency, value, time);
      } else if (path === "/filter/frequency") {
        setAudioParam(filter.frequency, value, time);
      } else if (path === "/filter/q") {
        setAudioParam(filter.Q, value, time);
      } else if (path === "/output/gain") {
        setAudioParam(gain.gain, value, time);
      }
    },
    destroy() {
      try {
        oscillator.stop();
      } catch (error) {
        // The oscillator may already be stopped while the browser is closing audio.
      }
      oscillator.disconnect();
      filter.disconnect();
      gain.disconnect();
    }
  };
}

function defaultsFromTarget(target) {
  return Object.fromEntries(Object.entries(target.parameters || {}).map(([path, config]) => [
    path,
    Number(config.default ?? config.init ?? config.value ?? 0)
  ]));
}

function setAudioParam(param, value, time) {
  param.cancelScheduledValues(time);
  param.setTargetAtTime(value, time, 0.035);
}
