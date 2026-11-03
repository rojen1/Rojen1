/** @typedef {{ id: string, date: string, vendor: string, liters: number, unitPrice: number, total: number, odometerKm: number, note?: string }} FuelReceiptRow */

/** @param {FuelReceiptRow[]} receipts */
export function sumReceiptLiters(receipts) {
  return receipts.reduce((s, r) => s + (Number(r.liters) || 0), 0);
}

/** @param {FuelReceiptRow[]} receipts */
export function sumReceiptAmount(receipts) {
  return receipts.reduce((s, r) => s + (Number(r.total) || 0), 0);
}

/** @param {number} odometerStart @param {number} odometerEnd */
export function calcTotalKm(odometerStart, odometerEnd) {
  const a = Number(odometerStart);
  const b = Number(odometerEnd);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return 0;
  return Math.round((b - a) * 10) / 10;
}

/** @param {number} totalLiters @param {number} totalKm */
export function calcAvgConsumptionPer100(totalLiters, totalKm) {
  if (!totalKm || totalKm <= 0) return 0;
  return Math.round((Number(totalLiters) / totalKm) * 100 * 100) / 100;
}

/**
 * Километраж от последното зареждане в периода (най-късна дата; при равенство — по-голям km).
 * @param {FuelReceiptRow[]} receipts
 * @param {string} [periodFrom] YYYY-MM-DD
 * @param {string} [periodTo] YYYY-MM-DD
 */
export function odometerKmFromLastReceiptInPeriod(receipts, periodFrom, periodTo) {
  const from = String(periodFrom || '').slice(0, 10);
  const to = String(periodTo || '').slice(0, 10);
  const candidates = (receipts || []).filter(r => {
    const km = Number(r.odometerKm);
    if (!Number.isFinite(km) || km <= 0) return false;
    const d = String(r.date || '').slice(0, 10);
    if (d && from && d < from) return false;
    if (d && to && d > to) return false;
    return true;
  });
  if (!candidates.length) return null;
  candidates.sort((a, b) => {
    const byDate = (b.date || '').localeCompare(a.date || '');
    if (byDate !== 0) return byDate;
    return Number(b.odometerKm) - Number(a.odometerKm);
  });
  return candidates[0].odometerKm;
}

/** @param {Partial<FuelReceiptRow>} row */
export function normalizeReceiptRow(row) {
  const liters = Number(row.liters) || 0;
  const unitPrice = Number(row.unitPrice) || 0;
  let total = Number(row.total);
  if (!Number.isFinite(total) || total <= 0) {
    total = Math.round(liters * unitPrice * 100) / 100;
  }
  return {
    id: row.id || `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    date: String(row.date || '').slice(0, 10),
    vendor: String(row.vendor || '').trim(),
    liters,
    unitPrice,
    total,
    odometerKm: Number(row.odometerKm) || 0,
    note: row.note != null && String(row.note).trim() ? String(row.note).trim() : ''
  };
}

/** Firebase RTDB не приема undefined — почистване преди set() */
/** @param {FuelReceiptRow[]} receipts */
export function receiptsForFirebase(receipts) {
  return (receipts || []).map(r => {
    const row = normalizeReceiptRow(r);
    return {
      id: row.id,
      date: row.date,
      vendor: row.vendor,
      liters: row.liters,
      unitPrice: row.unitPrice,
      total: row.total,
      odometerKm: row.odometerKm,
      note: row.note
    };
  });
}
