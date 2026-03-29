"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import ScenarioBuilderSimple from "./ScenarioBuilderSimple";
import gsap from "gsap";
import { useSimulatorStore, exportScenarioJson, importScenarioFromJson } from "@/lib/store/simulator-store";
import { runSimulationOffline } from "@/lib/simulation/engine";
import { fetchTacticalAnalysis } from "@/lib/ai/client";
import { WAR_SCENARIO_TEMPLATES, getWarTemplate } from "@/lib/simulation/war-templates";
import type { CameraMode, DefenseMode } from "@/lib/simulation/types";

const SimulationCanvas = dynamic(() => import("./SimulationCanvas"), { ssr: false });

function machLabel(speed: number) {
  const m = 2 + (speed / 100) * 10;
  return `MACH ${m.toFixed(1)}`;
}

function distanceLabel(dist: number) {
  const km = Math.round(200 + (dist / 100) * 2000);
  return `${km.toLocaleString()} KM`;
}

const PLAYBACK_STEP_SEC = 0.75;

export default function SimulatorApp() {
  const fileRef = useRef<HTMLInputElement>(null);
  const shellRef = useRef<HTMLElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const [advancedBuilder, setAdvancedBuilder] = useState(false);

  const scenario = useSimulatorStore((s) => s.scenario);
  const setMissileSpeed = useSimulatorStore((s) => s.setMissileSpeed);
  const setLaunchAngle = useSimulatorStore((s) => s.setLaunchAngle);
  const setTargetDistance = useSimulatorStore((s) => s.setTargetDistance);
  const setDefenseMode = useSimulatorStore((s) => s.setDefenseMode);
  const setManeuverIntensity = useSimulatorStore((s) => s.setManeuverIntensity);
  const setManeuverTiming = useSimulatorStore((s) => s.setManeuverTiming);
  const loadWarTemplate = useSimulatorStore((s) => s.loadWarTemplate);
  const warTemplateId = useSimulatorStore((s) => s.warTemplateId);
  const setCameraMode = useSimulatorStore((s) => s.setCameraMode);
  const cameraMode = useSimulatorStore((s) => s.cameraMode);
  const beginRun = useSimulatorStore((s) => s.beginRun);
  const resetRun = useSimulatorStore((s) => s.resetRun);
  const playback = useSimulatorStore((s) => s.playback);
  const setPlayback = useSimulatorStore((s) => s.setPlayback);
  const setSimTime = useSimulatorStore((s) => s.setSimTime);
  const simTime = useSimulatorStore((s) => s.simTime);
  const lastRun = useSimulatorStore((s) => s.lastRun);
  const ai = useSimulatorStore((s) => s.ai);
  const setAiLoading = useSimulatorStore((s) => s.setAiLoading);
  const setAiResult = useSimulatorStore((s) => s.setAiResult);

  useEffect(() => {
    void useSimulatorStore.persist.rehydrate();
  }, []);

  useLayoutEffect(() => {
    if (!shellRef.current) return;
    gsap.from(shellRef.current.querySelectorAll("[data-animate-panel]"), {
      opacity: 0,
      y: 12,
      duration: 0.45,
      stagger: 0.06,
      ease: "power2.out",
    });
  }, []);

  const onInitiate = useCallback(() => {
    const summary = runSimulationOffline(scenario);
    beginRun(summary);
  }, [beginRun, scenario]);

  const onExport = useCallback(() => {
    const blob = new Blob([exportScenarioJson()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "scenario.json";
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const onImportPick = useCallback(() => fileRef.current?.click(), []);

  const onImportFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      importScenarioFromJson(text);
    };
    reader.readAsText(f);
    e.target.value = "";
  }, []);

  useEffect(() => {
    if (playback !== "ended" || !lastRun) return;
    let cancelled = false;
    (async () => {
      setAiLoading(true);
      setAiResult(null, null);
      try {
        const analysis = await fetchTacticalAnalysis(scenario, lastRun);
        if (!cancelled) setAiResult(analysis, null);
      } catch {
        if (!cancelled) setAiResult(null, "Analysis failed");
      } finally {
        if (!cancelled) setAiLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [playback, lastRun, scenario, setAiLoading, setAiResult]);

  const togglePlay = useCallback(() => {
    if (!lastRun) return;
    if (playback === "running") setPlayback("paused");
    else if (playback === "paused") setPlayback("running");
    else if (playback === "ended" || playback === "idle") {
      setSimTime(0);
      setPlayback("running");
    }
  }, [lastRun, playback, setPlayback, setSimTime]);

  const scrubPreview = lastRun ? simTime / Math.max(lastRun.totalDurationSec, 0.001) : 0;

  const formatMissionClock = useCallback((t: number) => {
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    const cs = Math.floor((t % 1) * 100);
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
  }, []);

  const seekTimeline = useCallback(
    (clientX: number) => {
      if (!lastRun || !timelineRef.current) return;
      const rect = timelineRef.current.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      setSimTime(ratio * lastRun.totalDurationSec);
      setPlayback("paused");
    },
    [lastRun, setPlayback, setSimTime]
  );

  const onTimelineMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!lastRun || e.button !== 0) return;
      e.preventDefault();
      seekTimeline(e.clientX);
      const onMove = (ev: MouseEvent) => seekTimeline(ev.clientX);
      const onUp = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [lastRun, seekTimeline]
  );

  const stepBackward = useCallback(
    (e: React.MouseEvent) => {
      if (!lastRun) return;
      if (e.shiftKey) {
        setSimTime(0);
      } else {
        setSimTime(Math.max(0, simTime - PLAYBACK_STEP_SEC));
      }
      setPlayback("paused");
    },
    [lastRun, setPlayback, setSimTime, simTime]
  );

  const stepForward = useCallback(
    (e: React.MouseEvent) => {
      if (!lastRun) return;
      const end = lastRun.totalDurationSec;
      if (e.shiftKey) {
        setSimTime(end);
      } else {
        setSimTime(Math.min(end, simTime + PLAYBACK_STEP_SEC));
      }
      setPlayback("paused");
    },
    [lastRun, setPlayback, setSimTime, simTime]
  );

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={onImportFile}
      />
      <header
        data-animate-panel
        className="fixed top-0 z-50 flex h-16 w-full items-center justify-between border-b border-white/5 border-l-4 border-[#2ae500] bg-slate-950/90 px-6 shadow-[0_0_20px_rgba(42,229,0,0.1)] backdrop-blur-xl dark:bg-[#111318]/90"
      >
        <div className="flex items-center gap-8">
          <div className="font-headline text-xl font-bold uppercase tracking-tighter text-[#2ae500]">
            TACTICAL_VANGUARD
          </div>
          <nav className="hidden md:flex md:gap-6">
            <span className="cursor-default border-b-2 border-[#2ae500] pb-1 font-headline text-sm font-bold uppercase tracking-[0.05em] text-[#2ae500]">
              SIMULATION
            </span>
            <span className="cursor-default font-headline text-sm font-bold uppercase tracking-[0.05em] text-slate-400">
              CAMPAIGN_MODE
            </span>
            <span className="cursor-default font-headline text-sm font-bold uppercase tracking-[0.05em] text-slate-400">
              SCENARIOS
            </span>
          </nav>
        </div>
        <div className="flex items-center gap-2 text-[#2ae500]">
          <button
            type="button"
            className="p-2 transition-all duration-100 hover:bg-[#2ae500]/10"
            aria-label="Radar"
          >
            <span className="material-symbols-outlined">radar</span>
          </button>
          <button
            type="button"
            className="p-2 transition-all duration-100 hover:bg-[#2ae500]/10"
            aria-label="Emergency"
          >
            <span className="material-symbols-outlined">emergency_home</span>
          </button>
          <button
            type="button"
            className="p-2 transition-all duration-100 hover:bg-[#2ae500]/10"
            aria-label="Settings"
          >
            <span className="material-symbols-outlined">settings</span>
          </button>
        </div>
      </header>

      <main ref={shellRef} className="relative flex h-screen w-full overflow-hidden pt-16">
        <aside
          data-animate-panel
          className="glass-panel fixed left-0 top-16 z-40 flex h-[calc(100vh-64px)] w-72 flex-col border-r border-white/5 bg-slate-900/40 transition-all duration-100 dark:bg-[#111318]/80"
        >
          <div className="flex items-start justify-between gap-2 border-b border-white/5 p-4">
            <div className="min-w-0">
              <h2 className="font-headline text-lg font-bold tracking-tighter text-[#2ae500]">
                {advancedBuilder ? "SCENARIO_BUILDER" : "Scenario builder"}
              </h2>
              {advancedBuilder ? (
                <>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <span className="font-label text-[10px] text-on-surface-variant opacity-50">
                      SEC_04 // 22.4
                    </span>
                  </div>
                  <p className="mt-0.5 font-label text-[10px] uppercase tracking-widest text-secondary">
                    COMMANDER_VANGUARD // ALPHA_SITE
                  </p>
                </>
              ) : (
                <p className="mt-1 font-body text-[10px] text-on-surface-variant">
                  Simple controls — switch to technical labels anytime.
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setAdvancedBuilder((v) => !v)}
              className="shrink-0 border border-white/10 bg-surface-container-high/50 px-2 py-1 font-label text-[9px] font-bold uppercase tracking-wide text-secondary hover:border-secondary/40 hover:text-on-surface"
            >
              {advancedBuilder ? "Simple" : "Technical"}
            </button>
          </div>

          {advancedBuilder ? (
            <>
              <div className="flex-1 space-y-8 overflow-y-auto p-6">
                <div className="space-y-6">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between font-label text-[10px] uppercase text-on-surface-variant">
                      <span>[INP.01] MISSILE_SPEED</span>
                      <span className="text-primary">{machLabel(scenario.missileSpeed)}</span>
                    </div>
                    <input
                      className="h-1 w-full cursor-pointer appearance-none bg-surface-container-highest accent-primary"
                      type="range"
                      min={0}
                      max={100}
                      value={scenario.missileSpeed}
                      onChange={(e) => setMissileSpeed(Number(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between font-label text-[10px] uppercase text-on-surface-variant">
                      <span>[INP.02] LAUNCH_ANGLE</span>
                      <span className="text-primary">{scenario.launchAngle.toFixed(1)}°</span>
                    </div>
                    <input
                      className="h-1 w-full cursor-pointer appearance-none bg-surface-container-highest accent-primary"
                      type="range"
                      min={5}
                      max={85}
                      value={scenario.launchAngle}
                      onChange={(e) => setLaunchAngle(Number(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between font-label text-[10px] uppercase text-on-surface-variant">
                      <span>[INP.03] TARGET_DISTANCE</span>
                      <span className="text-primary">{distanceLabel(scenario.targetDistance)}</span>
                    </div>
                    <input
                      className="h-1 w-full cursor-pointer appearance-none bg-surface-container-highest accent-primary"
                      type="range"
                      min={0}
                      max={100}
                      value={scenario.targetDistance}
                      onChange={(e) => setTargetDistance(Number(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between font-label text-[10px] uppercase text-on-surface-variant">
                      <span>[INP.05] PROJECTIVE_SHIFT</span>
                      <span className="text-primary">{scenario.maneuverIntensity}%</span>
                    </div>
                    <input
                      className="h-1 w-full cursor-pointer appearance-none bg-surface-container-highest accent-primary"
                      type="range"
                      min={0}
                      max={100}
                      value={scenario.maneuverIntensity}
                      onChange={(e) => setManeuverIntensity(Number(e.target.value))}
                    />
                    <p className="font-label text-[9px] text-on-surface-variant opacity-80">
                      Mid-course direction change (0 = ballistic).
                    </p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between font-label text-[10px] uppercase text-on-surface-variant">
                      <span>[INP.06] SHIFT_TIMING</span>
                      <span className="text-primary">
                        {scenario.maneuverIntensity < 8 ? "N/A" : `${scenario.maneuverTiming}%`}
                      </span>
                    </div>
                    <input
                      className="h-1 w-full cursor-pointer appearance-none bg-surface-container-highest accent-primary"
                      type="range"
                      min={0}
                      max={100}
                      value={scenario.maneuverTiming}
                      onChange={(e) => setManeuverTiming(Number(e.target.value))}
                      disabled={scenario.maneuverIntensity < 8}
                    />
                  </div>
                  <div className="space-y-3 pt-4">
                    <span className="font-label text-[10px] uppercase text-on-surface-variant">
                      [INP.04] DEFENSE_CONFIG
                    </span>
                    <div className="grid grid-cols-1 gap-2">
                      {(
                        [
                          ["builder", "architecture", "BUILDER_MODE"],
                          ["parameters", "tune", "PARAMETERS"],
                          ["staging", "vibration", "STAGING"],
                        ] as const
                      ).map(([mode, icon, label]) => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => setDefenseMode(mode as DefenseMode)}
                          className={`flex items-center gap-3 px-4 py-3 text-left font-label text-[10px] transition-transform hover:translate-x-1 ${
                            scenario.defenseMode === mode
                              ? "border-l-2 border-secondary bg-secondary/10 text-secondary"
                              : "text-slate-500 hover:bg-white/5 hover:text-slate-200"
                          }`}
                        >
                          <span className="material-symbols-outlined text-sm">{icon}</span>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2 border-t border-white/10 pt-4">
                    <span className="font-label text-[10px] uppercase text-on-surface-variant">
                      WAR_TEMPLATES // EDU
                    </span>
                    <div className="flex flex-col gap-1.5">
                      {WAR_SCENARIO_TEMPLATES.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => loadWarTemplate(t.id)}
                          className={`truncate px-2 py-1.5 text-left font-label text-[9px] uppercase ${
                            warTemplateId === t.id
                              ? "bg-secondary/15 text-secondary"
                              : "text-on-surface-variant hover:bg-white/5 hover:text-on-surface"
                          }`}
                        >
                          {t.title}
                        </button>
                      ))}
                    </div>
                    {warTemplateId && getWarTemplate(warTemplateId) && (
                      <p className="border-l-2 border-secondary pl-2 font-body text-[9px] leading-relaxed text-on-surface-variant">
                        {getWarTemplate(warTemplateId)!.failureAnalysis}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-2 border-t border-white/5 pt-4">
                  <button
                    type="button"
                    onClick={onExport}
                    className="font-label text-[10px] uppercase text-on-surface-variant hover:text-primary"
                  >
                    Export scenario JSON
                  </button>
                  <button
                    type="button"
                    onClick={onImportPick}
                    className="font-label text-[10px] uppercase text-on-surface-variant hover:text-secondary"
                  >
                    Import scenario JSON
                  </button>
                  <button
                    type="button"
                    onClick={resetRun}
                    className="font-label text-[10px] uppercase text-on-surface-variant hover:text-error"
                  >
                    Reset simulation
                  </button>
                </div>
              </div>
              <div className="p-6">
                <button
                  type="button"
                  onClick={onInitiate}
                  className="glitch-effect flex w-full items-center justify-center gap-3 bg-primary py-4 font-headline text-sm font-bold uppercase tracking-widest text-on-primary shadow-[0_0_20px_rgba(42,229,0,0.3)]"
                >
                  <span className="material-symbols-outlined">rocket_launch</span>
                  INITIATE_DEPLOYMENT
                </button>
              </div>
            </>
          ) : (
            <ScenarioBuilderSimple
              missileSpeed={scenario.missileSpeed}
              launchAngle={scenario.launchAngle}
              targetDistance={scenario.targetDistance}
              defenseMode={scenario.defenseMode}
              maneuverIntensity={scenario.maneuverIntensity}
              maneuverTiming={scenario.maneuverTiming}
              warTemplateId={warTemplateId}
              setMissileSpeed={setMissileSpeed}
              setLaunchAngle={setLaunchAngle}
              setTargetDistance={setTargetDistance}
              setDefenseMode={setDefenseMode}
              setManeuverIntensity={setManeuverIntensity}
              setManeuverTiming={setManeuverTiming}
              loadWarTemplate={loadWarTemplate}
              machLabel={machLabel}
              distanceLabel={distanceLabel}
              onRun={onInitiate}
              onReset={resetRun}
              onExport={onExport}
              onImport={onImportPick}
            />
          )}
        </aside>

        <section
          data-animate-panel
          className="perspective-view relative flex-1 overflow-hidden bg-surface-container-lowest pl-72 pr-80"
        >
          <div className="grid-3d pointer-events-none" aria-hidden />
          <div className="axis-x pointer-events-none" aria-hidden />
          <div className="axis-y pointer-events-none" aria-hidden />
          <div className="pointer-events-none absolute bottom-1/2 left-1/2 z-10 -translate-x-1/2 translate-y-1/2 opacity-20">
            <div className="-ml-40 mt-2 font-mono text-[10px] text-red-500">X-AXIS // LATERAL</div>
            <div className="-mt-40 ml-4 font-mono text-[10px] text-primary">Y-AXIS // ALTITUDE</div>
          </div>
          <div className="pointer-events-none absolute inset-0 z-10 scanline opacity-20" aria-hidden />

          <div className="absolute inset-0 z-[5]">
            <SimulationCanvas />
          </div>

          <ViewportModeBar
            cameraMode={cameraMode}
            setCameraMode={setCameraMode}
          />

          <div className="pointer-events-none absolute left-6 top-6 z-20 font-mono text-[9px] uppercase tracking-widest text-primary/60">
            RENDER_ENGINE: AEGIS_V4.2
            <br />
            DRAWCALLS: 1,244
            <br />
            SHADERS: PBR_TACTICAL_GLOW
          </div>
          <div className="absolute bottom-32 right-10 z-20 flex flex-col gap-2">
            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center border border-white/10 bg-surface-container-high/80 transition-all hover:bg-primary/20 hover:text-primary"
              aria-label="Zoom in"
            >
              <span className="material-symbols-outlined text-sm">zoom_in</span>
            </button>
            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center border border-white/10 bg-surface-container-high/80 transition-all hover:bg-primary/20 hover:text-primary"
              aria-label="Zoom out"
            >
              <span className="material-symbols-outlined text-sm">zoom_out</span>
            </button>
            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center border border-white/10 bg-surface-container-high/80 transition-all hover:bg-primary/20 hover:text-primary"
              aria-label="Camera"
            >
              <span className="material-symbols-outlined text-sm">videocam</span>
            </button>
          </div>
        </section>

        <aside
          data-animate-panel
          className="glass-panel fixed right-0 top-16 z-40 flex h-[calc(100vh-64px)] w-80 flex-col border-l border-white/5 bg-slate-900/40 dark:bg-[#111318]/80"
        >
          <div className="border-b border-white/5 p-6">
            <div className="mb-1 flex items-start justify-between">
              <h2 className="font-headline text-lg font-bold tracking-tighter text-secondary">
                AI_TACTICAL_ASSISTANT
              </h2>
              <span className="font-label text-[10px] text-on-surface-variant opacity-50">
                {ai.loading ? "SYNC_PENDING" : "SYNC_ACTIVE"}
              </span>
            </div>
          </div>
          <div className="flex-1 space-y-6 overflow-y-auto p-6">
            <div className="border-l-2 border-primary bg-surface-container-low/50 p-4">
              <div className="mb-4 flex items-center justify-between">
                <span className="font-label text-[10px] uppercase text-on-surface-variant">
                  Interception_Success
                </span>
                <span className="font-headline text-xl font-bold text-primary">
                  {ai.analysis
                    ? `${ai.analysis.interceptionProbability.toFixed(1)}%`
                    : lastRun
                      ? lastRun.hit
                        ? "—"
                        : "—"
                      : "—"}
                </span>
              </div>
              <div className="h-1.5 w-full bg-surface-container-highest">
                <div
                  className="h-full bg-primary transition-[width] duration-500"
                  style={{
                    width: `${ai.analysis?.interceptionProbability ?? (lastRun?.hit ? 72 : 35)}%`,
                  }}
                />
              </div>
            </div>
            <div className="border-l-2 border-error bg-surface-container-low/50 p-4">
              <div className="flex items-center justify-between">
                <span className="font-label text-[10px] uppercase text-on-surface-variant">
                  Current_Threat_Level
                </span>
                <span className="bg-error/10 px-2 py-0.5 font-headline text-xs font-bold text-error">
                  {ai.analysis?.riskLevel ?? "MEDIUM"}
                </span>
              </div>
              <p className="mt-3 whitespace-pre-wrap font-body text-[11px] leading-relaxed text-on-surface-variant">
                {ai.loading
                  ? "Uplinking scenario telemetry to tactical model…"
                  : ai.error
                    ? ai.error
                    : ai.analysis?.briefing ??
                      "Run INITIATE_DEPLOYMENT to generate a mission trace and AI assessment."}
              </p>
            </div>
            <div className="space-y-4">
              <span className="font-label text-[10px] font-bold uppercase tracking-widest text-secondary">
                Recommended_Defense
              </span>
              <div className="space-y-3">
                {(ai.analysis?.recommendations ?? []).slice(0, 4).map((rec, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 border border-white/5 bg-surface-container-highest/30 p-3"
                  >
                    <span className="material-symbols-outlined text-lg text-secondary">
                      {i === 0 ? "my_location" : "shield"}
                    </span>
                    <div>
                      <h4 className="text-[11px] font-bold uppercase text-white">{rec.title}</h4>
                      <p className="text-[10px] text-on-surface-variant">{rec.detail}</p>
                    </div>
                  </div>
                ))}
                {!ai.analysis && !ai.loading && (
                  <p className="font-label text-[10px] text-on-surface-variant opacity-60">
                    No recommendations until first run completes.
                  </p>
                )}
              </div>
            </div>
            <TelemetryBlock />
          </div>
        </aside>

        <footer
          data-animate-panel
          className="fixed bottom-0 z-50 flex h-24 w-full items-center border-t border-[#2ae500]/20 bg-slate-950/95 px-6 shadow-[0_-4px_20px_rgba(42,229,0,0.05)] backdrop-blur-md dark:bg-[#111318]/95"
        >
          <div className="mr-8 flex items-center gap-4 border-r border-white/10 pr-8">
            <button
              type="button"
              className="text-on-surface-variant transition-colors hover:text-primary disabled:opacity-30"
              aria-label="Step back in time; Shift+click to jump to start"
              title="Back 0.75s · Shift+click: start"
              disabled={!lastRun}
              onClick={stepBackward}
            >
              <span className="material-symbols-outlined">fast_rewind</span>
            </button>
            <button
              type="button"
              onClick={togglePlay}
              disabled={!lastRun}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-primary bg-primary/5 text-primary transition-all hover:bg-primary/20 disabled:opacity-40"
              aria-label={playback === "running" ? "Pause" : "Play"}
            >
              <span className="material-symbols-outlined">
                {playback === "running" ? "pause" : "play_arrow"}
              </span>
            </button>
            <button
              type="button"
              className="text-on-surface-variant transition-colors hover:text-primary disabled:opacity-30"
              aria-label="Step forward in time; Shift+click to jump to end"
              title="Forward 0.75s · Shift+click: end"
              disabled={!lastRun}
              onClick={stepForward}
            >
              <span className="material-symbols-outlined">fast_forward</span>
            </button>
          </div>
          <div className="flex flex-1 flex-col gap-2 px-8">
            <div className="flex justify-between font-label text-[9px] uppercase tracking-tighter text-on-surface-variant">
              <span>00:00:00:00</span>
              <span className="text-primary">MISSION_CLOCK // LIVE</span>
              <span className="font-mono tabular-nums">
                {lastRun ? formatMissionClock(simTime) : "00:00.00"}
              </span>
            </div>
            <div
              ref={timelineRef}
              className={`relative flex h-9 w-full items-center py-1 ${lastRun ? "cursor-pointer" : "cursor-default"}`}
              onMouseDown={onTimelineMouseDown}
              role="presentation"
            >
              <div className="pointer-events-none absolute inset-0 flex items-center justify-around opacity-30">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-1 ${i === 5 ? "h-6 bg-primary" : i === 9 ? "h-4 bg-error" : "h-3 bg-secondary"}`}
                  />
                ))}
              </div>
              <div className="relative h-1 w-full bg-surface-container-highest">
                <div
                  className="absolute top-1/2 z-10 flex h-4 w-4 -translate-x-1/2 -translate-y-1/2 items-center justify-center bg-primary shadow-[0_0_10px_#2ae500]"
                  style={{ left: `${Math.min(100, Math.max(0, scrubPreview * 100))}%` }}
                >
                  <div className="h-full w-px bg-white/50" />
                </div>
              </div>
            </div>
          </div>
          <div className="ml-8 flex h-16 w-72 flex-col gap-1 overflow-hidden border-l border-white/10 pl-8">
            <span className="font-label text-[10px] uppercase text-on-surface-variant/50">Log_Output</span>
            <div className="space-y-1">
              {(lastRun?.logs ?? ["Awaiting mission start…"]).slice(-4).map((line, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span
                    className={`h-1 w-1 rounded-full ${i === 0 ? "animate-pulse bg-primary" : "bg-secondary"}`}
                  />
                  <span className="truncate font-label text-[10px] uppercase text-primary">{line}</span>
                </div>
              ))}
            </div>
          </div>
        </footer>

        <div className="pointer-events-none fixed right-[21rem] top-20 z-30 text-right font-headline text-[10px] leading-none text-primary/40">
          GRID_COORD_X: 42.00192
          <br />
          GRID_COORD_Y: 104.22381
          <br />
          ALTITUDE: 120,491M
        </div>
        <div className="pointer-events-none fixed bottom-28 left-8 z-30 font-headline text-[10px] leading-none text-secondary/40">
          ENCRYPTION: AES-256-GCM
          <br />
          STATION: VANGUARD_COMMAND_BASE
          <br />
          LATENCY: 12MS
        </div>
      </main>
    </>
  );
}

function ViewportModeBar({
  cameraMode,
  setCameraMode,
}: {
  cameraMode: CameraMode;
  setCameraMode: (m: CameraMode) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!ref.current) return;
    gsap.fromTo(
      ref.current.querySelectorAll("button"),
      { opacity: 0.4 },
      { opacity: 1, duration: 0.35, stagger: 0.05, ease: "sine.out" }
    );
  }, [cameraMode]);

  const modes: { id: CameraMode; label: string }[] = [
    { id: "orbital", label: "Orbital_View" },
    { id: "cad", label: "CAD_Grid_View" },
    { id: "telemetry", label: "Telemetry_Lock" },
  ];

  return (
    <div
      ref={ref}
      className="absolute left-1/2 top-6 z-20 flex -translate-x-1/2 items-center gap-px border border-white/10 bg-surface-container-high/80 glass-panel"
    >
      {modes.map((m, idx) => (
        <button
          key={m.id}
          type="button"
          onClick={() => setCameraMode(m.id)}
          className={`px-4 py-2 font-headline text-[10px] font-bold uppercase transition-colors ${
            cameraMode === m.id
              ? "text-primary"
              : "text-slate-400 hover:text-white"
          } ${idx < modes.length - 1 ? "border-r border-white/10" : ""} ${
            cameraMode === m.id ? "bg-primary/10" : ""
          }`}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}

function TelemetryBlock() {
  const lines = useSimulatorStore((s) => s.telemetryLines);
  return (
    <div className="border-t border-white/5 pt-4">
      <span className="mb-4 block font-label text-[10px] uppercase text-on-surface-variant opacity-50">
        Live_Telemetry_Stream
      </span>
      <div className="space-y-2 font-mono text-[9px] text-on-surface-variant">
        {lines.slice(-6).map((row, i) => (
          <div key={i} className="flex justify-between gap-2">
            <span
              className={
                row.tone === "primary"
                  ? "text-primary"
                  : row.tone === "secondary"
                    ? "text-secondary"
                    : "text-error"
              }
            >
              [{row.time}]
            </span>
            <span className="text-right">{row.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
