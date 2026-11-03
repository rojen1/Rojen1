import { loadData, updateSettings, getCurrentUsername } from '../storage.js';
import { formatDateKey } from '../calculations.js';
import { DEFAULT_LOGISTICS_BUSES, findBusById, normalizeLogisticsBuses } from '../logistics/buses.js';
import {
  calcAvgConsumptionPer100,
  calcTotalKm,
  normalizeReceiptRow,
  sumReceiptAmount,
  sumReceiptLiters
} from '../logistics/calculations.js';
import {
  deleteLogisticsReport,
  fetchLastOdometerEnd,
  saveLogisticsReport,
  subscribeLogisticsReports
} from '../logistics/storage.js';
import { extractReceiptFromImage } from '../logistics/receipt-vision.js';
import { printReport } from '../logistics/print.js';

/** @type {import('../logistics/storage.js').LogisticsReport[]} */
let archiveReports = [];

/** @type {(() => void) | null} */
let unsubReports = null;

/** @type {string | null} */
let editingReportId = null;

/** @type {'form' | 'archive'} */
let subView = 'form';

let formInitialized = false;

function defaultPeriod() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { from: formatDateKey(from), to: formatDateKey(to) };
}

function getBuses() {
  const data = loadData();
  return normalizeLogisticsBuses(data.settings?.logisticsBuses, DEFAULT_LOGISTICS_BUSES);
}

function defaultDriverName() {
  const data = loadData();
  const p = data.profile;
  return p?.displayName || p?.username || '';
}

/** @param {string} message */
function toast(message) {
  const el = document.getElementById('toast');
  const inner = el?.querySelector('div');
  if (!inner) return;
  inner.textContent = message;
  el.classList.add('show');
  el.classList.remove('hidden');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.classList.add('hidden'), 300);
  }, 2800);
}

function readFormReport() {
  const busId = document.getElementById('logistics-bus')?.value || '';
  const buses = getBuses();
  const bus = findBusById(buses, busId);

  /** @type {import('../logistics/calculations.js').FuelReceiptRow[]} */
  const receipts = [];
  document.querySelectorAll('#logistics-receipts-body tr[data-receipt-row]').forEach(tr => {
    receipts.push(
      normalizeReceiptRow({
        id: tr.dataset.receiptId,
        date: tr.querySelector('[data-field="date"]')?.value,
        vendor: tr.querySelector('[data-field="vendor"]')?.value,
        liters: tr.querySelector('[data-field="liters"]')?.value,
        unitPrice: tr.querySelector('[data-field="unitPrice"]')?.value,
        total: tr.querySelector('[data-field="total"]')?.value,
        odometerKm: tr.querySelector('[data-field="odometerKm"]')?.value
      })
    );
  });

  return {
    id: editingReportId || 'preview',
    createdAt: '',
    updatedAt: '',
    busId: bus?.id || busId,
    busName: document.getElementById('logistics-bus-name')?.value || bus?.name || '',
    plate: document.getElementById('logistics-plate')?.value || bus?.plate || '',
    region: document.getElementById('logistics-region')?.value || bus?.region || '',
    driverName: document.getElementById('logistics-driver-name')?.value?.trim() || defaultDriverName(),
    periodFrom: document.getElementById('logistics-period-from')?.value || '',
    periodTo: document.getElementById('logistics-period-to')?.value || '',
    odometerStart: Number(document.getElementById('logistics-odometer-start')?.value) || 0,
    odometerEnd: Number(document.getElementById('logistics-odometer-end')?.value) || 0,
    receipts,
    notes: document.getElementById('logistics-notes')?.value?.trim() || '',
    reportNo: document.getElementById('logistics-report-no')?.value?.trim() || '',
    reportDate: document.getElementById('logistics-report-date')?.value || '',
    orderNo: '1',
    employeePaid: document.getElementById('logistics-employee-paid')?.value || '',
    amountToReport: document.getElementById('logistics-amount-report')?.value || '',
    cashOnHand: document.getElementById('logistics-cash-on-hand')?.value || ''
  };
}

