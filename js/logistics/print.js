import {
  calcAvgConsumptionPer100,
  calcTotalKm,
  sumReceiptAmount,
  sumReceiptLiters
} from './calculations.js';

/** dd.mm от YYYY-MM-DD */
function formatDateDm(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  if (!d || !m) return iso;
  return `${d}.${m}`;
}

function formatDateBgFull(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}.${m}.${y}`;
}

/** @param {number} n */
function fmtKm(n) {
  if (!Number.isFinite(n)) return '';
  const v = Math.round(n);
  return String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/** @param {number} n @param {number} dec */
function fmtDec(n, dec = 2) {
  if (!Number.isFinite(n)) return '';
  return n.toLocaleString('bg-BG', {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec
  });
}

/** @param {import('./storage.js').LogisticsReport} report */
function vendorTotals(receipts, match) {
  const re = new RegExp(match, 'i');
  let liters = 0;
  let sum = 0;
  for (const r of receipts) {
    if (!re.test(r.vendor || '')) continue;
    liters += Number(r.liters) || 0;
    sum += Number(r.total) || 0;
  }
  return { liters, sum };
}

/** A4; @page margin 0 — вътрешни полета само на .print-container. */
const PRINT_PAGE_MM = { w: 210, h: 297, margin: 0 };

/** Редове в таблицата „гориво“ като на хартиената бланка. */
const FUEL_FORM_ROWS = 15;

const PRINT_FIELD_GRAY = '#c8c8c8';

/** @param {string} label @param {string} value */
function summaryRowHtml(label, value) {
  const v = value?.trim() ? escapeHtml(value) : '&nbsp;';
  return `<div class="summary-row">
    <span class="summary-label">${label}</span>
    <span class="summary-val">${v}</span>
  </div>`;
}

function getPrintStyles() {
  return `
  @page {
    size: A4 portrait;
    margin: ${PRINT_PAGE_MM.margin}mm;
  }
  html, body {
    margin: 0;
    padding: 0;
    background: #fff;
    box-sizing: border-box;
  }
  *, *::before, *::after { box-sizing: border-box; }
  .logistics-print-host,
  .print-container {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 9pt;
    line-height: 1.15;
    color: #000;
    background: #fff;
  }
  .logistics-print-host .sheet {
    width: 100%;
    max-width: 100%;
    margin: 0 auto;
    page-break-inside: avoid;
    page-break-after: avoid;
  }
  .logistics-print-host .title-box {
    text-align: center;
    font-weight: bold;
    font-size: 10.5pt;
    border: 1px solid #000;
    padding: 1mm 2mm;
    margin: 0 0 1.2mm;
  }
  .logistics-print-host .top-row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 1mm;
  }
  .logistics-print-host .field {
    display: inline-block;
    min-width: 12mm;
    min-height: 4.2mm;
    border: 1px solid #000;
    background: ${PRINT_FIELD_GRAY};
    padding: 0.15mm 1mm;
    font-weight: 600;
    vertical-align: -0.5mm;
    line-height: 1.2;
  }
  .logistics-print-host .field.field-no { min-width: 26mm; }
  .logistics-print-host .field.field-date { min-width: 32mm; }
  .logistics-print-host .field.plate { min-width: 24mm; }
  .logistics-print-host .field.region { min-width: 32mm; }
  .logistics-print-host .field.wide { min-width: 58mm; }
  .logistics-print-host .field.period { min-width: 18mm; }
  .logistics-print-host .field.km { min-width: 20mm; text-align: center; }
  .logistics-print-host .field.num { min-width: 16mm; text-align: right; }
  .logistics-print-host .field.order { min-width: 10mm; }
  .logistics-print-host .field.date-sm { min-width: 18mm; }
  .logistics-print-host .line.money-line { margin: 0.8mm 0 1.5mm; }
  .logistics-print-host .line { margin: 0.45mm 0; }
  .logistics-print-host .legal {
    font-size: 8pt;
    margin: 0.8mm 0 1.2mm;
    line-height: 1.18;
  }
  .logistics-print-host ol.main {
    margin: 0 0 1mm 5mm;
    padding: 0 0 0 4mm;
  }
  .logistics-print-host ol.main li { margin-bottom: 0.5mm; }
  .logistics-print-host .para3 {
    margin: 0.6mm 0 1.2mm;
    font-size: 8.5pt;
    line-height: 1.18;
  }
  .logistics-print-host .summary-block {
    width: 100%;
    margin: 1mm 0 2.5mm;
  }
  .logistics-print-host .summary-row {
    display: flex;
    align-items: stretch;
    justify-content: flex-end;
    margin-bottom: 0.55mm;
    min-height: 5mm;
  }
  .logistics-print-host .summary-label {
    flex: 1 1 auto;
    text-align: left;
    font-weight: bold;
    font-size: 8pt;
    padding: 0.6mm 2mm 0.4mm 0;
    background: transparent;
    border: none;
  }
  .logistics-print-host .summary-val {
    flex: 0 0 52mm;
    width: 52mm;
    min-height: 5mm;
    border: 1px solid #000;
    background: ${PRINT_FIELD_GRAY};
    text-align: right;
    padding: 0.45mm 1.5mm;
    font-weight: 600;
    font-size: 8pt;
  }
  .logistics-print-host .table-title {
    text-align: center;
    font-weight: bold;
    margin: 1.2mm 0 1mm;
    font-size: 8.5pt;
  }
  .logistics-print-host table.fuel,
  .logistics-print-host table.vendor-totals {
    width: 100%;
    border-collapse: collapse;
    font-size: 8pt;
  }
  .logistics-print-host table.fuel { margin-bottom: 0; }
  .logistics-print-host table.fuel th,
  .logistics-print-host table.fuel td,
  .logistics-print-host table.vendor-totals th,
  .logistics-print-host table.vendor-totals td {
    border: 1px solid #000;
    padding: 0.35mm 1mm;
    line-height: 1.1;
    background: #fff;
  }
  .logistics-print-host table.fuel th {
    font-weight: bold;
    text-align: center;
    background: #fff;
  }
  .logistics-print-host table.fuel tbody tr.fuel-row td {
    height: 6.2mm;
    vertical-align: middle;
  }
  .logistics-print-host table.fuel tr.fuel-band td {
    height: 6mm;
    background: ${PRINT_FIELD_GRAY};
    border: 1px solid #000;
    padding: 0;
  }
  .logistics-print-host table.fuel td.r,
  .logistics-print-host table.vendor-totals td.r { text-align: right; }
  .logistics-print-host table.fuel td.c { text-align: center; }
  .logistics-print-host table.vendor-totals {
    width: 48%;
    margin: 0.5mm 0 3mm auto;
  }
  .logistics-print-host table.vendor-totals th { font-weight: bold; text-align: center; }
  .logistics-print-host table.vendor-totals td.val-gray {
    background: ${PRINT_FIELD_GRAY};
    text-align: right;
  }
  .logistics-print-host .signatures {
    width: 62%;
    margin: 2mm 0 0 auto;
    font-size: 8.5pt;
    border-collapse: collapse;
  }
  .logistics-print-host .signatures td {
    padding: 1.2mm 0;
    vertical-align: bottom;
    white-space: nowrap;
  }
  .logistics-print-host .signatures td:first-child {
    width: 18mm;
    padding-right: 2mm;
  }
  .logistics-print-host .sig-dots { letter-spacing: 0.05em; }
  .logistics-print-host .sheet-bottom {
    width: 100%;
    margin-top: 1mm;
  }
  @media print {
    @page { size: A4 portrait; margin: 0mm; }
    html, body {
      width: 100% !important;
      height: 100% !important;
      margin: 0 !important;
      padding: 0 !important;
      background: #fff !important;
    }
    .print-container,
    .print-container * {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body > *:not(.print-container) {
      display: none !important;
      visibility: hidden !important;
    }
    .print-container > style { display: none !important; height: 0 !important; }
    .print-container {
      visibility: visible !important;
      position: absolute;
      left: 0;
      top: 0;
      width: 100% !important;
      max-width: 100% !important;
      min-height: 100vh !important;
      background: #fff !important;
      margin: 0 !important;
      padding: 11mm 13mm !important;
      box-sizing: border-box !important;
    }
    .print-container .sheet {
      display: block !important;
      width: 100% !important;
      margin: 0 auto !important;
      padding: 0 !important;
    }
    .print-container,
    .print-container * { visibility: visible !important; }
    button, .btn, nav, header, .no-print, footer {
      display: none !important;
    }
  }`;
}

/** @param {import('./storage.js').LogisticsReport['receipts']} receipts */
function buildFuelTableBody(receipts) {
  const list = receipts || [];
  const rowCount = Math.max(FUEL_FORM_ROWS, list.length);
  const rows = [];
  for (let i = 0; i < rowCount; i++) {
    const r = list[i];
    if (r) {
      rows.push(`<tr class="fuel-row">
        <td>${escapeHtml(r.vendor)}</td>
        <td class="c">${formatDateDm(r.date)}</td>
        <td class="r">${fmtDec(r.liters, 3)}</td>
        <td class="r">${fmtDec(r.unitPrice, 2)}</td>
        <td class="r">${fmtDec(r.total, 2)}</td>
      </tr>`);
    } else {
      rows.push(
        '<tr class="fuel-row fuel-row-empty"><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>'
      );
    }
  }
  rows.push('<tr class="fuel-band"><td colspan="5">&nbsp;</td></tr>');
  rows.push('<tr class="fuel-band"><td colspan="5">&nbsp;</td></tr>');
  return rows.join('');
}

const PRINT_SKIP_ATTR = 'data-logistics-print-skip';

function hideNonPrintBodyChildren() {
  for (const child of document.body.children) {
    if (child.classList?.contains('print-container')) continue;
    if (child.tagName === 'SCRIPT') continue;
    child.setAttribute(PRINT_SKIP_ATTR, '1');
    child.style.setProperty('display', 'none', 'important');
    child.style.setProperty('visibility', 'hidden', 'important');
  }
}

function restoreNonPrintBodyChildren() {
  for (const el of document.querySelectorAll(`[${PRINT_SKIP_ATTR}="1"]`)) {
    el.removeAttribute(PRINT_SKIP_ATTR);
    el.style.removeProperty('display');
    el.style.removeProperty('visibility');
  }
}

/** @param {import('./storage.js').LogisticsReport} report */
function buildPrintSheetHtml(report) {
  const totalKm = calcTotalKm(report.odometerStart, report.odometerEnd);
  const totalLiters = sumReceiptLiters(report.receipts);
  const totalAmount = sumReceiptAmount(report.receipts);
  const avg = calcAvgConsumptionPer100(totalLiters, totalKm);
  const receipts = report.receipts || [];

  const omv = vendorTotals(receipts, 'omv');
  const shellOnly = vendorTotals(receipts, 'shell');
  const shellLiters = shellOnly.liters > 0 ? shellOnly.liters : totalLiters;
  const shellSum = shellOnly.sum > 0 ? shellOnly.sum : totalAmount;

  const reportNo = report.reportNo || '';
  const reportDate = report.reportDate || formatDateBgFull(new Date().toISOString().slice(0, 10));
  const orderNo = report.orderNo || '1';

  const fuelBody = buildFuelTableBody(receipts);

  return `<div class="sheet">
  <div class="sheet-main">
  <div class="title-box">ОТЧЕТ - ПРОТОКОЛ</div>
  <div class="top-row">
    <span>No : <span class="field field-no">${escapeHtml(reportNo)}</span></span>
    <span>Дата: <span class="field field-date">${escapeHtml(reportDate)}</span></span>
  </div>
  <p class="line">За разходвано гориво на автомобил рег. №: <span class="field plate">${escapeHtml(report.plate)}</span>
    регион <span class="field region">${escapeHtml(report.region)}</span></p>
  <p class="line">от (име) <span class="field wide">${escapeHtml(report.driverName)}</span></p>
  <p class="line">
    за периода от : <span class="field period">${formatDateDm(report.periodFrom)}</span>
    до <span class="field period">${formatDateDm(report.periodTo)}</span> г.
  </p>
  <p class="legal">
    На основание заповед №: <span class="field order">${escapeHtml(orderNo)}</span>
    на Директора на &bdquo;РОЖЕН-1&ldquo; ЕООД се отчитат разходи за горивото на служебен автомобил.
  </p>
  <ol class="main">
    <li>На дата <span class="field date-sm">${formatDateDm(report.periodFrom)}</span>
      километражът показва <span class="field km">${fmtKm(report.odometerStart)}</span> км.</li>
    <li>Към дата <span class="field date-sm">${formatDateDm(report.periodTo)}</span>
      километражът показва <span class="field km">${fmtKm(report.odometerEnd)}</span> км.</li>
  </ol>
  <p class="para3">
    3. За периода от: <span class="field date-sm">${formatDateDm(report.periodFrom)}</span>
    до <span class="field date-sm">${formatDateDm(report.periodTo)}</span>
    са изминати <span class="field km">${fmtKm(totalKm)}</span> км за служебни цели и е разходвано гориво
    <span class="field num">${fmtDec(totalLiters, 3)}</span> лт. при норматив
    <span class="field num">${fmtDec(avg, 2)}</span> лт. / 100 км пробег, по цени както следва:
  </p>
  <p class="line money-line">
    <span class="field num">&nbsp;</span> лв. X <span class="field num">&nbsp;</span> лв. =
    <span class="field num">&nbsp;</span> лв.
  </p>
  <div class="summary-block">
    ${summaryRowHtml('ОБЩО ИЗМИНАТИ КИЛОМЕТРИ', fmtKm(totalKm))}
    ${summaryRowHtml('ОБЩО РАЗХОДВАНО ГОРИВО', fmtDec(totalLiters, 3))}
    ${summaryRowHtml('ОБЩА СТОЙНОСТ НА ГОРИВОТО', fmtDec(totalAmount, 2))}
    ${summaryRowHtml('ЗА СМЕТКА НА СЛУЖИТЕЛЯ', report.employeePaid ?? '')}
    ${summaryRowHtml('СУМА ЗА ОТЧИТАНЕ', report.amountToReport ?? '')}
    ${summaryRowHtml('НАЛИЧНОСТ', report.cashOnHand ?? '')}
  </div>
  <div class="table-title">Подробен опис на заредено гориво (по фактури)</div>
  <table class="fuel">
    <thead>
      <tr>
        <th style="width:30%">Petrol Station</th>
        <th style="width:12%">Дата</th>
        <th style="width:18%">Количество (лт)</th>
        <th style="width:18%">Ед.цена</th>
        <th style="width:22%">Сума</th>
      </tr>
    </thead>
    <tbody>${fuelBody}</tbody>
  </table>
  </div>
  <div class="sheet-bottom">
  <table class="vendor-totals">
    <tr><th></th><th>литри</th><th>сума</th></tr>
    <tr>
      <td>Total Shell</td>
      <td class="r val-gray">${shellLiters ? fmtDec(shellLiters, 3) : '&nbsp;'}</td>
      <td class="r val-gray">${shellSum ? fmtDec(shellSum, 2) : '&nbsp;'}</td>
    </tr>
    <tr>
      <td>Total OMV</td>
      <td class="r val-gray">${omv.liters ? fmtDec(omv.liters, 3) : '&nbsp;'}</td>
      <td class="r val-gray">${omv.sum ? fmtDec(omv.sum, 2) : '&nbsp;'}</td>
    </tr>
  </table>
  <table class="signatures">
    <tr><td>Отчел:</td><td><span class="sig-dots">................................</span> /подпис/</td></tr>
    <tr><td>Одобрил:</td><td><span class="sig-dots">................................</span> /подпис/</td></tr>
    <tr><td>Директор:</td><td><span class="sig-dots">................................</span> /подпис/</td></tr>
  </table>
  </div>
</div>`;
}

function mountPrintHost(report) {
  const host = document.getElementById('logistics-print-host');
  if (!host) throw new Error('Липсва елемент за печат.');
  host.innerHTML =
    `<style>${getPrintStyles()}</style>${buildPrintSheetHtml(report)}`;
  host.hidden = false;
}

function teardownPrintHost() {
  document.body.classList.remove('logistics-print-active');
  document.documentElement.classList.remove('logistics-print-active');
  restoreNonPrintBodyChildren();
  const host = document.getElementById('logistics-print-host');
  if (host) {
    host.hidden = true;
    host.innerHTML = '';
  }
  closePrintModal();
}

/** @param {import('./storage.js').LogisticsReport} report */
export function openPrintModal(report) {
  const modal = document.getElementById('logistics-print-modal');
  const body = document.getElementById('logistics-print-modal-body');
  if (!modal || !body) {
    printReport(report);
    return;
  }
  body.innerHTML =
    `<div class="logistics-print-host print-container"><style>${getPrintStyles()}</style>${buildPrintSheetHtml(report)}</div>`;
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('logistics-print-modal-open');
}

export function closePrintModal() {
  const modal = document.getElementById('logistics-print-modal');
  const body = document.getElementById('logistics-print-modal-body');
  if (modal) {
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
  }
  if (body) body.innerHTML = '';
  document.body.classList.remove('logistics-print-modal-open');
}

/** Печат в същата страница — без window.open (работи на мобилен). */
/** @param {import('./storage.js').LogisticsReport} report */
export function printReport(report) {
  closePrintModal();
  mountPrintHost(report);
  document.documentElement.classList.add('logistics-print-active');
  document.body.classList.add('logistics-print-active');
  hideNonPrintBodyChildren();

  const onAfterPrint = () => {
    teardownPrintHost();
    window.removeEventListener('afterprint', onAfterPrint);
  };
  window.addEventListener('afterprint', onAfterPrint);

  window.print();

  setTimeout(() => {
    if (document.body.classList.contains('logistics-print-active')) {
      onAfterPrint();
    }
  }, 1200);
}

/** @param {import('./storage.js').LogisticsReport} report */
export function openPrintPreview(report) {
  printReport(report);
}

/** @param {import('./storage.js').LogisticsReport} report */
export function buildPrintDocumentHtml(report) {
  return `<!DOCTYPE html><html lang="bg"><head><meta charset="utf-8"><title> </title><style>${getPrintStyles()}</style></head><body class="logistics-print-host">${buildPrintSheetHtml(report)}</body></html>`;
}

/** @param {string} s */
function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
