/**
 * 习惯逻辑纯函数（Seeora）：断签不清零 / 导入隔离 / 排行榜 / 徽章 / 热力图
 * 不依赖任何 React / Native 模块，可单测（node 环境）
 * 复用 @/lib/dates 的 currentWeekDates / countWeek / parseDate / fmtDate
 */
import { currentWeekDates, fmtDate, parseDate, type WeekStartOn } from "@/lib/dates";

/** 习惯的结构化最小接口（store 的 Habit 与之兼容，避免循环依赖） */
export interface HabitLike {
  id: string;
  name: string;
  nameZh: string;
  isArchived: boolean;
  migratedTotalDays: number;
  createdAt: string;
  checkIns: Record<string, true>;
  /* === v0.2 新增（全部可选，老数据降级兼容） === */
  /** 频率 N：一个圆环节点代表 N 天（1~30，默认 1） */
  frequency?: number;
  /** 次数：一个周期窗口内的目标打卡次数（1~20，默认 1）；圆点实心只要求 ≥1 次 */
  timesPerWindow?: number;
  /** 计划休息日（YYYY-MM-DD -> true）；只能事前/当日标记 */
  rests?: Record<string, true>;
  /** 历史最长连续（永久保存，永不消失） */
  bestStreak?: number;
  /** 已撒花庆祝过的里程碑（避免同档位反复触发）；老数据无此字段 → 视为空 */
  celebratedMilestones?: number[];
}

/* ===================== 累计 / 导入 ===================== */

/** Seeora 内真实打卡天数（仅 checkIns，不含导入） */
export function realDays(h: HabitLike): number {
  return Object.keys(h.checkIns).length;
}

/** 导入天数（来自其它 App 的迁移天数） */
export function allImported(h: HabitLike): number {
  return h.migratedTotalDays || 0;
}

/** 累计 = 真实打卡 + 导入天数（断签不清零：历史总天数不被单日未打卡影响） */
export function allTotal(h: HabitLike): number {
  return realDays(h) + allImported(h);
}

/* ===================== 排行榜 ===================== */

export type LeaderSort = "days" | "name" | "created";

/** 所有未归档习惯按指定维度排序 */
export function leaderboard(habits: HabitLike[], sort: LeaderSort, lang: "zh" | "en" = "en"): HabitLike[] {
  const arr = habits.filter((h) => !h.isArchived).slice();
  if (sort === "days") {
    arr.sort((a, b) => allTotal(b) - allTotal(a) || (a.createdAt < b.createdAt ? -1 : 1));
  } else if (sort === "name") {
    const nameOf = (h: HabitLike) => (lang === "zh" ? h.nameZh : h.name) || h.name;
    arr.sort((a, b) => nameOf(a).localeCompare(nameOf(b)));
  } else {
    arr.sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
  }
  return arr;
}

/* ===================== 时间段徽章 ===================== */

export type Badge = "year" | "half" | "quarter" | "month" | "fresh";

/** 按累计坚持天数返回时间段徽章（≥365 年 / ≥182 半年 / ≥91 三月 / ≥30 一月 / 其余「1 月内」） */
export function streakBadge(totalDays: number): Badge | null {
  if (totalDays <= 0) return null;
  if (totalDays >= 365) return "year";
  if (totalDays >= 182) return "half";
  if (totalDays >= 91) return "quarter";
  if (totalDays >= 30) return "month";
  return "fresh";
}

/* ===================== 热力图 ===================== */

/** 最近 n 天（默认 119 ≈ 17 周）的日期序列（由旧到新） */
export function lastNDates(n: number, now: Date = new Date()): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    out.push(fmtDate(d));
  }
  return out;
}

/** 合并所有习惯的真实打卡日期（导入天数不计入热力图） */
export function realDateSet(habits: HabitLike[]): Set<string> {
  const s = new Set<string>();
  for (const h of habits) for (const k of Object.keys(h.checkIns)) s.add(k);
  return s;
}

/** 返回最近 n 天每天是否打卡（由旧到新） */
export function heatOn(habits: HabitLike[], n = 119, now: Date = new Date()): boolean[] {
  const set = realDateSet(habits);
  return lastNDates(n, now).map((d) => set.has(d));
}

