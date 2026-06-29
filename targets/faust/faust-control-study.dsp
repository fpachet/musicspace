import("stdfaust.lib");

freq = hslider("osc/freq", 220, 110, 880, 0.1);
cutoff = hslider("filter/frequency", 1600, 250, 4200, 1);
q = hslider("filter/q", 2, 0.5, 18, 0.01);
gain = hslider("output/gain", 0.12, 0, 0.3, 0.001);

process = os.sawtooth(freq) : fi.resonlp(cutoff, q, 1) : *(gain);
