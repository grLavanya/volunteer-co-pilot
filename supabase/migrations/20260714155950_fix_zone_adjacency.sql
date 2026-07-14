/*
# Fix zone adjacency edges

The original seed left Gate C's connected_zone_ids missing Gate D, breaking
routes to/from Gate D. This migration re-populates connected_zone_ids for
all zones using their real IDs, ensuring every edge is bidirectional and the
graph matches the intended topology:

  Gate A  ↔ Central Concourse
  Gate B  ↔ Central Concourse
  Gate C  ↔ Central Concourse
  Gate C  ↔ Gate D
  Gate C  ↔ Gate E
  Gate E  ↔ Gate F

Central Concourse connects to Gates A, B, C. Gates do not connect directly
to each other except C-D and C-E-E-F.
*/

DO $$
DECLARE
  z_a uuid; z_b uuid; z_c uuid; z_d uuid; z_e uuid; z_f uuid; z_concourse uuid;
BEGIN
  SELECT id INTO z_a FROM zones WHERE name = 'Gate A' LIMIT 1;
  SELECT id INTO z_b FROM zones WHERE name = 'Gate B' LIMIT 1;
  SELECT id INTO z_c FROM zones WHERE name = 'Gate C' LIMIT 1;
  SELECT id INTO z_d FROM zones WHERE name = 'Gate D' LIMIT 1;
  SELECT id INTO z_e FROM zones WHERE name = 'Gate E' LIMIT 1;
  SELECT id INTO z_f FROM zones WHERE name = 'Gate F' LIMIT 1;
  SELECT id INTO z_concourse FROM zones WHERE name = 'Central Concourse' LIMIT 1;

  UPDATE zones SET connected_zone_ids = ARRAY[z_concourse] WHERE id = z_a;
  UPDATE zones SET connected_zone_ids = ARRAY[z_concourse] WHERE id = z_b;
  UPDATE zones SET connected_zone_ids = ARRAY[z_concourse, z_d, z_e] WHERE id = z_c;
  UPDATE zones SET connected_zone_ids = ARRAY[z_c] WHERE id = z_d;
  UPDATE zones SET connected_zone_ids = ARRAY[z_c, z_f] WHERE id = z_e;
  UPDATE zones SET connected_zone_ids = ARRAY[z_e] WHERE id = z_f;
  UPDATE zones SET connected_zone_ids = ARRAY[z_a, z_b, z_c] WHERE id = z_concourse;
END $$;