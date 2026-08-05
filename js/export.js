import { calcMonthSummary, formatShortDate, getMonthDayKeys } from './calculations.js';
import { normalizeDeliveries } from './storage.js';

/** @param {string} value */
function csvCell(value) {
  const text = String(value ?? '');
  if (/[",;\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

/** @param {string[][]} rows */
function rowsToCsv(rows) {
  return '\uFEFF' + rows.map(row => row.map(csvCell).join(';')).join('\n');
}

/** @param {string} filename @param {string} content */
export function downloadTextFile(filename, content) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
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
    ['Дата', 'Оборот (EUR)', 'Бонус (EUR)', 'Надник (EUR)', 'Общо (EUR)']
  ];

  for (const row of summary.rows) {
    rows.push([
      formatShortDate(row.dateKey),
      row.isPlanned ? String(row.plannedTurnover) : String(row.turnover),
      row.isPlanned ? '' : String(row.bonus),
      row.isPlanned ? '' : String(row.allowance),
      row.isPlanned ? `${row.stopCount} сп.` : String(row.total)
    ]);
  }

  rows.push([]);
  rows.push([
    'ОБЩО',
    String(summary.totalTurnover),
    String(summary.totalBonus),
    String(summary.totalAllowance),
    String(summary.totalDaily)
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
        String(d.amount ?? 0),
        d.delivered ? 'Да' : 'Не',
        d.isCash ? 'Брой' : 'Банка',
        d.note || ''
      ]);
    }
  }

  const safeLabel = monthLabel.replace(/\s+/g, '-').toLowerCase();
  downloadTextFile(`rojen1-${safeLabel}.csv`, rowsToCsv(rows));
}
