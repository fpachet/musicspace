declare name "Constellation";
declare author "MusicSpace / Faust Orbit proof of concept";
declare license "MIT";
import("stdfaust.lib");

bass = hslider("Bass", 0.4, 0, 1, 0.001) : si.smoo;
body = hslider("Body", 0.35, 0, 1, 0.001) : si.smoo;
air = hslider("Air", 0.25, 0, 1, 0.001) : si.smoo;
dry = hslider("Dry", 0.4, 0, 1, 0.001) : si.smoo;
wet = hslider("Wet", 0.6, 0, 1, 0.001) : si.smoo;
cutoff = hslider("Cutoff [unit:Hz]", 2200, 180, 6000, 1) : si.smoo;
reso = hslider("Resonance", 2.2, 0.5, 8, 0.01) : si.smoo;
rate = hslider("Rate [unit:Hz]", 1.2, 0.15, 4, 0.01) : si.smoo;
depth = hslider("Depth", 0.4, 0, 1, 0.001) : si.smoo;
pan = hslider("Pan", 0, -1, 1, 0.001) : si.smoo;

low = (os.osc(110) + os.osc(164.8138)) * 0.5;
mid = (os.sawtooth(220) + os.sawtooth(261.6256)) * 0.5;
high = (os.osc(523.251) + os.osc(659.255)) * 0.5;
chord = low * bass + mid * body + high * air;
envelope = 1 - depth * 0.5 + os.osc(rate) * depth * 0.5;
source = chord * envelope;
filtered = source : fi.resonlp(cutoff, reso, 1);
mix = (source * dry + filtered * wet) : ma.tanh : *(0.16);
process = mix <: *(sqrt((1 - pan) * 0.5)), *(sqrt((1 + pan) * 0.5));
