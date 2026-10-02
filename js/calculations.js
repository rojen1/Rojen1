/**
 * Salary & turnover — брутна заплата + чист бонус (0.3% оборот ÷ 1.2), после нето × коефициент (≈0.773).
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

/** Брутен бонус преди ДДС: оборот × bonusRate (0.003 = 0.3%) */
export function calcBonusGross(turnover, bonusRate) {
  return Number(turnover) * Number(bonusRate);
}

/** Чист бонус след ДДС/данък върху бонуса (÷ 1.2) */
export function calcBonus(turnover, bonusRate, bonusVatDivisor = 1.2) {
  const divisor = Number(bonusVatDivisor);
  if (!Number.isFinite(divisor) || divisor <= 0) return calcBonusGross(turnover, bonusRate);
  return calcBonusGross(turnover, bonusRate) / divisor;
}

/** Брутна основа преди крайни удържания: заплата + чист бонус */
export function calcGrossBeforeNetDeductions(
  grossMonthlySalary,
  totalTurnover,
  bonusRate,
  bonusVatDivisor = 1.2
) {
  const cleanBonus = calcBonus(totalTurnover, bonusRate, bonusVatDivisor);
  return Number(grossMonthlySalary) + cleanBonus;
}

/** @param {number} grossMonthlySalary @param {number} totalTurnover @param {number} bonusRate @param {number} netCoefficient @param {number} [bonusVatDivisor] */
export function calcMonthlyNetPayout(
  grossMonthlySalary,
  totalTurnover,
  bonusRate,
  netCoefficient,
  bonusVatDivisor = 1.2
) {
  const gross = calcGrossBeforeNetDeductions(
    grossMonthlySalary,
    totalTurnover,
    bonusRate,
    bonusVatDivisor
  );
  return gross * Number(netCoefficient);
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
 * Days in month where the user has at least one delivery record.
 * @param {Record<string, import('./storage.js').DayRecord>} allDays
 * @param {number} year
 * @param {number} month 0-indexed
 */
export function countWorkedDaysInMonth(allDays, year, month) {
  return getMonthDayKeys(allDays || {}, year, month).filter(key => {
    const day = allDays[key];
    return (day?.deliveries?.length ?? 0) > 0;
  }).length;
}

/**
 * Дневна брутна част от месечната заплата (разпределена по дни с курс).
 * @param {number} grossMonthlySalary
 * @param {Record<string, import('./storage.js').DayRecord>} allDays
 * @param {number} year
 * @param {number} month 0-indexed
 * @param {{ dateKey?: string, deliveries?: import('./storage.js').Delivery[] }} [activeDay]
 */
export function calcGrossDailyPortion(grossMonthlySalary, allDays, year, month, activeDay) {
  const salary = Number(grossMonthlySalary);
  if (!Number.isFinite(salary) || salary <= 0) return 0;

  let workedDays = countWorkedDaysInMonth(allDays, year, month);
  const activeKey = activeDay?.dateKey;
  const activeDeliveries = activeDay?.deliveries;
  const activeHasRows = (activeDeliveries?.length ?? 0) > 0;

  if (activeKey && activeHasRows && isDateKeyInMonth(activeKey, year, month)) {
    const alreadyInData = (allDays?.[activeKey]?.deliveries?.length ?? 0) > 0;
    if (!alreadyInData) workedDays += 1;
  }

  if (workedDays <= 0) {
    if (!activeHasRows) return 0;
    workedDays = 1;
  }
  return salary / workedDays;
}

/** @param {import('./storage.js').Settings} settings */
export function getGrossMonthlySalary(settings) {
  return normalizeSettings(settings).grossMonthlySalary;
}

/** @deprecated alias */
export function getMonthlyNetSalary(settings) {
  return getGrossMonthlySalary(settings);
}

/**
 * @param {Partial<import('./storage.js').Settings>} raw
 * @returns {import('./storage.js').Settings}
 */
export function normalizeSettings(raw) {
  let grossMonthlySalary = raw?.grossMonthlySalary ?? raw?.monthlyNetSalary;

  if (grossMonthlySalary == null || !Number.isFinite(Number(grossMonthlySalary)) || Number(grossMonthlySalary) <= 0) {
    const legacyDaily = raw?.dailyAllowance;
    if (legacyDaily != null && Number(legacyDaily) > 0) {
      grossMonthlySalary = Math.round(Number(legacyDaily) * 22 * 100) / 100;
    } else {
      grossMonthlySalary = 940;
    }
  }

  let bonusRate = raw?.bonusRate;
  if (bonusRate == null || !Number.isFinite(Number(bonusRate))) {
    if (raw?.bonusPercent != null && Number.isFinite(Number(raw.bonusPercent))) {
      bonusRate = Number(raw.bonusPercent) / 100;
    } else {
      bonusRate = 0.003;
    }
  }

  let netCoefficient = raw?.netCoefficient;
  if (netCoefficient == null || !Number.isFinite(Number(netCoefficient)) || Number(netCoefficient) <= 0) {
    netCoefficient = 0.773;
  }

  let bonusVatDivisor = raw?.bonusVatDivisor;
  if (bonusVatDivisor == null || !Number.isFinite(Number(bonusVatDivisor)) || Number(bonusVatDivisor) <= 0) {
    bonusVatDivisor = 1.2;
  }

  return {
    grossMonthlySalary: Number(grossMonthlySalary),
    bonusRate: Number(bonusRate),
    netCoefficient: Number(netCoefficient),
    bonusVatDivisor: Number(bonusVatDivisor),
    regions: raw?.regions
  };
}

/** @param {import('./storage.js').Settings} settings @param {string} dateKey @param {Record<string, import('./storage.js').DayRecord>} [allDays] @param {import('./storage.js').Delivery[]} [deliveries] */
export function grossDailyPortionForDate(settings, dateKey, allDays, deliveries) {
  const key = dateKey || todayKey();
  const parsed = parseDateKey(key) || parseDateKey(todayKey());
  if (!parsed) return 0;
  const salary = getGrossMonthlySalary(settings);
  return calcGrossDailyPortion(salary, allDays || {}, parsed.year, parsed.month, {
    dateKey: key,
    deliveries
  });
}

/** @param {import('./storage.js').Delivery[]} deliveries */
/** @param {import('./storage.js').Settings} settings @param {string} [dateKey] @param {Record<string, import('./storage.js').DayRecord>} [allDays] */
export function calcDaySummary(deliveries, settings, dateKey, allDays) {
  const s = normalizeSettings(settings);
  const turnover = calcDailyTurnover(deliveries);
  const bonusGross = calcBonusGross(turnover, s.bonusRate);
  const bonus = calcBonus(turnover, s.bonusRate, s.bonusVatDivisor);
  const key = dateKey || todayKey();
  const allowance = grossDailyPortionForDate(s, key, allDays, deliveries);
  const grossTotal = allowance + bonus;
  const total = grossTotal * s.netCoefficient;

  return { turnover, bonusGross, bonus, allowance, grossTotal, total };
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
 * @param {import('./storage.js').Settings} settings
 */
export function calcMonthSummary(allDays, year, month, settings) {
  const s = normalizeSettings(settings);
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

    const summary = calcDaySummary(day.deliveries, settings, dateKey, allDays);
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

  const grossMonthlySalary = s.grossMonthlySalary;
  const workedDays = countWorkedDaysInMonth(allDays, year, month);
  const dailyRate = calcGrossDailyPortion(grossMonthlySalary, allDays, year, month);
  const totalGross = grossMonthlySalary + totalBonus;
  const finalPayout = calcMonthlyNetPayout(
    grossMonthlySalary,
    totalTurnover,
    s.bonusRate,
    s.netCoefficient,
    s.bonusVatDivisor
  );

  return {
    rows,
    totalTurnover,
    totalBonus,
    totalAllowance,
    totalDaily,
    totalGross,
    finalPayout,
    workedDays,
    dailyRate,
    grossMonthlySalary,
    bonusRate: s.bonusRate,
    netCoefficient: s.netCoefficient,
    bonusVatDivisor: s.bonusVatDivisor
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

/** @deprecated use calcGrossDailyPortion */
export function calcDailyAllowance(grossMonthlySalary, allDays, year, month, activeDay) {
  return calcGrossDailyPortion(grossMonthlySalary, allDays, year, month, activeDay);
}

/** @deprecated */
export function dailyAllowanceForDate(settings, dateKey, allDays, deliveries) {
  return grossDailyPortionForDate(settings, dateKey, allDays, deliveries);
}
