/*
# Seed synthetic stadium data

Populates the base schema with realistic mock data for the FIFA World Cup 2026
stadium operations dashboard. All data is synthetic.

## Zones (7)
Gate A–F plus a Central Concourse, arranged as a routing graph:
  A ↔ Concourse ↔ B
  Concourse ↔ C ↔ D
  C ↔ E ↔ F
Each zone gets accessibility flags and a current_occupancy value.

## Crowd Snapshots
One latest snapshot per zone with density_pct and trend (rising/falling/stable).

## Volunteers
One mock volunteer "Alex Rivera" assigned to Gate A, speaking English + Spanish.
*/

DO $$
DECLARE
  z_a uuid; z_b uuid; z_c uuid; z_d uuid; z_e uuid; z_f uuid; z_concourse uuid;
BEGIN
  INSERT INTO zones (name, capacity, current_occupancy, accessibility_flags)
  VALUES
    ('Gate A', 2000, 1450, '{"wheelchair": true, "sensory_friendly": false}'::jsonb),
    ('Gate B', 1800, 1100, '{"wheelchair": true, "sensory_friendly": true}'::jsonb),
    ('Gate C', 2200, 1900, '{"wheelchair": true, "sensory_friendly": false}'::jsonb),
    ('Gate D', 1500, 600,  '{"wheelchair": false, "sensory_friendly": true}'::jsonb),
    ('Gate E', 2000, 1750, '{"wheelchair": true, "sensory_friendly": false}'::jsonb),
    ('Gate F', 1600, 800,  '{"wheelchair": true, "sensory_friendly": false}'::jsonb),
    ('Central Concourse', 5000, 3200, '{"wheelchair": true, "sensory_friendly": true}'::jsonb)
  ON CONFLICT DO NOTHING;

  SELECT id INTO z_a FROM zones WHERE name = 'Gate A' LIMIT 1;
  SELECT id INTO z_b FROM zones WHERE name = 'Gate B' LIMIT 1;
  SELECT id INTO z_c FROM zones WHERE name = 'Gate C' LIMIT 1;
  SELECT id INTO z_d FROM zones WHERE name = 'Gate D' LIMIT 1;
  SELECT id INTO z_e FROM zones WHERE name = 'Gate E' LIMIT 1;
  SELECT id INTO z_f FROM zones WHERE name = 'Gate F' LIMIT 1;
  SELECT id INTO z_concourse FROM zones WHERE name = 'Central Concourse' LIMIT 1;

  UPDATE zones SET connected_zone_ids = ARRAY[z_concourse] WHERE id = z_a;
  UPDATE zones SET connected_zone_ids = ARRAY[z_concourse] WHERE id = z_b;
  UPDATE zones SET connected_zone_ids = ARRAY[z_concourse, z_e] WHERE id = z_c;
  UPDATE zones SET connected_zone_ids = ARRAY[z_c] WHERE id = z_d;
  UPDATE zones SET connected_zone_ids = ARRAY[z_c, z_f] WHERE id = z_e;
  UPDATE zones SET connected_zone_ids = ARRAY[z_e] WHERE id = z_f;
  UPDATE zones SET connected_zone_ids = ARRAY[z_a, z_b, z_c] WHERE id = z_concourse;

  INSERT INTO crowd_snapshots (zone_id, density_pct, trend, recorded_at)
  VALUES
    (z_a, 72.5, 'rising',   now() - interval '2 minutes'),
    (z_b, 61.1, 'stable',   now() - interval '3 minutes'),
    (z_c, 86.4, 'rising',   now() - interval '1 minute'),
    (z_d, 40.0, 'falling',  now() - interval '5 minutes'),
    (z_e, 87.5, 'rising',   now() - interval '90 seconds'),
    (z_f, 50.0, 'stable',   now() - interval '4 minutes'),
    (z_concourse, 64.0, 'rising', now() - interval '2 minutes')
  ON CONFLICT DO NOTHING;

  INSERT INTO volunteers (name, assigned_zone_id, languages)
  VALUES ('Alex Rivera', z_a, ARRAY['English','Spanish'])
  ON CONFLICT DO NOTHING;
END $$;