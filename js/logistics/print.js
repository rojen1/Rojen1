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

  const fuelBody = dataRows || '<tr><td colspan="5">&nbsp;</td></tr>';

  return `<!DOCTYPE html>
<html lang="bg">
<head>
<meta charset="utf-8">
<title> </title>
<style>
  @page {
    size: A4 portrait;
    margin: 10mm;
  }
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    color: #000;
    background: #fff;
  }
  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 8.5pt;
    line-height: 1.12;
  }
  .sheet {
    width: 100%;
    max-width: 190mm;
    margin: 0 auto;
  }
  .title-box {
    text-align: center;
    font-weight: bold;
    font-size: 10.5pt;
    border: 1px solid #000;
    padding: 1mm 2mm;
    margin-bottom: 1.5mm;
  }
  .field {
    display: inline-block;
    min-width: 14mm;
    border: 1px solid #000;
    background: #fff;
    padding: 0.1mm 1.2mm;
    font-weight: 600;
    vertical-align: baseline;
  }
  .field.wide { min-width: 46mm; }
  .field.km { min-width: 16mm; text-align: center; }
  .field.num { min-width: 12mm; text-align: right; }
  .top-row { margin-bottom: 0.8mm; }
  .line { margin: 0.5mm 0; }
  .legal { font-size: 8pt; margin: 1mm 0 1.5mm; line-height: 1.15; }
  ol.main { margin: 0 0 1mm 4mm; padding: 0 0 0 4mm; }
  ol.main li { margin-bottom: 0.5mm; }
  .para3 { margin: 0.8mm 0 1.5mm; font-size: 8.5pt; line-height: 1.15; }
  table.summary {
    width: 74%;
    margin-left: auto;
    margin-bottom: 1.5mm;
    border-collapse: collapse;
    font-size: 8pt;
  }
  table.summary td {
    border: 1px solid #000;
    padding: 0.4mm 1.2mm;
    background: #fff;
  }
  table.summary td.label {
    text-align: left;
    font-weight: bold;
    width: 70%;
  }
  table.summary td.val {
    text-align: right;
    font-weight: 600;
    width: 30%;
  }
  .table-title {
    text-align: center;
    font-weight: bold;
    margin: 1mm 0 0.8mm;
    font-size: 8.5pt;
  }
  table.fuel, table.vendor-totals {
    width: 100%;
    border-collapse: collapse;
    font-size: 8pt;
  }
  table.fuel {
    margin-bottom: 1mm;
  }
  table.fuel th, table.fuel td,
  table.vendor-totals th, table.vendor-totals td {
    border: 1px solid #000;
    padding: 0.35mm 1mm;
    background: #fff;
    line-height: 1.08;
  }
  table.fuel th, table.vendor-totals th {
    font-weight: bold;
    text-align: center;
  }
  table.fuel td.r, table.vendor-totals td.r { text-align: right; }
  table.fuel td.c { text-align: center; }
  table.vendor-totals {
    width: 42%;
    margin-left: auto;
    margin-bottom: 2mm;
  }
  .signatures {
    width: 56%;
    margin-left: auto;
    font-size: 8.5pt;
    border-collapse: collapse;
  }
  .signatures td { padding: 0.6mm 0; vertical-align: bottom; }
  .sig-dots { letter-spacing: 0.1em; }
  @media print {
    body {
      print-color-adjust: economy;
      -webkit-print-color-adjust: economy;
    }
    .sheet {
      page-break-inside: avoid;
      page-break-after: avoid;
    }
    .field, table.summary td, table.fuel td, table.fuel th,
    table.vendor-totals td, table.vendor-totals th {
      background: #fff !important;
    }
  }
</style>
</head>
<body>
<div class="sheet">
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
      <td><span class="sig-dots">................................</span> /подпис/</td>
    </tr>
    <tr>
      <td>Одобрил:</td>
      <td><span class="sig-dots">................................</span> /подпис/</td>
    </tr>
    <tr>
      <td>Директор:</td>
      <td><span class="sig-dots">................................</span> /подпис/</td>
    </tr>
  </table>
</div>
<script>
window.onload = function () {
  try { document.title = ' '; } catch (e) {}
  window.focus();
  window.print();
};
</script>
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
  const win = window.open('', '_blank', 'noopener,noreferrer');
  if (!win) {
    throw new Error('Блокиран pop-up. Разрешете прозорци за печат.');
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
  try {
    win.document.title = ' ';
  } catch {
    /* ignore */
  }
}