function updateTotalsPanel() {
  const report = readFormReport();
  const totalKm = calcTotalKm(report.odometerStart, report.odometerEnd);
  const liters = sumReceiptLiters(report.receipts);
  const amount = sumReceiptAmount(report.receipts);
  const avg = calcAvgConsumptionPer100(liters, totalKm);

  const kmEl = document.getElementById('logistics-total-km');
  const lEl = document.getElementById('logistics-total-liters');
  const aEl = document.getElementById('logistics-total-amount');
  const cEl = document.getElementById('logistics-avg-consumption');
  if (kmEl) kmEl.textContent = totalKm.toFixed(1);
  if (lEl) lEl.textContent = liters.toFixed(2);
  if (aEl) aEl.textContent = amount.toFixed(2);
  if (cEl) cEl.textContent = avg.toFixed(2);
}

function addReceiptRow(data = {}) {
  const tbody = document.getElementById('logistics-receipts-body');
  if (!tbody) return;
  const row = normalizeReceiptRow(data);
  const tr = document.createElement('tr');
  tr.dataset.receiptRow = '1';
  tr.dataset.receiptId = row.id;
  tr.innerHTML = `
    <td><input type="date" data-field="date" value="${row.date}" class="logistics-cell-input"></td>
    <td><input type="text" data-field="vendor" value="${escapeAttr(row.vendor)}" placeholder="EKO, Shell…" class="logistics-cell-input"></td>
    <td><input type="number" step="0.01" data-field="liters" value="${row.liters || ''}" class="logistics-cell-input"></td>
    <td><input type="number" step="0.001" data-field="unitPrice" value="${row.unitPrice || ''}" class="logistics-cell-input"></td>
    <td><input type="number" step="0.01" data-field="total" value="${row.total || ''}" class="logistics-cell-input"></td>
    <td><input type="number" step="1" data-field="odometerKm" value="${row.odometerKm || ''}" class="logistics-cell-input"></td>
    <td><button type="button" class="logistics-row-del text-red-600 text-xs font-semibold" aria-label="Изтрий ред">✕</button></td>`;
  tbody.appendChild(tr);
  tr.querySelectorAll('input').forEach(inp => inp.addEventListener('input', updateTotalsPanel));
  tr.querySelector('.logistics-row-del')?.addEventListener('click', () => {
    tr.remove();
    updateTotalsPanel();
  });
  updateTotalsPanel();
}

