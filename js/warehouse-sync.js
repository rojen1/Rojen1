import { ref, set, remove, update } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-database.js';
import { getFirebaseDb } from './firebase.js';

/** @param {unknown} raw */
function normalizeDeliveries(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter(Boolean).map(d => ({ ...d }));
  return Object.keys(raw)
    .filter(k => /^\d+$/.test(k))
    .sort((a, b) => Number(a) - Number(b))
    .map(k => raw[k])
    .filter(Boolean)
    .map(d => ({ ...d }));
}

function driverDayRef(dateKey, username) {
  return ref(getFirebaseDb(), `sklad/days/${dateKey}/drivers/${username}`);
}

function dayMetaRef(dateKey) {
  return ref(getFirebaseDb(), `sklad/days/${dateKey}`);
}

/**
 * Rozhen1 → Склад: копира целия дневен курс на шофьора.
 * @param {string} username
 * @param {string} displayName
 * @param {string} dateKey
 * @param {{ deliveries?: unknown[], updatedAt?: string }} dayRecord
 */
export async function syncDriverDayToSklad(username, displayName, dateKey, dayRecord) {
  if (!username || !dateKey) return;

  const deliveries = normalizeDeliveries(dayRecord?.deliveries);
  const now = new Date().toISOString();

  if (!deliveries.length) {
    await remove(driverDayRef(dateKey, username));
  } else {
    await set(driverDayRef(dateKey, username), {
      username,
      displayName: displayName || username,
      deliveries,
      stopCount: deliveries.length,
      doneCount: deliveries.filter(d => d.delivered).length,
      updatedAt: now
    });
  }

  await update(dayMetaRef(dateKey), {
    dateKey,
    updatedAt: now,
    lastSyncBy: username
  });
}

/**
 * При вход — изпраща всички дни на шофьора към склада.
 * @param {string} username
 * @param {string} displayName
 * @param {Record<string, { deliveries?: unknown[] }>} days
 */
export async function syncAllDriverDaysToSklad(username, displayName, days) {
  const entries = Object.entries(days || {});
  for (const [dateKey, day] of entries) {
    if (!day?.deliveries?.length) continue;
    await syncDriverDayToSklad(username, displayName, dateKey, day);
  }
}
