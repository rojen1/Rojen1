import { calcMonthSummary, formatShortDate, getMonthDayKeys } from './calculations.js';
import { normalizeDeliveries } from './storage.js';

/** @param {number} amount */
function exportNumber(amount) {
  if (amount == null || !Number.isFinite(Number(amount))) return '';
  return Math.round(Number(amount) * 100) / 100;
}

/**
 * @param {Record<string, import('./storage.js').DayRecord>} allDays
 * @param {number} year
 * @param {number} month
 * @param {import('./storage.js').Settings} settings
 * @param {string} monthLabel
 * @returns {(string | number)[][]}
 */
function buildMonthExportRows(allDays, year, month, settings, monthLabel) {
  const summary = calcMonthSummary(allDays, year, month, settings);

  /** @type {(string | number)[][]} */
  const rows = [
    [`Месечен отчет - ${monthLabel}`],
    [],
    ['Дата', 'Оборот (EUR)', 'Бонус чист (EUR)', 'Брутна част (EUR)', 'Нето (EUR)']
  ];

  for (const row of summary.rows) {
    rows.push([
      formatShortDate(row.dateKey),
      row.isPlanned ? exportNumber(row.plannedTurnover) : exportNumber(row.turnover),
      row.isPlanned ? '' : exportNumber(row.bonus),
      row.isPlanned ? '' : exportNumber(row.allowance),
      row.isPlanned ? '' : exportNumber(row.total)
    ]);
  }

  rows.push([]);
  rows.push([
    'ОБЩО',
    exportNumber(summary.totalTurnover),
    exportNumber(summary.totalBonus),
    exportNumber(summary.totalAllowance),
    exportNumber(summary.finalPayout)
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
        exportNumber(d.amount ?? 0),
        d.delivered ? 'Да' : 'Не',
        d.isCash ? 'Брой' : 'Банка',
        d.note || ''
      ]);
    }
  }

  return rows;
}

/** @param {string} filename @param {Blob} blob */
async function deliverDownload(filename, blob) {
  const file = new File([blob], filename, { type: blob.type });

  if (typeof navigator.canShare === 'function' && typeof navigator.share === 'function') {
    try {
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: filename });
        return;
      }
    } catch (err) {
      if (err?.name === 'AbortError') return;
    }
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 120_000);
}

let xlsxModulePromise = null;

function loadXlsx() {
  if (!xlsxModulePromise) {
    xlsxModulePromise = import('./vendor/xlsx.mjs');
  }
  return xlsxModulePromise;
}

/**
 * @param {Record<string, import('./storage.js').DayRecord>} allDays
 * @param {number} year
 * @param {number} month
 * @param {import('./storage.js').Settings} settings
 * @param {string} monthLabel
 */
export async function exportMonthCsv(allDays, year, month, settings, monthLabel) {
  const XLSX = await loadXlsx();
  const rows = buildMonthExportRows(allDays, year, month, settings, monthLabel);
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Mesec');

  const monthNum = String(month + 1).padStart(2, '0');
  const filename = `rozhen1-${year}-${monthNum}.xlsx`;

  const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
  await deliverDownload(filename, blob);
}
