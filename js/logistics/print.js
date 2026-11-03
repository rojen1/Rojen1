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

/** Минимум редове в таблицата гориво (като хартия, запълва A4). */
const MIN_FUEL_ROWS = 12;

function getPrintStyles() {
  return `
  @page { size: A4 portrait; margin: 8mm; }
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    background: #fff;
  }
  .logistics-print-host {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 9.5pt;
    color: #000;
    line-height: 1.16;
  }
  .sheet {
    width: 100%;
    max-width: 100%;
    margin: 0 auto;
    page-break-inside: avoid;
    page-break-after: avoid;
  }
  .title-box {
    text-align: center;
    font-weight: bold;
    font-size: 11pt;
    border: 1px solid #000;
    padding: 1.5mm 2mm;
    margin-bottom: 2mm;
    letter-spacing: 0.02em;
  }
  .shade {
    display: inline-block;
    min-width: 16mm;
    background: #d9d9d9;
    padding: 0.2mm 1.5mm;
    border: 1px solid #999;
    vertical-align: baseline;
  }
  .shade.wide { min-width: 48mm; }
  .shade.km { min-width: 18mm; text-align: center; }
  .shade.num { min-width: 14mm; text-align: right; }
  .top-row { margin-bottom: 1mm; }
  .line { margin: 0.8mm 0; }
  .legal { font-size: 8.5pt; margin: 1.5mm 0 2mm; line-height: 1.2; }
  ol.main { margin: 0 0 1.5mm 4mm; padding: 0 0 0 4mm; }
  ol.main li { margin-bottom: 0.8mm; }
  .para3 { margin: 1mm 0 2mm; font-size: 9pt; line-height: 1.2; }
  .summary {
    width: 74%;
    margin-left: auto;
    margin-bottom: 2mm;
    border-collapse: collapse;
    font-size: 8.5pt;
  }
  .summary td {
    border: 1px solid #000;
    padding: 0.6mm 1.5mm;
    vertical-align: middle;
  }
  .summary td.label { font-weight: bold; width: 68%; }
  .summary td.val {
    width: 32%;
    background: #d9d9d9;
    text-align: right;
    font-weight: bold;
  }
  .table-title {
    text-align: center;
    font-weight: bold;
    margin: 1.5mm 0 1mm;
    font-size: 9pt;
  }
  table.fuel {
    width: 100%;
    border-collapse: collapse;
    font-size: 8.5pt;
    margin-bottom: 1.5mm;
  }
  table.fuel th, table.fuel td {
    border: 1px solid #000;
    padding: 0.45mm 1.2mm;
    line-height: 1.1;
  }
  table.fuel tr.fuel-empty td {
    height: 5mm;
    padding: 0.2mm 1.2mm;
  }
  table.fuel th {
    font-weight: bold;
    text-align: center;
    background: #fff;
  }
  table.fuel td.r { text-align: right; }
  table.fuel td.c { text-align: center; }
  table.vendor-totals {
    width: 45%;
    margin-left: auto;
    border-collapse: collapse;
    font-size: 8.5pt;
    margin-bottom: 3mm;
  }
  table.vendor-totals td, table.vendor-totals th {
    border: 1px solid #000;
    padding: 0.5mm 1.5mm;
  }
  table.vendor-totals th { font-weight: bold; text-align: center; }
  table.vendor-totals td.r { text-align: right; background: #d9d9d9; font-weight: bold; }
  .signatures {
    width: 58%;
    margin-left: auto;
    font-size: 9pt;
    border-collapse: collapse;
  }
  .signatures td { padding: 1mm 0; vertical-align: bottom; }
  .sig-dots { letter-spacing: 0.12em; white-space: nowrap; }
  @media print {
    body {
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
  }`;
}

