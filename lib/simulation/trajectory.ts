import type { ScenarioParams, TrajectoryDef, Vec3 } from "./types";

const MACH_MS = 343;

export function quadraticBezier(p0: Vec3, p1: Vec3, p2: Vec3, u: number): Vec3 {
  const t = Math.min(1, Math.max(0, u));
  const om = 1 - t;
  return {
    x: om * om * p0.x + 2 * om * t * p1.x + t * t * p2.x,
    y: om * om * p0.y + 2 * om * t * p1.y + t * t * p2.y,
    z: om * om * p0.z + 2 * om * t * p1.z + t * t * p2.z,
  };
}

export function bezierTangent(p0: Vec3, p1: Vec3, p2: Vec3, u: number): Vec3 {
  const t = Math.min(1, Math.max(0, u));
  const om = 1 - t;
  const dx = 2 * om * (p1.x - p0.x) + 2 * t * (p2.x - p1.x);
  const dy = 2 * om * (p1.y - p0.y) + 2 * t * (p2.y - p1.y);
  const dz = 2 * om * (p1.z - p0.z) + 2 * t * (p2.z - p1.z);
  const len = Math.hypot(dx, dy, dz) || 1;
  return { x: dx / len, y: dy / len, z: dz / len };
}

function approxBezierLength(p0: Vec3, p1: Vec3, p2: Vec3, segments = 32): number {
  let len = 0;
  let prev = p0;
  for (let i = 1; i <= segments; i++) {
    const u = i / segments;
    const p = quadraticBezier(p0, p1, p2, u);
    len += Math.hypot(p.x - prev.x, p.y - prev.y, p.z - prev.z);
    prev = p;
  }
  return len;
}

function defenseMultiplier(mode: ScenarioParams["defenseMode"]): number {
  switch (mode) {
    case "builder":
      return 1.15;
    case "parameters":
      return 1.05;
    default:
      return 0.95;
  }
}

/** Build missile arc and timing from scenario sliders (educational / tunable, not classified physics). */
export function buildTrajectory(scenario: ScenarioParams): {
  trajectory: TrajectoryDef;
  interceptorStart: Vec3;
  interceptorSpeed: number;
} {
  const mach = 2 + (scenario.missileSpeed / 100) * 10;
  const angleRad = (Math.max(5, Math.min(85, scenario.launchAngle)) * Math.PI) / 180;
  const distFactor = 0.4 + (scenario.targetDistance / 100) * 1.2;

  const p0: Vec3 = { x: -55 * distFactor, y: 4, z: -15 * distFactor };
  const p2: Vec3 = { x: 45 * distFactor, y: 10, z: 18 * distFactor };
  const mid = {
    x: (p0.x + p2.x) / 2 + Math.sin(angleRad) * 8,
    y: Math.max(p0.y, p2.y) + 25 * Math.sin(angleRad) * distFactor,
    z: (p0.z + p2.z) / 2,
  };
  const p1: Vec3 = mid;

  const pathLenKm = approxBezierLength(p0, p1, p2) / 10;
  const missileSpeedMs = mach * MACH_MS;
  const durationSec = Math.max(6, Math.min(22, (pathLenKm * 1000) / missileSpeedMs));

  const trajectory: TrajectoryDef = { p0, p1, p2, durationSec };

  const interceptorStart: Vec3 = { x: 52 * distFactor, y: 3, z: -22 * distFactor };
  const baseInt = missileSpeedMs * 1.25 * defenseMultiplier(scenario.defenseMode);
  const interceptorSpeed = baseInt / 10;

  return { trajectory, interceptorStart, interceptorSpeed };
}

export function missilePosition(def: TrajectoryDef, elapsedSec: number): Vec3 {
  const u = elapsedSec / def.durationSec;
  return quadraticBezier(def.p0, def.p1, def.p2, u);
}

export function sub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

export function len(v: Vec3): number {
  return Math.hypot(v.x, v.y, v.z);
}

export function normalize(v: Vec3): Vec3 {
  const l = len(v) || 1;
  return { x: v.x / l, y: v.y / l, z: v.z / l };
}

export function addScaled(a: Vec3, b: Vec3, s: number): Vec3 {
  return { x: a.x + b.x * s, y: a.y + b.y * s, z: a.z + b.z * s };
}
