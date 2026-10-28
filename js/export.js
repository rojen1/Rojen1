import { calcMonthSummary, formatShortDate, getMonthDayKeys } from './calculations.js';
import { normalizeDeliveries } from './storage.js';

/** @param {string} s */
function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** @param {number} amount */
function formatExportAmount(amount) {
  if (amount == null || !Number.isFinite(Number(amount))) return '';
  return Number(amount).toFixed(2).replace('.', ',');
}

/**
 * @param {Record<string, import('./storage.js').DayRecord>} allDays
 * @param {number} year
 * @param {number} month
 * @param {import('./storage.js').Settings} settings
 * @param {string} monthLabel
 * @returns {string[][]}
 */
function buildMonthExportRows(allDays, year, month, settings, monthLabel) {
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

  return rows;
}

/** HTML table as .xls — отваря се в Excel на телефон без „corrupted file“ */
/** @param {string[][]} rows */
function rowsToExcelHtml(rows) {
  const tableRows = rows.map(row => {
    if (!row.length) {
      return '<tr><td colspan="7">&nbsp;</td></tr>';
    }
    return (
      '<tr>' +
      row.map(cell => `<td>${escapeHtml(cell)}</td>`).join('') +
      '</tr>'
    );
  }).join('');

  return (
    '\uFEFF' +
    '<html xmlns:o="urn:schemas-microsoft-com:office:office" ' +
    'xmlns:x="urn:schemas-microsoft-com:office:excel">' +
    '<head><meta charset="utf-8">' +
    '<meta http-equiv="Content-Type" content="text/html; charset=utf-8">' +
    '</head><body><table border="1" cellspacing="0" cellpadding="4">' +
    tableRows +
    '</table></body></html>'
  );
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

/**
 * @param {Record<string, import('./storage.js').DayRecord>} allDays
 * @param {number} year
 * @param {number} month
 * @param {import('./storage.js').Settings} settings
 * @param {string} monthLabel
 */
export async function exportMonthCsv(allDays, year, month, settings, monthLabel) {
  const rows = buildMonthExportRows(allDays, year, month, settings, monthLabel);
  const monthNum = String(month + 1).padStart(2, '0');
  const filename = `rozhen1-${year}-${monthNum}.xls`;
  const html = rowsToExcelHtml(rows);
  const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8' });
  await deliverDownload(filename, blob);
}
