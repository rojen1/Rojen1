import { loadData, updateSettings } from './storage.js';
import { DEFAULT_REGIONS, dedupeRegions } from './regions.js';

export function getSavedRegions() {
  const custom = loadData().settings.regions;
  if (Array.isArray(custom)) return dedupeRegions(custom);
  return [...DEFAULT_REGIONS];
}

/** @param {string[]} regions */
export async function saveSavedRegions(regions) {
  await updateSettings({ regions: dedupeRegions(regions) });
}

/** @param {string} name */
export async function addSavedRegion(name) {
  const trimmed = name.trim();
  if (!trimmed) return getSavedRegions();

  const current = getSavedRegions();
  if (current.some(region => region.toLowerCase() === trimmed.toLowerCase())) {
    return current;
  }

  const next = [...current, trimmed];
  await saveSavedRegions(next);
  return next;
}

/** @param {string} name */
export async function removeSavedRegion(name) {
  const next = getSavedRegions().filter(region => region !== name);
  await saveSavedRegions(next);
  return next;
}