function escapeAttr(s) {
  return String(s ?? '').replace(/"/g, '&quot;');
}

async function onBusChange() {
  const busId = document.getElementById('logistics-bus')?.value;
  const bus = findBusById(getBuses(), busId || '');
  if (bus) {
    const nameEl = document.getElementById('logistics-bus-name');
    const plateEl = document.getElementById('logistics-plate');
    const regionEl = document.getElementById('logistics-region');
    if (nameEl && !nameEl.dataset.userEdited) nameEl.value = bus.name;
    if (plateEl) plateEl.value = bus.plate;
    if (regionEl) regionEl.value = bus.region;
  }
  if (busId && !editingReportId) {
    const last = await fetchLastOdometerEnd(busId);
    const startEl = document.getElementById('logistics-odometer-start');
    if (last != null && startEl && !startEl.dataset.userEdited) {
      startEl.value = String(last);
      updateTotalsPanel();
    }
  }
}

function fillFormFromReport(report) {
  editingReportId = report.id;
  document.getElementById('logistics-bus').value = report.busId;
  document.getElementById('logistics-bus-name').value = report.busName;
  document.getElementById('logistics-plate').value = report.plate;
  document.getElementById('logistics-region').value = report.region;
  document.getElementById('logistics-driver-name').value = report.driverName;
  document.getElementById('logistics-period-from').value = report.periodFrom;
  document.getElementById('logistics-period-to').value = report.periodTo;
  document.getElementById('logistics-odometer-start').value = String(report.odometerStart);
  document.getElementById('logistics-odometer-end').value = String(report.odometerEnd);
  document.getElementById('logistics-notes').value = report.notes || '';
  document.getElementById('logistics-report-no').value = report.reportNo || '';
  document.getElementById('logistics-report-date').value = report.reportDate || '';
  document.getElementById('logistics-employee-paid').value = report.employeePaid || '';
  document.getElementById('logistics-amount-report').value = report.amountToReport || '';
  document.getElementById('logistics-cash-on-hand').value = report.cashOnHand || '';
  const tbody = document.getElementById('logistics-receipts-body');
  if (tbody) tbody.innerHTML = '';
  (report.receipts || []).forEach(r => addReceiptRow(r));
  subView = 'form';
  syncSubViewUi();
}

function resetNewForm() {
  editingReportId = null;
  const period = defaultPeriod();
  const buses = getBuses();
  const bus = buses[0];
  document.getElementById('logistics-bus').value = bus?.id || '';
  document.getElementById('logistics-bus-name').value = bus?.name || '';
  document.getElementById('logistics-plate').value = bus?.plate || '';
  document.getElementById('logistics-region').value = bus?.region || '';
  document.getElementById('logistics-driver-name').value = defaultDriverName();
  document.getElementById('logistics-period-from').value = period.from;
  document.getElementById('logistics-period-to').value = period.to;
  document.getElementById('logistics-odometer-start').value = '';
  document.getElementById('logistics-odometer-start')?.removeAttribute('data-user-edited');
  document.getElementById('logistics-odometer-end').value = '';
  document.getElementById('logistics-notes').value = '';
  document.getElementById('logistics-report-no').value = '';
  document.getElementById('logistics-report-date').value = formatDateKey(new Date());
  document.getElementById('logistics-employee-paid').value = '';
  document.getElementById('logistics-amount-report').value = '';
  document.getElementById('logistics-cash-on-hand').value = '';
  const tbody = document.getElementById('logistics-receipts-body');
  if (tbody) tbody.innerHTML = '';
  onBusChange();
  subView = 'form';
  syncSubViewUi();
}

function syncSubViewUi() {
  document.getElementById('logistics-panel-form')?.classList.toggle('hidden', subView !== 'form');
  document.getElementById('logistics-panel-archive')?.classList.toggle('hidden', subView !== 'archive');
  document.getElementById('logistics-sub-form')?.classList.toggle('logistics-sub-active', subView === 'form');
  document.getElementById('logistics-sub-archive')?.classList.toggle('logistics-sub-active', subView === 'archive');
}

function renderArchiveList() {
  const list = document.getElementById('logistics-archive-list');
  if (!list) return;

  const busFilter = document.getElementById('logistics-filter-bus')?.value || '';
  const fromFilter = document.getElementById('logistics-filter-from')?.value || '';
  const toFilter = document.getElementById('logistics-filter-to')?.value || '';

  let rows = archiveReports.slice();
  if (busFilter) rows = rows.filter(r => r.busId === busFilter);
  if (fromFilter) rows = rows.filter(r => r.periodTo >= fromFilter);
  if (toFilter) rows = rows.filter(r => r.periodFrom <= toFilter);

  if (!rows.length) {
    list.innerHTML = '<p class="text-sm text-slate-500 text-center py-8">Няма запазени отчети.</p>';
    return;
  }

  list.innerHTML = rows
    .map(r => {
      const km = calcTotalKm(r.odometerStart, r.odometerEnd);
      return `<article class="logistics-archive-card">
        <div>
          <p class="font-semibold text-navy">${escapeHtml(r.driverName)} · ${escapeHtml(r.plate)}</p>
          <p class="text-xs text-slate-500">${escapeHtml(r.periodFrom)} — ${escapeHtml(r.periodTo)} · ${km.toFixed(0)} км</p>
        </div>
        <div class="flex gap-2">
          <button type="button" class="logistics-btn-sm" data-print-id="${escapeHtml(r.id)}">Печат</button>
          <button type="button" class="logistics-btn-sm logistics-btn-secondary" data-edit-id="${escapeHtml(r.id)}">Отвори</button>
        </div>
      </article>`;
    })
    .join('');

  list.querySelectorAll('[data-print-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-print-id');
      const rep = archiveReports.find(x => x.id === id);
      if (rep) {
        try {
          printReport(rep);
        } catch (e) {
          toast(e.message || 'Грешка при печат.');
        }
      }
    });
  });

  list.querySelectorAll('[data-edit-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-edit-id');
      const rep = archiveReports.find(x => x.id === id);
      if (rep) fillFormFromReport(rep);
    });
  });
}

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function populateBusSelects() {
  const buses = getBuses();
  const html = buses.map(b => `<option value="${escapeAttr(b.id)}">${escapeHtml(b.name)}</option>`).join('');
  const sel = document.getElementById('logistics-bus');
  const filt = document.getElementById('logistics-filter-bus');
  if (sel) {
    const cur = sel.value;
    sel.innerHTML = html;
    if (cur) sel.value = cur;
  }
  if (filt) {
    filt.innerHTML = `<option value="">Всички бусове</option>${html}`;
  }
}

