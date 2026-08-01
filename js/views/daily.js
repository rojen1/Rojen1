import { loadData, saveDay, getDay, getCurrentUsername } from '../storage.js';
import {
  calcDaySummary,
  calcCashSummary,
  formatEUR,
  todayKey,
  tomorrowKey,
  formatDisplayDate,
  formatShortDate,
  generateId
} from '../calculations.js';
import {
  LAST_REGION_KEY,
  groupDeliveriesByRegion,
  isAllRegionsComplete,
  fillRegionSelect,
  syncRegionOtherVisibility,
  getRegionFromSelect
} from '../regions.js';
import { formatWaybillText, copyTextToClipboard } from '../waybill.js';

const COURSE_DATE_KEY = 'rojen1_course_date';

/** @type {boolean} */
let addPaymentIsCash = false;

/** @type {import('../app.js').DailyViewCallbacks} */
let callbacks = {};

/** @param {import('../app.js').DailyViewCallbacks} cb */
export function initDailyView(cb) {
  callbacks = cb;

  populateRegionSelect();
  document.getElementById('input-region')?.addEventListener('change', handleRegionSelectChange);
  document.getElementById('form-add-delivery')?.addEventListener('submit', handleAddDelivery);
  document.getElementById('delivery-list')?.addEventListener('change', handleToggle);
  document.getElementById('delivery-list')?.addEventListener('click', handleCardClick);
  document.getElementById('btn-copy-waybill')?.addEventListener('click', handleCopyWaybill);
  document.getElementById('btn-course-today')?.addEventListener('click', () => selectCourseDate(todayKey()));
  document.getElementById('btn-course-tomorrow')?.addEventListener('click', () => selectCourseDate(tomorrowKey()));
  document.getElementById('btn-pay-invoice')?.addEventListener('click', () => setAddPaymentType(false));
  document.getElementById('btn-pay-cash')?.addEventListener('click', () => setAddPaymentType(true));
}

export function renderDailyView() {
  const dateKey = getCourseDateKey();
  const data = loadData();
  const day = getDay(dateKey);
  const summary = calcDaySummary(day.deliveries, data.settings);
  const groups = groupDeliveriesByRegion(day.deliveries);

  updateCourseDateSwitch(dateKey);
  updateListTitle(dateKey);
  renderRegionProgress(groups);
  renderDeliveryList(groups);
  updateSummaryBar(summary);
  updateCashSummaryBar(day.deliveries);
  updateWaybillButton(day.deliveries.length);
  updateSyncInfo(dateKey, day.deliveries.length);
  callbacks.onDateUpdate?.(dateKey);
}

/** Resolve which day the daily course shows (today or tomorrow planning). */
function getCourseDateKey() {
  const today = todayKey();
  const tomorrow = tomorrowKey();
  const stored = sessionStorage.getItem(COURSE_DATE_KEY);

  if (stored === tomorrow && stored !== today) {
    return tomorrow;
  }

  if (stored !== today) {
    sessionStorage.setItem(COURSE_DATE_KEY, today);
  }
  return today;
}

/** @param {string} dateKey */
function selectCourseDate(dateKey) {
  const today = todayKey();
  const tomorrow = tomorrowKey();
  if (dateKey !== today && dateKey !== tomorrow) return;

  sessionStorage.setItem(COURSE_DATE_KEY, dateKey);
  renderDailyView();
}

/** @param {string} dateKey */
function updateCourseDateSwitch(dateKey) {
  const today = todayKey();
  const tomorrow = tomorrowKey();
  const isToday = dateKey === today;
  const isTomorrow = dateKey === tomorrow;

  const todayBtn = document.getElementById('btn-course-today');
  const tomorrowBtn = document.getElementById('btn-course-tomorrow');
  const hint = document.getElementById('course-date-hint');

  if (todayBtn) {
    todayBtn.classList.toggle('course-date-btn--active', isToday);
    todayBtn.setAttribute('aria-pressed', String(isToday));
  }

  if (tomorrowBtn) {
    tomorrowBtn.classList.toggle('course-date-btn--active', isTomorrow);
    tomorrowBtn.setAttribute('aria-pressed', String(isTomorrow));
    tomorrowBtn.textContent = today === tomorrow ? 'Утре' : `Утре (${formatShortDate(tomorrow)})`;
  }

  if (hint) {
    if (isTomorrow) {
      hint.textContent = `Планирате курса за ${formatDisplayDate(tomorrow)} — днешните спирки не се променят.`;
      hint.classList.remove('hidden');
    } else {
      hint.classList.add('hidden');
    }
  }
}

