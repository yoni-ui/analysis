import {
  addScaled,
  buildTrajectory,
  len,
  missilePosition,
  normalize,
  sub,
} from "./trajectory";
import type { RunSummary, ScenarioParams, Vec3 } from "./types";

const HIT_RADIUS = 3.2;
const MAX_SIM_SEC = 45;
const DT = 1 / 60;

export function runSimulationOffline(scenario: ScenarioParams): RunSummary {
  const { trajectory, interceptorStart, interceptorSpeed } = buildTrajectory(scenario);
  let interceptor: Vec3 = { ...interceptorStart };
  let t = 0;
  let minDistance = Infinity;
  let hit = false;
  let interceptTime: number | null = null;
  const logs: string[] = [
    "Missile_Launched // Alpha_Site",
    "Interceptor_Fired // Battery_1",
  ];

  while (t < MAX_SIM_SEC) {
    const m = missilePosition(trajectory, t);
    const d = len(sub(m, interceptor));
    if (d < minDistance) minDistance = d;
    if (d < HIT_RADIUS && !hit) {
      hit = true;
      interceptTime = t;
      logs.push("Target_Destroyed // Sector_01");
      break;
    }
    if (t >= trajectory.durationSec + 2 && !hit) break;

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
    missileDurationSec: trajectory.durationSec,
    trajectory,
    interceptorStart,
    interceptorSpeed,
    logs,
  };
}
