# MusicSpace Testing

Run the constraint-engine regression battery with:

```sh
node --test tests/constraint-engine.test.js
```

The tests load `musicspace.js` in a mocked DOM/canvas sandbox, then drive patches directly through the engine. They assert propagation reports and residual measurements rather than relying on screenshots.

Current coverage:

- Sum redistribution.
- Shared Sum + Angle propagation through a common source.
- Product + radial-limit backoff.
- Radial-limit clamping.
- Distance-ratio preservation.
- Solid-link propagation.
- Over-constrained residual diagnostics.

Keep these tests focused on engine behavior. Browser/UI rendering checks should stay separate.
