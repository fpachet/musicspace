import { relations } from "./constellation-model.mjs";

// Draw in Orbit's existing world transform: no separate canvas or coordinate system.
export function drawConstraints(
  ctx,
  state,
  scene,
  { visibility = "all", selected = null, activePath = null, guides = false, residuals = [] } = {}
) {
  if (visibility === "none") return [];
  const byName = Object.fromEntries(Object.values(state.controls).map((c) => [c.label, c]));
  const issues = new Set(residuals.map((r) => r.id));
  const drawn = [];
  const center = state.center;
  const line = (a, b) => {
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  };
  const radialPoint = (angle, radius) => ({
    x: center.x + Math.cos(angle) * radius,
    y: center.y + Math.sin(angle) * radius
  });

  for (const relation of relations) {
    const spec = scene.constraints.find((c) => c.id === relation.id);
    if (!spec || spec.enabled === false) continue;
    const points = relation.names.map((name) => byName[name]);
    const focused =
      selected === relation.id || (!selected && activePath && points.some((p) => p.path === activePath));
    if (visibility === "related" && !focused) continue;
    const color = issues.has(spec.id) ? "#ff998a" : relation.color;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = focused ? 2.5 : 1.2;
    ctx.globalAlpha = selected && !focused ? 0.16 : focused ? 0.95 : 0.58;
    let badge = {
      x: points.reduce((sum, p) => sum + p.x, 0) / points.length,
      y: points.reduce((sum, p) => sum + p.y, 0) / points.length
    };

    if (relation.type === "angle" || relation.type === "angleSector") {
      const a =
        relation.type === "angleSector"
          ? spec.centerAngle - spec.width / 2
          : Math.atan2(points[0].y - center.y, points[0].x - center.x);
      let b =
        relation.type === "angleSector"
          ? spec.centerAngle + spec.width / 2
          : Math.atan2(points[1].y - center.y, points[1].x - center.x);
      while (b < a) b += Math.PI * 2;
      if (b - a > Math.PI) b -= Math.PI * 2;
      const radius = relation.type === "angleSector" ? state.outerRadius * 0.96 : state.outerRadius * 0.29;
      ctx.beginPath();
      ctx.arc(center.x, center.y, radius, a, b, b < a);
      ctx.stroke();
      ctx.setLineDash([3, 5]);
      line(radialPoint(a, state.innerRadius), radialPoint(a, radius));
      line(radialPoint(b, state.innerRadius), radialPoint(b, radius));
      badge = radialPoint((a + b) / 2, radius + 10);
    } else if (relation.type === "sum" && points.length > 2) {
      ctx.setLineDash([5, 5]);
      for (let i = 0; i < points.length; i++) line(points[i], points[(i + 1) % points.length]);
      badge.y += 24;
    } else if (relation.type === "spring") {
      const [a, b] = points,
        dx = b.x - a.x,
        dy = b.y - a.y,
        distance = Math.hypot(dx, dy) || 1;
      ctx.beginPath();
      for (let i = 0; i <= 80; i++) {
        const t = i / 80,
          wave = Math.sin(t * Math.PI * 20) * 5 * Math.sin(t * Math.PI);
        const x = a.x + dx * t - (dy / distance) * wave,
          y = a.y + dy * t + (dx / distance) * wave;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      badge.x += relation.id === "air-spring" ? -18 : 16;
      badge.y += relation.id === "air-spring" ? -16 : 20;
    } else {
      if (relation.type === "sum") ctx.setLineDash([5, 5]);
      if (relation.type === "separation") ctx.setLineDash([2, 6]);
      line(points[0], points[1]);
      if (relation.type === "distanceRatio") {
        ctx.setLineDash([2, 5]);
        line(center, points[0]);
        line(center, points[1]);
      }
      if (relation.type === "fixedDistance") {
        const [a, b] = points,
          dx = b.x - a.x,
          dy = b.y - a.y,
          length = Math.hypot(dx, dy) || 1;
        for (const p of points)
          line(
            { x: p.x - (dy / length) * 5, y: p.y + (dx / length) * 5 },
            { x: p.x + (dy / length) * 5, y: p.y - (dx / length) * 5 }
          );
      }
      if (relation.id === "blend") badge.y += 18;
    }
    ctx.setLineDash([]);
    ctx.globalAlpha = selected && !focused ? 0.25 : 1;
    ctx.fillStyle = "#192223";
    ctx.beginPath();
    ctx.roundRect(badge.x - 16, badge.y - 10, 32, 20, 5);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = focused ? 1.5 : 0.7;
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.font = "10px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(relation.number, badge.x, badge.y);
    if (focused) {
      for (const p of points) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 14, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.restore();
    drawn.push(relation.id);
  }

  if (guides) {
    ctx.save();
    ctx.strokeStyle = "#79938b";
    ctx.fillStyle = "#aec9bd";
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 7]);
    for (const radius of [state.innerRadius, state.outerRadius]) {
      ctx.beginPath();
      ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.font = "10px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.fillText("10 radial bounds · shared annulus", center.x, center.y + state.outerRadius + 20);
    ctx.restore();
    drawn.push("radial-bounds");
  }
  return drawn;
}
