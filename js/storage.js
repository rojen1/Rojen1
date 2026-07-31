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
  dailyAllowance: 33.16,
  monthlyVoucher: 100
};

/** @typedef {{ id: string, clientName: string, amount: number, delivered: boolean, createdAt: string, region?: string }} Delivery */
/** @typedef {{ deliveries: Delivery[], updatedAt: string }} DayRecord */
/** @typedef {{ bonusPercent: number, dailyAllowance: number, monthlyVoucher: number }} Settings */
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
  return cache.days[dateKey] || { deliveries: [], updatedAt: new Date().toISOString() };
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
            days[dateKey] = {
              deliveries: day.deliveries || [],
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
  cache.settings = merged;
  notify();

  await update(accountRef(currentUsername), { settings: merged });
  return merged;
}

/** @param {string} dateKey */
/** @param {DayRecord} dayRecord */
export async function saveDay(dateKey, dayRecord) {
  if (!currentUsername) throw new Error('Not signed in');

  const record = { ...dayRecord, updatedAt: new Date().toISOString() };
  cache.days[dateKey] = record;
  notify();

  await set(dayRef(currentUsername, dateKey), record);
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
