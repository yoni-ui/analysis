"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type {
  CameraMode,
  DefenseMode,
  RunSummary,
  ScenarioParams,
} from "@/lib/simulation/types";
import type { TacticalAnalysis } from "@/lib/ai/types";

const STORAGE_KEY = "tactical-vanguard-v1";

export type SimPlayback = "idle" | "running" | "paused" | "ended";

interface SimulatorState {
  scenario: ScenarioParams;
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
  setCameraMode: (m: CameraMode) => void;

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
      scenario: {
        missileSpeed: 70,
        launchAngle: 45,
        targetDistance: 60,
        defenseMode: "builder",
      },
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
        set((s) => ({ scenario: { ...s.scenario, missileSpeed: v } })),
      setLaunchAngle: (v) =>
        set((s) => ({ scenario: { ...s.scenario, launchAngle: v } })),
      setTargetDistance: (v) =>
        set((s) => ({ scenario: { ...s.scenario, targetDistance: v } })),
      setDefenseMode: (m) =>
        set((s) => ({ scenario: { ...s.scenario, defenseMode: m } })),
      setCameraMode: (m) => set({ cameraMode: m }),

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

      importScenario: (params) => set({ scenario: { ...params } }),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ scenario: s.scenario, cameraMode: s.cameraMode }),
      skipHydration: true,
    }
  )
);

export function exportScenarioJson(): string {
  const { scenario } = useSimulatorStore.getState();
  return JSON.stringify({ version: 1, scenario }, null, 2);
}

export function importScenarioFromJson(text: string): boolean {
  try {
    const o = JSON.parse(text) as { scenario?: ScenarioParams };
    if (!o.scenario) return false;
    const { missileSpeed, launchAngle, targetDistance, defenseMode } = o.scenario;
    if (
      typeof missileSpeed !== "number" ||
      typeof launchAngle !== "number" ||
      typeof targetDistance !== "number"
    )
      return false;
    useSimulatorStore.getState().importScenario({
      missileSpeed,
      launchAngle,
      targetDistance,
      defenseMode: defenseMode ?? "builder",
    });
    return true;
  } catch {
    return false;
  }
}
