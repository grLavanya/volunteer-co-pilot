import type { Zone } from '../types/database';

/**
 * Build an adjacency map from zone data.
 * Each zone id maps to its set of connected zone ids.
 */
export function buildAdjacencyMap(zones: Zone[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const zone of zones) {
    map.set(zone.id, zone.connected_zone_ids ?? []);
  }
  return map;
}

/**
 * BFS shortest-path between two zones.
 * Returns an ordered list of zone *names* from origin to destination,
 * or null if no path exists.
 */
export function getRoute(
  zones: Zone[],
  fromZoneId: string,
  toZoneId: string
): string[] | null {
  if (fromZoneId === toZoneId) {
    const start = zones.find((z) => z.id === fromZoneId);
    return start ? [start.name] : null;
  }

  const adj = buildAdjacencyMap(zones);
  const nameById = new Map(zones.map((z) => [z.id, z.name]));

  const queue: string[] = [fromZoneId];
  const visited = new Set<string>([fromZoneId]);
  const parent = new Map<string, string | null>();
  parent.set(fromZoneId, null);

  while (queue.length > 0) {
    const current = queue.shift()!;

    const neighbors = adj.get(current) ?? [];
    for (const neighbor of neighbors) {
      if (visited.has(neighbor)) continue;
      visited.add(neighbor);
      parent.set(neighbor, current);

      if (neighbor === toZoneId) {
        // Reconstruct path
        const path: string[] = [];
        let node: string | undefined = toZoneId;
        while (node) {
          const name = nameById.get(node);
          if (name) path.unshift(name);
          node = parent.get(node) ?? undefined;
        }
        return path;
      }
      queue.push(neighbor);
    }
  }

  return null;
}
