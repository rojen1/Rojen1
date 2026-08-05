import {
  ref,
  set,
  update,
  onValue,
  get,
  remove
} from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-database.js';
import { getFirebaseDb } from './firebase.js';

const LEGACY_STORAGE_KEY = 'rozhen1_data';
const SESSION_KEY = 'rozhen1_session';

export const DEFAULT_SETTINGS = {
  bonusPercent: 0.25,
  dailyAllowance: 33.16
};

/** @typedef {{ id: string, clientName: string, amount: number, delivered: boolean, createdAt: string, region?: string, isCash?: boolean, cashReported?: boolean, note?: string }} Delivery */
/** @typedef {{ deliveries: Delivery[], updatedAt: string }} DayRecord */
/** @typedef {{ bonusPercent: number, dailyAllowance: number, regions?: string[] }} Settings */
/** @typedef {{ role: 'admin' | 'driver', username: string, displayName?: string, disabled?: boolean }} UserProfile */
/** @typedef {{ settings: Settings, days: Record<string, DayRecord>, profile: UserProfile | null }} AppData */

/** @type {string | null} */
let currentRole = null;

/** @type {AppData} */
let cache = getDefaultData();

/** @type {string | null} */
let currentUsername = null;

/** @type {(() => void)[]} */
const listeners = [];

/** @type {(() => void)[]} */
let unsubscribes = [];

/** @type {Set<string>} */
const pendingDayWrites = new Set();

function getDefaultData() {
  return {
    settings: { ...DEFAULT_SETTINGS },
    days: {},
    profile: null
  };
}

function notify() {
  listeners.forEach(fn => fn());
}

/** @param {unknown} raw */
export function normalizeDeliveries(raw) {
  if (!raw) return [];

  /** @type {import('./storage.js').Delivery[]} */
  let list;
  if (Array.isArray(raw)) {
    list = raw.slice();
  } else if (typeof raw === 'object') {
    list = Object.keys(raw)
      .filter(k => /^\d+$/.test(k))
      .sort((a, b) => Number(a) - Number(b))
      .map(k => raw[k]);
  } else {
    return [];
  }

  return list
    .filter(d => d && typeof d === 'object')
    .map(d => {
      /** @type {import('./storage.js').Delivery} */
      const delivery = { ...d };
      const note = typeof delivery.note === 'string' ? delivery.note.trim() : '';
      if (note) {
        delivery.note = note;
      } else {
        delete delivery.note;
      }
      return delivery;
    });
}

/** @param {() => void} fn */
export function onDataChange(fn) {
  listeners.push(fn);
  return () => {
    const i = listeners.indexOf(fn);
    if (i >= 0) listeners.splice(i, 1);
  };
}

export function loadData() {
  return cache;
}

/** @param {string} dateKey */
export function getDay(dateKey) {
  const day = cache.days[dateKey];
  if (!day) {
    return { deliveries: [], updatedAt: new Date().toISOString() };
  }
  return {
    deliveries: normalizeDeliveries(day.deliveries),
    updatedAt: day.updatedAt || new Date().toISOString()
  };
}

/** @param {string} username */
function accountRef(username) {
  return ref(getFirebaseDb(), `accounts/${username}`);
}

/** @param {string} username */
/** @param {string} dateKey */
function dayRef(username, dateKey) {
  return ref(getFirebaseDb(), `accounts/${username}/days/${dateKey}`);
}

/** @param {string} username */
function daysRef(username) {
  return ref(getFirebaseDb(), `accounts/${username}/days`);
}

/**
 * @param {string} username
 * @param {'admin' | 'driver'} role
 */
