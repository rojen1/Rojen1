import { loadData, updateSettings, DEFAULT_SETTINGS } from '../storage.js';
import { handleLogout } from '../auth.js';
import { setTheme, updateThemeButtonStates } from '../theme.js';

/** @type {() => void} */
let onSettingsSaved = () => {};

/** @param {{ onSaved: () => void }} options */
export function initSettingsView({ onSaved }) {
  onSettingsSaved = onSaved;

  document.getElementById('btn-settings')?.addEventListener('click', openModal);
  document.getElementById('btn-close-settings')?.addEventListener('click', closeModal);
  document.getElementById('modal-backdrop')?.addEventListener('click', closeModal);

  document.getElementById('form-settings')?.addEventListener('submit', handleSave);
  document.getElementById('btn-logout-settings')?.addEventListener('click', () => {
    closeModal();
    handleLogout();
  });

  document.getElementById('theme-light')?.addEventListener('click', () => setTheme('light'));
  document.getElementById('theme-dark')?.addEventListener('click', () => setTheme('dark'));
}

function openModal() {
  const data = loadData();
  document.getElementById('setting-bonus').value = data.settings.bonusPercent;
  document.getElementById('setting-allowance').value = data.settings.dailyAllowance;
  updateThemeButtonStates();

  document.getElementById('modal-settings').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  document.getElementById('modal-settings').classList.add('hidden');
  document.body.style.overflow = '';
}

async function handleSave(e) {
  e.preventDefault();

  const bonusPercent = parseFloat(document.getElementById('setting-bonus').value);
  const dailyAllowance = parseFloat(document.getElementById('setting-allowance').value);

  if ([bonusPercent, dailyAllowance].some(v => isNaN(v) || v < 0)) return;

  try {
    await updateSettings({ bonusPercent, dailyAllowance });
    closeModal();
    onSettingsSaved();
    showToast('Настройките са запазени');
  } catch (err) {
    showToast(err.message || 'Грешка при запис.');
  }
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

export { DEFAULT_SETTINGS };
