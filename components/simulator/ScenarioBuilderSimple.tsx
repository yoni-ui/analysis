"use client";

import { WAR_SCENARIO_TEMPLATES, getWarTemplate } from "@/lib/simulation/war-templates";
import type { DefenseMode } from "@/lib/simulation/types";

type Props = {
  missileSpeed: number;
  launchAngle: number;
  targetDistance: number;
  defenseMode: DefenseMode;
  maneuverIntensity: number;
  maneuverTiming: number;
  warTemplateId: string | null;
  setMissileSpeed: (v: number) => void;
  setLaunchAngle: (v: number) => void;
  setTargetDistance: (v: number) => void;
  setDefenseMode: (m: DefenseMode) => void;
  setManeuverIntensity: (v: number) => void;
  setManeuverTiming: (v: number) => void;
  loadWarTemplate: (id: string) => void;
  machLabel: (s: number) => string;
  distanceLabel: (d: number) => string;
  onRun: () => void;
  onReset: () => void;
  onExport: () => void;
  onImport: () => void;
};

const DEFENSE_OPTIONS: { mode: DefenseMode; title: string; hint: string }[] = [
  { mode: "builder", title: "Strong", hint: "Best intercept odds" },
  { mode: "parameters", title: "Balanced", hint: "Default response" },
  { mode: "staging", title: "Light", hint: "Harder intercept" },
];

function SliderRow({
  label,
  hint,
  value,
  display,
  min,
  max,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  display: string;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-body text-xs font-medium text-on-surface">{label}</span>
        <span className="shrink-0 font-headline text-xs font-bold text-primary">{display}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none bg-surface-container-highest accent-primary"
      />
      <p className="font-body text-[10px] leading-snug text-on-surface-variant">{hint}</p>
    </div>
  );
}

export default function ScenarioBuilderSimple({
  missileSpeed,
  launchAngle,
  targetDistance,
  defenseMode,
  maneuverIntensity,
  maneuverTiming,
  warTemplateId,
  setMissileSpeed,
  setLaunchAngle,
  setTargetDistance,
  setDefenseMode,
  setManeuverIntensity,
  setManeuverTiming,
  loadWarTemplate,
  machLabel,
  distanceLabel,
  onRun,
  onReset,
  onExport,
  onImport,
}: Props) {
  const activeTemplate = warTemplateId ? getWarTemplate(warTemplateId) : undefined;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto border-b border-white/5 px-5 py-5">
        <div>
          <h2 className="font-headline text-base font-bold text-[#2ae500]">Scenario</h2>
          <p className="mt-1 font-body text-[11px] leading-relaxed text-on-surface-variant">
            Set the attack and defenses, then run the 3D simulation.
          </p>
        </div>

        <SliderRow
          label="Threat speed"
          hint="Higher speed gives the interceptor less time to close."
          value={missileSpeed}
          min={0}
          max={100}
          display={machLabel(missileSpeed)}
          onChange={setMissileSpeed}
        />
        <SliderRow
          label="Launch angle"
          hint="Steeper arcs climb higher before descending toward the target."
          value={launchAngle}
          min={5}
          max={85}
          display={`${launchAngle.toFixed(0)}°`}
          onChange={setLaunchAngle}
        />
        <SliderRow
          label="Range to target"
          hint="How far away the impact point is along the flight path."
          value={targetDistance}
          min={0}
          max={100}
          display={distanceLabel(targetDistance)}
          onChange={setTargetDistance}
        />

        <SliderRow
          label="Mid-course maneuver"
          hint="Threat shifts direction mid-flight (harder to predict). 0 = smooth ballistic arc."
          value={maneuverIntensity}
          min={0}
          max={100}
          display={`${maneuverIntensity}%`}
          onChange={setManeuverIntensity}
        />
        <SliderRow
          label="When it veers"
          hint="Earlier vs later along the path the projective shift happens."
          value={maneuverTiming}
          min={0}
          max={100}
          display={maneuverIntensity < 8 ? "—" : `${maneuverTiming}%`}
          onChange={setManeuverTiming}
        />

        <div className="space-y-2">
          <span className="font-body text-xs font-medium text-on-surface">Defense strength</span>
          <div className="grid grid-cols-3 gap-1.5">
            {DEFENSE_OPTIONS.map(({ mode, title, hint }) => (
              <button
                key={mode}
                type="button"
                onClick={() => setDefenseMode(mode)}
                title={hint}
                className={`border px-2 py-2 text-center transition-colors ${
                  defenseMode === mode
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-white/10 bg-surface-container-high/40 text-on-surface-variant hover:border-white/20 hover:text-on-surface"
                }`}
              >
                <span className="block font-headline text-[10px] font-bold uppercase tracking-wide">
                  {title}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3 border-t border-white/10 pt-4">
          <h3 className="font-headline text-[10px] font-bold uppercase tracking-wide text-secondary">
            War-style templates
          </h3>
          <p className="font-body text-[9px] leading-snug text-on-surface-variant">
            Educational presets inspired by publicly discussed air-defense patterns — not classified
            timelines or real fire missions.
          </p>
          <div className="flex flex-col gap-2">
            {WAR_SCENARIO_TEMPLATES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => loadWarTemplate(t.id)}
                className={`border px-3 py-2 text-left transition-colors ${
                  warTemplateId === t.id
                    ? "border-secondary bg-secondary/10"
                    : "border-white/10 bg-surface-container-high/30 hover:border-white/20"
                }`}
              >
                <span className="block font-body text-[11px] font-semibold text-on-surface">
                  {t.title}
                </span>
                <span className="mt-0.5 block font-body text-[9px] text-on-surface-variant">
                  {t.subtitle}
                </span>
              </button>
            ))}
          </div>
          {activeTemplate && (
            <div className="border-l-2 border-secondary bg-surface-container-low/50 p-3">
              <p className="mb-1.5 font-label text-[9px] font-bold uppercase tracking-wide text-secondary">
                Why intercepts underperform (open literature)
              </p>
              <p className="font-body text-[10px] leading-relaxed text-on-surface-variant">
                {activeTemplate.failureAnalysis}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="flex shrink-0 flex-col gap-3 p-5">
        <button
          type="button"
          onClick={onRun}
          className="glitch-effect w-full bg-primary py-3.5 font-headline text-sm font-bold uppercase tracking-wide text-on-primary shadow-[0_0_20px_rgba(42,229,0,0.25)]"
        >
          Run simulation
        </button>
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 font-body text-[10px] text-on-surface-variant">
          <button type="button" onClick={onReset} className="hover:text-primary">
            Reset
          </button>
          <span className="opacity-40">·</span>
          <button type="button" onClick={onExport} className="hover:text-secondary">
            Export JSON
          </button>
          <span className="opacity-40">·</span>
          <button type="button" onClick={onImport} className="hover:text-secondary">
            Import JSON
          </button>
        </div>
      </div>
    </div>
  );
}
