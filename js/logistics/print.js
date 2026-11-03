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

/** @param {import('./storage.js').LogisticsReport} report */
export function buildPrintDocumentHtml(report) {
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

  const emptyRows = Array.from({ length: Math.max(0, 8 - receipts.length) })
    .map(() => '<tr><td>&nbsp;</td><td></td><td></td><td></td><td></td></tr>')
    .join('');

  return `<!DOCTYPE html>
<html lang="bg">
<head>
<meta charset="utf-8">
<title>ОТЧЕТ-ПРОТОКОЛ ${escapeHtml(report.plate)}</title>
<style>
  @page { size: A4 portrait; margin: 10mm 12mm; }
  * { box-sizing: border-box; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 10.5pt;
    color: #000;
    margin: 0;
    line-height: 1.35;
  }
  .sheet { max-width: 186mm; margin: 0 auto; }
  .title-box {
    text-align: center;
    font-weight: bold;
    font-size: 13pt;
    border: 1px solid #000;
    padding: 3mm 2mm;
    margin-bottom: 4mm;
    letter-spacing: 0.02em;
  }
  .shade {
    display: inline-block;
    min-width: 18mm;
    background: #d9d9d9;
    padding: 0.5mm 2mm;
    border: 1px solid #999;
    vertical-align: baseline;
  }
  .shade.wide { min-width: 55mm; }
  .shade.km { min-width: 22mm; text-align: center; }
  .shade.num { min-width: 16mm; text-align: right; }
  .top-row { margin-bottom: 2mm; }
  .line { margin: 1.5mm 0; }
  .legal { font-size: 10pt; margin: 3mm 0 4mm; }
  ol.main { margin: 0 0 3mm 5mm; padding: 0 0 0 5mm; }
  ol.main li { margin-bottom: 2mm; }
  .para3 { margin: 2mm 0 4mm 0; font-size: 10.5pt; }
  .summary {
    width: 72%;
    margin-left: auto;
    margin-bottom: 4mm;
    border-collapse: collapse;
    font-size: 10pt;
  }
  .summary td {
    border: 1px solid #000;
    padding: 1.5mm 2mm;
    vertical-align: middle;
  }
  .summary td.label {
    font-weight: bold;
    width: 68%;
  }
  .summary td.val {
    width: 32%;
    background: #d9d9d9;
    text-align: right;
    font-weight: bold;
  }
  .table-title {
    text-align: center;
    font-weight: bold;
    margin: 3mm 0 2mm;
    font-size: 10.5pt;
  }
  table.fuel {
    width: 100%;
    border-collapse: collapse;
    font-size: 10pt;
    margin-bottom: 3mm;
  }
  table.fuel th, table.fuel td {
    border: 1px solid #000;
    padding: 1.2mm 2mm;
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
    font-size: 10pt;
    margin-bottom: 8mm;
  }
  table.vendor-totals td, table.vendor-totals th {
    border: 1px solid #000;
    padding: 1.2mm 2mm;
  }
  table.vendor-totals th { font-weight: bold; text-align: center; }
  table.vendor-totals td.r { text-align: right; background: #d9d9d9; font-weight: bold; }
  .signatures {
    width: 55%;
    margin-left: auto;
    font-size: 10pt;
    border-collapse: collapse;
  }
  .signatures td { padding: 2mm 0; vertical-align: bottom; }
  .sig-name { border-bottom: 1px dotted #000; min-height: 6mm; display: inline-block; min-width: 45mm; }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>
<div class="sheet">
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
    <tbody>
      ${dataRows}${emptyRows}
    </tbody>
  </table>

  <table class="vendor-totals">
    <tr>
      <th></th>
      <th>литри</th>
      <th>сума</th>
    </tr>
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
    <tr>
      <td>Отчел:</td>
      <td><span class="sig-name">${escapeHtml(report.driverName)}</span> / подпис /</td>
    </tr>
    <tr>
      <td>Одобрил:</td>
      <td><span class="sig-name"></span> / подпис /</td>
    </tr>
    <tr>
      <td>Директор:</td>
      <td><span class="sig-name"></span> / подпис /</td>
    </tr>
  </table>
</div>
<script>window.onload=function(){window.focus();window.print();};</script>
</body>
</html>`;
}

/** @param {string} s */
function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** @param {import('./storage.js').LogisticsReport} report */
export function openPrintPreview(report) {
  const html = buildPrintDocumentHtml(report);
  const win = window.open('', '_blank');
  if (!win) {
    throw new Error('Блокиран pop-up. Разрешете прозорци за печат.');
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
}
