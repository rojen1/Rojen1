/**
 * Salary & turnover calculations matching the spreadsheet model.
 */

/** @param {import('./storage.js').Delivery[]} deliveries */
export function getDeliveredDeliveries(deliveries) {
  return deliveries.filter(d => d.delivered);
}

/** Daily turnover = sum of delivered invoice amounts */
/** @param {import('./storage.js').Delivery[]} deliveries */
export function calcDailyTurnover(deliveries) {
  return getDeliveredDeliveries(deliveries).reduce((sum, d) => sum + d.amount, 0);
}

/** Commission bonus = turnover × (bonusPercent / 100) */
export function calcBonus(turnover, bonusPercent) {
  return turnover * (bonusPercent / 100);
}

/** Total for the day = bonus + daily allowance */
export function calcDailyTotal(bonus, dailyAllowance) {
  return bonus + dailyAllowance;
}

/** Mon–Fri in calendar month (0-indexed month). */
export function countWorkingDaysInMonth(year, month) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  let count = 0;
  for (let day = 1; day <= daysInMonth; day++) {
    const dow = new Date(year, month, day).getDay();
    if (dow >= 1 && dow <= 5) count++;
  }
  return count;
}

/** @param {string} dateKey YYYY-MM-DD */
export function parseDateKey(dateKey) {
  const parts = String(dateKey).split('-').map(Number);
  if (parts.length !== 3 || parts.some(n => Number.isNaN(n))) return null;
  return { year: parts[0], month: parts[1] - 1, day: parts[2] };
}

/**
 * Daily allowance = monthly net salary / working days in that calendar month.
 * @param {number} monthlyNetSalary
 * @param {number} year
 * @param {number} month 0-indexed
 */
export function calcDailyAllowance(monthlyNetSalary, year, month) {
  const salary = Number(monthlyNetSalary);
  if (!Number.isFinite(salary) || salary <= 0) return 0;
  const workDays = countWorkingDaysInMonth(year, month);
  if (workDays <= 0) return 0;
  return salary / workDays;
}

/** @param {import('./storage.js').Settings} settings */
export function getMonthlyNetSalary(settings) {
  const s = normalizeSettings(settings);
  return s.monthlyNetSalary;
}

/**
 * @param {Partial<import('./storage.js').Settings>} raw
 * @returns {import('./storage.js').Settings}
 */
export function normalizeSettings(raw) {
  const bonusPercent = raw?.bonusPercent ?? 0.25;
  let monthlyNetSalary = raw?.monthlyNetSalary;

  if (monthlyNetSalary == null || !Number.isFinite(Number(monthlyNetSalary)) || Number(monthlyNetSalary) <= 0) {
    const legacyDaily = raw?.dailyAllowance;
    if (legacyDaily != null && Number(legacyDaily) > 0) {
      // Старият фиксиран дневен надник ≈ месечна база / 22; провери в настройки след update.
      monthlyNetSalary = Math.round(Number(legacyDaily) * 22 * 100) / 100;
    } else {
      monthlyNetSalary = 931;
    }
  }

  return {
    bonusPercent: Number(bonusPercent),
    monthlyNetSalary: Number(monthlyNetSalary),
    regions: raw?.regions
  };
}

/** @param {import('./storage.js').Settings} settings @param {string} dateKey */
export function dailyAllowanceForDate(settings, dateKey) {
  const parsed = parseDateKey(dateKey) || parseDateKey(todayKey());
  if (!parsed) return 0;
  const salary = getMonthlyNetSalary(settings);
  return calcDailyAllowance(salary, parsed.year, parsed.month);
}

/** @param {import('./storage.js').Delivery[]} deliveries */
/** @param {import('./storage.js').Settings} settings @param {string} [dateKey] */
export function calcDaySummary(deliveries, settings, dateKey) {
  const turnover = calcDailyTurnover(deliveries);
  const bonus = calcBonus(turnover, settings.bonusPercent);
  const allowance = dailyAllowanceForDate(settings, dateKey || todayKey());
  const total = calcDailyTotal(bonus, allowance);

  return { turnover, bonus, allowance, total };
}

