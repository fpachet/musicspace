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
    // Also accept a deliverable path so release checks test the exact handed-off bytes.
    let archive = process.env.MUSICSPACE_TEST_ARCHIVE;
    if (archive) archive = path.resolve(archive);
    else {
      execFileSync("npm", ["pack", "--ignore-scripts", "--pack-destination", temp], {
        ...options,
        cwd: pkg,
        stdio: "pipe"
      });
      archive = path.join(
        temp,
        fs.readdirSync(temp).find((file) => file.endsWith(".tgz"))
      );
    }
    assert.ok(fs.existsSync(archive));
    const consumer = path.join(temp, "consumer");
    fs.mkdirSync(consumer);
    fs.writeFileSync(path.join(consumer, "package.json"), '{"name":"independent-consumer","private":true}');
    execFileSync("npm", ["install", "--offline", "--ignore-scripts", "--no-audit", "--no-fund", archive], {
      ...options,
      cwd: consumer,
      stdio: "pipe"
    });
    const code = `const {createSpace} = LIBRARY;
      const {importLegacyPatch, exportLegacyPatch} = ADAPTER;
      const space = createSpace({points:[{id:'a',x:10,y:20}]});
      space.move('a', -500, 1000);
      if (space.getPoint('a').x !== -500) throw new Error('bad position');
      const imported = importLegacyPatch({listener:{x:0,y:0},sources:[{name:'A',x:10,y:20}],custom:{keep:true}});
      const legacySpace = createSpace(imported.scene);
      legacySpace.move(imported.context.pointIds.A, 30, 40);
      const saved = exportLegacyPatch(legacySpace.snapshot(), imported.context);
      if (saved.sources[0].x !== 30 || !saved.custom.keep) throw new Error('bad legacy export');
      console.log('ok');`;
    for (const [args, library] of [
      [[], "require('@musicspace/engine')"],
      [["--input-type=module"], "await import('@musicspace/engine')"]
    ]) {
      const script = code
        .replace("LIBRARY", library)
        .replace("ADAPTER", library.replace("@musicspace/engine", "@musicspace/engine/legacy-patch"));
      const output = execFileSync(process.execPath, [...args, "-e", script], {
        ...options,
        cwd: consumer
      });
      assert.equal(output.trim(), "ok");
    }
    const installed = path.join(consumer, "node_modules/@musicspace/engine");
    for (const file of [
      "LICENSE",
      "QUICKSTART.md",
      "CHANGELOG.md",
      "dist/index.d.ts",
      "dist/legacy-patch.d.ts"
    ])
      assert.ok(fs.existsSync(path.join(installed, file)), `Missing distribution file: ${file}`);
    const typed = fs.readFileSync(path.join(installed, "examples/typed-consumer.mts"), "utf8");
    // A missing declaration must not silently turn imports into any.
    const negativeChecks = `
      if (false) {
        // @ts-expect-error Coordinates must be numbers.
        space.move("A", "invalid", 0);
        // @ts-expect-error Unknown constraint kinds must fail at compile time.
        space.addConstraint({ id: "bad", type: "unknown" });
        // @ts-expect-error Solver names are restricted.
        space.configure({ solver: "unknown" });
      }
    `;
    for (const extension of ["mts", "cts"]) {
      const source = `consumer.${extension}`;
      fs.writeFileSync(path.join(consumer, source), typed + negativeChecks);
      execFileSync(
        process.execPath,
        [
          path.join(path.dirname(require.resolve("typescript/package.json")), "bin/tsc"),
          source,
          "--strict",
          "--target",
          "ES2022",
          "--module",
          "NodeNext",
          "--moduleResolution",
          "NodeNext",
          "--outDir",
          "compiled",
          "--skipLibCheck",
          "false"
        ],
        { ...options, cwd: consumer }
      );
      const result = execFileSync(
        process.execPath,
        [`compiled/consumer.${extension === "mts" ? "mjs" : "cjs"}`],
        { ...options, cwd: consumer }
      );
      assert.equal(result.trim(), "TypeScript consumer passed");
    }
    execFileSync(
      process.execPath,
      [
        path.join(path.dirname(require.resolve("typescript/package.json")), "bin/tsc"),
        "consumer.mts",
        "--strict",
        "--target",
        "ES2022",
        "--module",
        "ESNext",
        "--moduleResolution",
        "Bundler",
        "--noEmit",
        "--skipLibCheck",
        "false"
      ],
      { ...options, cwd: consumer }
    );
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});