/** @param {import('./storage.js').LogisticsReport['receipts']} receipts */
function buildFuelRows(receipts) {
  const list = receipts || [];
  const rowCount = Math.max(MIN_FUEL_ROWS, list.length);
  const rows = [];
  for (let i = 0; i < rowCount; i++) {
    const r = list[i];
    if (r) {
      rows.push(`<tr>
        <td>${escapeHtml(r.vendor)}</td>
        <td class="c">${formatDateDm(r.date)}</td>
        <td class="r">${fmtDec(r.liters, 3)}</td>
        <td class="r">${fmtDec(r.unitPrice, 2)}</td>
        <td class="r">${fmtDec(r.total, 2)}</td>
      </tr>`);
    } else {
      rows.push(
        '<tr class="fuel-empty"><td>&nbsp;</td><td></td><td></td><td></td><td></td></tr>'
      );
    }
  }
  return rows.join('');
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

  return `<div class="sheet">
  <div class="title-box">ОТЧЕТ - ПРОТОКОЛ</div>
  <div class="top-row">
    <span>No :</span> <span class="shade">${escapeHtml(reportNo)}</span>
    &nbsp;&nbsp;&nbsp;
    <span>Дата:</span> <span class="shade">${escapeHtml(reportDate)}</span>
  </div>
  <p class="line">За разходвано гориво на автомобил рег. №: <span class="shade wide">${escapeHtml(report.plate)}</span></p>
  <p class="line">регион <span class="shade wide">${escapeHtml(report.region)}</span></p>
  <p class="line">от (име) <span class="shade wide">${escapeHtml(report.driverName)}</span></p>
  <p class="line">
    за периода от : <span class="shade">${formatDateDm(report.periodFrom)}</span>
    до <span class="shade">${formatDateDm(report.periodTo)}</span> г.
  </p>
  <p class="legal">
    На основание заповед №: <span class="shade" style="min-width:8mm">${escapeHtml(orderNo)}</span>
    на Директора на &bdquo;РОЖЕН-1&ldquo; ЕООД се отчитат разходи за горивото на служебен автомобил.
  </p>
  <ol class="main">
    <li>На дата <span class="shade">${formatDateDm(report.periodFrom)}</span>
      километражът показва <span class="shade km">${fmtKm(report.odometerStart)}</span> км.</li>
    <li>Към дата <span class="shade">${formatDateDm(report.periodTo)}</span>
      километражът показва <span class="shade km">${fmtKm(report.odometerEnd)}</span> км.</li>
  </ol>
  <p class="para3">
    3. За периода от: <span class="shade">${formatDateDm(report.periodFrom)}</span>
    до <span class="shade">${formatDateDm(report.periodTo)}</span>
    са изминати <span class="shade km">${fmtKm(totalKm)}</span> км за служебни цели и е разходвано гориво
    <span class="shade num">${fmtDec(totalLiters, 3)}</span> лт. при норматив
    <span class="shade num">${fmtDec(avg, 2)}</span> лт. / 100 км пробег, по цени както следва:
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
    <tbody>${buildFuelRows(receipts)}</tbody>
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

/** @param {import('./storage.js').LogisticsReport} report */
export function buildPrintDocumentHtml(report) {
  return `<!DOCTYPE html>
<html lang="bg">
<head>
<meta charset="utf-8">
<title>ОТЧЕТ-ПРОТОКОЛ ${escapeHtml(report.plate)}</title>
<style>${getPrintStyles()}</style>
</head>
<body class="logistics-print-host">${buildPrintSheetHtml(report)}</body>
</html>`;
}

const PRINT_SKIP_ATTR = 'data-logistics-print-skip';

function hideNonPrintBodyChildren() {
  for (const child of document.body.children) {
    if (child.id === 'logistics-print-host') continue;
    if (child.tagName === 'SCRIPT') continue;
    child.setAttribute(PRINT_SKIP_ATTR, '1');
    child.style.setProperty('display', 'none', 'important');
  }
}

function restoreNonPrintBodyChildren() {
  for (const el of document.querySelectorAll(`[${PRINT_SKIP_ATTR}="1"]`)) {
    el.removeAttribute(PRINT_SKIP_ATTR);
    el.style.removeProperty('display');
  }
}

function teardownPrintHost() {
  document.body.classList.remove('logistics-print-active');
  document.documentElement.classList.remove('logistics-print-active');
  restoreNonPrintBodyChildren();
  const host = document.getElementById('logistics-print-host');
  if (host) {
    host.hidden = true;
    host.setAttribute('aria-hidden', 'true');
    host.innerHTML = '';
  }
}

function mountPrintHost(report) {
  const host = document.getElementById('logistics-print-host');
  if (!host) throw new Error('Липсва елемент за печат.');
  host.className = 'logistics-print-host print-container';
  host.innerHTML = `<style>${getPrintStyles()}</style>${buildPrintSheetHtml(report)}`;
  host.hidden = false;
  host.removeAttribute('aria-hidden');
}

/** In-page печат — същият шаблон като v1.69, без pop-up. */
/** @param {import('./storage.js').LogisticsReport} report */
export function printReport(report) {
  mountPrintHost(report);
  document.documentElement.classList.add('logistics-print-active');
  document.body.classList.add('logistics-print-active');
  hideNonPrintBodyChildren();

  const cleanup = () => {
    teardownPrintHost();
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);

  window.print();

  setTimeout(() => {
    if (document.body.classList.contains('logistics-print-active')) {
      cleanup();
    }
  }, 1500);
}

/** @param {import('./storage.js').LogisticsReport} report */
export function openPrintPreview(report) {
  printReport(report);
}

/** @param {string} s */
function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
