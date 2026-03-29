"use client";

import type { DefenseMode } from "@/lib/simulation/types";

type Props = {
  missileSpeed: number;
  launchAngle: number;
  targetDistance: number;
  defenseMode: DefenseMode;
  setMissileSpeed: (v: number) => void;
  setLaunchAngle: (v: number) => void;
  setTargetDistance: (v: number) => void;
  setDefenseMode: (m: DefenseMode) => void;
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
  setMissileSpeed,
  setLaunchAngle,
  setTargetDistance,
  setDefenseMode,
  machLabel,
  distanceLabel,
  onRun,
  onReset,
  onExport,
  onImport,
}: Props) {
  return (
    <div className="flex flex-1 flex-col">
      <div className="space-y-6 border-b border-white/5 px-5 py-5">
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
      </div>

      <div className="flex flex-1 flex-col justify-end gap-3 p-5">
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