/** @param {string} dateKey */
function updateListTitle(dateKey) {
  const title = document.getElementById('delivery-list-title');
  if (!title) return;

  if (dateKey === todayKey()) {
    title.textContent = 'Спирки за днес';
    return;
  }

  if (dateKey === tomorrowKey()) {
    title.textContent = 'Спирки за утре';
    return;
  }

  title.textContent = `Спирки · ${formatShortDate(dateKey)}`;
}

/** @param {string} activeDateKey @param {number} activeCount */
function updateSyncInfo(activeDateKey, activeCount) {
  const el = document.getElementById('daily-sync-info');
  if (!el) return;

  const username = getCurrentUsername();
  if (!username) {
    el.classList.add('hidden');
    return;
  }

  const today = todayKey();
  const tomorrow = tomorrowKey();
  const todayCount = getDay(today).deliveries.length;
  const tomorrowCount = getDay(tomorrow).deliveries.length;

  let text = `Акаунт: ${username}`;

  if (activeDateKey === today) {
    text += ` · ${activeCount} спирки днес`;
    if (tomorrowCount) {
      text += ` · ${tomorrowCount} планирани за утре`;
    }
  } else if (activeDateKey === tomorrow) {
    text += ` · ${activeCount} спирки за утре`;
    if (todayCount) {
      text += ` · ${todayCount} за днес`;
    }
  } else {
    text += ` · ${activeCount} спирки`;
  }

  el.textContent = text;
  el.classList.remove('hidden');
}

function updateWaybillButton(deliveryCount) {
  const btn = document.getElementById('btn-copy-waybill');
  if (!btn) return;
  btn.classList.toggle('hidden', deliveryCount === 0);
}

function populateRegionSelect() {
  fillRegionSelect(
    document.getElementById('input-region'),
    document.getElementById('input-region-other')
  );
}

function handleRegionSelectChange() {
  syncRegionOtherVisibility(
    document.getElementById('input-region'),
    document.getElementById('input-region-other')
  );
}

/** @param {import('../regions.js').RegionGroup[]} groups */
function renderRegionProgress(groups) {
  const container = document.getElementById('region-progress');
  if (!container) return;

  if (!groups.length) {
    container.classList.add('hidden');
    container.innerHTML = '';
    return;
  }

  container.classList.remove('hidden');
  const allDone = isAllRegionsComplete(groups);

  container.innerHTML = `
    <div class="bg-white rounded-2xl shadow-card border border-navy/5 p-3">
      <div class="flex items-center justify-between mb-2">
        <p class="text-xs font-bold text-navy uppercase tracking-wide">Прогрес по райони</p>
        ${allDone ? '<span class="text-xs font-semibold text-success-dark">✓ Всички готови</span>' : ''}
      </div>
      <div class="region-progress-grid">
        ${groups.map(g => renderRegionProgressCard(g)).join('')}
      </div>
    </div>
  `;
}

/** @param {import('../regions.js').RegionGroup} group */
function renderRegionProgressCard(group) {
  const pct = group.total ? Math.round((group.delivered / group.total) * 100) : 0;
  const complete = group.delivered === group.total;

  return `
    <div class="region-progress-card ${complete ? 'region-progress-card--done' : ''}">
      <div class="flex items-center justify-between gap-2 mb-1.5">
        <span class="text-xs font-semibold text-navy truncate">${escapeHtml(group.region)}</span>
        <span class="text-xs font-bold shrink-0 ${complete ? 'text-success-dark' : 'text-slate-500'}">
          ${complete ? '✓' : ''} ${group.delivered}/${group.total}
        </span>
      </div>
      <div class="region-progress-track" aria-hidden="true">
        <div class="region-progress-fill ${complete ? 'region-progress-fill--done' : ''}" style="width: ${pct}%"></div>
      </div>
    </div>
  `;
}