export function initLogisticsReportView() {
  document.getElementById('logistics-sub-form')?.addEventListener('click', () => {
    subView = 'form';
    syncSubViewUi();
  });
  document.getElementById('logistics-sub-archive')?.addEventListener('click', () => {
    subView = 'archive';
    syncSubViewUi();
    renderArchiveList();
  });

  document.getElementById('logistics-bus')?.addEventListener('change', onBusChange);
  document.getElementById('logistics-odometer-start')?.addEventListener('input', e => {
    e.target.dataset.userEdited = '1';
    updateTotalsPanel();
  });
  document.getElementById('logistics-odometer-end')?.addEventListener('input', updateTotalsPanel);

  document.getElementById('logistics-add-receipt')?.addEventListener('click', () => addReceiptRow());
  document.getElementById('logistics-new-report')?.addEventListener('click', resetNewForm);

  document.getElementById('logistics-scan-camera')?.addEventListener('click', () => {
    document.getElementById('logistics-receipt-camera')?.click();
  });
  document.getElementById('logistics-scan-gallery')?.addEventListener('click', () => {
    document.getElementById('logistics-receipt-gallery')?.click();
  });

  async function handleReceiptFileInput(e) {
    const input = /** @type {HTMLInputElement} */ (e.target);
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    toast('AI чете бележката…');
    try {
      const data = await extractReceiptFromImage(file);
      addReceiptRow(data);
      toast('Ред добавен от бележката.');
    } catch (err) {
      toast(err.message || 'Неуспешно сканиране.');
    }
  }

  document.getElementById('logistics-receipt-camera')?.addEventListener('change', handleReceiptFileInput);
  document.getElementById('logistics-receipt-gallery')?.addEventListener('change', handleReceiptFileInput);

  document.getElementById('logistics-save')?.addEventListener('click', async () => {
    const report = readFormReport();
    if (!report.driverName) {
      toast('Въведете име на шофьор (отчел).');
      return;
    }
    if (!report.plate) {
      toast('Въведете рег. номер на буса.');
      return;
    }
    try {
      const id = await saveLogisticsReport(report);
      editingReportId = id;
      const buses = getBuses().map(b =>
        b.id === report.busId ? { ...b, name: report.busName, plate: report.plate, region: report.region } : b
      );
      await updateSettings({ logisticsBuses: buses });
      toast('Отчетът е запазен.');
    } catch (err) {
      toast(err.message || 'Грешка при запис.');
    }
  });

  document.getElementById('logistics-print')?.addEventListener('click', () => {
    try {
      printReport(readFormReport());
    } catch (e) {
      toast(e.message || 'Грешка при печат.');
    }
  });

  ['logistics-filter-bus', 'logistics-filter-from', 'logistics-filter-to'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', renderArchiveList);
  });
}

export function renderLogisticsReportView() {
  populateBusSelects();
  const username = getCurrentUsername();
  if (unsubReports) {
    unsubReports();
    unsubReports = null;
  }
  if (username) {
    unsubReports = subscribeLogisticsReports(username, reports => {
      archiveReports = reports;
      if (subView === 'archive') renderArchiveList();
    });
  }

  if (!formInitialized) {
    resetNewForm();
    formInitialized = true;
  } else {
    updateTotalsPanel();
  }
  syncSubViewUi();
}
