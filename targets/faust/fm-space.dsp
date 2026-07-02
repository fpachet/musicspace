import("stdfaust.lib");

carrierFrequency = hslider("carrier/frequency", 220, 40, 1400, 0.01);
modARatio = hslider("modA/ratio", 2, 0.125, 16, 0.001);
modAIndex = hslider("modA/index", 1.5, 0, 14, 0.001);
modBRatio = hslider("modB/ratio", 3, 0.125, 24, 0.001);
modBIndex = hslider("modB/index", 0.35, 0, 10, 0.001);
vibratoRate = hslider("vibrato/rate", 4, 0.05, 18, 0.001);
vibratoDepth = hslider("vibrato/depth", 2, 0, 80, 0.001);
tremoloRate = hslider("tremolo/rate", 0.8, 0.02, 16, 0.001);
tremoloDepth = hslider("tremolo/depth", 0.08, 0, 0.75, 0.001);
cutoff = hslider("filter/frequency", 2600, 80, 12000, 0.01);
q = hslider("filter/q", 1.1, 0.1, 24, 0.001);
drive = hslider("drive/amount", 0.08, 0, 1, 0.001);
feedbackAmount = hslider("feedback/amount", 0.08, 0, 0.82, 0.001);
feedbackDelay = hslider("feedback/delay", 0.018, 0.002, 0.08, 0.001);
gain = hslider("output/gain", 0.18, 0, 0.7, 0.001);
pan = hslider("space/pan", 0, -1, 1, 0.001);

modA = os.osc(carrierFrequency * modARatio) * carrierFrequency * modAIndex;
modB = os.osc(carrierFrequency * modBRatio) * carrierFrequency * modBIndex;
vibrato = os.osc(vibratoRate) * vibratoDepth;
fm = os.osc(carrierFrequency + modA + modB + vibrato);
tremolo = 1 - tremoloDepth * 0.5 + os.osc(tremoloRate) * gain * tremoloDepth;

process = fm
  : *(gain)
  : fi.lowpass(2, cutoff)
  : *(tremolo)
  <: _,_
  : sp.panner(pan);
