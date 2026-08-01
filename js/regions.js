/** @typedef {{ region: string, deliveries: import('./storage.js').Delivery[], delivered: number, total: number }} RegionGroup */

export const DEFAULT_REGIONS = [
  'Поморие',
  'Равда',
  'Несебър',
  'Слънчев бряг',
  'Свети Влас',
  'Бургас'
];

export const OTHER_REGION_VALUE = '__other__';
export const LAST_REGION_KEY = 'rozhen1_last_region';
export const NO_REGION_LABEL = 'Без район';

/** @param {string[]} regions */
export function dedupeRegions(regions) {
  /** @type {string[]} */
  const out = [];
  /** @type {Set<string>} */
  const seen = new Set();

  for (const region of regions) {
    const trimmed = region.trim();
    const key = trimmed.toLowerCase();
    if (!trimmed || seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }

  return out;
}

/**
 * @param {HTMLSelectElement | null} select
 * @param {HTMLInputElement | null} otherInput
 * @param {{ lastRegion?: string, regions?: string[] }} [options]
 */
export function fillRegionSelect(select, otherInput, options = {}) {
  if (!select) return;

  const regions = options.regions ?? DEFAULT_REGIONS;
  const lastRegion = options.lastRegion ?? sessionStorage.getItem(LAST_REGION_KEY) ?? '';
  select.innerHTML = '<option value="">— Изберете район —</option>';

  for (const region of regions) {
    const opt = document.createElement('option');
    opt.value = region;
    opt.textContent = region;
    select.appendChild(opt);
  }

  const otherOpt = document.createElement('option');
  otherOpt.value = OTHER_REGION_VALUE;
  otherOpt.textContent = 'Добави нов…';
  select.appendChild(otherOpt);

  if (lastRegion && [...select.options].some(o => o.value === lastRegion)) {
    select.value = lastRegion;
  } else if (lastRegion && otherInput) {
    select.value = OTHER_REGION_VALUE;
    otherInput.value = lastRegion;
  }

  syncRegionOtherVisibility(select, otherInput);
}

/**
 * @param {HTMLSelectElement | null} select
 * @param {HTMLInputElement | null} otherInput
 */
export function syncRegionOtherVisibility(select, otherInput) {
  if (!select || !otherInput) return;

  const isOther = select.value === OTHER_REGION_VALUE;
  otherInput.classList.toggle('hidden', !isOther);
  otherInput.required = isOther;
}

/**
 * @param {HTMLSelectElement | null} select
 * @param {HTMLInputElement | null} otherInput
 */
export function getRegionFromSelect(select, otherInput) {
  if (!select?.value) return '';

  if (select.value === OTHER_REGION_VALUE) {
    return otherInput?.value.trim() || '';
  }

  return select.value;
}

/** @param {string | undefined | null} region */
export function normalizeRegionLabel(region) {
  const trimmed = (region || '').trim();
  return trimmed || NO_REGION_LABEL;
}

/**
 * Groups deliveries by region, preserving route order (first stop in a region).
 * @param {import('./storage.js').Delivery[]} deliveries
 * @returns {RegionGroup[]}
 */
export function groupDeliveriesByRegion(deliveries) {
  /** @type {Map<string, import('./storage.js').Delivery[]>} */
  const groups = new Map();
  /** @type {Map<string, number>} */
  const regionOrder = new Map();
  let orderIndex = 0;

  for (const delivery of deliveries) {
    const region = normalizeRegionLabel(delivery.region);
    if (!regionOrder.has(region)) {
      regionOrder.set(region, orderIndex++);
    }
    if (!groups.has(region)) {
      groups.set(region, []);
    }
    groups.get(region).push(delivery);
  }

  return [...groups.entries()]
    .sort((a, b) => regionOrder.get(a[0]) - regionOrder.get(b[0]))
    .map(([region, items]) => ({
      region,
      deliveries: items,
      delivered: items.filter(d => d.delivered).length,
      total: items.length
    }));
}

/** @param {RegionGroup[]} groups */
export function isAllRegionsComplete(groups) {
  return groups.length > 0 && groups.every(g => g.delivered === g.total);
}