/* ==================================================================
 * ===================== v0.2：周期节点 / 休息日 / 补签 =====================
 * 规则来源：《Seeora 产品设计文档 v0.2》
 *   3.1 休息日（事前/当日，历史不可补设，可覆盖为打卡）
 *   3.2 补签（过去 7 天内，只能生成打卡，不可标休息日）
 *   3.3 连续（漏 1 不断；连续漏 2 暂停但不归零；恢复从暂停点继续）
 *   4.   频率 N / 窗口次数（节点实心只看窗口内是否至少打卡 1 次）
 *   5.1~5.3 螺旋圆环 / 横向累计曲线 / 最近 7 天迷你条
 * ==================================================================
 */

/** 补签时间窗（天）：过去 7 天内自由补签/取消，超过 7 天禁止 */
export const MAKEUP_WINDOW_DAYS = 7;

/**
 * 习惯起始日 YYYY-MM-DD（createdAt 的「本地」日期部分）
 *
 * 修复（上架复核 C-04 变体）：createdAt 统一为 `new Date().toISOString()`（UTC），
 * 东八区在 00:00–07:59 创建的习惯，若按 UTC 取前 10 字符会把起始日记成前一天，
 * 导致「习惯第 1 天 / 已坚持天数」整体偏一天且不可回溯。
 *
 * 两条分支必须分开：
 *   1) 纯 "YYYY-MM-DD" 串（老数据 / 经导入的 migratedStartDate）：直接切字符串。
 *      绝不可走 new Date() —— ES5+ 对纯日期串按 **UTC 午夜** 解析，fmtDate 转本地后会倒退一天（同样的坑）。
 *   2) 带时区 / 时间的 ISO 串：交给 new Date() 转本地，再用 fmtDate 取本地日期部分。
 */
export function habitStartDate(h: HabitLike, now: Date = new Date()): string {
  const raw = String(h.createdAt ?? "");
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const d = new Date(raw);
  if (!Number.isNaN(d.getTime())) return fmtDate(d);
  return fmtDate(now);
}

function shiftDate(iso: string, days: number): string {
  const p = parseDate(iso);
  if (!p) return iso;
  p.setDate(p.getDate() + days);
  return fmtDate(p);
}

/** 两个 YYYY-MM-DD 之间相差的天数（to - from） */
export function diffDays(from: string, to: string): number {
  const a = new Date(`${from}T00:00:00`).getTime();
  const b = new Date(`${to}T00:00:00`).getTime();
  return Math.round((b - a) / 86400000);
}

function eachDateInRange(from: string, to: string): string[] {
  const out: string[] = [];
  let cur = from;
  let guard = 0;
  while (cur <= to && guard++ < 400) {
    out.push(cur);
    cur = shiftDate(cur, 1);
  }
  return out;
}

/** 频率 N（1~30，默认 1） */
export function freqOf(h: HabitLike): number {
  const n = Math.round(h.frequency ?? 0);
  if (!n || n < 1) return 1;
  return Math.min(30, n);
}

/** 窗口目标次数（1~20，默认 1） */
export function windowTargetOf(h: HabitLike): number {
  const n = Math.round(h.timesPerWindow ?? 0);
  if (!n || n < 1) return 1;
  return Math.min(20, n);
}

/** 某日期属于第几个周期节点（自创建日起算，不对齐自然周；早于创建日返回 -1） */
export function nodeIndexAt(h: HabitLike, date: string): number {
  const start = habitStartDate(h);
  const d = diffDays(start, date);
  if (d < 0) return -1;
  return Math.floor(d / freqOf(h));
}

/** 第 idx 个节点覆盖的日期区间（闭区间） */
export function nodeRange(h: HabitLike, idx: number): { from: string; to: string } {
  const N = freqOf(h);
  const start = habitStartDate(h);
  return { from: shiftDate(start, idx * N), to: shiftDate(start, (idx + 1) * N - 1) };
}

/** 节点状态：done=窗口内已打卡 / rest=计划休息日 / miss=普通漏签 */
export type NodeState = "done" | "rest" | "miss";

export function nodeStateAt(h: HabitLike, idx: number): NodeState {
  if (idx < 0) return "miss";
  const { from, to } = nodeRange(h, idx);
  for (const d of eachDateInRange(from, to)) if (h.checkIns[d]) return "done";
  const rests = h.rests || {};
  for (const d of eachDateInRange(from, to)) if (rests[d]) return "rest";
  return "miss";
}

