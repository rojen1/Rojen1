import { loadData, getDay } from '../storage.js';
import {
  calcDaySummary,
  calcCashSummary,
  calcMonthSummary,
  formatEUR,
  formatShortDate,
  formatMonthLabel,
  formatDisplayDate
} from '../calculations.js';
import { groupDeliveriesByRegion } from '../regions.js';

let currentYear;
let currentMonth;

/** @param {number} year @param {number} month 0-11 */
function getNextMonth(year, month) {
  if (month === 11) return { year: year + 1, month: 0 };
  return { year, month: month + 1 };
}

/** @param {number} year @param {number} month 0-11 */
function isFutureMonth(year, month) {
  const now = new Date();
  return year > now.getFullYear() || (year === now.getFullYear() && month > now.getMonth());
}

/** @param {Record<string, { deliveries?: unknown[] }>} allDays @param {number} year @param {number} month */
function monthHasDeliveries(allDays, year, month) {
  const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;
  return Object.keys(allDays).some(key => {
    if (!key.startsWith(prefix)) return false;
    return (allDays[key]?.deliveries?.length ?? 0) > 0;
  });
}

/** @param {Record<string, { deliveries?: unknown[] }>} allDays */
function canGoToNextMonth(allDays) {
  const { year, month } = getNextMonth(currentYear, currentMonth);
  if (!isFutureMonth(year, month)) return true;
  return monthHasDeliveries(allDays, year, month);
}

export function initArchiveView() {
  const now = new Date();
  currentYear = now.getFullYear();
  currentMonth = now.getMonth();

  document.getElementById('btn-prev-month')?.addEventListener('click', () => {
    currentMonth--;
    if (currentMonth < 0) {
      currentMonth = 11;
      currentYear--;
    }
    renderArchiveView();
  });

  document.getElementById('btn-next-month')?.addEventListener('click', () => {
    const data = loadData();
    if (!canGoToNextMonth(data.days)) return;

    currentMonth++;
    if (currentMonth > 11) {
      currentMonth = 0;
      currentYear++;
    }
    renderArchiveView();
  });

  document.getElementById('archive-table-body')?.addEventListener('click', handleRowClick);
  document.getElementById('archive-table-body')?.addEventListener('keydown', handleRowKeydown);
  document.getElementById('btn-close-day-detail')?.addEventListener('click', closeDayDetail);
  document.getElementById('day-detail-backdrop')?.addEventListener('click', closeDayDetail);
}

export function renderArchiveView() {
  const data = loadData();
  const summary = calcMonthSummary(data.days, currentYear, currentMonth, data.settings);

  document.getElementById('archive-month-label').textContent =
    formatMonthLabel(currentYear, currentMonth);

  const nextBtn = document.getElementById('btn-next-month');
  if (nextBtn) {
    const allowed = canGoToNextMonth(data.days);
    nextBtn.disabled = !allowed;
    nextBtn.classList.toggle('opacity-40', !allowed);
    nextBtn.classList.toggle('pointer-events-none', !allowed);
  }

  renderTable(summary.rows);
  renderSummaryCards(summary);
  renderPayoutBanner(summary);
}

