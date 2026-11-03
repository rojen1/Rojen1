/** @typedef {{ id: string, name: string, plate: string, region: string }} LogisticsBus */

/** @type {LogisticsBus[]} */
export const DEFAULT_LOGISTICS_BUSES = [
  { id: 'bus-1', name: 'Бус 1', plate: '', region: '' },
  { id: 'bus-2', name: 'Бус 2', plate: '', region: '' },
  { id: 'bus-3', name: 'Бус 3', plate: '', region: '' }
];

/** @param {unknown} raw @param {LogisticsBus[]} fallback */
export function normalizeLogisticsBuses(raw, fallback = DEFAULT_LOGISTICS_BUSES) {
  if (!Array.isArray(raw) || !raw.length) return fallback.map(b => ({ ...b }));
  return raw
    .filter(b => b && typeof b === 'object')
    .map((b, i) => ({
      id: String(b.id || `bus-${i + 1}`),
      name: String(b.name || b.label || `Бус ${i + 1}`).trim(),
      plate: String(b.plate || b.regNumber || '').trim(),
      region: String(b.region || '').trim()
    }));
}

/** @param {LogisticsBus[]} buses @param {string} busId */
export function findBusById(buses, busId) {
  return buses.find(b => b.id === busId) || buses[0] || null;
}
