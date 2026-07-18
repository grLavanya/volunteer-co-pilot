create or replace function public.get_latest_crowd_snapshots()
returns table (
  zone_id uuid,
  density_pct numeric,
  trend text,
  recorded_at timestamptz
)
language sql
stable
as $$
  select distinct on (zone_id)
    zone_id,
    density_pct,
    trend,
    recorded_at
  from crowd_snapshots
  order by zone_id, recorded_at desc;
$$;