import { formatEUR } from './calculations.js';

const STORAGE_KEY = 'rojen1_cash_calc';

/** Euro banknotes for the cash counter. */
export const CASH_DENOMINATIONS = [500, 200, 100, 50, 20, 10, 5];

/** @type {(() => number) | null} */
let getExpectedCash = null;

/** @returns {Record<string, number>} */
function loadCounts() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

/** @param {Record<string, number>} counts */
function saveCounts(counts) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(counts));
}

/** @param {Record<string, number>} counts */
function calcTotal(counts) {
  return CASH_DENOMINATIONS.reduce((sum, value) => {
    const count = Number(counts[String(value)] || 0);
    return sum + value * count;
  }, 0);
}

function renderRows() {
  const container = document.getElementById('cash-calc-rows');
  if (!container) return;

  const counts = loadCounts();

  container.innerHTML = CASH_DENOMINATIONS.map(value => {
    const count = Number(counts[String(value)] || 0);
    const subtotal = value * count;

    return `
      <div class="cash-calc-row">
        <label class="cash-calc-label" for="cash-count-${value}">${value} €</label>
        <input type="number" id="cash-count-${value}" data-denom="${value}" min="0" step="1" inputmode="numeric"
          value="${count || ''}" placeholder="0"
          class="cash-calc-input">
        <span class="cash-calc-subtotal" data-subtotal="${value}">${formatEUR(subtotal)}</span>
      </div>`;
  }).join('');
}

function updateTotals() {
  /** @type {Record<string, number>} */
  const counts = {};
  let total = 0;

  for (const value of CASH_DENOMINATIONS) {
    const input = document.getElementById(`cash-count-${value}`);
    const subtotalEl = document.querySelector(`[data-subtotal="${value}"]`);
    const count = Math.max(0, parseInt(input?.value || '0', 10) || 0);

    if (input && String(input.value) !== String(count)) {
      input.value = count ? String(count) : '';
    }

    counts[String(value)] = count;
    const subtotal = value * count;
    total += subtotal;
    if (subtotalEl) subtotalEl.textContent = formatEUR(subtotal);
  }

  saveCounts(counts);

  const totalEl = document.getElementById('cash-calc-total');
  if (totalEl) totalEl.textContent = formatEUR(total);

  const expected = getExpectedCash?.() ?? 0;
  const compareEl = document.getElementById('cash-calc-compare');
  if (!compareEl) return;

  if (expected <= 0) {
    compareEl.classList.add('hidden');
    compareEl.textContent = '';
    return;
  }

  const diff = total - expected;
  compareEl.classList.remove('hidden');

  if (Math.abs(diff) < 0.01) {
    compareEl.className = 'cash-calc-compare cash-calc-compare--ok';
    compareEl.textContent = `Съвпада с „За отчитане“ (${formatEUR(expected)})`;
  } else if (diff > 0) {
    compareEl.className = 'cash-calc-compare cash-calc-compare--over';
    compareEl.textContent = `+${formatEUR(diff)} над „За отчитане“ (${formatEUR(expected)})`;
  } else {
    compareEl.className = 'cash-calc-compare cash-calc-compare--under';
    compareEl.textContent = `${formatEUR(Math.abs(diff))} под „За отчитане“ (${formatEUR(expected)})`;
  }
}

function handleInput() {
  updateTotals();
}

function clearCounts() {
  saveCounts({});
  renderRows();
  updateTotals();
}

export function openCashCalculator() {
  renderRows();
  updateTotals();
  document.getElementById('modal-cash-calc')?.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeCashCalculator() {
  document.getElementById('modal-cash-calc')?.classList.add('hidden');
  document.body.style.overflow = '';
}

/** @param {{ getExpectedCash?: () => number }} [options] */
export function initCashCalculator(options = {}) {
  getExpectedCash = options.getExpectedCash || null;

  document.getElementById('btn-open-cash-calc')?.addEventListener('click', openCashCalculator);
  document.getElementById('btn-open-cash-calc-alt')?.addEventListener('click', openCashCalculator);
  document.getElementById('btn-close-cash-calc')?.addEventListener('click', closeCashCalculator);
  document.getElementById('cash-calc-backdrop')?.addEventListener('click', closeCashCalculator);
  document.getElementById('btn-clear-cash-calc')?.addEventListener('click', clearCounts);
  document.getElementById('cash-calc-rows')?.addEventListener('input', handleInput);
}
