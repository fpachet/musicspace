// Optional client-oriented demo patches.
//
// The core MusicSpace scene file keeps geometric examples. Patches that exist
// to demonstrate target backends or synthesis clients live here and are merged
// into the built-in patch menu at startup.

(function exposeMusicSpaceClientPatches(global) {
  global.MusicSpaceClientPatches = [
    {
      key: "jazz-trio-midi",
      name: "Jazz Trio MIDI Spatializer",
      listener: { x: 400, y: 300 },
      sources: [
        { name: "Bass", x: 245, y: 355, drawTrace: true },
        { name: "Drums", x: 400, y: 170, drawTrace: true },
        { name: "Piano", x: 560, y: 355, drawTrace: true }
      ],
      constraints: [
        { type: "sum", sources: ["Bass", "Drums", "Piano"] },
        { type: "angle", sources: ["Bass", "Piano"] },
        { type: "radialLimit", source: "Drums", minDistance: 95, maxDistance: 220 }
      ],
      midiFile: {
        url: "Midifiles/triojazz.mid",
        preferredMode: "internal",
        trackBindings: [
          { track: "Bass", source: "Bass", channel: 2, program: 33 },
          { track: "Drums", source: "Drums", channel: 10, program: 1, isDrums: true },
          { track: "Piano", source: "Piano", channel: 3, program: 1 }
        ]
      }
    },
    {
      key: "faust-control-study",
      name: "Faust Control Study",
      listener: { x: 400, y: 300 },
      sources: [
        { name: "Freq", x: 250, y: 230, drawTrace: true },
        { name: "Cutoff", x: 570, y: 260, drawTrace: true },
        { name: "Q", x: 530, y: 385, drawTrace: true },
        { name: "Gain", x: 325, y: 405 }
      ],
      movingObjects: [
        {
          name: "Sweep",
          x: 250,
          y: 230,
          drawTrace: true,
          trajectory: {
            type: "shuttle",
            ax: 210,
            ay: 210,
            bx: 610,
            by: 250,
            phase: 0.1,
            speed: 0.0045,
            direction: 1,
            showPath: true
          }
        },
        {
          name: "Orbit",
          x: 520,
          y: 340,
          trajectory: {
            type: "rotation",
            centerX: 400,
            centerY: 300,
            radius: 135,
            phase: 0.3,
            angularSpeed: 0.009
          }
        },
        {
          name: "ResoSpin",
          x: 520,
          y: 340,
          trajectory: {
            type: "rotator",
            running: true,
            periodSeconds: 7,
            direction: -1,
            displacementInducesRotation: true,
            phase: 0,
            rotationDelta: 0
          }
        }
      ],
      constraints: [
        { type: "solid", carrier: "Sweep", attached: "Freq" },
        { type: "solid", carrier: "Orbit", attached: "ResoSpin" },
        { type: "solid", carrier: "ResoSpin", attached: "Q" },
        { type: "fixedDistance", anchor: "Freq", target: "Gain", distance: 190 },
        { type: "distanceRatio", sources: ["Cutoff", "Q"], ratio: 1.35 },
        { type: "radialLimit", source: "Q", minDistance: 75, maxDistance: 185 },
        { type: "sum", sources: ["Freq", "Cutoff", "Gain"] }
      ],
      parameterMappings: [
        {
          source: "Freq",
          feature: "x",
          target: "/osc/freq",
          inputMin: 180,
          inputMax: 640,
          outputMin: 110,
          outputMax: 880,
          curve: "exp"
        },
        {
          source: "Cutoff",
          feature: "distance",
          target: "/filter/frequency",
          inputMin: 70,
          inputMax: 260,
          outputMin: 250,
          outputMax: 4200,
          curve: "exp"
        },
        {
          source: "Q",
          feature: "distance",
          target: "/filter/q",
          inputMin: 70,
          inputMax: 190,
          outputMin: 0.5,
          outputMax: 18,
          curve: "linear"
        },
        {
          source: "Gain",
          feature: "y",
          target: "/output/gain",
          inputMin: 500,
          inputMax: 150,
          outputMin: 0.03,
          outputMax: 0.22,
          curve: "linear"
        }
      ]
    },
    {
      key: "granular-cloud-study",
      name: "Granular Cloud Study",
      listener: { x: 400, y: 300 },
      sources: [
        { name: "Rate", x: 235, y: 205, drawTrace: true },
        { name: "Size", x: 330, y: 430, drawTrace: true },
        { name: "Pitch", x: 555, y: 225, drawTrace: true },
        { name: "Spray", x: 585, y: 370, drawTrace: true },
        { name: "Tone", x: 420, y: 145 },
        { name: "Level", x: 270, y: 350 }
      ],
      movingObjects: [
        {
          name: "DensityLift",
          x: 235,
          y: 205,
          drawTrace: true,
          trajectory: {
            type: "shuttle",
            start: { type: "object", name: "Level" },
            end: { type: "fixed", x: 620, y: 190 },
            ax: 270,
            ay: 350,
            bx: 620,
            by: 190,
            phase: 0.18,
            speed: 0.0035,
            direction: 1,
            showPath: true
          }
        },
        {
          name: "PitchOrbit",
          x: 540,
          y: 300,
          trajectory: {
            type: "rotation",
            centerX: 400,
            centerY: 300,
            radius: 140,
            phase: -0.5,
            angularSpeed: 0.006
          }
        },
        {
          name: "PitchSpin",
          x: 540,
          y: 300,
          trajectory: {
            type: "rotator",
            running: true,
            periodSeconds: 11,
            direction: 1,
            displacementInducesRotation: true,
            phase: 0,
            rotationDelta: 0
          }
        }
      ],
      constraints: [
        { type: "solid", carrier: "DensityLift", attached: "Rate" },
        { type: "solid", carrier: "PitchOrbit", attached: "PitchSpin" },
        { type: "solid", carrier: "PitchSpin", attached: "Pitch" },
        { type: "solid", carrier: "PitchSpin", attached: "Spray" },
        { type: "fixedDistance", anchor: "Rate", target: "Size", distance: 250 },
        { type: "distanceRatio", sources: ["Tone", "Pitch"], ratio: 0.85 },
        { type: "angleSector", source: "Tone", centerAngle: -1.55, width: 1.75 },
        { type: "radialLimit", source: "Spray", minDistance: 80, maxDistance: 210 },
        { type: "sum", sources: ["Rate", "Size", "Level"] }
      ],
      target: { type: "granular" },
      parameterMappings: [
        {
          source: "Rate",
          feature: "x",
          target: "/grain/rate",
          inputMin: 210,
          inputMax: 640,
          outputMin: 6,
          outputMax: 44,
          curve: "linear"
        },
        {
          source: "Size",
          feature: "distance",
          target: "/grain/size",
          inputMin: 90,
          inputMax: 280,
          outputMin: 0.025,
          outputMax: 0.22,
          curve: "linear"
        },
        {
          source: "Pitch",
          feature: "y",
          target: "/grain/pitch",
          inputMin: 500,
          inputMax: 120,
          outputMin: 0.45,
          outputMax: 2.4,
          curve: "exp"
        },
        {
          source: "Spray",
          feature: "distance",
          target: "/grain/spread",
          inputMin: 80,
          inputMax: 215,
          outputMin: 0.02,
          outputMax: 0.9,
          curve: "linear"
        },
        {
          source: "Tone",
          feature: "distance",
          target: "/filter/frequency",
          inputMin: 70,
          inputMax: 230,
          outputMin: 450,
          outputMax: 6200,
          curve: "exp"
        },
        {
          source: "Spray",
          feature: "angle",
          target: "/filter/q",
          inputMin: -3.14,
          inputMax: 3.14,
          outputMin: 0.6,
          outputMax: 12,
          curve: "linear"
        },
        {
          source: "Level",
          feature: "y",
          target: "/output/gain",
          inputMin: 500,
          inputMax: 160,
          outputMin: 0.08,
          outputMax: 0.34,
          curve: "linear"
        }
      ]
    }
  ];
})(window);
