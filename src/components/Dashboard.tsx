import { useState } from 'react';
import { LogOut, Mic, Loader2, AlertTriangle, UploadCloud } from 'lucide-react';
import type { Volunteer } from '../types/database';
import { useZones } from '../hooks/useZones';
import ZoneCard from './ZoneCard';
import RecommendationCard from './RecommendationCard';
import FanAssistModal from './FanAssistModal';
import RoutePlanner from './RoutePlanner';
import CSVUploadModal from './CSVUploadModal';

interface DashboardProps {
  volunteer: Volunteer;
  onSignOut: () => void;
}

export default function Dashboard({ volunteer, onSignOut }: DashboardProps) {
  const { zones, loading, error, refetch } = useZones();
  const [fanAssistOpen, setFanAssistOpen] = useState(false);
  const [csvUploadOpen, setCsvUploadOpen] = useState(false);

  const assignedZone = zones.find((z) => z.id === volunteer.assigned_zone_id);

  return (
    <div className="min-h-screen bg-slate-950 pb-24">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-500/10 ring-1 ring-cyan-500/30">
              <Mic className="h-5 w-5 text-cyan-400" />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-white">Volunteer Co-Pilot</h1>
              <p className="text-xs text-slate-400">
                {volunteer.name}
                {assignedZone && (
                  <>
                    <span className="mx-1.5 text-slate-600">·</span>
                    <span className="text-cyan-400">{assignedZone.name}</span>
                  </>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCsvUploadOpen(true)}
              className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200"
              title="Upload crowd data for testing"
              aria-label="Upload crowd data for testing"
            >
              <UploadCloud className="h-4 w-4" />
              <span className="hidden sm:inline">Upload Data</span>
            </button>
            <button
              onClick={onSignOut}
              className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200"
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto max-w-5xl px-4 py-5">
        {error && (
          <div
            role="alert"
            className="mb-4 flex items-center gap-2 rounded-lg border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-red-300"
          >
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <div className="grid gap-5 lg:grid-cols-3">
          {/* Zone list — spans 2 columns on desktop */}
          <section className="lg:col-span-2">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xs font-semibold tracking-wider text-slate-400 uppercase">
                Zone & Gate Status
              </h2>
              {loading && (
                <Loader2 className="h-4 w-4 animate-spin text-slate-500" aria-label="Loading zones" />
              )}
            </div>

            {loading ? (
              <div className="grid gap-3 sm:grid-cols-2" aria-busy="true" aria-label="Loading zone status">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-28 animate-pulse rounded-lg border border-slate-800 bg-slate-900/50"
                  />
                ))}
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {zones.map((zone) => (
                  <ZoneCard key={zone.id} zone={zone} />
                ))}
              </div>
            )}
          </section>

          {/* Right column: AI recommendation + route planner */}
          <aside className="space-y-5">
            <RecommendationCard zones={zones} />
            {!loading && zones.length > 0 && <RoutePlanner zones={zones} />}
          </aside>
        </div>
      </main>

      {/* Floating action button — Assist a Fan */}
      <button
        onClick={() => setFanAssistOpen(true)}
        className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-cyan-600 px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-cyan-900/50 transition-all hover:bg-cyan-500 hover:shadow-xl active:scale-95"
        aria-label="Assist a fan"
      >
        <Mic className="h-5 w-5" />
        <span className="hidden sm:inline">Assist a Fan</span>
      </button>

      <FanAssistModal
        open={fanAssistOpen}
        onClose={() => setFanAssistOpen(false)}
        volunteerId={volunteer.id}
      />

      <CSVUploadModal
        open={csvUploadOpen}
        onClose={() => setCsvUploadOpen(false)}
        zones={zones}
        onUploaded={refetch}
      />
    </div>
  );
}