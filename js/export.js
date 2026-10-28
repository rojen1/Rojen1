import { calcMonthSummary, formatShortDate, getMonthDayKeys } from './calculations.js';
import { normalizeDeliveries } from './storage.js';

/** @param {string} value */
function csvCell(value) {
  const text = String(value ?? '');
  if (/[",;\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

/** Числа с десетична запетая — Excel (BG) ги разпознава по-надеждно */
/** @param {number} amount */
function formatExportAmount(amount) {
  if (amount == null || !Number.isFinite(Number(amount))) return '';
  return Number(amount).toFixed(2).replace('.', ',');
}

/** @param {string[][]} rows */
function rowsToCsv(rows) {
  const body = rows.map(row => row.map(csvCell).join(';')).join('\r\n');
  return `\uFEFFsep=;\r\n${body}`;
}

/** @param {string} filename @param {string} content */
export function downloadTextFile(filename, content) {
  const blob = new Blob([content], {
    type: 'application/vnd.ms-excel;charset=utf-8'
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * @param {Record<string, import('./storage.js').DayRecord>} allDays
 * @param {number} year
 * @param {number} month
 * @param {import('./storage.js').Settings} settings
 * @param {string} monthLabel
 */
export function exportMonthCsv(allDays, year, month, settings, monthLabel) {
  const summary = calcMonthSummary(allDays, year, month, settings);

  /** @type {string[][]} */
  const rows = [
    [`Месечен отчет - ${monthLabel}`],
    [],
    ['Дата', 'Оборот (EUR)', 'Бонус чист (EUR)', 'Брутна част (EUR)', 'Нето (EUR)']
  ];

  for (const row of summary.rows) {
    rows.push([
      formatShortDate(row.dateKey),
      row.isPlanned ? formatExportAmount(row.plannedTurnover) : formatExportAmount(row.turnover),
      row.isPlanned ? '' : formatExportAmount(row.bonus),
      row.isPlanned ? '' : formatExportAmount(row.allowance),
      row.isPlanned ? '' : formatExportAmount(row.total)
    ]);
  }

  rows.push([]);
  rows.push([
    'ОБЩО',
    formatExportAmount(summary.totalTurnover),
    formatExportAmount(summary.totalBonus),
    formatExportAmount(summary.totalAllowance),
    formatExportAmount(summary.finalPayout)
  ]);
  rows.push([]);
  rows.push(['Детайли по спирки']);
  rows.push(['Дата', 'Клиент', 'Район', 'Сума (EUR)', 'Доставено', 'Плащане', 'Бележка']);

  const dayKeys = getMonthDayKeys(allDays, year, month);

  for (const dateKey of dayKeys) {
    const deliveries = normalizeDeliveries(allDays[dateKey]?.deliveries);
    for (const d of deliveries) {
      rows.push([
        formatShortDate(dateKey),
        d.clientName || '',
        d.region || '',
        formatExportAmount(d.amount ?? 0),
        d.delivered ? 'Да' : 'Не',
        d.isCash ? 'Брой' : 'Банка',
        d.note || ''
      ]);
    }
  }

  const monthNum = String(month + 1).padStart(2, '0');
  const filename = `rozhen1-${year}-${monthNum}.csv`;
  downloadTextFile(filename, rowsToCsv(rows));
}
