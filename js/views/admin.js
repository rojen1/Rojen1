import {
  createUserAccount,
  listAllAccounts,
  listLoginUsers,
  updateUserPassword,
  setUserDisabled,
  deleteUserAccount,
  ADMIN_USERNAME
} from '../accounts.js';

/** @type {string | null} */
let resetTargetUsername = null;

export function initAdminView() {
  document.getElementById('form-create-driver')?.addEventListener('submit', handleCreateUser);
  document.getElementById('btn-refresh-drivers')?.addEventListener('click', renderUserList);
  document.getElementById('admin-driver-list')?.addEventListener('click', handleUserAction);
  document.getElementById('form-reset-password')?.addEventListener('submit', handleResetPassword);
  document.getElementById('btn-close-reset')?.addEventListener('click', closeResetModal);
  document.getElementById('reset-backdrop')?.addEventListener('click', closeResetModal);
}

export function renderAdminView() {
  renderUserList();
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
