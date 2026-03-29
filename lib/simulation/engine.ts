import {
  addScaled,
  buildTrajectory,
  len,
  missileAt,
  normalize,
  pathTotalDuration,
  sub,
} from "./trajectory";
import type { RunSummary, ScenarioParams, Vec3 } from "./types";

const HIT_RADIUS = 3.2;
const MAX_SIM_SEC = 50;
const DT = 1 / 60;

export function runSimulationOffline(scenario: ScenarioParams): RunSummary {
  const { path, interceptorStart, interceptorSpeed } = buildTrajectory(scenario);
  const flightEnd = pathTotalDuration(path);
  let interceptor: Vec3 = { ...interceptorStart };
  let t = 0;
  let minDistance = Infinity;
  let hit = false;
  let interceptTime: number | null = null;
  const logs: string[] = [
    "Missile_Launched // Alpha_Site",
    "Interceptor_Fired // Battery_1",
  ];
  if (path.kind === "shifted") {
    logs.push(`Midcourse_Projective_Shift // T+${path.splitTimeSec.toFixed(2)}s`);
  }

  while (t < MAX_SIM_SEC) {
    const m = missileAt(path, Math.min(t, flightEnd));
    const d = len(sub(m, interceptor));
    if (d < minDistance) minDistance = d;
    if (d < HIT_RADIUS && !hit) {
      hit = true;
      interceptTime = t;
      logs.push("Target_Destroyed // Sector_01");
      break;
    }
    if (t >= flightEnd + 2 && !hit) break;

    const to = normalize(sub(m, interceptor));
    interceptor = addScaled(interceptor, to, interceptorSpeed * DT);
    t += DT;
  }

  if (!hit) {
    logs.push("Intercept_Miss // Reengage_Protocol");
  }

  const totalDurationSec = hit ? (interceptTime ?? t) + 1.5 : Math.min(t, MAX_SIM_SEC);

  return {
    hit,
    interceptTimeSec: interceptTime,
    minDistance,
    totalDurationSec,
    missileDurationSec: flightEnd,
    path,
    interceptorStart,
    interceptorSpeed,
    logs,
  };
}

export interface ReplayState {
  missile: Vec3;
  interceptor: Vec3;
  visualHit: boolean;
  explosionVisible: boolean;
  explosionPos: Vec3 | null;
}

/** Deterministic replay of pursuit up to tSec — use for paused/scrub so missile + interceptor stay in sync. */
export function replaySimState(run: RunSummary, tSec: number): ReplayState {
  const path = run.path;
  const flightEnd = pathTotalDuration(path);
  const cap = Math.max(0, Math.min(tSec, run.totalDurationSec));
  let interceptor: Vec3 = { ...run.interceptorStart };
  let t = 0;
  let visualHit = false;

  while (t + 1e-9 < cap) {
    const mt = Math.min(t, flightEnd);
    const m = missileAt(path, mt);
    const dist = len(sub(m, interceptor));
    if (dist < HIT_RADIUS && !visualHit) {
      visualHit = true;
    }
    if (!visualHit) {
      const to = normalize(sub(m, interceptor));
      interceptor = addScaled(interceptor, to, run.interceptorSpeed * DT);
    }
    t += DT;
  }

  const mt = Math.min(cap, flightEnd);
  const missile = missileAt(path, mt);

  const explosionVisible =
    run.hit &&
    run.interceptTimeSec != null &&
    cap >= run.interceptTimeSec - 0.02;

  let explosionPos: Vec3 | null = null;
  if (explosionVisible && run.interceptTimeSec != null) {
    const hitT = Math.min(run.interceptTimeSec, flightEnd);
    explosionPos = missileAt(path, hitT);
  }

  return {
    missile,
    interceptor,
    visualHit,
    explosionVisible,
    explosionPos,
  };
}
