/**
 * Educational scenario presets inspired by publicly discussed air-defense patterns.
 * Not a recreation of classified engagements, timelines, or weapon performance.
 */

import type { ScenarioParams } from "./types";

export interface WarScenarioTemplate {
  id: string;
  title: string;
  subtitle: string;
  scenario: ScenarioParams;
  /** Open-literature-style discussion of why intercepts often underperform vs idealized models. */
  failureAnalysis: string;
}

export const WAR_SCENARIO_TEMPLATES: WarScenarioTemplate[] = [
  {
    id: "gulf-ballistic-press",
    title: "1991-style theater ballistic press",
    subtitle: "Long-range lofted threat, early PATRIOT-era tracking debates",
    scenario: {
      missileSpeed: 78,
      launchAngle: 52,
      targetDistance: 72,
      defenseMode: "parameters",
      maneuverIntensity: 12,
      maneuverTiming: 35,
    },
    failureAnalysis:
      "Public post-war studies argued kill assessment and debris discrimination were harder than raw radar geometry suggests: breakup, short coherent track segments, and confusion between re-entry debris and warheads made “successful intercept” claims controversial. Sim takeaway: modest maneuvering plus sensor ambiguity lowers realized Pk compared to a clean ballistic solve.",
  },
  {
    id: "cruise-low-slow-maneuver",
    title: "Low-altitude cruise + late weave",
    subtitle: "Patterns often cited in 2022–2024 open reporting (Ukraine)",
    scenario: {
      missileSpeed: 42,
      launchAngle: 28,
      targetDistance: 55,
      defenseMode: "staging",
      maneuverIntensity: 68,
      maneuverTiming: 58,
    },
    failureAnalysis:
      "Open sources describe low RCS cruise weapons terrain-masking and late lateral jinks consuming interceptor energy budgets. Shoot-look-shoot is sensitive to latency; a vector change after commit can move the aimpoint outside the fuze basket. Sim takeaway: stronger mid-course shifts punish light defense configs and late commits.",
  },
  {
    id: "red-sea-saturation",
    title: "Saturation + subsonic swarm stress",
    subtitle: "Analogy to publicly reported 2023–2024 Red Sea engagements",
    scenario: {
      missileSpeed: 35,
      launchAngle: 22,
      targetDistance: 48,
      defenseMode: "parameters",
      maneuverIntensity: 45,
      maneuverTiming: 40,
    },
    failureAnalysis:
      "Magazine depth, cueing queues, and hold-fire rules matter as much as single-shot kinematics: many open articles stress defenders trading cost-per-shot vs salvo size. Sim models one threat, but the lesson transfers—if tracks split or timing staggers, projectors shift and the fire-control solution must be recomputed under time pressure.",
  },
  {
    id: "patriot-scud-analogy",
    title: "High-speed breakup / track-drop analogy",
    subtitle: "Simplified nod to Scud–Patriot technical controversy (unclassified summaries)",
    scenario: {
      missileSpeed: 92,
      launchAngle: 48,
      targetDistance: 80,
      defenseMode: "builder",
      maneuverIntensity: 55,
      maneuverTiming: 32,
    },
    failureAnalysis:
      "Unclassified summaries highlight unstable boosters shedding pieces, velocity mismatches, and brief radar coherence. Interceptors optimized for a smooth ballistic arc can miss when the effective centroid jumps. Sim takeaway: high maneuver timing early plus high closure speed widens the miss distance unless defense margin (Strong) is available.",
  },
];

export function getWarTemplate(id: string): WarScenarioTemplate | undefined {
  return WAR_SCENARIO_TEMPLATES.find((t) => t.id === id);
}
