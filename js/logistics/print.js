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
    line-height: 1.12;
    color: #000;
    background: #fff;
    box-sizing: border-box;
  }
  .logistics-print-host .sheet,
  .print-container .sheet {
    width: 100% !important;
    max-width: 100% !important;
    margin: 0 auto !important;
    padding: 0 !important;
    box-sizing: border-box;
    page-break-inside: avoid;
    page-break-after: avoid;
    transform: scale(1);
    transform-origin: top left;
  }
  .logistics-print-host .title-box {
    text-align: center; font-weight: bold; font-size: 10pt;
    border: 1px solid #000; padding: 0.8mm 2mm; margin-bottom: 1mm;
  }
  .logistics-print-host .field {
    display: inline-block; min-width: 14mm; border: 1px solid #000;
    background: #fff; padding: 0.1mm 1.2mm; font-weight: 600; vertical-align: baseline;
  }
  .logistics-print-host .field.wide { min-width: 46mm; }
  .logistics-print-host .field.km { min-width: 16mm; text-align: center; }
  .logistics-print-host .field.num { min-width: 12mm; text-align: right; }
  .logistics-print-host .top-row { margin-bottom: 0.5mm; }
  .logistics-print-host .line { margin: 0.35mm 0; }
  .logistics-print-host .legal { font-size: 7.5pt; margin: 0.6mm 0 1mm; line-height: 1.12; }
  .logistics-print-host ol.main { margin: 0 0 0.6mm 4mm; padding: 0 0 0 4mm; }
  .logistics-print-host ol.main li { margin-bottom: 0.35mm; }
  .logistics-print-host .para3 { margin: 0.5mm 0 1mm; font-size: 8pt; line-height: 1.12; }
  .logistics-print-host table.summary {
    width: 74%; margin-left: auto; margin-bottom: 1mm;
    border-collapse: collapse; font-size: 7.5pt;
  }
  .logistics-print-host table.summary td {
    border: 1px solid #000; padding: 0.25mm 1mm; background: #fff;
  }
  .logistics-print-host table.summary td.label { text-align: left; font-weight: bold; width: 70%; }
  .logistics-print-host table.summary td.val { text-align: right; font-weight: 600; width: 30%; }
  .logistics-print-host .table-title {
    text-align: center; font-weight: bold; margin: 1mm 0 0.8mm; font-size: 8.5pt;
  }
  .logistics-print-host table.fuel,
  .logistics-print-host table.vendor-totals {
    width: 100%; border-collapse: collapse; font-size: 8pt;
  }
  .logistics-print-host table.fuel { margin-bottom: 0.6mm; }
  .logistics-print-host table.fuel th,
  .logistics-print-host table.fuel td,
  .logistics-print-host table.vendor-totals th,
  .logistics-print-host table.vendor-totals td {
    border: 1px solid #000; padding: 0.2mm 0.8mm; background: #fff; line-height: 1.05;
  }
  .logistics-print-host table.fuel th,
  .logistics-print-host table.vendor-totals th { font-weight: bold; text-align: center; }
  .logistics-print-host table.fuel td.r,
  .logistics-print-host table.vendor-totals td.r { text-align: right; }
  .logistics-print-host table.fuel td.c { text-align: center; }
  .logistics-print-host table.vendor-totals {
    width: 42%; margin-left: auto; margin-bottom: 1mm;
  }
  .logistics-print-host .signatures {
    width: 56%; margin-left: auto; font-size: 8pt; border-collapse: collapse;
  }
  .logistics-print-host .signatures td { padding: 0.4mm 0; vertical-align: bottom; }
  .logistics-print-host .sig-dots { letter-spacing: 0.1em; }
  @media print {
    @page {
      size: A4 portrait;
      margin: 0mm;
    }
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
      height: 0 !important;
      min-height: 0 !important;
      overflow: hidden !important;
      background: transparent !important;
    }
    .logistics-print-host,
    .print-container {
      font-size: 9.75pt;
      line-height: 1.14;
    }
    .logistics-print-host .title-box { font-size: 11pt; padding: 0.9mm 2.2mm; }
    .logistics-print-host .legal { font-size: 8.25pt; }
    .logistics-print-host .para3 { font-size: 8.75pt; }
    .logistics-print-host table.summary { font-size: 8.25pt; }
    .logistics-print-host table.summary td { padding: 0.3mm 1.1mm; }
    .logistics-print-host table.fuel,
    .logistics-print-host table.vendor-totals { font-size: 8.75pt; }
    .logistics-print-host table.fuel th,
    .logistics-print-host table.fuel td,
    .logistics-print-host table.vendor-totals th,
    .logistics-print-host table.vendor-totals td {
      padding: 0.25mm 0.9mm;
    }
    .logistics-print-host .signatures { font-size: 8.75pt; }
    .print-container > style {
      display: none !important;
      height: 0 !important;
    }
    .print-container {
      display: flex !important;
      flex-direction: column !important;
      justify-content: space-between !important;
      visibility: visible !important;
      position: absolute;
      left: 0;
      top: 0;
      width: 100% !important;
      max-width: 100% !important;
      min-height: 100vh !important;
      background: #fff !important;
      margin: 0 !important;
      padding: 8mm 10mm !important;
      box-sizing: border-box !important;
      overflow: visible !important;
      transform: none !important;
    }
    .print-container .sheet {
      flex: 1 1 auto;
      display: flex !important;
      flex-direction: column !important;
      justify-content: space-between !important;
      width: 100% !important;
      max-width: 100% !important;
      min-height: 100% !important;
      margin: 0 auto !important;
      padding: 2mm 5mm !important;
      box-sizing: border-box !important;
      transform: none !important;
      row-gap: 1.2mm;
    }
    .logistics-print-host .title-box { margin-bottom: 2mm !important; }
    .logistics-print-host .legal { margin-top: 1mm !important; margin-bottom: 2mm !important; }
    .logistics-print-host ol.main { margin-bottom: 2mm !important; }
    .logistics-print-host .para3 { margin-bottom: 2.5mm !important; }
    .logistics-print-host table.summary { margin-top: 1.5mm !important; margin-bottom: 3mm !important; }
    .logistics-print-host .table-title { margin-top: 2mm !important; margin-bottom: 2mm !important; }
    .logistics-print-host table.fuel { margin-bottom: 2.5mm !important; }
    .logistics-print-host table.vendor-totals { margin-bottom: 3mm !important; }
    .logistics-print-host .signatures { margin-top: 2mm !important; }
    .print-container,
    .print-container * {
      visibility: visible !important;
    }
    button, .btn, nav, header, .no-print, footer {
      display: none !important;
      visibility: hidden !important;
      height: 0 !important;
    }
  }`;
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

  const dataRows = receipts
    .map(
      r => `<tr>
        <td>${escapeHtml(r.vendor)}</td>
        <td class="c">${formatDateDm(r.date)}</td>
        <td class="r">${fmtDec(r.liters, 3)}</td>
        <td class="r">${fmtDec(r.unitPrice, 2)}</td>
        <td class="r">${fmtDec(r.total, 2)}</td>
      </tr>`
    )
    .join('');

  const fuelBody = dataRows || '<tr><td colspan="5">&nbsp;</td></tr>';

  return `<div class="sheet">
  <div class="title-box">ОТЧЕТ - ПРОТОКОЛ</div>
  <div class="top-row">
    <span>No :</span> <span class="field">${escapeHtml(reportNo)}</span>
    &nbsp;&nbsp;
    <span>Дата:</span> <span class="field">${escapeHtml(reportDate)}</span>
  </div>
  <p class="line">За разходвано гориво на автомобил рег. №: <span class="field wide">${escapeHtml(report.plate)}</span></p>
  <p class="line">регион <span class="field wide">${escapeHtml(report.region)}</span></p>
  <p class="line">от (име) <span class="field wide">${escapeHtml(report.driverName)}</span></p>
  <p class="line">
    за периода от : <span class="field">${formatDateDm(report.periodFrom)}</span>
    до <span class="field">${formatDateDm(report.periodTo)}</span> г.
  </p>
  <p class="legal">
    На основание заповед №: <span class="field" style="min-width:7mm">${escapeHtml(orderNo)}</span>
    на Директора на &bdquo;РОЖЕН-1&ldquo; ЕООД се отчитат разходи за горивото на служебен автомобил.
  </p>
  <ol class="main">
    <li>На дата <span class="field">${formatDateDm(report.periodFrom)}</span>
      километражът показва <span class="field km">${fmtKm(report.odometerStart)}</span> км.</li>
    <li>Към дата <span class="field">${formatDateDm(report.periodTo)}</span>
      километражът показва <span class="field km">${fmtKm(report.odometerEnd)}</span> км.</li>
  </ol>
  <p class="para3">
    3. За периода от: <span class="field">${formatDateDm(report.periodFrom)}</span>
    до <span class="field">${formatDateDm(report.periodTo)}</span>
    са изминати <span class="field km">${fmtKm(totalKm)}</span> км за служебни цели и е разходвано гориво
    <span class="field num">${fmtDec(totalLiters, 3)}</span> лт. при норматив
    <span class="field num">${fmtDec(avg, 2)}</span> лт. / 100 км пробег, по цени както следва:
  </p>
  <table class="summary">
    <tr><td class="label">ОБЩО ИЗМИНАТИ КИЛОМЕТРИ</td><td class="val">${fmtKm(totalKm)}</td></tr>
    <tr><td class="label">ОБЩО РАЗХОДВАНО ГОРИВО</td><td class="val">${fmtDec(totalLiters, 3)}</td></tr>
    <tr><td class="label">ОБЩА СТОЙНОСТ НА ГОРИВОТО</td><td class="val">${fmtDec(totalAmount, 2)}</td></tr>
    <tr><td class="label">ЗА СМЕТКА НА СЛУЖИТЕЛЯ</td><td class="val">${escapeHtml(report.employeePaid ?? '')}</td></tr>
    <tr><td class="label">СУМА ЗА ОТЧИТАНЕ</td><td class="val">${escapeHtml(report.amountToReport ?? '')}</td></tr>
    <tr><td class="label">НАЛИЧНОСТ</td><td class="val">${escapeHtml(report.cashOnHand ?? '')}</td></tr>
  </table>
  <div class="table-title">Подробен опис на заредено гориво (по фактури)</div>
  <table class="fuel">
    <thead>
      <tr>
        <th style="width:28%">Petrol Station</th>
        <th style="width:14%">Дата</th>
        <th style="width:18%">Количество (лт)</th>
        <th style="width:18%">Ед. цена</th>
        <th style="width:22%">Сума</th>
      </tr>
    </thead>
    <tbody>${fuelBody}</tbody>
  </table>
  <table class="vendor-totals">
    <tr><th></th><th>литри</th><th>сума</th></tr>
    <tr>
      <td>Total Shell</td>
      <td class="r">${shellLiters ? fmtDec(shellLiters, 3) : ''}</td>
      <td class="r">${shellSum ? fmtDec(shellSum, 2) : ''}</td>
    </tr>
    <tr>
      <td>Total OMV</td>
      <td class="r">${omv.liters ? fmtDec(omv.liters, 3) : ''}</td>
      <td class="r">${omv.sum ? fmtDec(omv.sum, 2) : ''}</td>
    </tr>
  </table>
  <table class="signatures">
    <tr><td>Отчел:</td><td><span class="sig-dots">................................</span> /подпис/</td></tr>
    <tr><td>Одобрил:</td><td><span class="sig-dots">................................</span> /подпис/</td></tr>
    <tr><td>Директор:</td><td><span class="sig-dots">................................</span> /подпис/</td></tr>
  </table>
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
