import { useMemo, useState } from 'react';
import { Route as RouteIcon, ArrowRight } from 'lucide-react';
import type { Zone } from '../types/database';
import { getRoute } from '../lib/routing';

interface RoutePlannerProps {
  zones: Zone[];
}

export default function RoutePlanner({ zones }: RoutePlannerProps) {
  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState('');
  const [route, setRoute] = useState<string[] | null>(null);
  const [searched, setSearched] = useState(false);

  const sortedZones = useMemo(
    () => [...zones].sort((a, b) => a.name.localeCompare(b.name)),
    [zones]
  );

  function handleFindRoute(e: React.FormEvent) {
    e.preventDefault();
    if (!fromId || !toId) return;
    const result = getRoute(zones, fromId, toId);
    setRoute(result);
    setSearched(true);
  }

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800/60 p-5">
      <div className="flex items-center gap-2">
        <RouteIcon className="h-5 w-5 text-cyan-400" />
        <h2 className="text-sm font-semibold tracking-wide text-slate-100 uppercase">
          Route Planner
        </h2>
      </div>

      <form onSubmit={handleFindRoute} className="mt-4 space-y-3">
        <div>
          <label htmlFor="route-from" className="mb-1 block text-xs font-medium text-slate-400">
            From
          </label>
          <select
            id="route-from"
            value={fromId}
            onChange={(e) => setFromId(e.target.value)}
            className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
          >
            <option value="">Select origin…</option>
            {sortedZones.map((z) => (
              <option key={z.id} value={z.id}>
                {z.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="route-to" className="mb-1 block text-xs font-medium text-slate-400">
            To
          </label>
          <select
            id="route-to"
            value={toId}
            onChange={(e) => setToId(e.target.value)}
            className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
          >
            <option value="">Select destination…</option>
            {sortedZones.map((z) => (
              <option key={z.id} value={z.id}>
                {z.name}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          disabled={!fromId || !toId}
          className="w-full rounded-md bg-cyan-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Find Route
        </button>
      </form>

      {searched && (
        <div
          className="mt-4 rounded-md border border-slate-700 bg-slate-900/50 p-3"
          role="status"
          aria-live="polite"
        >
          {route && route.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5 text-sm">
              {route.map((name, i) => (
                <span key={i} className="flex items-center gap-1.5">
                  <span className="font-medium text-slate-100">{name}</span>
                  {i < route.length - 1 && <ArrowRight className="h-4 w-4 text-slate-500" />}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-red-400">No path found between these zones.</p>
          )}
        </div>
      )}
    </div>
  );
}