/** @param {import('../regions.js').RegionGroup[]} groups */
function renderDeliveryList(groups) {
  const list = document.getElementById('delivery-list');
  const empty = document.getElementById('empty-deliveries');
  const count = document.getElementById('delivery-count');
  const totalStops = groups.reduce((sum, g) => sum + g.total, 0);

  if (!list) return;

  count.textContent = String(totalStops);

  if (!totalStops) {
    list.innerHTML = '';
    empty?.classList.remove('hidden');
    return;
  }

  empty?.classList.add('hidden');

  list.innerHTML = groups.map(g => `
    <li class="region-block">
      <div class="region-header ${g.delivered === g.total ? 'region-header--done' : ''}">
        <div class="flex items-center gap-2 min-w-0">
          <span class="region-header-icon" aria-hidden="true">📍</span>
          <span class="font-bold text-sm uppercase tracking-wide truncate">${escapeHtml(g.region)}</span>
        </div>
        <span class="region-header-count ${g.delivered === g.total ? 'text-success-dark' : 'text-slate-500'}">
          ${g.delivered === g.total ? '✓ ' : ''}${g.delivered}/${g.total}
        </span>
      </div>
      <ul class="space-y-2 mt-2">
        ${g.deliveries.map(d => `
          <li>
            ${renderDeliveryCard(d)}
          </li>
        `).join('')}
      </ul>
    </li>
  `).join('');
}

function setAddPaymentType(isCash) {
  addPaymentIsCash = isCash;
  document.getElementById('btn-pay-invoice')?.classList.toggle('payment-type-btn--active', !isCash);
  document.getElementById('btn-pay-cash')?.classList.toggle('payment-type-btn--active', isCash);
  document.getElementById('btn-pay-invoice')?.setAttribute('aria-pressed', String(!isCash));
  document.getElementById('btn-pay-cash')?.setAttribute('aria-pressed', String(isCash));
}

/** @param {import('../storage.js').Delivery} d */
function renderDeliveryCard(d) {
  const isCash = !!d.isCash;

  return `
    <article class="delivery-card ${d.delivered ? 'delivered' : 'bg-white'} rounded-2xl shadow-card p-4 border border-navy/5 transition-all duration-300"
      data-id="${d.id}">
      <div class="flex items-center gap-2">
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 min-w-0">
            <h3 class="delivery-name font-semibold text-navy truncate">${escapeHtml(d.clientName)}</h3>
            ${isCash ? '<span class="cash-badge shrink-0">Брой</span>' : ''}
          </div>
          <p class="delivery-amount text-lg font-bold mt-0.5 ${d.delivered ? '' : 'text-accent-coral'}">${formatEUR(d.amount)}</p>
        </div>
        <button type="button" data-action="delete" data-id="${d.id}" aria-label="Изтрий спирка"
          class="btn-delete-delivery shrink-0">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
          </svg>
        </button>
        <label class="toggle-switch" aria-label="Маркирай като доставено">
          <input type="checkbox" ${d.delivered ? 'checked' : ''} data-action="toggle" data-id="${d.id}">
          <span class="toggle-slider"></span>
        </label>
      </div>
      <div class="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" data-action="set-payment" data-id="${d.id}" data-cash="false"
          class="payment-chip ${!isCash ? 'payment-chip--active' : ''}">Банка</button>
        <button type="button" data-action="set-payment" data-id="${d.id}" data-cash="true"
          class="payment-chip ${isCash ? 'payment-chip--active payment-chip--cash' : ''}">💵 Брой</button>
      </div>
      ${d.delivered ? `
        <div class="mt-2 flex items-center gap-1.5 text-success-dark text-xs font-medium">
          <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
          </svg>
          Доставено
        </div>
      ` : ''}
    </article>
  `;
}

function updateSummaryBar(summary) {
  document.getElementById('sum-turnover').textContent = formatEUR(summary.turnover);
  document.getElementById('sum-bonus').textContent = formatEUR(summary.bonus);
  document.getElementById('sum-allowance').textContent = formatEUR(summary.allowance);
  document.getElementById('sum-total').textContent = formatEUR(summary.total);
}

/** @param {import('../storage.js').Delivery[]} deliveries */
function updateCashSummaryBar(deliveries) {
  const block = document.getElementById('cash-summary-block');
  const amountEl = document.getElementById('sum-cash-to-report');
  const detailEl = document.getElementById('sum-cash-detail');
  if (!block || !amountEl || !detailEl) return;

  const cash = calcCashSummary(deliveries);
  if (!cash.totalCashCount) {
    block.classList.add('hidden');
    return;
  }

  block.classList.remove('hidden');
  amountEl.textContent = formatEUR(cash.toReportAmount);

  const parts = [];
  if (cash.toReportCount) {
    parts.push(`${cash.toReportCount} доставени в брой`);
  }
  if (cash.pendingCount) {
    parts.push(`${cash.pendingCount} в брой, още не доставени`);
  }

  detailEl.textContent = parts.join(' · ') || `${cash.totalCashCount} спирки в брой`;
}