function renderTable(rows) {
  const tbody = document.getElementById('archive-table-body');
  const tfoot = document.getElementById('archive-table-foot');

  if (!rows.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="py-10 text-center text-slate-400 text-sm">
          Няма записи за този месец
        </td>
      </tr>`;
    tfoot.innerHTML = '';
    return;
  }

  tbody.innerHTML = rows.map(row => {
    const turnover = row.isPlanned ? row.plannedTurnover : row.turnover;
    const dateLabel = row.isPlanned
      ? `${formatShortDate(row.dateKey)} · план`
      : formatShortDate(row.dateKey);

    return `
    <tr class="archive-row border-b border-slate-100 ${row.isPlanned ? 'bg-amber-50/60' : ''}" tabindex="0" role="button"
      data-date-key="${row.dateKey}" aria-label="Детайли за ${formatShortDate(row.dateKey)}">
      <td class="py-2.5 px-3 font-medium text-navy">${dateLabel}</td>
      <td class="py-2.5 px-2 text-right">${formatEUR(turnover)}</td>
      <td class="py-2.5 px-2 text-right text-accent-amber">${row.isPlanned ? '—' : formatEUR(row.bonus)}</td>
      <td class="py-2.5 px-2 text-right">${row.isPlanned ? '—' : formatEUR(row.allowance)}</td>
      <td class="py-2.5 px-3 text-right font-semibold ${row.isPlanned ? 'text-navy' : 'text-success-dark'}">${row.isPlanned ? `${row.stopCount} сп.` : formatEUR(row.total)}</td>
    </tr>`;
  }).join('');

  const totals = rows.reduce(
    (acc, r) => ({
      turnover: acc.turnover + r.turnover,
      bonus: acc.bonus + r.bonus,
      allowance: acc.allowance + r.allowance,
      total: acc.total + r.total
    }),
    { turnover: 0, bonus: 0, allowance: 0, total: 0 }
  );

  tfoot.innerHTML = `
    <tr class="bg-navy/5 font-bold text-navy text-xs">
      <td class="py-3 px-3">ОБЩО</td>
      <td class="py-3 px-2 text-right">${formatEUR(totals.turnover)}</td>
      <td class="py-3 px-2 text-right">${formatEUR(totals.bonus)}</td>
      <td class="py-3 px-2 text-right">${formatEUR(totals.allowance)}</td>
      <td class="py-3 px-3 text-right text-success-dark">${formatEUR(totals.total)}</td>
    </tr>`;
}

function handleRowClick(e) {
  const row = e.target.closest('.archive-row');
  if (!row) return;
  openDayDetail(row.dataset.dateKey);
}

function handleRowKeydown(e) {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const row = e.target.closest('.archive-row');
  if (!row) return;
  e.preventDefault();
  openDayDetail(row.dataset.dateKey);
}

function openDayDetail(dateKey) {
  const data = loadData();
  const day = getDay(dateKey);
  const summary = calcDaySummary(day.deliveries, data.settings);
  const cash = calcCashSummary(day.deliveries);

  document.getElementById('day-detail-date').textContent = formatDisplayDate(dateKey);

  let cashHtml = '';
  if (cash.totalCashCount) {
    cashHtml = `
    <div class="bg-amber-50 rounded-xl p-3 border border-amber-200 col-span-2">
      <p class="text-xs text-amber-800">В брой за отчитане</p>
      <p class="font-bold text-amber-900">${formatEUR(cash.toReportAmount)}</p>
      <p class="text-xs text-amber-700 mt-1">${cash.toReportCount} доставени · ${cash.pendingCount} предстоящи</p>
    </div>`;
  }

  document.getElementById('day-detail-summary').innerHTML = `
    <div class="bg-cream rounded-xl p-3 border border-navy/5">
      <p class="text-xs text-slate-500">Оборот</p>
      <p class="font-bold text-navy">${formatEUR(summary.turnover)}</p>
    </div>
    <div class="bg-cream rounded-xl p-3 border border-navy/5">
      <p class="text-xs text-slate-500">Бонус</p>
      <p class="font-semibold text-accent-amber">${formatEUR(summary.bonus)}</p>
    </div>
    <div class="bg-cream rounded-xl p-3 border border-navy/5">
      <p class="text-xs text-slate-500">Надник</p>
      <p class="font-semibold text-slate-700">${formatEUR(summary.allowance)}</p>
    </div>
    <div class="bg-success-light rounded-xl p-3 border border-success/20">
      <p class="text-xs text-success-dark">Общо</p>
      <p class="font-bold text-success-dark">${formatEUR(summary.total)}</p>
    </div>
    ${cashHtml}`;

  const list = document.getElementById('day-detail-deliveries');

  if (!day.deliveries.length) {
    list.innerHTML = `<li class="text-center text-slate-400 text-sm py-6">Няма записани доставки</li>`;
  } else {
    const groups = groupDeliveriesByRegion(day.deliveries);
    list.innerHTML = groups.map(g => `
      <li class="mb-3 last:mb-0">
        <p class="text-xs font-bold text-navy uppercase tracking-wide mb-2 px-1">
          ${escapeHtml(g.region)} · ${g.delivered}/${g.total}
        </p>
        <ul class="space-y-2">
          ${g.deliveries.map(d => `
            <li class="day-detail-item ${d.delivered ? 'delivered' : 'bg-cream'} rounded-xl p-3 border border-navy/5 flex items-center justify-between gap-3">
              <div class="min-w-0">
                <p class="day-detail-client font-medium text-navy truncate">${escapeHtml(d.clientName)}${d.isCash ? ' · брой' : ''}</p>
                ${d.delivered
                  ? `<p class="text-xs mt-0.5 ${d.isCash ? 'text-amber-700 font-medium' : 'text-success-dark font-medium'}">${d.isCash ? 'В брой' : 'Доставено'}</p>`
                  : '<p class="text-xs text-slate-400 mt-0.5">Недоставено</p>'}
              </div>
              <p class="day-detail-amount font-bold shrink-0 ${d.delivered ? '' : 'text-accent-coral'}">${formatEUR(d.amount)}</p>
            </li>
          `).join('')}
        </ul>
      </li>
    `).join('');
  }

  document.getElementById('modal-day-detail').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeDayDetail() {
  document.getElementById('modal-day-detail').classList.add('hidden');
  document.body.style.overflow = '';
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function renderSummaryCards(summary) {
  const container = document.getElementById('archive-summary');
  container.innerHTML = `
    <div class="bg-white rounded-xl shadow-card p-3 border border-navy/5">
      <p class="text-xs text-slate-500">Месечен оборот</p>
      <p class="text-lg font-bold text-navy">${formatEUR(summary.totalTurnover)}</p>
    </div>
    <div class="bg-white rounded-xl shadow-card p-3 border border-navy/5">
      <p class="text-xs text-slate-500">Общ бонус</p>
      <p class="text-lg font-bold text-accent-amber">${formatEUR(summary.totalBonus)}</p>
    </div>
    <div class="bg-white rounded-xl shadow-card p-3 border border-navy/5">
      <p class="text-xs text-slate-500">Общ надник</p>
      <p class="text-lg font-bold text-slate-700">${formatEUR(summary.totalAllowance)}</p>
    </div>
    <div class="bg-white rounded-xl shadow-card p-3 border border-navy/5">
      <p class="text-xs text-slate-500">Ваучер бонус</p>
      <p class="text-lg font-bold text-accent-sky">${formatEUR(summary.voucher)}</p>
    </div>`;
}

function renderPayoutBanner(summary) {
  const banner = document.getElementById('archive-payout');
  banner.innerHTML = `
    <div class="flex items-center justify-between">
      <div>
        <p class="text-white/80 text-sm font-medium">ЗА ПЛАЩАНЕ</p>
        <p class="text-3xl font-bold mt-1">${formatEUR(summary.finalPayout)}</p>
      </div>
      <div class="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center">
        <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
      </div>
    </div>
    <p class="text-white/60 text-xs mt-2">
      ${formatEUR(summary.totalDaily)} дневни + ${formatEUR(summary.voucher)} ваучер
    </p>`;
}
