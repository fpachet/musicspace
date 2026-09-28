const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

test("packed archive installs and works without the source repository", () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "musicspace-install-"));
  try {
    const pkg = path.resolve(__dirname, "..");
    const options = { encoding: "utf8", env: { ...process.env, npm_config_cache: path.join(temp, "cache") } };
    // Build was already run by npm test; test the exact distribution contents.
    execFileSync("npm", ["pack", "--ignore-scripts", "--pack-destination", temp], {
      ...options,
      cwd: pkg,
      stdio: "pipe"
    });
    const archive = fs.readdirSync(temp).find((file) => file.endsWith(".tgz"));
    assert.ok(archive);
    const consumer = path.join(temp, "consumer");
    fs.mkdirSync(consumer);
    fs.writeFileSync(path.join(consumer, "package.json"), '{"name":"independent-consumer","private":true}');
    execFileSync(
      "npm",
      ["install", "--offline", "--ignore-scripts", "--no-audit", "--no-fund", path.join(temp, archive)],
      { ...options, cwd: consumer, stdio: "pipe" }
    );
    const code = `const {createSpace} = LIBRARY;
      const space = createSpace({points:[{id:'a',x:10,y:20}]});
      space.move('a', -500, 1000);
      if (space.getPoint('a').x !== -500) throw new Error('bad position');
      console.log('ok');`;
    for (const [args, library] of [
      [[], "require('@musicspace/engine')"],
      [["--input-type=module"], "await import('@musicspace/engine')"]
    ]) {
      const output = execFileSync(process.execPath, [...args, "-e", code.replace("LIBRARY", library)], {
        ...options,
        cwd: consumer
      });
      assert.equal(output.trim(), "ok");
    }
    assert.ok(fs.existsSync(path.join(consumer, "node_modules/@musicspace/engine/dist/index.d.ts")));
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});
