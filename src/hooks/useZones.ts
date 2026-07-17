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
 * Uses a two-query approach (zones, then latest snapshot per zone) because
 * Supabase doesn't support DISTINCT ON via the PostgREST query builder.
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

      const { data: snapshots, error: snapErr } = await supabase
        .from('crowd_snapshots')
        .select('zone_id, density_pct, trend, recorded_at')
        .order('recorded_at', { ascending: false });

      if (snapErr) throw snapErr;

      // Keep only the latest snapshot per zone
      const latestByZone = new Map<string, { density_pct: number; trend: string }>();
      for (const s of snapshots ?? []) {
        if (!latestByZone.has(s.zone_id)) {
          latestByZone.set(s.zone_id, { density_pct: s.density_pct, trend: s.trend });
        }
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