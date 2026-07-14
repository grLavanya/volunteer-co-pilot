import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import type { ZoneWithSnapshot, Trend } from '../types/database';

interface ZoneCardProps {
  zone: ZoneWithSnapshot;
}

function densityColor(pct: number | null): string {
  if (pct === null) return 'bg-slate-600';
  if (pct < 60) return 'bg-emerald-500';
  if (pct <= 85) return 'bg-amber-500';
  return 'bg-red-500';
}

function densityTextColor(pct: number | null): string {
  if (pct === null) return 'text-slate-400';
  if (pct < 60) return 'text-emerald-400';
  if (pct <= 85) return 'text-amber-400';
  return 'text-red-400';
}

function TrendIcon({ trend }: { trend: Trend | null }) {
  if (trend === 'rising')
    return <ArrowUpRight className="h-4 w-4 text-red-400" aria-label="Rising" />;
  if (trend === 'falling')
    return <ArrowDownRight className="h-4 w-4 text-emerald-400" aria-label="Falling" />;
  return <Minus className="h-4 w-4 text-slate-400" aria-label="Stable" />;
}

export default function ZoneCard({ zone }: ZoneCardProps) {
  const pct = zone.density_pct;
  const barWidth = pct !== null ? `${Math.min(pct, 100)}%` : '0%';

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800/60 p-4 transition-colors hover:border-slate-600">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">{zone.name}</h3>
          <p className="mt-0.5 text-xs text-slate-400">
            {zone.current_occupancy.toLocaleString()} / {zone.capacity.toLocaleString()}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <TrendIcon trend={zone.trend} />
          <span className={`text-lg font-bold tabular-nums ${densityTextColor(pct)}`}>
            {pct !== null ? `${Math.round(pct)}%` : '--'}
          </span>
        </div>
      </div>

      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-700">
        <div
          className={`h-full rounded-full transition-all duration-500 ${densityColor(pct)}`}
          style={{ width: barWidth }}
        />
      </div>

      {zone.accessibility_flags &&
        Object.keys(zone.accessibility_flags).length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {zone.accessibility_flags.wheelchair && (
              <span className="rounded bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-medium text-sky-300">
                Wheelchair
              </span>
            )}
            {zone.accessibility_flags.sensory_friendly && (
              <span className="rounded bg-violet-500/15 px-1.5 py-0.5 text-[10px] font-medium text-violet-300">
                Sensory-friendly
              </span>
            )}
          </div>
        )}
    </div>
  );
}
