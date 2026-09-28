// Deterministic large scenes shared by the browser benchmark and parity tests.
function performanceScenes() {
  const fixtures = [];
  // Independent links expose adapter scaling without an impossible global solve.
  // Replicated musical springs exercise dynamics and mapping-ready geometry.
  for (const count of [100, 500]) {
    const patch = {
      name: `${count} independent links`,
      listener: { x: 400, y: 500 },
      sources: [],
      constraints: []
    };
    for (let i = 0; i < count; i++) {
      const x = 40 + (i % 20) * 35,
        y = 30 + Math.floor(i / 20) * 18;
      patch.sources.push({ name: `A${i}`, x, y }, { name: `B${i}`, x: x + 15, y });
      patch.constraints.push({ type: "fixedDistance", anchor: `A${i}`, target: `B${i}`, distance: 15 });
    }
    fixtures.push({ key: `links-${count}`, patch });
  }
  const springs = {
    name: "100 spring pairs",
    listener: { x: 400, y: 550 },
    sources: [],
    constraints: []
  };
  for (let i = 0; i < 100; i++) {
    const x = 40 + (i % 20) * 35,
      y = 40 + Math.floor(i / 20) * 80;
    springs.sources.push({ name: `Anchor${i}`, x, y }, { name: `Mass${i}`, x, y: y + 45 });
    springs.constraints.push(
      { type: "pin", target: `Anchor${i}`, x, y },
      {
        type: "spring",
        anchor: `Anchor${i}`,
        target: `Mass${i}`,
        restLength: 35,
        stiffness: 40,
        damping: 2
      }
    );
  }
  fixtures.push({ key: "springs-100", patch: springs });
  const grid = {
    name: "15 by 15 connected grid",
    listener: { x: 400, y: 550 },
    sources: [],
    constraints: []
  };
  for (let y = 0; y < 15; y++)
    for (let x = 0; x < 15; x++) {
      const name = `P${x}-${y}`;
      grid.sources.push({ name, x: 80 + x * 25, y: 50 + y * 25 });
      if (x)
        grid.constraints.push({
          type: "fixedDistance",
          anchor: `P${x - 1}-${y}`,
          target: name,
          distance: 25
        });
      if (y)
        grid.constraints.push({
          type: "fixedDistance",
          anchor: `P${x}-${y - 1}`,
          target: name,
          distance: 25
        });
    }
  fixtures.push({ key: "grid-225", patch: grid });
  return fixtures;
}
module.exports = { performanceScenes };
