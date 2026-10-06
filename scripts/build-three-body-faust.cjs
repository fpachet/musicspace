// Recompile the committed DSP artifacts with Faust 2.81.2. Browsers need no compiler.
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const cwd = path.resolve(__dirname, "../targets/faust");
execFileSync("faust", ["-lang", "wasm", "-json", "-o", "three-body.wasm", "three-body.dsp"], {
  cwd,
  stdio: "inherit"
});
const file = path.join(cwd, "three-body.json");
const metadata = JSON.parse(fs.readFileSync(file, "utf8"));
delete metadata.library_list;
delete metadata.include_pathnames;
fs.writeFileSync(file, JSON.stringify(metadata, null, 2) + "\n");
fs.rmSync(path.join(cwd, "three-body.dsp.json"), { force: true });
console.log("Built Three-Body Faust WASM and metadata.");
