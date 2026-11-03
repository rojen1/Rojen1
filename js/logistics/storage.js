import { ref, get, set, update, onValue, push, remove } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-database.js';
import { getFirebaseDb } from '../firebase.js';
import { getCurrentUsername } from '../storage.js';
import { receiptsForFirebase } from './calculations.js';

/** @typedef {import('./calculations.js').FuelReceiptRow} FuelReceiptRow */

/**
 * @typedef {Object} LogisticsReport
 * @property {string} id
 * @property {string} createdAt
 * @property {string} updatedAt
 * @property {string} busId
 * @property {string} busName
 * @property {string} plate
 * @property {string} region
 * @property {string} driverName
 * @property {string} periodFrom
 * @property {string} periodTo
 * @property {number} odometerStart
 * @property {number} odometerEnd
 * @property {FuelReceiptRow[]} receipts
 * @property {string} [notes]
 * @property {string} [reportNo]
 * @property {string} [reportDate]
 * @property {string} [orderNo]
 * @property {string} [employeePaid]
 * @property {string} [amountToReport]
 * @property {string} [cashOnHand]
 */

function reportsRef(username) {
  return ref(getFirebaseDb(), `accounts/${username}/logisticsReports`);
}

function reportRef(username, reportId) {
  return ref(getFirebaseDb(), `accounts/${username}/logisticsReports/${reportId}`);
}

function odometerStateRef(username, busId) {
  return ref(getFirebaseDb(), `accounts/${username}/logisticsState/odometer/${busId}`);
}

function driverNameStateRef(username, busId) {
  return ref(getFirebaseDb(), `accounts/${username}/logisticsState/driverName/${busId}`);
}

/** @param {unknown} raw */
export function normalizeReport(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const r = /** @type {Record<string, unknown>} */ (raw);
  const receipts = Array.isArray(r.receipts) ? r.receipts : [];
  return {
    id: String(r.id || ''),
    createdAt: String(r.createdAt || ''),
    updatedAt: String(r.updatedAt || ''),
    busId: String(r.busId || ''),
    busName: String(r.busName || ''),
    plate: String(r.plate || ''),
    region: String(r.region || ''),
    driverName: String(r.driverName || ''),
    periodFrom: String(r.periodFrom || ''),
    periodTo: String(r.periodTo || ''),
    odometerStart: Number(r.odometerStart) || 0,
    odometerEnd: Number(r.odometerEnd) || 0,
    receipts,
    notes: r.notes ? String(r.notes) : undefined,
    reportNo: r.reportNo ? String(r.reportNo) : undefined,
    reportDate: r.reportDate ? String(r.reportDate) : undefined,
    orderNo: r.orderNo ? String(r.orderNo) : undefined,
    employeePaid: r.employeePaid != null ? String(r.employeePaid) : undefined,
    amountToReport: r.amountToReport != null ? String(r.amountToReport) : undefined,
    cashOnHand: r.cashOnHand != null ? String(r.cashOnHand) : undefined
  };
}

/** @param {string} username @param {(reports: LogisticsReport[]) => void} cb */
export function subscribeLogisticsReports(username, cb) {
  return onValue(reportsRef(username), snap => {
    if (!snap.exists()) {
      cb([]);
      return;
    }
    const val = snap.val();
    const list = Object.entries(val)
      .map(([id, row]) => normalizeReport({ ...row, id }))
      .filter(Boolean);
    list.sort((a, b) => (b.periodTo || '').localeCompare(a.periodTo || ''));
    cb(list);
  });
}

/** @param {string} busId */
export async function fetchLastOdometerEnd(busId) {
  const username = getCurrentUsername();
  if (!username || !busId) return null;
  const snap = await get(odometerStateRef(username, busId));
  if (!snap.exists()) return null;
  const v = Number(snap.val());
  return Number.isFinite(v) ? v : null;
}

/** @param {string} busId */
export async function fetchLastDriverName(busId) {
  const username = getCurrentUsername();
  if (!username || !busId) return '';
  const snap = await get(driverNameStateRef(username, busId));
  if (!snap.exists()) return '';
  const v = String(snap.val() || '').trim();
  return v;
}

/** @param {string} busId @param {number} odometerEnd */
async function saveLastOdometerEnd(busId, odometerEnd) {
  const username = getCurrentUsername();
  if (!username || !busId) return;
  await set(odometerStateRef(username, busId), odometerEnd);
}

/** @param {string} busId @param {string} driverName */
async function saveLastDriverName(busId, driverName) {
  const username = getCurrentUsername();
  const trimmed = String(driverName || '').trim();
  if (!username || !busId || !trimmed) return;
  await set(driverNameStateRef(username, busId), trimmed);
}

/** @param {Omit<LogisticsReport, 'id'|'createdAt'|'updatedAt'> & { id?: string }} report */
export async function saveLogisticsReport(report) {
  const username = getCurrentUsername();
  if (!username) throw new Error('Не сте влезли в системата.');

  const now = new Date().toISOString();
  let id = report.id;
  if (id === 'preview' || id === '') id = undefined;
  if (!id) {
    const newRef = push(reportsRef(username));
    id = newRef.key;
  }
  if (!id) throw new Error('Грешка при запис.');

  const existingSnap = await get(reportRef(username, id));
  const createdAt = existingSnap.exists()
    ? String(existingSnap.val()?.createdAt || now)
    : now;

  const payload = {
    busId: report.busId,
    busName: report.busName,
    plate: report.plate,
    region: report.region,
    driverName: report.driverName,
    periodFrom: report.periodFrom,
    periodTo: report.periodTo,
    odometerStart: report.odometerStart,
    odometerEnd: report.odometerEnd,
    receipts: receiptsForFirebase(report.receipts),
    notes: report.notes || '',
    reportNo: report.reportNo || '',
    reportDate: report.reportDate || '',
    orderNo: report.orderNo || '1',
    employeePaid: report.employeePaid || '',
    amountToReport: report.amountToReport || '',
    cashOnHand: report.cashOnHand || '',
    createdAt,
    updatedAt: now
  };

  await set(reportRef(username, id), payload);

  if (report.odometerEnd > 0) {
    await saveLastOdometerEnd(report.busId, report.odometerEnd);
  }
  await saveLastDriverName(report.busId, report.driverName);

  return id;
}

/** @param {string} reportId */
export async function deleteLogisticsReport(reportId) {
  const username = getCurrentUsername();
  if (!username) throw new Error('Не сте влезли в системата.');
  await remove(reportRef(username, reportId));
}
