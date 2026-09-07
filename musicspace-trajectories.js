// Authored v1 trajectory speeds are expressed per 1/60-second simulation step.
(function exposeTrajectories(global) {
  const isNode = typeof module === "object" && module.exports;
  const { WIDTH, HEIGHT, FRAMES_PER_SECOND } = isNode
    ? require("./musicspace-constants")
    : global.MusicSpaceConstants;
  function createTrajectories({ getListener, getObjectByName }) {
    function clamp(value, min, max) {
      return Math.min(max, Math.max(min, value));
    }
    function rotatorFrameDelta(trajectory) {
      const periodSeconds = Math.max(0.5, trajectory.periodSeconds || 20);
      return (trajectory.direction * (Math.PI * 2)) / (periodSeconds * FRAMES_PER_SECOND);
    }

    function resolveTrajectoryEndpoint(endpoint, fallbackX, fallbackY) {
      if (endpoint?.type === "object") {
        const object = getObjectByName(endpoint.name);
        if (object) {
          return { x: object.x, y: object.y };
        }
      }

      return {
        x: endpoint?.x ?? fallbackX,
        y: endpoint?.y ?? fallbackY
      };
    }

    function normalizeTrajectory(trajectory, x, y) {
      const type = trajectory && trajectory.type ? trajectory.type : "free";

      if (type === "translation") {
        return {
          type,
          vx: trajectory.vx ?? 1.2,
          vy: trajectory.vy ?? 0.6,
          bounce: trajectory.bounce ?? true
        };
      }

      if (type === "rotation") {
        const centerX = trajectory.centerX ?? getListener()?.x ?? WIDTH / 2;
        const centerY = trajectory.centerY ?? getListener()?.y ?? HEIGHT / 2;
        return {
          type,
          centerX,
          centerY,
          radius: trajectory.radius ?? Math.max(40, Math.hypot(x - centerX, y - centerY)),
          phase: trajectory.phase ?? Math.atan2(y - centerY, x - centerX),
          angularSpeed: trajectory.angularSpeed ?? 0.018
        };
      }

      if (type === "shuttle") {
        const start = normalizeTrajectoryEndpoint(
          trajectory.start,
          trajectory.ax ?? x - 80,
          trajectory.ay ?? y
        );
        const end = normalizeTrajectoryEndpoint(trajectory.end, trajectory.bx ?? x + 80, trajectory.by ?? y);
        return {
          type,
          start,
          end,
          ax: start.x,
          ay: start.y,
          bx: end.x,
          by: end.y,
          phase: trajectory.phase ?? 0.5,
          speed: trajectory.speed ?? 0.01,
          direction: trajectory.direction ?? 1,
          showPath: trajectory.showPath ?? true
        };
      }

      if (type === "bounce") {
        return {
          type,
          vx: trajectory.vx ?? 1.8,
          vy: trajectory.vy ?? 1.1
        };
      }

      if (type === "rotator") {
        return {
          type,
          running: trajectory.running ?? true,
          periodSeconds: trajectory.periodSeconds ?? 20,
          direction: trajectory.direction ?? 1,
          displacementInducesRotation: trajectory.displacementInducesRotation ?? true,
          phase: trajectory.phase ?? 0,
          rotationDelta: 0
        };
      }

      return { type: "free" };
    }

    function normalizeTrajectoryEndpoint(endpoint, fallbackX, fallbackY) {
      if (endpoint?.type === "object") {
        const object = getObjectByName(endpoint.name);
        return {
          type: "object",
          name: endpoint.name,
          x: object?.x ?? endpoint.x ?? fallbackX,
          y: object?.y ?? endpoint.y ?? fallbackY
        };
      }

      return {
        type: "fixed",
        x: endpoint?.x ?? fallbackX,
        y: endpoint?.y ?? fallbackY
      };
    }
    function tick(mover) {
      const trajectory = mover.trajectory || { type: "free" };
      trajectory.rotationDelta = 0;

      if (trajectory.type === "translation") {
        mover.x += trajectory.vx;
        mover.y += trajectory.vy;
        if (trajectory.bounce) {
          reflectWithinBounds(mover, trajectory);
        }
        return true;
      }

      if (trajectory.type === "rotation") {
        trajectory.phase += trajectory.angularSpeed;
        mover.x = trajectory.centerX + trajectory.radius * Math.cos(trajectory.phase);
        mover.y = trajectory.centerY + trajectory.radius * Math.sin(trajectory.phase);
        return true;
      }

      if (trajectory.type === "shuttle") {
        trajectory.phase += trajectory.speed * trajectory.direction;
        if (trajectory.phase > 1 || trajectory.phase < 0) {
          trajectory.phase = clamp(trajectory.phase, 0, 1);
          trajectory.direction *= -1;
        }
        const start = resolveTrajectoryEndpoint(trajectory.start, trajectory.ax, trajectory.ay);
        const end = resolveTrajectoryEndpoint(trajectory.end, trajectory.bx, trajectory.by);
        mover.x = start.x + (end.x - start.x) * trajectory.phase;
        mover.y = start.y + (end.y - start.y) * trajectory.phase;
        return true;
      }

      if (trajectory.type === "bounce") {
        mover.x += trajectory.vx;
        mover.y += trajectory.vy;
        reflectWithinBounds(mover, trajectory);
        return true;
      }

      if (trajectory.type === "rotator") {
        if (!trajectory.running) {
          return false;
        }

        trajectory.rotationDelta = rotatorFrameDelta(trajectory);
        trajectory.phase += trajectory.rotationDelta;
        return Math.abs(trajectory.rotationDelta) > 0;
      }

      return false;
    }
    function reflectWithinBounds(mover, trajectory) {
      if (mover.x < mover.radius || mover.x > WIDTH - mover.radius) {
        trajectory.vx *= -1;
        mover.x = clamp(mover.x, mover.radius, WIDTH - mover.radius);
      }

      if (mover.y < mover.radius || mover.y > HEIGHT - mover.radius) {
        trajectory.vy *= -1;
        mover.y = clamp(mover.y, mover.radius, HEIGHT - mover.radius);
      }
    }
    return {
      normalizeTrajectory,
      normalizeTrajectoryEndpoint,
      rotatorFrameDelta,
      resolveTrajectoryEndpoint,
      tick
    };
  }
  const api = { createTrajectories };
  if (isNode) module.exports = api;
  else global.MusicSpaceTrajectories = api;
})(globalThis);