/**
 * 当前连续（周期数）。规则：
 *  - 今日节点已完成（打卡或休息）→ 先计 1
 *  - 向前遍历：完成 → +1；漏签第 1 天 → 计数不变（连续不断）；连续漏签第 2 天 → 暂停，直接停止
 *  - 恢复打卡后从暂停点继续计数（不归零）
 */
export function currentStreak(h: HabitLike, now: Date = new Date()): number {
  const today = fmtDate(now);
  const cur = nodeIndexAt(h, today);
  if (cur < 0) return 0;
  let streak = 0;
  const todayState = nodeStateAt(h, cur);
  if (todayState === "done" || todayState === "rest") streak = 1;
  let miss = 0;
  for (let i = cur - 1; i >= 0; i--) {
    const st = nodeStateAt(h, i);
    if (st === "done" || st === "rest") {
      miss = 0;
      streak += 1;
    } else {
      miss += 1;
      if (miss >= 2) break; // 连续漏签 2 → 暂停
    }
  }
  return streak;
}

/** 历史最长连续（永久保存，永不消失） */
export function bestStreakOf(h: HabitLike): number {
  return Math.max(0, Math.round(h.bestStreak ?? 0));
}

/* ===================== 庆祝里程碑（撒花触发条件） =====================
 * ★ 为什么需要这一层
 *   `newBest`（刷新历史最长连续）在**第 1 天就会为真**（streak=1 > best=0）——
 *   若直接拿它当撒花条件，用户前 10 天会天天看到彩纸，奖励迅速贬值，
 *   而且会挤掉「全部完成」那一刻的仪式感（撒花必须是稀缺资源）。
 *   所以拆成两条独立通道：
 *     1) 里程碑：跨过固定档位（7/14/30/60/90/180/365 天）—— 稀疏、明确、可预期。
 *     2) 破纪录：只在超越一个**已有分量**的纪录时庆祝（见 BEST_STREAK_GATES），
 *        1~6 天的「新纪录」不撒花，交给原有的文字提示（d.newBest）。
 */

/** 连续天数里程碑（天）。只在**首次跨过**时庆祝一次。 */
export const MILESTONES = [7, 14, 30, 60, 90, 180, 365] as const;

/**
 * 破纪录的「分量闸门」：只有当**刷新后的纪录**达到这些值之一才算值得庆祝。
 * 作用是过滤掉 1~6 天这段「每天都是新纪录」的蜜月期，避免开局就天天撒花。
 */
export const BEST_STREAK_GATES = [7, 14, 30, 60, 90, 180, 365] as const;

export type CelebrateReason = "milestone" | "record";

export interface CelebrateInput {
  /** 本次打卡后的当前连续天数 */
  streak: number;
  /** 本次打卡前的历史最长连续 */
  prevBest: number;
  /** 已经庆祝过的里程碑（避免同一年第 7 天反复撒花）；老数据缺失时视为空 */
  doneMilestones?: number[];
}

export interface CelebrateResult {
  /** 是否应当撒花 */
  celebrate: boolean;
  reason: CelebrateReason | null;
  /** 触发原因对应的天数（用于 UI 提示；无则为 0） */
  days: number;
}

/**
 * 判定本次打卡是否值得撒花。**纯函数，无副作用**，可直接单测。
 *
 * 判定口径（两条通道任一命中即撒花，同一次只撒一轮）：
 *   A. 里程碑：streak 恰好落在 MILESTONES 上，且不在 doneMilestones 里（首次达成）。
 *   B. 破纪录：streak > prevBest（真刷新了纪录）**且** streak 达到某个分量闸门
 *      ——「首次到 30 天」会同时命中 A 和 B，但只撒一次。
 *
 * @param doneMilestones 已庆祝过的里程碑数组；函数**不会**修改它，
 *        调用方需把返回的 days 追加进去后再持久化（见 useHabitActions.celebrateMilestone）。
 */
export function shouldCelebrate(input: CelebrateInput): CelebrateResult {
  const { streak, prevBest, doneMilestones } = input;
  if (streak <= 0) return { celebrate: false, reason: null, days: 0 };

  const done = doneMilestones ?? [];
  // ★ 该档位是否已经被庆祝过。两条通道都必须查它 ——
  //   漏查会让「连续到 7 天 → 断签 → 重新连回 7 天」再次撒花，
  //   而 7 天的里程碑对用户来说只值得庆祝一次。
  const alreadyDone = done.includes(streak);

  // 通道 A：首次跨过里程碑
  const isMilestone = (MILESTONES as readonly number[]).includes(streak);
  if (isMilestone && !alreadyDone) {
    return { celebrate: true, reason: "milestone", days: streak };
  }

  // 通道 B：刷新了有分量的历史纪录
  const beatRecord = streak > prevBest;
  const hitGate = (BEST_STREAK_GATES as readonly number[]).includes(streak);
  if (beatRecord && hitGate && !alreadyDone) {
    return { celebrate: true, reason: "record", days: streak };
  }

  return { celebrate: false, reason: null, days: 0 };
}

