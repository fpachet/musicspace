const js = require("@eslint/js");
const globals = require("globals");

module.exports = [
  { ignores: ["node_modules/**", "test-results/**", ".venv*/**", "examples/orbit-musicspace/vendor/**"] },
  {
    files: ["**/*.js", "**/*.cjs"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "commonjs",
      globals: {
        ...globals.browser,
        ...globals.node,
        ...Object.fromEntries(
          [
            "MusicSpaceModel",
            "MusicSpaceClock",
            "MusicSpaceMapping",
            "MusicSpaceParameterClient",
            "MusicSpaceSourceAudioClient",
            "MusicSpaceGeneratorClient",
            "MusicSpaceMidiFileClient"
          ].map((name) => [name, "readonly"])
        )
      }
    },
    rules: {
      ...js.configs.recommended.rules,
      "no-unused-vars": ["error", { args: "none", caughtErrors: "none", varsIgnorePattern: "^_" }]
    }
  },
  { files: ["targets/faust/*-adapter.js"], languageOptions: { sourceType: "module" } },
  {
    files: [
      "examples/orbit-musicspace/*.mjs",
      "examples/orbit-musicspace/audio/*.mjs",
      "targets/faust/*-worklet.mjs"
    ],
    languageOptions: {
      sourceType: "module",
      globals: {
        ...globals.browser,
        AudioWorkletProcessor: "readonly",
        registerProcessor: "readonly",
        sampleRate: "readonly"
      }
    },
    rules: {
      ...js.configs.recommended.rules,
      "no-unused-vars": ["error", { argsIgnorePattern: "^_", caughtErrors: "none" }]
    }
  }
];
