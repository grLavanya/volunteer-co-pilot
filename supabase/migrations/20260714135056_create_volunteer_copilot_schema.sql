/*
# Volunteer Co-Pilot — FIFA World Cup 2026 Stadium Operations

Base schema for the Volunteer Co-Pilot application. This is a no-auth app:
the frontend uses the anon key exclusively (the "sign in" button stores a
mock volunteer profile in React state, not a real Supabase auth session).
All policies therefore target `anon, authenticated`.

## 1. New Tables

### zones
Stadium zones/gates represented as nodes in a routing graph.
- `id` (uuid, primary key)
- `name` (text, not null) — display name e.g. "Gate A"
- `capacity` (int, not null) — max occupancy for the zone
- `current_occupancy` (int, not null, default 0) — live-ish count of people
- `connected_zone_ids` (uuid[], default '{}') — adjacency edges for BFS routing
- `accessibility_flags` (jsonb, default '{}') — e.g. wheelchair accessible, sensory-friendly
- `created_at` (timestamptz, default now())

### crowd_snapshots
Time-series density readings per zone.
- `id` (uuid, primary key)
- `zone_id` (uuid, fk → zones.id ON DELETE CASCADE)
- `density_pct` (float, not null) — 0-100 crowd density percentage
- `trend` (text, not null, check in rising/falling/stable)
- `recorded_at` (timestamptz, default now())

### volunteers
Mock volunteer profiles (no auth.users link — app is no-auth).
- `id` (uuid, primary key)
- `name` (text, not null)
- `assigned_zone_id` (uuid, fk → zones.id ON DELETE SET NULL)
- `languages` (text[], default '{}') — spoken languages
- `created_at` (timestamptz, default now())

### fan_interactions
Log of fan-assist sessions (future multilingual layer writes here).
- `id` (uuid, primary key)
- `volunteer_id` (uuid, fk → volunteers.id ON DELETE SET NULL)
- `detected_language` (text, nullable)
- `context_tag` (text, nullable, check in general/medical/accessibility)
- `transcript` (text, nullable)
- `translated_response` (text, nullable)
- `created_at` (timestamptz, default now())

## 2. Security (RLS)

All tables enable RLS. Because this is a single-tenant no-auth app, every
policy uses `TO anon, authenticated` with `USING (true)` / `WITH CHECK (true)`
— the data is intentionally shared/public across the operations team.

## 3. Indexes

- `crowd_snapshots.zone_id` — filtered per zone
- `crowd_snapshots.recorded_at DESC` — latest-first queries
- `volunteers.assigned_zone_id` — dashboard lookup
- `fan_interactions.volunteer_id` — per-volunteer history
*/

-- ============================================================
-- zones
-- ============================================================
CREATE TABLE IF NOT EXISTS zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  capacity int NOT NULL,
  current_occupancy int NOT NULL DEFAULT 0,
  connected_zone_ids uuid[] DEFAULT '{}',
  accessibility_flags jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE zones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_zones" ON zones;
CREATE POLICY "anon_select_zones" ON zones FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_zones" ON zones;
CREATE POLICY "anon_insert_zones" ON zones FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_zones" ON zones;
CREATE POLICY "anon_update_zones" ON zones FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_zones" ON zones;
CREATE POLICY "anon_delete_zones" ON zones FOR DELETE
  TO anon, authenticated USING (true);

-- ============================================================
-- crowd_snapshots
-- ============================================================
CREATE TABLE IF NOT EXISTS crowd_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id uuid NOT NULL REFERENCES zones(id) ON DELETE CASCADE,
  density_pct float NOT NULL,
  trend text NOT NULL CHECK (trend IN ('rising','falling','stable')),
  recorded_at timestamptz DEFAULT now()
);

ALTER TABLE crowd_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_crowd_snapshots" ON crowd_snapshots;
CREATE POLICY "anon_select_crowd_snapshots" ON crowd_snapshots FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_crowd_snapshots" ON crowd_snapshots;
CREATE POLICY "anon_insert_crowd_snapshots" ON crowd_snapshots FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_crowd_snapshots" ON crowd_snapshots;
CREATE POLICY "anon_update_crowd_snapshots" ON crowd_snapshots FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_crowd_snapshots" ON crowd_snapshots;
CREATE POLICY "anon_delete_crowd_snapshots" ON crowd_snapshots FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_crowd_snapshots_zone_id ON crowd_snapshots(zone_id);
CREATE INDEX IF NOT EXISTS idx_crowd_snapshots_recorded_at ON crowd_snapshots(recorded_at DESC);

-- ============================================================
-- volunteers
-- ============================================================
CREATE TABLE IF NOT EXISTS volunteers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  assigned_zone_id uuid REFERENCES zones(id) ON DELETE SET NULL,
  languages text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE volunteers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_volunteers" ON volunteers;
CREATE POLICY "anon_select_volunteers" ON volunteers FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_volunteers" ON volunteers;
CREATE POLICY "anon_insert_volunteers" ON volunteers FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_volunteers" ON volunteers;
CREATE POLICY "anon_update_volunteers" ON volunteers FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_volunteers" ON volunteers;
CREATE POLICY "anon_delete_volunteers" ON volunteers FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_volunteers_assigned_zone ON volunteers(assigned_zone_id);

-- ============================================================
-- fan_interactions
-- ============================================================
CREATE TABLE IF NOT EXISTS fan_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  volunteer_id uuid REFERENCES volunteers(id) ON DELETE SET NULL,
  detected_language text,
  context_tag text CHECK (context_tag IN ('general','medical','accessibility')),
  transcript text,
  translated_response text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE fan_interactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_fan_interactions" ON fan_interactions;
CREATE POLICY "anon_select_fan_interactions" ON fan_interactions FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_fan_interactions" ON fan_interactions;
CREATE POLICY "anon_insert_fan_interactions" ON fan_interactions FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_fan_interactions" ON fan_interactions;
CREATE POLICY "anon_update_fan_interactions" ON fan_interactions FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_fan_interactions" ON fan_interactions;
CREATE POLICY "anon_delete_fan_interactions" ON fan_interactions FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_fan_interactions_volunteer ON fan_interactions(volunteer_id);