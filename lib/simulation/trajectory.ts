import type { MissilePath, ScenarioParams, TrajectoryDef, Vec3 } from "./types";

const MACH_MS = 343;
const MANEUVER_THRESHOLD = 8;

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

function lerpVec3(a: Vec3, b: Vec3, t: number): Vec3 {
  const u = Math.min(1, Math.max(0, t));
  return {
    x: a.x + (b.x - a.x) * u,
    y: a.y + (b.y - a.y) * u,
    z: a.z + (b.z - a.z) * u,
  };
}

/** De Casteljau split of quadratic Bezier at parameter t in (0,1). */
function splitQuadraticBezier(p0: Vec3, p1: Vec3, p2: Vec3, t: number) {
  const b01 = lerpVec3(p0, p1, t);
  const b12 = lerpVec3(p1, p2, t);
  const j = lerpVec3(b01, b12, t);
  return {
    left: { p0, p1: b01, p2: j } as const,
    right: { p0: j, p1: b12, p2 } as const,
  };
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

function perpendicularShiftDirection(tan: Vec3): Vec3 {
  const n = {
    x: -tan.z,
    y: tan.y * 0.2,
    z: tan.x,
  };
  const len = Math.hypot(n.x, n.y, n.z) || 1;
  return { x: n.x / len, y: n.y / len, z: n.z / len };
}

export function pathTotalDuration(path: MissilePath): number {
  if (path.kind === "ballistic") return path.seg.durationSec;
  return path.totalDurationSec;
}

export function missileAt(path: MissilePath, elapsedSec: number): Vec3 {
  if (path.kind === "ballistic") {
    const u = Math.min(1, Math.max(0, elapsedSec / path.seg.durationSec));
    return quadraticBezier(path.seg.p0, path.seg.p1, path.seg.p2, u);
  }
  if (elapsedSec <= path.splitTimeSec) {
    const d = path.splitTimeSec || 1e-6;
    const u = Math.min(1, Math.max(0, elapsedSec / d));
    return quadraticBezier(path.first.p0, path.first.p1, path.first.p2, u);
  }
  const rem = elapsedSec - path.splitTimeSec;
  const d = path.totalDurationSec - path.splitTimeSec || 1e-6;
  const u = Math.min(1, Math.max(0, rem / d));
  return quadraticBezier(path.second.p0, path.second.p1, path.second.p2, u);
}

export function missileTangentAt(path: MissilePath, elapsedSec: number): Vec3 {
  if (path.kind === "ballistic") {
    const u = Math.min(1, Math.max(0, elapsedSec / path.seg.durationSec));
    return bezierTangent(path.seg.p0, path.seg.p1, path.seg.p2, Math.min(0.999, u + 0.02));
  }
  if (elapsedSec <= path.splitTimeSec) {
    const d = path.splitTimeSec || 1e-6;
    const u = Math.min(1, Math.max(0, elapsedSec / d));
    return bezierTangent(path.first.p0, path.first.p1, path.first.p2, Math.min(0.999, u + 0.02));
  }
  const rem = elapsedSec - path.splitTimeSec;
  const d = path.totalDurationSec - path.splitTimeSec || 1e-6;
  const u = Math.min(1, Math.max(0, rem / d));
  return bezierTangent(path.second.p0, path.second.p1, path.second.p2, Math.min(0.999, u + 0.02));
}

/** Build missile path and interceptor kinematics (educational / tunable). */
export function buildTrajectory(scenario: ScenarioParams): {
  path: MissilePath;
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

  const missileSpeedMs = mach * MACH_MS;
  const intensity = Math.max(0, Math.min(100, scenario.maneuverIntensity ?? 0));
  const timing = Math.max(0, Math.min(100, scenario.maneuverTiming ?? 50));
  const uSplit = 0.2 + (timing / 100) * 0.55;

  if (intensity < MANEUVER_THRESHOLD) {
    const pathLenKm = approxBezierLength(p0, p1, p2) / 10;
    const durationSec = Math.max(6, Math.min(22, (pathLenKm * 1000) / missileSpeedMs));
    const seg: TrajectoryDef = { p0, p1, p2, durationSec };
    const interceptorStart: Vec3 = { x: 52 * distFactor, y: 3, z: -22 * distFactor };
    const interceptorSpeed = (missileSpeedMs * 1.25 * defenseMultiplier(scenario.defenseMode)) / 10;
    return {
      path: { kind: "ballistic", seg },
      interceptorStart,
      interceptorSpeed,
    };
  }

  const { left, right } = splitQuadraticBezier(p0, p1, p2, uSplit);
  const tan = bezierTangent(p0, p1, p2, uSplit);
  const n = perpendicularShiftDirection(tan);
  const shiftMag = (intensity / 100) * 26 * distFactor;

  const secondP1 = {
    x: right.p1.x + n.x * shiftMag * 0.4,
    y: right.p1.y + n.y * shiftMag * 0.4,
    z: right.p1.z + n.z * shiftMag * 0.4,
  };
  const secondP2 = {
    x: right.p2.x + n.x * shiftMag,
    y: right.p2.y + n.y * shiftMag * 0.35,
    z: right.p2.z + n.z * shiftMag,
  };

  const len1 = approxBezierLength(left.p0, left.p1, left.p2);
  const len2 = approxBezierLength(right.p0, secondP1, secondP2);
  const totalLen = len1 + len2 || 1;
  const pathLenKm = totalLen / 10;
  const totalDurationSec = Math.max(6, Math.min(24, (pathLenKm * 1000) / missileSpeedMs));
  const splitTimeSec = totalDurationSec * (len1 / totalLen);

  const first: TrajectoryDef = {
    p0: left.p0,
    p1: left.p1,
    p2: left.p2,
    durationSec: splitTimeSec,
  };
  const second: TrajectoryDef = {
    p0: right.p0,
    p1: secondP1,
    p2: secondP2,
    durationSec: totalDurationSec - splitTimeSec,
  };

  const path: MissilePath = {
    kind: "shifted",
    first,
    second,
    splitTimeSec,
    totalDurationSec,
  };

  const interceptorStart: Vec3 = { x: 52 * distFactor, y: 3, z: -22 * distFactor };
  const interceptorSpeed = (missileSpeedMs * 1.25 * defenseMultiplier(scenario.defenseMode)) / 10;

  return { path, interceptorStart, interceptorSpeed };
}

/** @deprecated use missileAt */
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
