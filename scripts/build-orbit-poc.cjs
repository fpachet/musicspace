// Rebuild the self-contained, committed browser demo. No network access required.
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const demo = path.join(root, "examples/orbit-musicspace");
const orbit = path.join(demo, "vendor/orbit");
function node(script, args = []) {
  execFileSync(process.execPath, [script, ...args], { cwd: root, stdio: "inherit" });
}
node(path.join(root, "packages/musicspace-engine/scripts/build.cjs"));
fs.copyFileSync(
  path.join(root, "packages/musicspace-engine/dist/index.mjs"),
  path.join(demo, "vendor/musicspace-engine.mjs")
);
node(path.join(orbit, "scripts/build-styles.mjs"));
const typescriptRoot = path.dirname(require.resolve("typescript/package.json"));
node(path.join(typescriptRoot, "bin/tsc"), ["-p", path.join(orbit, "tsconfig.json")]);
fs.writeFileSync(
  path.join(orbit, "dist/faust-orbit-ui.css"),
  ["faust-orbit-ui.css", "orbit-calque.css"]
    .map((file) => fs.readFileSync(path.join(orbit, "src", file), "utf8"))
    .join("\n")
);

if (process.argv.includes("--compile-dsp")) {
  const audio = path.join(demo, "audio");
  execFileSync("faust", ["-lang", "wasm", "-json", "-o", "orbit-study.wasm", "orbit-study.dsp"], {
    cwd: audio,
    stdio: "inherit"
  });
  const metaPath = path.join(audio, "orbit-study.json");
  const metadata = JSON.parse(fs.readFileSync(metaPath, "utf8"));
  delete metadata.library_list;
  delete metadata.include_pathnames;
  fs.writeFileSync(metaPath, JSON.stringify(metadata, null, 2) + "\n");
  fs.rmSync(path.join(audio, "orbit-study.dsp.json"), { force: true });
}
console.log("Orbit × MusicSpace demo built. Serve examples/orbit-musicspace over HTTP.");
