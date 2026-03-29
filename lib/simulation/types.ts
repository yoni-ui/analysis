export type Vec3 = { x: number; y: number; z: number };

export type DefenseMode = "builder" | "parameters" | "staging";

export type CameraMode = "orbital" | "cad" | "telemetry";

export interface ScenarioParams {
  missileSpeed: number;
  launchAngle: number;
  targetDistance: number;
  defenseMode: DefenseMode;
}

export interface TrajectoryDef {
  p0: Vec3;
  p1: Vec3;
  p2: Vec3;
  durationSec: number;
}

export interface SimSnapshot {
  t: number;
  missile: Vec3;
  interceptor: Vec3;
  distance: number;
  phase: "boost" | "cruise" | "intercept" | "miss" | "idle";
}

export interface RunSummary {
  hit: boolean;
  interceptTimeSec: number | null;
  minDistance: number;
  totalDurationSec: number;
  missileDurationSec: number;
  trajectory: TrajectoryDef;
  interceptorStart: Vec3;
  interceptorSpeed: number;
  logs: string[];
}
