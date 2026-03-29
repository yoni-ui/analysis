import type { RunSummary } from "@/lib/simulation/types";
import type { ScenarioParams } from "@/lib/simulation/types";

export function buildTacticalPayload(scenario: ScenarioParams, run: RunSummary) {
  return {
    scenario: {
      missileSpeedSlider: scenario.missileSpeed,
      launchAngleDeg: scenario.launchAngle,
      targetDistanceSlider: scenario.targetDistance,
      defenseMode: scenario.defenseMode,
      maneuverIntensity: scenario.maneuverIntensity,
      maneuverTiming: scenario.maneuverTiming,
    },
    run: {
      hit: run.hit,
      interceptTimeSec: run.interceptTimeSec,
      minDistance: run.minDistance,
      totalDurationSec: run.totalDurationSec,
      missileDurationSec: run.missileDurationSec,
      pathKind: run.path.kind,
      midcourseShiftSec:
        run.path.kind === "shifted" ? run.path.splitTimeSec : null,
    },
  };
}

export const GROQ_SYSTEM = `You are a concise tactical analyst for an educational missile-defense simulation (not real operations).
Respond with ONLY valid JSON matching:
{"interceptionProbability":number,"riskLevel":"LOW"|"MEDIUM"|"HIGH"|"CRITICAL","briefing":string,"recommendations":[{"title":string,"detail":string}]}
Probability is 0-100. Keep briefing under 400 characters. 2-4 recommendations.`;

export const GEMINI_SYSTEM = `You are briefing a commander for a fictional simulation. Output short markdown: a title line, then bullets for assessment and recommended actions. Under 250 words.`;
