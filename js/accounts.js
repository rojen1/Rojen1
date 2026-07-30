import {
  ref,
  get,
  set,
  update,
  remove
} from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-database.js';
import { getFirebaseDb } from './firebase.js';
import { DEFAULT_SETTINGS } from './storage.js';

export const ADMIN_USERNAME = 'martin';
export const DEFAULT_ADMIN_PASSWORD = 'rozhen1';

/** @typedef {'admin' | 'driver'} UserRole */

/**
 * @param {string} password
 * @returns {Promise<string>}
 */
export async function hashPassword(password) {
  const data = new TextEncoder().encode(password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/** @param {string} raw */
export function normalizeUsername(raw) {
  return raw.trim().toLowerCase().replace(/\s+/g, '_');
}

/** @param {string} username */
export function isAdminUsername(username) {
  return normalizeUsername(username) === ADMIN_USERNAME;
}

/** @param {string} username */
function accountRef(username) {
  return ref(getFirebaseDb(), `accounts/${normalizeUsername(username)}`);
}

/** @param {Record<string, unknown>} account */
function accountProfile(username, account) {
  const { days, passwordHash, ...rest } = account;
  return {
    username,
    displayName: /** @type {string} */ (rest.displayName) || username,
    role: rest.role === 'admin' ? 'admin' : 'driver',
    disabled: !!rest.disabled,
    createdAt: /** @type {string | undefined} */ (rest.createdAt)
  };
}

/**
 * @returns {Promise<void>}
 */
export async function ensureBootstrapAdmin() {
  const snap = await get(accountRef(ADMIN_USERNAME));
  if (snap.exists()) return;

  await set(accountRef(ADMIN_USERNAME), {
    username: ADMIN_USERNAME,
    displayName: 'Мартин',
    passwordHash: await hashPassword(DEFAULT_ADMIN_PASSWORD),
    role: 'admin',
    settings: DEFAULT_SETTINGS,
    disabled: false,
    createdAt: new Date().toISOString()
  });
}

/**
 * @returns {Promise<Array<{ username: string, displayName: string, role: UserRole, disabled: boolean }>>}
 */
export async function listLoginUsers() {
  await ensureBootstrapAdmin();
  const snap = await get(ref(getFirebaseDb(), 'accounts'));
  if (!snap.exists()) return [];

  const accounts = snap.val();
  return Object.entries(accounts)
    .map(([username, data]) => accountProfile(username, /** @type {Record<string, unknown>} */ (data)))
    .filter(u => !u.disabled)
    .sort((a, b) => {
      if (a.username === ADMIN_USERNAME) return -1;
      if (b.username === ADMIN_USERNAME) return 1;
      return (a.displayName || a.username).localeCompare(b.displayName || b.username, 'bg');
    });
}

/**
 * @returns {Promise<Array<{ username: string, displayName: string, role: UserRole, disabled: boolean, createdAt: string }>>}
 */
export async function listAllAccounts() {
  await ensureBootstrapAdmin();
  const snap = await get(ref(getFirebaseDb(), 'accounts'));
  if (!snap.exists()) return [];

  const accounts = snap.val();
  return Object.entries(accounts)
    .map(([username, data]) => accountProfile(username, /** @type {Record<string, unknown>} */ (data)))
    .sort((a, b) => (a.displayName || a.username).localeCompare(b.displayName || b.username, 'bg'));
}

/**
 * @param {string} username
 * @param {string} password
 * @returns {Promise<{ username: string, displayName: string, role: UserRole }>}
 */
export async function verifyLogin(username, password) {
  const key = normalizeUsername(username);
  if (!key) throw new Error('Изберете потребител.');

  const snap = await get(accountRef(key));
  if (!snap.exists()) throw new Error('Грешен потребител или парола.');

  const data = snap.val();
  if (data.disabled) throw new Error('Този акаунт е деактивиран.');

  const hash = await hashPassword(password);
  if (hash !== data.passwordHash) throw new Error('Грешен потребител или парола.');

  return {
    username: key,
    displayName: data.displayName || key,
    role: data.role === 'admin' ? 'admin' : 'driver'
  };
}

/**
 * @param {{ username: string, displayName?: string, password: string }} input
 */
export async function createUserAccount(input) {
  const username = normalizeUsername(input.username);
  const displayName = (input.displayName || username).trim();
  const password = input.password;

  if (!username || username.length < 2) {
    throw new Error('Потребителското име трябва да е поне 2 символа.');
  }
  if (!/^[a-z0-9_]+$/.test(username)) {
    throw new Error('Потребителското име: само букви, цифри и _');
  }
  if (password.length < 4) {
    throw new Error('Паролата трябва да е поне 4 символа.');
  }
  if (isAdminUsername(username)) {
    throw new Error('Потребителят martin е запазен за администратора.');
  }

  const existing = await get(accountRef(username));
  if (existing.exists()) throw new Error('Това потребителско име вече съществува.');

  await set(accountRef(username), {
    username,
    displayName,
    passwordHash: await hashPassword(password),
    role: 'driver',
    settings: DEFAULT_SETTINGS,
    disabled: false,
    createdAt: new Date().toISOString()
  });

  return username;
}

/**
 * @param {string} username
 * @param {string} newPassword
 */
export async function updateUserPassword(username, newPassword) {
  const key = normalizeUsername(username);
  if (newPassword.length < 4) {
    throw new Error('Паролата трябва да е поне 4 символа.');
  }

  const snap = await get(accountRef(key));
  if (!snap.exists()) throw new Error('Потребителят не е намерен.');

  await update(accountRef(key), {
    passwordHash: await hashPassword(newPassword),
    updatedAt: new Date().toISOString()
  });
}

/**
 * @param {string} username
 * @param {boolean} disabled
 */
export async function setUserDisabled(username, disabled) {
  const key = normalizeUsername(username);
  if (isAdminUsername(key) && disabled) {
    throw new Error('Не може да деактивирате администратора.');
  }

  await update(accountRef(key), {
    disabled,
    updatedAt: new Date().toISOString()
  });
}

/**
 * Permanently delete a user account and all delivery data.
 * @param {string} username
 */
export async function deleteUserAccount(username) {
  const key = normalizeUsername(username);
  if (!key) throw new Error('Невалиден потребител.');
  if (isAdminUsername(key)) {
    throw new Error('Не може да изтриете администратора.');
  }

  const snap = await get(accountRef(key));
  if (!snap.exists()) throw new Error('Потребителят не е намерен.');

  await remove(accountRef(key));
}
