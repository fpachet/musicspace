# Release notes

## 0.1.0-alpha.5 — 28 September 2026

First archive prepared for external integration trials. The API remains experimental.

### Included

- Standalone geometry engine: 11 constraint types, movable center, trajectories,
  linked rotation, spring dynamics, drag/release, snapshots and diagnostics.
- ES modules and CommonJS entry points, TypeScript declarations, MIT license,
  and no runtime dependencies.
- Optional legacy-patch adapter preserving workbench metadata and output bindings.
- SVG playground, headless JavaScript example, typed consumer and quick-start guide.
- Experimental MusicSpace Play/Edit integration using plain presentation records.

### Performance

Indexed lookup and fewer redundant copies/model constructions improve large-scene
movement, saving and editing. On the measured 1,000-control workload, propagation
movement was 4.1 → 1.4 ms, saving 13.6 → 0.7 ms, and renaming 32 → 12.7 ms (medians).
These diagnostic measurements depend on the machine and workload; audio was disabled.
See the repository's `benchmarks/package-performance.md` for methodology and raw data.

### Verification

- All 23 predefined scenes and four larger fixtures exercised with both solvers.
- Exact final geometry parity with the previous milestone in the browser benchmark.
- Regression tests for editing, restoration, independent snapshots and validation.
- Archive installation and execution in an independent Node project, plus strict
  TypeScript compilation using NodeNext ESM/CommonJS and Bundler resolution.

### Known limits

One radial center and one active drag per scene; scene coordinates use pixel-like
units; fixed legacy bounce bounds; authoring replaces the scene model. Solvers can
leave residuals on dense or incompatible graphs. See README.md for precise limits.

### Distribution

This release is shared as `musicspace-engine-0.1.0-alpha.5.tgz`. It has not been
published to npm. The package name is provisional pending publisher/scope verification.
