import type { RunSummary } from "@/lib/simulation/types";
import type { ScenarioParams } from "@/lib/simulation/types";
import type { TacticalAnalysis } from "./types";

export function mockTacticalAnalysis(
  scenario: ScenarioParams,
  run: RunSummary
): TacticalAnalysis {
  const mach = 2 + (scenario.missileSpeed / 100) * 10;
  let base = run.hit ? 88 : 42;
  base += scenario.defenseMode === "builder" ? 8 : scenario.defenseMode === "parameters" ? 4 : -6;
  base -= Math.min(15, mach);
  const maneuver = scenario.maneuverIntensity ?? 0;
  base -= maneuver / 22;
  if (run.path.kind === "shifted") base -= 4;
  const interceptionProbability = Math.max(5, Math.min(99, Math.round(base * 10) / 10));

  const riskLevel: TacticalAnalysis["riskLevel"] =
    mach > 8 ? "CRITICAL" : mach > 5 ? "HIGH" : mach > 3 ? "MEDIUM" : "LOW";

  const shiftNote =
    run.path.kind === "shifted"
      ? ` Mid-course projective shift at ~${run.path.splitTimeSec.toFixed(1)}s complicates lead pursuit.`
      : "";
  const briefing = run.hit
    ? `Intercept geometry closed successfully. Minimum separation ${run.minDistance.toFixed(2)} units. Mach ${mach.toFixed(1)} threat channel suppressed.${shiftNote}`
    : `Closest approach ${run.minDistance.toFixed(2)} units — outside kill radius. Recommend adjusting defense config or engagement timing for Mach ${mach.toFixed(1)} vector.${shiftNote}`;

  const recommendations = run.hit
    ? [
        {
          title: "Primary Battery Pos A1",
          detail: "Hold posture; verify debris field tracking.",
        },
        {
          title: "Kinetic Shielding",
          detail: "Maintain overlap at predicted impact corridor.",
        },
      ]
    : [
        {
          title: "Re-engage Window",
          detail: "Shift to PARAMETERS staging for faster closure rate.",
        },
        {
          title: "Sensor Tasking",
          detail: "Tighten track on boost phase for earlier commit.",
        },
      ];

  return {
    interceptionProbability,
    riskLevel,
    briefing,
    recommendations,
  };
}
