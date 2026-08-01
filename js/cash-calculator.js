import { formatEUR } from './calculations.js';

const STORAGE_KEY = 'rojen1_cash_calc';

/** @typedef {{ value: number, label: string }} CashDenomination */

/** @type {{ title: string, items: CashDenomination[] }[]} */
export const CASH_SECTIONS = [
  {
    title: 'Банкnotes',
    items: [
      { value: 500, label: '500 €' },
      { value: 200, label: '200 €' },
      { value: 100, label: '100 €' },
      { value: 50, label: '50 €' },
      { value: 20, label: '20 €' },
      { value: 10, label: '10 €' },
      { value: 5, label: '5 €' }
    ]
  },
  {
    title: 'Монети',
    items: [
      { value: 2, label: '2 €' },
      { value: 1, label: '1 €' },
      { value: 0.5, label: '50 ст' },
      { value: 0.2, label: '20 ст' },
      { value: 0.1, label: '10 ст' },
      { value: 0.05, label: '5 ст' },
      { value: 0.02, label: '2 ст' },
      { value: 0.01, label: '1 ст' }
    ]
  }
];

/** @type {CashDenomination[]} */
const ALL_DENOMINATIONS = CASH_SECTIONS.flatMap(section => section.items);

/** @type {(() => number) | null} */
let getExpectedCash = null;

/** @param {number} value */
function denomKey(value) {
  return String(value);
}

/** @param {number} value */
function inputId(value) {
  return `cash-count-${String(value).replace('.', '_')}`;
}

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
  return ALL_DENOMINATIONS.reduce((sum, item) => {
    const count = Number(counts[denomKey(item.value)] || 0);
    return sum + item.value * count;
  }, 0);
}

function renderRows() {
  const container = document.getElementById('cash-calc-rows');
  if (!container) return;

  const counts = loadCounts();

  container.innerHTML = CASH_SECTIONS.map(section => `
    <div class="cash-calc-section">
      <p class="cash-calc-section-title">${section.title}</p>
      <div class="space-y-2">
        ${section.items.map(item => {
          const key = denomKey(item.value);
          const count = Number(counts[key] || 0);
          const subtotal = item.value * count;
          const id = inputId(item.value);

          return `
            <div class="cash-calc-row">
              <label class="cash-calc-label" for="${id}">${item.label}</label>
              <input type="number" id="${id}" data-denom="${key}" min="0" step="1" inputmode="numeric"
                value="${count || ''}" placeholder="0"
                class="cash-calc-input">
              <span class="cash-calc-subtotal" data-subtotal="${key}">${formatEUR(subtotal)}</span>
            </div>`;
        }).join('')}
      </div>
    </div>
  `).join('');
}

function updateTotals() {
  /** @type {Record<string, number>} */
  const counts = {};
  let total = 0;

  for (const item of ALL_DENOMINATIONS) {
    const key = denomKey(item.value);
    const input = document.getElementById(inputId(item.value));
    const subtotalEl = document.querySelector(`[data-subtotal="${key}"]`);
    const count = Math.max(0, parseInt(input?.value || '0', 10) || 0);

    if (input && String(input.value) !== String(count)) {
      input.value = count ? String(count) : '';
    }

    counts[key] = count;
    const subtotal = item.value * count;
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
