export type Trend = 'rising' | 'falling' | 'stable';

export type ContextTag = 'general' | 'medical' | 'accessibility';

export interface Zone {
  id: string;
  name: string;
  capacity: number;
  current_occupancy: number;
  connected_zone_ids: string[];
  accessibility_flags: Record<string, boolean>;
  created_at: string;
}

export interface CrowdSnapshot {
  id: string;
  zone_id: string;
  density_pct: number;
  trend: Trend;
  recorded_at: string;
}

export interface Volunteer {
  id: string;
  name: string;
  assigned_zone_id: string | null;
  languages: string[];
  created_at: string;
}

export interface FanInteraction {
  id: string;
  volunteer_id: string | null;
  detected_language: string | null;
  context_tag: ContextTag | null;
  transcript: string | null;
  translated_response: string | null;
  created_at: string;
}

/** Zone with its latest crowd snapshot — the shape the dashboard consumes. */
export interface ZoneWithSnapshot extends Zone {
  density_pct: number | null;
  trend: Trend | null;
}
