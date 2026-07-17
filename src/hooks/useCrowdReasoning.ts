import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { ZoneWithSnapshot } from '../types/database';

export interface CrowdReasoningResult {
  has_recommendation: boolean;
  urgency?: 'low' | 'medium' | 'high';
  affected_zone?: string;
  recommendation?: string;
  reasoning?: string;
  suggested_scripts?: {
    en: string;
    es: string;
    fr: string;
  } | null;
}

interface UseCrowdReasoningResult {
  recommendation: CrowdReasoningResult | null;
  loading: boolean;
  error: string | null;
}

export function useCrowdReasoning(zones: ZoneWithSnapshot[]): UseCrowdReasoningResult {
  const [recommendation, setRecommendation] = useState<CrowdReasoningResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Avoid redundant network requests if the zones array reference changes
  // but its data contents remain identical.
  const lastPayloadRef = useRef<string>('');

  // Tracks which fetch is the most recent one. A response only applies its
  // state updates if it's still the latest request — this correctly ignores
  // genuinely superseded requests without relying on effect-cleanup timing,
  // which under React Strict Mode's dev-only double-invoke can fire before
  // an in-flight request resolves and incorrectly suppress its own result.
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!zones || zones.length === 0) {
      setRecommendation(null);
      return;
    }

    const formattedZones = zones.map((z) => ({
      id: z.id,
      name: z.name,
      occupancy_pct: z.density_pct ?? 0,
      capacity: z.capacity,
      trend: z.trend ?? 'stable',
    }));

    const connectedZoneIdsMap: Record<string, string[]> = {};
    for (const z of zones) {
      connectedZoneIdsMap[z.id] = z.connected_zone_ids ?? [];
    }

    const payload = {
      zones: formattedZones,
      connected_zone_ids: connectedZoneIdsMap,
      threshold_pct: 80,
    };

    const serializedPayload = JSON.stringify(payload);
    if (serializedPayload === lastPayloadRef.current) {
      return;
    }
    lastPayloadRef.current = serializedPayload;

    const thisRequestId = ++requestIdRef.current;

    async function fetchRecommendation() {
      setLoading(true);
      setError(null);

      try {
        const { data, error: invokeErr } = await supabase.functions.invoke('crowd-reasoning', {
          body: payload,
        });

        if (invokeErr) {
          throw invokeErr;
        }

        // Only apply this result if no newer request has since started.
        if (requestIdRef.current === thisRequestId) {
          setRecommendation(data);
        }
      } catch (err) {
        console.error('Error calling crowd-reasoning edge function:', err);
        const errMsg = err instanceof Error ? err.message : 'Failed to call crowd reasoning service';
        if (requestIdRef.current === thisRequestId) {
          setError(errMsg);
        }
      } finally {
        if (requestIdRef.current === thisRequestId) {
          setLoading(false);
        }
      }
    }

    fetchRecommendation();
  }, [zones]);

  return { recommendation, loading, error };
}