"use client";

import type { RunSummary } from "@/lib/simulation/types";
import type { ScenarioParams } from "@/lib/simulation/types";
import type { TacticalAnalysis } from "./types";
import { mockTacticalAnalysis } from "./mock";

export async function fetchTacticalAnalysis(
  scenario: ScenarioParams,
  run: RunSummary
): Promise<TacticalAnalysis> {
  try {
    const res = await fetch("/api/tactical", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scenario, run }),
    });
    if (!res.ok) throw new Error(String(res.status));
    const data = (await res.json()) as { analysis?: TacticalAnalysis };
    if (!data.analysis) throw new Error("no analysis");
    return data.analysis;
  } catch {
    return mockTacticalAnalysis(scenario, run);
  }
}
