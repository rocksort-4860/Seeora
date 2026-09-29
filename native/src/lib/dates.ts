/**
 * 日期工具（Seeora）：全部使用本地时区，禁止 toISOString 直接当日期用
 * 复用 Seeora 范式，并新增周统计辅助（weekStart / currentWeekDates / countWeek）
 */

export const pad = (n: number): string => (n < 10 ? "0" + n : "" + n);

// 本地时区 YYYY-MM-DD
export function fmtDate(d: Date): string {
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
}

export function todayStr(): string {
  return fmtDate(new Date());
}

export function tomorrowStr(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return fmtDate(d);
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function parseDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return new Date(+m[1], +m[2] - 1, +m[3]);
}

export function isToday(s: string | null | undefined): boolean {
  return !!s && isSameDay(parseDate(s) as Date, new Date());
}

/* ===================== 周统计辅助（§3 数据模型 / §6 周归零） ===================== */

export type WeekStartOn = "mon" | "sun";

// 返回作为「每周第一天」的 JS getDay() 值：周一→1，周日→0
export function weekStartDow(w: WeekStartOn): number {
  return w === "mon" ? 1 : 0;
}

// 当前周的 7 个日期（周一或周日为首），返回 YYYY-MM-DD 数组
export function currentWeekDates(now: Date, w: WeekStartOn): string[] {
  const startDow = weekStartDow(w);
  const dow = now.getDay(); // 0..6
  const diff = (dow - startDow + 7) % 7; // 距本周首天的天数
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff);
  const out: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    out.push(fmtDate(d));
  }
  return out;
}

// 统计 checkIns 中落在「当前周」内的天数（断签不清零：只点本周）
export function countWeek(checkIns: Record<string, true>, w: WeekStartOn, now: Date = new Date()): number {
  const set = new Set(currentWeekDates(now, w));
  let n = 0;
  for (const k of Object.keys(checkIns)) if (set.has(k)) n++;
  return n;
}

// 连续打卡天数（今天已打卡计 1，从昨天回溯；断档即停，最多 366 天）
export function calcStreak(dates: string[]): number {
  if (!dates || !dates.length) return 0;
  const has = (s: string) => dates.indexOf(s) >= 0;
  const t = todayStr();
  let n = has(t) ? 1 : 0;
  for (let i = 1; i < 366; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    if (has(fmtDate(d))) n++;
    else break;
  }
  return n;
}
