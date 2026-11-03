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
    note: row.note ? String(row.note).trim() : undefined
  };
}
