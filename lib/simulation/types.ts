export type Vec3 = { x: number; y: number; z: number };

export type DefenseMode = "builder" | "parameters" | "staging";

export type CameraMode = "orbital" | "cad" | "telemetry";

export interface ScenarioParams {
  missileSpeed: number;
  launchAngle: number;
  targetDistance: number;
  defenseMode: DefenseMode;
  /** 0 = smooth ballistic arc; higher = stronger mid-course lateral “projective shift” second leg. */
  maneuverIntensity: number;
  /** When the shift happens along the nominal path (0 = early … 100 = late). */
  maneuverTiming: number;
}

export interface TrajectoryDef {
  p0: Vec3;
  p1: Vec3;
  p2: Vec3;
  durationSec: number;
}

/** Missile path: single arc or two-segment Bezier after a mid-course direction change. */
export type MissilePath =
  | { kind: "ballistic"; seg: TrajectoryDef }
  | {
      kind: "shifted";
      first: TrajectoryDef;
      second: TrajectoryDef;
      splitTimeSec: number;
      totalDurationSec: number;
    };

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
  path: MissilePath;
  interceptorStart: Vec3;
  interceptorSpeed: number;
  logs: string[];
}
