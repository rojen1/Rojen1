import { loadData, updateSettings, DEFAULT_SETTINGS } from '../storage.js';
import { handleLogout } from '../auth.js';
import { setTheme, updateThemeButtonStates } from '../theme.js';
import {
  calcDailyAllowance,
  countWorkedDaysInMonth,
  getMonthlyNetSalary
} from '../calculations.js';

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

  document.getElementById('setting-monthly-salary')?.addEventListener('input', updateDailyAllowancePreview);
}

function updateDailyAllowancePreview() {
  const preview = document.getElementById('setting-daily-preview');
  const input = document.getElementById('setting-monthly-salary');
  if (!preview || !input) return;
  const monthly = parseFloat(input.value);
  if (!Number.isFinite(monthly) || monthly <= 0) {
    preview.textContent = '';
    return;
  }
  const now = new Date();
  const data = loadData();
  const y = now.getFullYear();
  const m = now.getMonth();
  const wd = countWorkedDaysInMonth(data.days, y, m);
  const daily = calcDailyAllowance(monthly, data.days, y, m);
  const monthLabel = now.toLocaleDateString('bg-BG', { month: 'long', year: 'numeric' });
  if (wd <= 0) {
    preview.textContent =
      `За ${monthLabel}: надникът се смята след първи ден с въведен курс (заплата ÷ брой такива дни).`;
    return;
  }
  preview.textContent =
    `За ${monthLabel}: ${wd} дни с курс → дневен надник ${daily.toFixed(2)} €`;
}

function openModal() {
  const data = loadData();
  document.getElementById('setting-bonus').value = data.settings.bonusPercent;
  document.getElementById('setting-monthly-salary').value = getMonthlyNetSalary(data.settings);
  updateDailyAllowancePreview();
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
  const monthlyNetSalary = parseFloat(document.getElementById('setting-monthly-salary').value);

  if ([bonusPercent, monthlyNetSalary].some(v => isNaN(v) || v < 0)) return;
  if (monthlyNetSalary <= 0) return;

  try {
    await updateSettings({ bonusPercent, monthlyNetSalary });
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
