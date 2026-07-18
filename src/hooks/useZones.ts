import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { ZoneWithSnapshot, Zone } from '../types/database';

/**
 * Normalize connected_zone_ids — PostgREST may return a uuid[] column as a
 * PostgreSQL array literal string (e.g. "{uuid1,uuid2}") instead of a JSON
 * array. Coerce to a real string array so BFS can iterate correctly.
 */
function normalizeZone(raw: Record<string, unknown>): Zone {
  let ids = raw.connected_zone_ids;
  if (typeof ids === 'string') {
    const trimmed = ids.replace(/^\{|\}$/g, '');
    ids = trimmed ? trimmed.split(',').map((s) => s.trim()) : [];
  }
  return { ...(raw as unknown as Zone), connected_zone_ids: (ids as string[]) ?? [] };
}

interface UseZonesResult {
  zones: ZoneWithSnapshot[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Fetches all zones joined with their latest crowd_snapshot.
 *
 * The latest-snapshot-per-zone lookup is done via the get_latest_crowd_snapshots
 * RPC (a DISTINCT ON query defined in the database — see
 * supabase/migrations/20260718183000_add_latest_crowd_snapshots_rpc.sql),
 * rather than fetching the entire crowd_snapshots history and filtering to
 * "latest per zone" client-side. PostgREST's query builder doesn't support
 * DISTINCT ON directly, so this logic lives in a small SQL function instead —
 * the client now receives exactly one row per zone regardless of how much
 * snapshot history has accumulated.
 */
export function useZones(): UseZonesResult {
  const [zones, setZones] = useState<ZoneWithSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data: zoneRows, error: zoneErr } = await supabase
        .from('zones')
        .select('*')
        .order('name');

      if (zoneErr) throw zoneErr;
      if (!zoneRows) {
        setZones([]);
        return;
      }

      const { data: snapshots, error: snapErr } = await supabase.rpc(
        'get_latest_crowd_snapshots'
      );

      if (snapErr) throw snapErr;

      const latestByZone = new Map<string, { density_pct: number; trend: string }>();
      for (const s of snapshots ?? []) {
        latestByZone.set(s.zone_id, { density_pct: s.density_pct, trend: s.trend });
      }

      const merged: ZoneWithSnapshot[] = zoneRows.map((z) => {
        const snap = latestByZone.get(z.id);
        return {
          ...normalizeZone(z as unknown as Record<string, unknown>),
          density_pct: snap?.density_pct ?? null,
          trend: (snap?.trend as ZoneWithSnapshot['trend']) ?? null,
        };
      });

      setZones(merged);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load zone data';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { zones, loading, error, refetch: load };
}