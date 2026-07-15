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

  // Use a ref to store serialized payload and avoid redundant network requests 
  // if the zones array reference changes but its data contents remain identical.
  const lastPayloadRef = useRef<string>('');

  useEffect(() => {
    if (!zones || zones.length === 0) {
      setRecommendation(null);
      return;
    }

    // Format zones as expected by the POST request schema
    const formattedZones = zones.map((z) => ({
      id: z.id,
      name: z.name,
      occupancy_pct: z.density_pct ?? 0,
      capacity: z.capacity,
      trend: z.trend ?? 'stable',
    }));

    // Create adjacent zone connections mapping
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

    let active = true;

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

        if (active) {
          setRecommendation(data);
          if (data && data.gemini_error) {
            console.error('DEBUG_GEMINI_ERROR:', data.gemini_error);
          }
        }
      } catch (err) {
        console.error('Error calling crowd-reasoning edge function:', err);
        const errMsg = err instanceof Error ? err.message : 'Failed to call crowd reasoning service';
        if (active) {
          setError(errMsg);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    fetchRecommendation();

    return () => {
      active = false;
    };
  }, [zones]);

  return { recommendation, loading, error };
}
