"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { getWarTemplate } from "@/lib/simulation/war-templates";
import type {
  CameraMode,
  DefenseMode,
  RunSummary,
  ScenarioParams,
} from "@/lib/simulation/types";
import type { TacticalAnalysis } from "@/lib/ai/types";

const STORAGE_KEY = "tactical-vanguard-v1";

export type SimPlayback = "idle" | "running" | "paused" | "ended";

const defaultScenario: ScenarioParams = {
  missileSpeed: 70,
  launchAngle: 45,
  targetDistance: 60,
  defenseMode: "builder",
  maneuverIntensity: 0,
  maneuverTiming: 50,
};

function normalizeScenario(p: Partial<ScenarioParams>): ScenarioParams {
  return {
    missileSpeed: typeof p.missileSpeed === "number" ? p.missileSpeed : defaultScenario.missileSpeed,
    launchAngle: typeof p.launchAngle === "number" ? p.launchAngle : defaultScenario.launchAngle,
    targetDistance:
      typeof p.targetDistance === "number" ? p.targetDistance : defaultScenario.targetDistance,
    defenseMode: (p.defenseMode as DefenseMode) ?? defaultScenario.defenseMode,
    maneuverIntensity:
      typeof p.maneuverIntensity === "number" ? p.maneuverIntensity : defaultScenario.maneuverIntensity,
    maneuverTiming:
      typeof p.maneuverTiming === "number" ? p.maneuverTiming : defaultScenario.maneuverTiming,
  };
}

interface SimulatorState {
  scenario: ScenarioParams;
  warTemplateId: string | null;
  cameraMode: CameraMode;
  playback: SimPlayback;
  simTime: number;
  lastRun: RunSummary | null;
  telemetryLines: { time: string; text: string; tone: "primary" | "secondary" | "error" }[];
  ai: {
    analysis: TacticalAnalysis | null;
    loading: boolean;
    error: string | null;
  };

  setMissileSpeed: (v: number) => void;
  setLaunchAngle: (v: number) => void;
  setTargetDistance: (v: number) => void;
  setDefenseMode: (m: DefenseMode) => void;
  setManeuverIntensity: (v: number) => void;
  setManeuverTiming: (v: number) => void;
  setCameraMode: (m: CameraMode) => void;
  loadWarTemplate: (id: string) => void;

  beginRun: (summary: RunSummary) => void;
  setSimTime: (t: number) => void;
  setPlayback: (p: SimPlayback) => void;
  tickTelemetry: () => void;
  resetRun: () => void;

  setAiLoading: (v: boolean) => void;
  setAiResult: (a: TacticalAnalysis | null, err?: string | null) => void;

  importScenario: (s: ScenarioParams) => void;
}

function formatClock(d: Date): string {
  return d.toTimeString().slice(0, 8);
}

export const useSimulatorStore = create<SimulatorState>()(
  persist(
    (set, get) => ({
      scenario: { ...defaultScenario },
      warTemplateId: null,
      cameraMode: "cad",
      playback: "idle",
      simTime: 0,
      lastRun: null,
      telemetryLines: [
        { time: "04:12:22", text: "Pinging Server Node_04... OK", tone: "primary" },
        { time: "04:12:24", text: "Awaiting uplink authorization...", tone: "primary" },
        { time: "04:12:25", text: "Scanning Sub-sector 12-A...", tone: "secondary" },
        { time: "04:12:28", text: "Signature Detected: MIRV_CLASS_7", tone: "error" },
      ],
      ai: { analysis: null, loading: false, error: null },

      setMissileSpeed: (v) =>
        set((s) => ({
          scenario: { ...s.scenario, missileSpeed: v },
          warTemplateId: null,
        })),
      setLaunchAngle: (v) =>
        set((s) => ({
          scenario: { ...s.scenario, launchAngle: v },
          warTemplateId: null,
        })),
      setTargetDistance: (v) =>
        set((s) => ({
          scenario: { ...s.scenario, targetDistance: v },
          warTemplateId: null,
        })),
      setDefenseMode: (m) =>
        set((s) => ({
          scenario: { ...s.scenario, defenseMode: m },
          warTemplateId: null,
        })),
      setManeuverIntensity: (v) =>
        set((s) => ({
          scenario: { ...s.scenario, maneuverIntensity: v },
          warTemplateId: null,
        })),
      setManeuverTiming: (v) =>
        set((s) => ({
          scenario: { ...s.scenario, maneuverTiming: v },
          warTemplateId: null,
        })),
      setCameraMode: (m) => set({ cameraMode: m }),

      loadWarTemplate: (id) => {
        const t = getWarTemplate(id);
        if (!t) return;
        set({ scenario: { ...t.scenario }, warTemplateId: id });
      },

      beginRun: (summary) =>
        set({
          lastRun: summary,
          playback: "running",
          simTime: 0,
          ai: { analysis: null, loading: false, error: null },
        }),

      setSimTime: (t) => set({ simTime: t }),
      setPlayback: (p) => set({ playback: p }),

      tickTelemetry: () => {
        const now = formatClock(new Date());
        set((s) => ({
          telemetryLines: [
            ...s.telemetryLines.slice(-12),
            {
              time: now,
              text: `Sim_T ${get().simTime.toFixed(2)}s // Frame_OK`,
              tone: "primary" as const,
            },
          ],
        }));
      },

      resetRun: () =>
        set({
          playback: "idle",
          simTime: 0,
          lastRun: null,
          ai: { analysis: null, loading: false, error: null },
        }),

      setAiLoading: (v) => set((s) => ({ ai: { ...s.ai, loading: v } })),
      setAiResult: (a, err = null) =>
        set({ ai: { analysis: a, loading: false, error: err } }),

      importScenario: (params) =>
        set({
          scenario: normalizeScenario(params),
          warTemplateId: null,
        }),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        scenario: s.scenario,
        cameraMode: s.cameraMode,
        warTemplateId: s.warTemplateId,
      }),
      skipHydration: true,
    }
  )
);

export function exportScenarioJson(): string {
  const { scenario, warTemplateId } = useSimulatorStore.getState();
  return JSON.stringify({ version: 2, scenario, warTemplateId }, null, 2);
}

export function importScenarioFromJson(text: string): boolean {
  try {
    const o = JSON.parse(text) as {
      version?: number;
      scenario?: Partial<ScenarioParams> & Record<string, unknown>;
      warTemplateId?: string | null;
    };
    if (!o.scenario) return false;
    const sc = o.scenario;
    if (
      typeof sc.missileSpeed !== "number" ||
      typeof sc.launchAngle !== "number" ||
      typeof sc.targetDistance !== "number"
    )
      return false;
    const scenario = normalizeScenario(sc);
    let warTemplateId: string | null = null;
    if (typeof o.warTemplateId === "string" && getWarTemplate(o.warTemplateId)) {
      warTemplateId = o.warTemplateId;
    }
    useSimulatorStore.setState({ scenario, warTemplateId });
    return true;
  } catch {
    return false;
  }
}