function getSelectedRegion() {
  return getRegionFromSelect(
    document.getElementById('input-region'),
    document.getElementById('input-region-other')
  );
}

async function handleAddDelivery(e) {
  e.preventDefault();

  const clientInput = document.getElementById('input-client');
  const amountInput = document.getElementById('input-amount');
  const region = getSelectedRegion();

  const clientName = clientInput.value.trim();
  const amount = parseFloat(amountInput.value);

  if (!region) {
    showToast('Изберете район.');
    return;
  }
  if (!clientName || isNaN(amount) || amount < 0) return;

  const dateKey = getCourseDateKey();
  const day = getDay(dateKey);

  day.deliveries.push({
    id: generateId(),
    clientName,
    amount,
    region,
    delivered: false,
    isCash: addPaymentIsCash,
    createdAt: new Date().toISOString()
  });

  try {
    await saveDay(dateKey, day);
    sessionStorage.setItem(LAST_REGION_KEY, region);
    clientInput.value = '';
    amountInput.value = '';
    clientInput.focus();
    callbacks.onDeliveryAdded?.();
    renderDailyView();
  } catch (err) {
    showToast(err.message || 'Грешка при запис.');
  }
}

async function handleCopyWaybill() {
  const dateKey = getCourseDateKey();
  const data = loadData();
  const day = getDay(dateKey);

  if (!day.deliveries.length) {
    showToast('Няма спирки за копиране.');
    return;
  }

  const text = formatWaybillText(day.deliveries, {
    dateKey,
    driverName: data.profile?.displayName || data.profile?.username || ''
  });

  try {
    await copyTextToClipboard(text);
    showToast('Копирано! Поставете във Viber и изпратете.');
  } catch {
    showToast('Неуспешно копиране. Опитайте отново.');
  }
}

async function handleToggle(e) {
  if (e.target.dataset.action !== 'toggle') return;

  const id = e.target.dataset.id;
  const dateKey = getCourseDateKey();
  const day = getDay(dateKey);
  const delivery = day.deliveries.find(d => d.id === id);
  if (!delivery) return;

  delivery.delivered = e.target.checked;

  try {
    await saveDay(dateKey, day);
    renderDailyView();
  } catch (err) {
    e.target.checked = !e.target.checked;
    showToast(err.message || 'Грешка при запис.');
  }
}

async function handleCardClick(e) {
  const btn = e.target.closest('[data-action]');
  if (!btn || btn.dataset.action === 'toggle') return;

  const action = btn.dataset.action;
  const id = btn.dataset.id;
  if (!id) return;

  if (action === 'delete') {
    await handleDelete(id);
    return;
  }

  const dateKey = getCourseDateKey();
  const day = getDay(dateKey);
  const delivery = day.deliveries.find(d => d.id === id);
  if (!delivery) return;

  if (action === 'set-payment') {
    delivery.isCash = btn.dataset.cash === 'true';
  } else {
    return;
  }

  try {
    await saveDay(dateKey, day);
    renderDailyView();
  } catch (err) {
    showToast(err.message || 'Грешка при запис.');
  }
}

/** @param {string} id */
async function handleDelete(id) {
  const dateKey = getCourseDateKey();
  const day = getDay(dateKey);
  const delivery = day.deliveries.find(d => d.id === id);
  if (!delivery) return;

  if (!confirm(`Изтриване на „${delivery.clientName}“ от списъка?`)) return;

  day.deliveries = day.deliveries.filter(d => d.id !== id);

  try {
    await saveDay(dateKey, day);
    renderDailyView();
  } catch (err) {
    showToast(err.message || 'Грешка при запис.');
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function showToast(message) {
  const toast = document.getElementById('toast');
  const inner = toast?.querySelector('div');
  if (!inner) return;
  inner.textContent = message;
  toast.classList.add('show');
  toast.classList.remove('hidden');
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.classList.add('hidden'), 300);
  }, 2500);
}
