declare name "Orbit Study";
declare author "MusicSpace / Faust Orbit proof of concept";
declare license "MIT";
import("stdfaust.lib");

// A quiet, pulsed minor chord: no microphone or sample download required.
dry = hslider("Dry", 0.55, 0, 1, 0.001) : si.smoo;
wet = hslider("Wet", 0.45, 0, 1, 0.001) : si.smoo;
cutoff = hslider("Cutoff [unit:Hz]", 1800, 180, 6000, 1) : si.smoo;
resonance = hslider("Resonance", 1.5, 0.5, 8, 0.01) : si.smoo;
chord = (os.sawtooth(110) + os.sawtooth(130.8128) + os.sawtooth(164.8138)) / 3;
pulse = 0.25 + 0.75 * pow(0.5 + 0.5 * os.osc(1.5), 3);
source = chord * pulse;
filtered = source : fi.resonlp(cutoff, resonance, 1);
mixed = (source * dry + filtered * wet) : ma.tanh : *(0.16);
process = mixed <: _,_;
