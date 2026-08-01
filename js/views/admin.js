import {
  createUserAccount,
  listAllAccounts,
  listLoginUsers,
  updateUserPassword,
  setUserDisabled,
  deleteUserAccount,
  fetchDriversDayStats,
  fetchDriverDayDetail,
  ADMIN_USERNAME
} from '../accounts.js';
import { formatDisplayDate, formatEUR, formatTime, formatDateTime, todayKey, calcCashSummary } from '../calculations.js';
import { copyTextToClipboard } from '../waybill.js';
import { groupDeliveriesByRegion } from '../regions.js';

const APP_URL = 'https://rojen1.github.io/Rojen1/';

/** @type {string | null} */
let resetTargetUsername = null;

/** @type {string} */
let fleetDateKey = todayKey();

export function initAdminView() {
  document.getElementById('form-create-driver')?.addEventListener('submit', handleCreateUser);
  document.getElementById('btn-refresh-drivers')?.addEventListener('click', () => {
    renderUserList();
    renderFleetOverview();
  });
  document.getElementById('btn-refresh-fleet')?.addEventListener('click', renderFleetOverview);
  document.getElementById('btn-copy-app-link')?.addEventListener('click', handleCopyAppLink);
  document.getElementById('admin-fleet-list')?.addEventListener('click', handleFleetClick);
  document.getElementById('admin-driver-list')?.addEventListener('click', handleUserAction);
  document.getElementById('form-reset-password')?.addEventListener('submit', handleResetPassword);
  document.getElementById('btn-close-reset')?.addEventListener('click', closeResetModal);
  document.getElementById('reset-backdrop')?.addEventListener('click', closeResetModal);
  document.getElementById('btn-close-admin-driver')?.addEventListener('click', closeDriverDetailModal);
  document.getElementById('admin-driver-backdrop')?.addEventListener('click', closeDriverDetailModal);

  const qr = document.getElementById('admin-qr-code');
  if (qr) {
    qr.src = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(APP_URL)}`;
  }
}

export function renderAdminView() {
  renderFleetOverview();
  renderUserList();
}

async function renderFleetOverview() {
  const list = document.getElementById('admin-fleet-list');
  const dateEl = document.getElementById('admin-fleet-date');
  if (!list) return;

  const dateKey = todayKey();
  fleetDateKey = dateKey;
  if (dateEl) dateEl.textContent = formatDisplayDate(dateKey);

  list.innerHTML = '<li class="text-center text-slate-400 text-sm py-4">Зареждане…</li>';

  try {
    const stats = await fetchDriversDayStats(dateKey);

    if (!stats.length) {
      list.innerHTML = '<li class="text-center text-slate-400 text-sm py-4">Няма данни</li>';
      return;
    }

    list.innerHTML = stats.map(s => {
      const pct = s.total ? Math.round((s.done / s.total) * 100) : 0;
      const complete = s.total > 0 && s.done === s.total;

      return `
        <li>
          <button type="button" class="fleet-driver-btn w-full text-left rounded-xl border border-navy/10 p-3 ${complete ? 'bg-success-light/40' : 'bg-cream/40'} active:scale-[0.99] transition-all"
            data-username="${escapeHtml(s.username)}" data-label="${escapeHtml(s.displayName)}">
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0">
                <p class="font-semibold text-navy truncate">${escapeHtml(s.displayName)}</p>
                <p class="text-xs text-slate-500">@${escapeHtml(s.username)}${s.role === 'admin' ? ' · Админ' : ''}</p>
              </div>
              <span class="text-xs font-bold shrink-0 ${complete ? 'text-success-dark' : 'text-navy'}">${s.done}/${s.total}</span>
            </div>
            <div class="mt-2 flex flex-wrap gap-2 text-xs">
              <span class="px-2 py-1 rounded-lg bg-white border border-navy/10">${pct}% готови</span>
              ${s.cashCount ? `<span class="px-2 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-900">💵 ${formatEUR(s.cashAmount)} (${s.cashCount})</span>` : ''}
              ${!s.total ? '<span class="px-2 py-1 rounded-lg bg-white border border-slate-200 text-slate-500">Няма спирки</span>' : '<span class="px-2 py-1 rounded-lg bg-navy/5 border border-navy/10 text-navy">Докосни за детайли →</span>'}
            </div>
          </button>
        </li>`;
    }).join('');
  } catch (err) {
    list.innerHTML = `<li class="text-center text-red-500 text-sm py-4">${escapeHtml(err.message || 'Грешка')}</li>`;
  }
}

async function handleCopyAppLink() {
  try {
    await copyTextToClipboard(APP_URL);
    showAdminSuccess('Линкът е копиран.');
  } catch {
    showAdminError('Неуспешно копиране.');
  }
}

async function handleFleetClick(e) {
  const btn = e.target.closest('[data-username]');
  if (!btn) return;

  const username = btn.dataset.username;
  const label = btn.dataset.label || username;
  await openDriverDetailModal(username, label);
}

async function openDriverDetailModal(username, label) {
  const stopsEl = document.getElementById('admin-driver-stops');
  const summaryEl = document.getElementById('admin-driver-summary');
  const metaEl = document.getElementById('admin-driver-meta');
  if (!stopsEl) return;

  document.getElementById('admin-driver-title').textContent = label;
  document.getElementById('admin-driver-subtitle').textContent =
    `${formatDisplayDate(fleetDateKey)} · @${username}`;
  summaryEl.innerHTML = '';
  metaEl.textContent = 'Зареждане…';
  stopsEl.innerHTML = '<li class="text-center text-slate-400 text-sm py-6">Зареждане…</li>';
  document.getElementById('modal-admin-driver').classList.remove('hidden');
  document.body.style.overflow = 'hidden';

  try {
    const detail = await fetchDriverDayDetail(username, fleetDateKey);
    const deliveries = detail.deliveries || [];
    const cash = calcCashSummary(deliveries);
    const done = deliveries.filter(d => d.delivered).length;
    const plannedTotal = deliveries.reduce((sum, d) => sum + (d.amount || 0), 0);

    const createdTimes = deliveries
      .map(d => d.createdAt)
      .filter(Boolean)
      .sort();

    summaryEl.innerHTML = `
      <div class="bg-cream rounded-xl p-3 border border-navy/5">
        <p class="text-xs text-slate-500">Спирки</p>
        <p class="font-bold text-navy">${done}/${deliveries.length}</p>
      </div>
      <div class="bg-cream rounded-xl p-3 border border-navy/5">
        <p class="text-xs text-slate-500">Сума</p>
        <p class="font-bold text-navy">${formatEUR(plannedTotal)}</p>
      </div>
      <div class="bg-amber-50 rounded-xl p-3 border border-amber-200">
        <p class="text-xs text-amber-800">В брой</p>
        <p class="font-bold text-amber-900">${formatEUR(cash.toReportAmount)}</p>
      </div>
      <div class="bg-cream rounded-xl p-3 border border-navy/5">
        <p class="text-xs text-slate-500">Доставени</p>
        <p class="font-bold text-success-dark">${done}</p>
      </div>`;

    const metaParts = [];
    if (createdTimes.length) {
      metaParts.push(`Първа спирка: ${formatTime(createdTimes[0])}`);
      metaParts.push(`Последна добавена: ${formatTime(createdTimes[createdTimes.length - 1])}`);
    }
    if (detail.updatedAt) {
      metaParts.push(`Последна промяна: ${formatDateTime(detail.updatedAt)}`);
    }
    metaEl.textContent = metaParts.join(' · ') || 'Няма записани часове';

    if (!deliveries.length) {
      stopsEl.innerHTML = '<li class="text-center text-slate-400 text-sm py-6">Няма спирки за този ден</li>';
      return;
    }

    const groups = groupDeliveriesByRegion(deliveries);
    stopsEl.innerHTML = groups.map(g => `
      <li>
        <p class="text-xs font-bold text-navy uppercase tracking-wide mb-2 px-1">
          ${escapeHtml(g.region)} · ${g.delivered}/${g.total}
        </p>
        <ul class="space-y-2">
          ${g.deliveries.map((d, index) => `
            <li class="rounded-xl p-3 border border-navy/5 ${d.delivered ? 'bg-success-light/30' : 'bg-cream/50'}">
              <div class="flex items-start justify-between gap-2">
                <div class="min-w-0">
                  <p class="font-medium text-navy truncate">${index + 1}. ${escapeHtml(d.clientName)}</p>
                  <p class="text-xs text-slate-500 mt-0.5">Заредена: ${formatTime(d.createdAt)} · ${formatDateTime(d.createdAt)}</p>
                  ${d.note ? `<p class="text-xs text-slate-600 mt-1">📝 ${escapeHtml(d.note)}</p>` : ''}
                </div>
                <div class="text-right shrink-0">
                  <p class="font-bold text-navy">${formatEUR(d.amount)}</p>
                  <p class="text-xs mt-0.5 ${d.delivered ? 'text-success-dark' : 'text-slate-400'}">${d.delivered ? '✓ Доставено' : 'Чака'}</p>
                  ${d.isCash ? '<p class="text-xs text-amber-800 font-medium">💵 Брой</p>' : ''}
                </div>
              </div>
            </li>
          `).join('')}
        </ul>
      </li>
    `).join('');
  } catch (err) {
    stopsEl.innerHTML = '';
    metaEl.textContent = '';
    showAdminError(err.message || 'Грешка при зареждане.');
    closeDriverDetailModal();
  }
}

function closeDriverDetailModal() {
  document.getElementById('modal-admin-driver')?.classList.add('hidden');
  document.body.style.overflow = '';
}

async function renderUserList() {
  const list = document.getElementById('admin-driver-list');
  const empty = document.getElementById('admin-empty');
  if (!list) return;

  list.innerHTML = '<li class="text-center text-slate-400 text-sm py-6">Зареждане…</li>';

  try {
    const users = await listAllAccounts();

    if (!users.length) {
      list.innerHTML = '';
      empty?.classList.remove('hidden');
      return;
    }

    empty?.classList.add('hidden');
    list.innerHTML = users.map(u => `
      <li class="bg-white rounded-xl shadow-card p-4 border border-navy/5">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="font-semibold text-navy truncate">${escapeHtml(u.displayName || u.username)}</p>
            <p class="text-xs text-slate-500 truncate">@${escapeHtml(u.username)} · ${u.role === 'admin' ? 'Админ' : 'Шофьор'}</p>
            <p class="text-xs mt-1 ${u.disabled ? 'text-red-500' : 'text-success-dark'}">
              ${u.disabled ? 'Деактивиран' : 'Активен'}
            </p>
          </div>
          <div class="flex flex-col gap-2 shrink-0">
            <button type="button" data-action="reset" data-username="${escapeHtml(u.username)}"
              data-label="${escapeHtml(u.displayName || u.username)}"
              class="text-xs px-3 py-1.5 rounded-lg bg-navy/10 text-navy font-medium hover:bg-navy/15">
              Смени парола
            </button>
            ${u.username !== ADMIN_USERNAME ? `
            <button type="button" data-action="toggle" data-username="${escapeHtml(u.username)}" data-disabled="${u.disabled}"
              class="text-xs px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-cream">
              ${u.disabled ? 'Активирай' : 'Деактивирай'}
            </button>
            <button type="button" data-action="delete" data-username="${escapeHtml(u.username)}"
              data-label="${escapeHtml(u.displayName || u.username)}"
              class="text-xs px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50">
              Изтрий
            </button>` : ''}
          </div>
        </div>
      </li>
    `).join('');
  } catch (err) {
    list.innerHTML = '';
    showAdminError(err.message || 'Грешка при зареждане.');
  }
}

async function handleCreateUser(e) {
  e.preventDefault();
  clearAdminError();

  const username = document.getElementById('admin-driver-username').value;
  const displayName = document.getElementById('admin-driver-name').value;
  const password = document.getElementById('admin-driver-password').value;

  const btn = document.getElementById('btn-create-driver');
  btn.disabled = true;

  try {
    await createUserAccount({ username, displayName, password });
    e.target.reset();
    showAdminSuccess('Потребителят е създаден.');
    await refreshLoginSelect();
    renderUserList();
  } catch (err) {
    showAdminError(err.message || 'Грешка при създаване.');
  } finally {
    btn.disabled = false;
  }
}

async function refreshLoginSelect() {
  const select = document.getElementById('auth-user');
  if (!select) return;

  const current = select.value;
  select.innerHTML = '<option value="">— Изберете потребител —</option>';

  const users = await listLoginUsers();
  for (const user of users) {
    const opt = document.createElement('option');
    opt.value = user.username;
    opt.textContent = user.displayName || user.username;
    if (user.username === ADMIN_USERNAME) opt.textContent += ' (Админ)';
    select.appendChild(opt);
  }
  if (current) select.value = current;
}

async function handleUserAction(e) {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;

  const username = btn.dataset.username;
  const action = btn.dataset.action;

  if (action === 'reset') {
    openResetModal(username, btn.dataset.label);
    return;
  }

  if (action === 'toggle') {
    const currentlyDisabled = btn.dataset.disabled === 'true';
    const label = currentlyDisabled ? 'активирате' : 'деактивирате';
    if (!confirm(`Сигурни ли сте, че искате да ${label} този потребител?`)) return;

    try {
      await setUserDisabled(username, !currentlyDisabled);
      await refreshLoginSelect();
      renderUserList();
    } catch (err) {
      showAdminError(err.message || 'Грешка при промяна.');
    }
    return;
  }

  if (action === 'delete') {
    const label = btn.dataset.label || username;
    if (!confirm(
      `Изтриване на „${label}“ (@${username})?\n\n` +
      'Ще бъдат изтрити завинаги акаунтът и всички негови доставки.\n' +
      'Това действие не може да бъде отменено.'
    )) return;

    try {
      await deleteUserAccount(username);
      showAdminSuccess('Потребителят е изтрит.');
      await refreshLoginSelect();
      renderUserList();
    } catch (err) {
      showAdminError(err.message || 'Грешка при изтриване.');
    }
  }
}

function openResetModal(username, label) {
  resetTargetUsername = username;
  document.getElementById('reset-driver-email').textContent = label || username;
  document.getElementById('admin-new-password').value = '';
  document.getElementById('modal-reset-password').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeResetModal() {
  resetTargetUsername = null;
  document.getElementById('modal-reset-password').classList.add('hidden');
  document.body.style.overflow = '';
}

async function handleResetPassword(e) {
  e.preventDefault();
  if (!resetTargetUsername) return;

  const newPassword = document.getElementById('admin-new-password').value;
  const btn = document.getElementById('btn-confirm-reset');
  btn.disabled = true;

  try {
    await updateUserPassword(resetTargetUsername, newPassword);
    closeResetModal();
    showAdminSuccess('Паролата е сменена.');
  } catch (err) {
    showAdminError(err.message || 'Грешка при смяна на парола.');
  } finally {
    btn.disabled = false;
  }
}

function showAdminError(message) {
  const el = document.getElementById('admin-feedback');
  if (!el) return;
  el.textContent = message;
  el.className = 'mb-4 p-3 rounded-xl text-sm bg-red-50 border border-red-200 text-red-700';
  el.classList.remove('hidden');
}

function showAdminSuccess(message) {
  const el = document.getElementById('admin-feedback');
  if (!el) return;
  el.textContent = message;
  el.className = 'mb-4 p-3 rounded-xl text-sm bg-success-light border border-success/30 text-success-dark';
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 4000);
}

function clearAdminError() {
  document.getElementById('admin-feedback')?.classList.add('hidden');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
