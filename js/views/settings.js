import { loadData, updateSettings, DEFAULT_SETTINGS } from '../storage.js';
import { handleLogout } from '../auth.js';
import { setTheme, updateThemeButtonStates } from '../theme.js';
import {
  calcMonthlyNetPayout,
  calcMonthSummary,
  normalizeSettings
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

  ['setting-gross-salary', 'setting-net-coef'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', updateSalaryPreview);
  });
}

function updateSalaryPreview() {
  const preview = document.getElementById('setting-daily-preview');
  if (!preview) return;
  const gross = parseFloat(document.getElementById('setting-gross-salary')?.value || '');
  const netCoef = parseFloat(document.getElementById('setting-net-coef')?.value || '');
  if (!Number.isFinite(gross) || gross <= 0) {
    preview.textContent = '';
    return;
  }
  const coef = Number.isFinite(netCoef) && netCoef > 0 ? netCoef : 0.773;
  const data = loadData();
  const now = new Date();
  const summary = calcMonthSummary(data.days, now.getFullYear(), now.getMonth(), {
    grossMonthlySalary: gross,
    bonusRate: 0.003,
    bonusVatDivisor: 1.2,
    netCoefficient: coef
  });
  const net = calcMonthlyNetPayout(gross, summary.totalTurnover, 0.003, coef, 1.2);
  const cleanBonus = summary.totalBonus;
  preview.textContent =
    `Този месец: (${gross.toFixed(0)} + ${cleanBonus.toFixed(2)} чист бонус) × ${coef} ≈ ${net.toFixed(2)} € нето`;
}

function openModal() {
  const data = loadData();
  const s = normalizeSettings(data.settings);
  document.getElementById('setting-gross-salary').value = s.grossMonthlySalary;
  document.getElementById('setting-net-coef').value = s.netCoefficient;
  updateSalaryPreview();
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

  const grossMonthlySalary = parseFloat(document.getElementById('setting-gross-salary').value);
  const netCoefficient = parseFloat(document.getElementById('setting-net-coef').value);

  if ([grossMonthlySalary, netCoefficient].some(v => isNaN(v) || v < 0)) return;
  if (grossMonthlySalary <= 0 || netCoefficient <= 0 || netCoefficient > 1) return;

  try {
    await updateSettings({
      grossMonthlySalary,
      bonusRate: 0.003,
      bonusVatDivisor: 1.2,
      netCoefficient
    });
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
