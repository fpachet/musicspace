declare name "ThreeBody";
declare author "MusicSpace";
declare license "MIT";
import("stdfaust.lib");

// Distinct partials identify each body while its position changes continuously.
voice(partial, color) = stereo with {
    freq = hslider("frequency [unit:Hz]", 220, 40, 2000, 0.01) : si.smoo;
    pan = hslider("pan", 0, -1, 1, 0.001) : si.smoo;
    gain = hslider("gain", 0.1, 0, 0.2, 0.001) : si.smoo;
    cutoff = hslider("cutoff [unit:Hz]", 2000, 100, 8000, 1) : si.smoo;
    signal = (os.osc(freq) + color * os.osc(freq * partial)) / (1 + color)
        : fi.lowpass(2, max(100, cutoff)) : *(gain);
    stereo = signal <: *(sqrt(max(0, (1-pan)/2))), *(sqrt(max(0, (1+pan)/2)));
};
process = (vgroup("A", voice(2, 0.2)), vgroup("B", voice(3, 0.35)), vgroup("C", voice(2.01, 0.3))) :> _,_;