export async function initUserStorage(username, role) {
  teardownStorage();
  currentUsername = username;
  currentRole = role;
  cache = getDefaultData();
  cache.profile = { role, username, displayName: username };

  return new Promise((resolve, reject) => {
    let userReady = false;
    let daysReady = false;
    let settled = false;

    const tryReady = () => {
      if (userReady && daysReady && !settled) {
        settled = true;
        migrateLegacyLocalStorage(username).then(resolve).catch(reject);
      }
    };

    const userUnsub = onValue(
      accountRef(username),
      (snap) => {
        if (!snap.exists()) {
          reject(new Error('Липсва профил на потребителя.'));
          return;
        }
        const data = snap.val();
        cache.settings = { ...DEFAULT_SETTINGS, ...(data.settings || {}) };
        cache.profile = {
          role: data.role || role,
          username,
          displayName: data.displayName || username,
          disabled: !!data.disabled
        };
        userReady = true;
        notify();
        tryReady();
      },
      reject
    );

    const daysUnsub = onValue(
      daysRef(username),
      (snap) => {
        const days = {};
        if (snap.exists()) {
          const raw = snap.val();
          for (const [dateKey, day] of Object.entries(raw)) {
            if (pendingDayWrites.has(dateKey)) continue;
            days[dateKey] = {
              deliveries: normalizeDeliveries(day.deliveries),
              updatedAt: day.updatedAt || new Date().toISOString()
            };
          }
        }
        cache.days = days;
        daysReady = true;
        notify();
        tryReady();
      },
      reject
    );

    unsubscribes = [userUnsub, daysUnsub];
  });
}

export function teardownStorage() {
  unsubscribes.forEach(unsub => unsub());
  unsubscribes = [];
  currentUsername = null;
  currentRole = null;
  cache = getDefaultData();
}

export function getUserRole() {
  return currentRole;
}

export function getCurrentUsername() {
  return currentUsername;
}

export function isAdmin() {
  return currentRole === 'admin';
}

export function saveSession(session) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function loadSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
}

async function migrateLegacyLocalStorage(username) {
  try {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return;

    const daysSnap = await get(daysRef(username));
    if (daysSnap.exists()) {
      localStorage.removeItem(LEGACY_STORAGE_KEY);
      return;
    }

    const parsed = JSON.parse(raw);

    await update(accountRef(username), {
      settings: { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) },
      migratedFromLocalStorage: true,
      migratedAt: new Date().toISOString()
    });

    const dayWrites = {};
    for (const [dateKey, day] of Object.entries(parsed.days || {})) {
      dayWrites[dateKey] = {
        deliveries: day.deliveries || [],
        updatedAt: day.updatedAt || new Date().toISOString()
      };
    }

    if (Object.keys(dayWrites).length) {
      await update(daysRef(username), dayWrites);
    }

    localStorage.removeItem(LEGACY_STORAGE_KEY);
    notify();
  } catch {
    // best-effort
  }
}

/** @param {Partial<Settings>} settings */
export async function updateSettings(settings) {
  if (!currentUsername) throw new Error('Not signed in');

  const merged = { ...cache.settings, ...settings };
  delete merged.monthlyVoucher;
  cache.settings = merged;
  notify();

  await update(accountRef(currentUsername), { settings: merged });
  return merged;
}

/** @param {unknown} value */
function sanitizeForFirebase(value) {
  if (value === undefined) return undefined;
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    return value.map(item => sanitizeForFirebase(item));
  }

  /** @type {Record<string, unknown>} */
  const out = {};
  for (const [key, val] of Object.entries(value)) {
    if (val === undefined) continue;
    if (key === 'note' && (typeof val !== 'string' || !val.trim())) continue;
    out[key] = sanitizeForFirebase(val);
  }
  return out;
}

/** @param {string} dateKey */
/** @param {DayRecord} dayRecord */
export async function saveDay(dateKey, dayRecord) {
  if (!currentUsername) throw new Error('Not signed in');

  const normalizedDeliveries = normalizeDeliveries(dayRecord.deliveries);
  const record = /** @type {DayRecord} */ (sanitizeForFirebase({
    deliveries: normalizedDeliveries,
    updatedAt: new Date().toISOString()
  }));

  pendingDayWrites.add(dateKey);
  try {
    if (!record.deliveries.length) {
      await remove(dayRef(currentUsername, dateKey));
      delete cache.days[dateKey];
    } else {
      await set(dayRef(currentUsername, dateKey), record);
      cache.days[dateKey] = record;
    }
    notify();
  } finally {
    pendingDayWrites.delete(dateKey);
  }
}

export async function clearAllData() {
  if (!currentUsername) throw new Error('Not signed in');

  await remove(daysRef(currentUsername));
  await update(accountRef(currentUsername), {
    settings: DEFAULT_SETTINGS,
    clearedAt: new Date().toISOString()
  });

  cache = getDefaultData();
  notify();
}

export function isStorageReady() {
  return currentUsername !== null;
}
