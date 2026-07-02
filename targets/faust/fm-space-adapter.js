export async function createFaustNode(context, target) {
  const values = defaultsFromTarget(target);
  const carrier = context.createOscillator();
  const modA = context.createOscillator();
  const modB = context.createOscillator();
  const vibrato = context.createOscillator();
  const tremolo = context.createOscillator();
  const modAGain = context.createGain();
  const modBGain = context.createGain();
  const vibratoGain = context.createGain();
  const tremoloGain = context.createGain();
  const drive = context.createWaveShaper();
  const filter = context.createBiquadFilter();
  const delay = context.createDelay(0.12);
  const feedback = context.createGain();
  const feedbackMix = context.createGain();
  const output = context.createGain();
  const pan = context.createStereoPanner ? context.createStereoPanner() : null;
  const destination = pan || output;

  carrier.type = "sine";
  modA.type = "sine";
  modB.type = "sine";
  vibrato.type = "sine";
  tremolo.type = "sine";
  filter.type = "lowpass";
  output.gain.value = 0;
  delay.delayTime.value = 0.018;

  modA.connect(modAGain);
  modB.connect(modBGain);
  vibrato.connect(vibratoGain);
  modAGain.connect(carrier.frequency);
  modBGain.connect(carrier.frequency);
  vibratoGain.connect(carrier.frequency);
  tremolo.connect(tremoloGain);
  tremoloGain.connect(output.gain);

  carrier.connect(drive);
  drive.connect(filter);
  filter.connect(output);
  filter.connect(delay);
  delay.connect(feedback);
  feedback.connect(delay);
  delay.connect(feedbackMix);
  feedbackMix.connect(output);
  if (pan) {
    output.connect(pan);
  }

  carrier.start();
  modA.start();
  modB.start();
  vibrato.start();
  tremolo.start();

  const controller = {
    node: destination,
    output: destination,
    setParamValue(path, value) {
      values[path] = Number(value);
      applyValues(context, {
        carrier,
        modA,
        modB,
        vibrato,
        tremolo,
        modAGain,
        modBGain,
        vibratoGain,
        tremoloGain,
        drive,
        filter,
        delay,
        feedback,
        feedbackMix,
        output,
        pan
      }, values);
    },
    destroy() {
      for (const oscillator of [carrier, modA, modB, vibrato, tremolo]) {
        try {
          oscillator.stop();
        } catch (error) {
          // The browser may already have stopped the graph while closing audio.
        }
      }
      for (const node of [
        carrier,
        modA,
        modB,
        vibrato,
        tremolo,
        modAGain,
        modBGain,
        vibratoGain,
        tremoloGain,
        drive,
        filter,
        delay,
        feedback,
        feedbackMix,
        output,
        pan
      ]) {
        node?.disconnect?.();
      }
    }
  };

  applyValues(context, {
    carrier,
    modA,
    modB,
    vibrato,
    tremolo,
    modAGain,
    modBGain,
    vibratoGain,
    tremoloGain,
    drive,
    filter,
    delay,
    feedback,
    feedbackMix,
    output,
    pan
  }, values, true);
  return controller;
}

function applyValues(context, nodes, values, immediate = false) {
  const time = context.currentTime;
  const glide = immediate ? 0.005 : 0.04;
  const carrierFrequency = clamp(values["/carrier/frequency"] ?? 220, 40, 1400);
  const ratioA = clamp(values["/modA/ratio"] ?? 2, 0.125, 16);
  const ratioB = clamp(values["/modB/ratio"] ?? 3, 0.125, 24);
  const indexA = clamp(values["/modA/index"] ?? 1.5, 0, 14);
  const indexB = clamp(values["/modB/index"] ?? 0.35, 0, 10);
  const vibratoRate = clamp(values["/vibrato/rate"] ?? 4, 0.05, 18);
  const vibratoDepth = clamp(values["/vibrato/depth"] ?? 2, 0, 80);
  const tremoloRate = clamp(values["/tremolo/rate"] ?? 0.8, 0.02, 16);
  const tremoloDepth = clamp(values["/tremolo/depth"] ?? 0.08, 0, 0.75);
  const cutoff = clamp(values["/filter/frequency"] ?? 2600, 80, 12000);
  const q = clamp(values["/filter/q"] ?? 1.1, 0.1, 24);
  const drive = clamp(values["/drive/amount"] ?? 0.08, 0, 1);
  const feedbackAmount = clamp(values["/feedback/amount"] ?? 0.08, 0, 0.82);
  const feedbackDelay = clamp(values["/feedback/delay"] ?? 0.018, 0.002, 0.08);
  const gain = clamp(values["/output/gain"] ?? 0.18, 0, 0.7);
  const pan = clamp(values["/space/pan"] ?? 0, -1, 1);

  setAudioParam(nodes.carrier.frequency, carrierFrequency, time, glide);
  setAudioParam(nodes.modA.frequency, carrierFrequency * ratioA, time, glide);
  setAudioParam(nodes.modB.frequency, carrierFrequency * ratioB, time, glide);
  setAudioParam(nodes.modAGain.gain, carrierFrequency * indexA, time, glide);
  setAudioParam(nodes.modBGain.gain, carrierFrequency * indexB, time, glide);
  setAudioParam(nodes.vibrato.frequency, vibratoRate, time, glide);
  setAudioParam(nodes.vibratoGain.gain, vibratoDepth, time, glide);
  setAudioParam(nodes.tremolo.frequency, tremoloRate, time, glide);
  setAudioParam(nodes.tremoloGain.gain, gain * tremoloDepth, time, glide);
  setAudioParam(nodes.filter.frequency, cutoff, time, glide);
  setAudioParam(nodes.filter.Q, q, time, glide);
  setAudioParam(nodes.delay.delayTime, feedbackDelay, time, glide);
  setAudioParam(nodes.feedback.gain, feedbackAmount, time, glide);
  setAudioParam(nodes.feedbackMix.gain, feedbackAmount * 0.42, time, glide);
  setAudioParam(nodes.output.gain, gain * (1 - tremoloDepth * 0.5), time, glide);
  nodes.pan?.pan && setAudioParam(nodes.pan.pan, pan, time, glide);
  nodes.drive.curve = driveCurve(drive);
}

function defaultsFromTarget(target) {
  return Object.fromEntries(Object.entries(target.parameters || {}).map(([path, config]) => [
    path,
    Number(config.default ?? config.init ?? config.value ?? 0)
  ]));
}

function setAudioParam(param, value, time, rampTime) {
  param.cancelScheduledValues(time);
  param.setTargetAtTime(value, time, rampTime);
}

function driveCurve(amount) {
  const samples = 1024;
  const curve = new Float32Array(samples);
  const drive = 1 + amount * 24;
  for (let index = 0; index < samples; index += 1) {
    const x = index / (samples - 1) * 2 - 1;
    curve[index] = Math.tanh(x * drive) / Math.tanh(drive);
  }
  return curve;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value)));
}
