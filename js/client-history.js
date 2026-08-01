/**
 * Client name suggestions from the current user's delivery history only.
 */

/** @param {Record<string, { deliveries?: Array<{ clientName?: string }> }>} allDays @param {string} [query] */
export function collectClientNames(allDays, query = '') {
  /** @type {Map<string, number>} */
  const counts = new Map();
  const q = query.trim().toLowerCase();

  for (const day of Object.values(allDays)) {
    for (const delivery of day?.deliveries || []) {
      const name = delivery.clientName?.trim();
      if (!name) continue;
      if (q && !name.toLowerCase().includes(q)) continue;
      counts.set(name, (counts.get(name) || 0) + 1);
    }
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'bg'))
    .map(([name]) => name)
    .slice(0, 30);
}

/** @param {import('./storage.js').Delivery[]} deliveries @param {string} clientName */
export function hasClientOnDay(deliveries, clientName) {
  const needle = clientName.trim().toLowerCase();
  if (!needle) return false;
  return deliveries.some(d => d.clientName?.trim().toLowerCase() === needle);
}