/** 把 HabitLike 读成「已庆祝里程碑」数组（老数据无此字段 → 空数组，降级不报错） */
export function celebratedMilestonesOf(h: HabitLike): number[] {
  return h.celebratedMilestones ?? [];
}

/** 窗口内已打卡次数与目标次数（节点旁显示如 3/8；实心只看 ≥1） */
export function windowProgress(h: HabitLike, idx: number): { done: number; target: number } {
  const { from, to } = nodeRange(h, idx);
  let done = 0;
  for (const d of eachDateInRange(from, to)) if (h.checkIns[d]) done += 1;
  return { done, target: windowTargetOf(h) };
}

export interface NodeView {
  idx: number;
  state: NodeState;
  from: string;
  to: string;
  progress: { done: number; target: number };
}

/** 螺旋圆环数据：由旧到新返回 count 个节点（当前节点必定是最后一个） */
export function recentNodes(h: HabitLike, count: number, now: Date = new Date()): NodeView[] {
  const today = fmtDate(now);
  const cur = Math.max(0, nodeIndexAt(h, today));
  const from = Math.max(0, cur - count + 1);
  const out: NodeView[] = [];
  for (let i = from; i <= cur; i++) {
    out.push({ idx: i, state: nodeStateAt(h, i), ...nodeRange(h, i), progress: windowProgress(h, i) });
  }
  return out;
}

export interface CurvePoint {
  date: string;
  total: number; // 累计打卡次数（只增不减）
  has: boolean; // 该日是否有打卡（用于点状虚线分段）
}

/** 横向时间流曲线：过去 days 天的累计打卡点数（由旧到新） */
export function curveSeries(h: HabitLike, days: number, now: Date = new Date()): CurvePoint[] {
  const imported = allImported(h);
  let cum = imported;
  return lastNDates(Math.max(1, days), now).map((d) => {
    if (h.checkIns[d]) cum += 1;
    return { date: d, total: cum, has: !!h.checkIns[d] };
  });
}

export interface MiniDay {
  date: string;
  done: boolean;
  rest: boolean;
  isToday: boolean;
}

/** 最近 7 天迷你圆点条（由旧到新，末位为今天） */
export function miniWeek(h: HabitLike, now: Date = new Date()): MiniDay[] {
  const today = fmtDate(now);
  const rests = h.rests || {};
  return lastNDates(7, now).map((d) => ({
    date: d,
    done: !!h.checkIns[d],
    rest: !!rests[d],
    isToday: d === today,
  }));
}

/** 该日期能否标记/取消休息日：只能未来或最晚当天（历史禁止） */
export function canRestOn(h: HabitLike, date: string, now: Date = new Date()): boolean {
  const today = fmtDate(now);
  if (diffDays(today, date) < 0) return false; // 早于今天
  if (diffDays(habitStartDate(h, now), date) < 0) return false; // 早于创建日
  return true;
}

/** 该日期能否补签：过去 1~7 天前，且未标记休息日，且在创建日之后 */
export function canMakeupOn(h: HabitLike, date: string, now: Date = new Date()): boolean {
  const today = fmtDate(now);
  // dist = 该日期距离今天多少天（今天为 0，昨天为 1 …）
  const dist = diffDays(date, today);
  if (dist < 1 || dist > MAKEUP_WINDOW_DAYS) return false;
  if ((h.rests || {})[date]) return false; // 休息日不需要补打卡
  if (diffDays(habitStartDate(h, now), date) < 0) return false;
  return true;
}

/** 给 store 用的字段迁移：老习惯补上 v0.2 默认值 */
export function normalizeHabit(h: HabitLike): HabitLike {
  return {
    ...h,
    frequency: freqOf(h),
    timesPerWindow: windowTargetOf(h),
    rests: h.rests || {},
    bestStreak: bestStreakOf(h),
  };
}
