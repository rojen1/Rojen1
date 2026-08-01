import { normalizeRegionLabel } from './regions.js';

/** @param {import('./storage.js').Delivery[]} deliveries */
function regionKey(delivery) {
  return normalizeRegionLabel(delivery.region);
}

/**
 * @param {import('./storage.js').Delivery[]} deliveries
 * @param {string} id
 * @param {'up' | 'down'} direction
 */
export function moveDeliveryInRegion(deliveries, id, direction) {
  const index = deliveries.findIndex(d => d.id === id);
  if (index < 0) return deliveries;

  const region = regionKey(deliveries[index]);
  const regionIndexes = deliveries
    .map((d, i) => ({ i, d }))
    .filter(({ d }) => regionKey(d) === region)
    .map(({ i }) => i);

  const position = regionIndexes.indexOf(index);
  if (position < 0) return deliveries;

  const targetPosition = direction === 'up' ? position - 1 : position + 1;
  if (targetPosition < 0 || targetPosition >= regionIndexes.length) return deliveries;

  const swapIndex = regionIndexes[targetPosition];
  const next = [...deliveries];
  [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  return next;
}

/**
 * @param {import('./storage.js').Delivery[]} deliveries
 * @param {string} dragId
 * @param {string} targetId
 */
export function reorderDeliveryBefore(deliveries, dragId, targetId) {
  if (dragId === targetId) return deliveries;

  const drag = deliveries.find(d => d.id === dragId);
  const target = deliveries.find(d => d.id === targetId);
  if (!drag || !target) return deliveries;
  if (regionKey(drag) !== regionKey(target)) return deliveries;

  const rest = deliveries.filter(d => d.id !== dragId);
  const targetIndex = rest.findIndex(d => d.id === targetId);
  if (targetIndex < 0) return deliveries;

  rest.splice(targetIndex, 0, drag);
  return rest;
}