/** Cash collected in delivered stops marked as cash payment. */
/** @param {import('./storage.js').Delivery[]} deliveries */
export function calcCashSummary(deliveries) {
  const cash = deliveries.filter(d => d.isCash);
  const toReport = cash.filter(d => d.delivered);
  const pendingDelivery = cash.filter(d => !d.delivered);

  return {
    toReportAmount: toReport.reduce((sum, d) => sum + d.amount, 0),
    toReportCount: toReport.length,
    pendingAmount: pendingDelivery.reduce((sum, d) => sum + d.amount, 0),
    pendingCount: pendingDelivery.length,
    totalCashCount: cash.length,
    totalCashAmount: cash.reduce((sum, d) => sum + d.amount, 0)
  };
}

/** Sum of all invoice amounts (delivered or not) — for planned routes */
/** @param {import('./storage.js').Delivery[]} deliveries */
export function calcPlannedTurnover(deliveries) {
  return deliveries.reduce((sum, d) => sum + (d.amount || 0), 0);
}

/** @param {string} dateKey @param {number} year @param {number} month 0-indexed */
export function isDateKeyInMonth(dateKey, year, month) {
  const parts = String(dateKey).split('-').map(Number);
  if (parts.length !== 3 || parts.some(n => Number.isNaN(n))) return false;
  return parts[0] === year && parts[1] === month + 1;
}

/**
 * @param {Record<string, import('./storage.js').DayRecord>} allDays
 * @param {number} year
 * @param {number} month 0-indexed
 */
export function getMonthDayKeys(allDays, year, month) {
  return Object.keys(allDays)
    .filter(key => isDateKeyInMonth(key, year, month))
    .sort();
}

/**
 * Aggregate monthly stats from all day records in a given month.
 * @param {Record<string, import('./storage.js').DayRecord>} allDays
 * @param {number} year
 * @param {number} month 0-indexed
 * @param {{ bonusPercent: number, dailyAllowance: number }} settings
 */
export function calcMonthSummary(allDays, year, month, settings) {
  const rows = [];
  const today = todayKey();

  let totalTurnover = 0;
  let totalBonus = 0;
  let totalAllowance = 0;
  let totalDaily = 0;

  const sortedKeys = getMonthDayKeys(allDays, year, month);

  for (const dateKey of sortedKeys) {
    const day = allDays[dateKey];
    if (!day?.deliveries?.length) continue;

    const summary = calcDaySummary(day.deliveries, settings, dateKey);
    const plannedTurnover = calcPlannedTurnover(day.deliveries);
    const isFuture = dateKey > today;
    const isPlanned = isFuture || (summary.turnover === 0 && day.deliveries.some(d => !d.delivered));

    rows.push({
      dateKey,
      ...summary,
      plannedTurnover,
      isPlanned,
      stopCount: day.deliveries.length
    });

    if (!isFuture) {
      totalTurnover += summary.turnover;
      totalBonus += summary.bonus;
      totalAllowance += summary.allowance;
      totalDaily += summary.total;
    }
  }

  const workDays = countWorkingDaysInMonth(year, month);
  const monthlyNetSalary = getMonthlyNetSalary(settings);
  const dailyRate = calcDailyAllowance(monthlyNetSalary, year, month);

  return {
    rows,
    totalTurnover,
    totalBonus,
    totalAllowance,
    totalDaily,
    finalPayout: totalDaily,
    workDays,
    dailyRate,
    monthlyNetSalary
  };
}

/** Format currency in EUR with Bulgarian locale */
export function formatEUR(amount) {
  return new Intl.NumberFormat('bg-BG', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}

/** Today's date as YYYY-MM-DD */
export function todayKey() {
  const now = new Date();
  return formatDateKey(now);
}

/** Tomorrow's date as YYYY-MM-DD */
export function tomorrowKey() {
  const now = new Date();
  now.setDate(now.getDate() + 1);
  return formatDateKey(now);
}

/** @param {Date} date */
export function formatDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** @param {string} dateKey YYYY-MM-DD */
export function formatDisplayDate(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return new Intl.DateTimeFormat('bg-BG', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(date);
}

/** @param {number} year @param {number} month 0-indexed */
export function formatMonthLabel(year, month) {
  const date = new Date(year, month, 1);
  return new Intl.DateTimeFormat('bg-BG', {
    month: 'long',
    year: 'numeric'
  }).format(date);
}

/** @param {string} dateKey */
export function formatShortDate(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return new Intl.DateTimeFormat('bg-BG', {
    day: '2-digit',
    month: '2-digit'
  }).format(date);
}

/** @param {string} iso */
export function formatTime(iso) {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('bg-BG', {
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

/** @param {string} iso */
export function formatDateTime(iso) {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('bg-BG', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

export function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
