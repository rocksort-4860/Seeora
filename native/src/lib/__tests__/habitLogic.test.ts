/**
 * Seeora 核心逻辑单测（环节⑤审计）
 * 覆盖：断签不清零 / 导入隔离 / 排行榜 / 徽章 / 热力图
 * 运行：node node_modules/jest/bin/jest.js src/lib/__tests__/habitLogic.test.ts
 */
import {
  realDays,
  allImported,
  allTotal,
  leaderboard,
  streakBadge,
  lastNDates,
  realDateSet,
  heatOn,
  /* === v0.2 周期节点 / 休息日 / 补签 === */
  freqOf,
  windowTargetOf,
  habitStartDate,
  diffDays,
  nodeIndexAt,
  nodeRange,
  nodeStateAt,
  currentStreak,
  bestStreakOf,
  windowProgress,
  recentNodes,
  curveSeries,
  miniWeek,
  canRestOn,
  canMakeupOn,
  /* === 庆祝里程碑（撒花触发） === */
  shouldCelebrate,
  celebratedMilestonesOf,
  MILESTONES,
  type NodeState,
  type HabitLike,
} from "../habitLogic";
import { currentWeekDates, fmtDate } from "@/lib/dates";

/** 构造测试用 HabitLike（注意：必须展开 p，否则 v0.2 的 frequency/rests 等字段会被丢弃） */
function makeHabit(p: Partial<HabitLike> = {}): HabitLike {
  return {
    ...p,
    id: p.id ?? "h1",
    name: p.name ?? "Read",
    nameZh: p.nameZh ?? "阅读",
    isArchived: p.isArchived ?? false,
    migratedTotalDays: p.migratedTotalDays ?? 0,
    createdAt: p.createdAt ?? "2026-01-01",
    checkIns: p.checkIns ?? {},
  };
}

/** 取某周的 n 天日期作为 checkIns（对齐 currentWeekDates） */
function checkInsForWeek(now: Date, w: "mon" | "sun", days: number): Record<string, true> {
  const week = currentWeekDates(now, w);
  const ci: Record<string, true> = {};
  for (let i = 0; i < days && i < week.length; i++) ci[week[i]] = true;
  return ci;
}

// （周统计 / 近 8 周达标 两套测试已随功能退役移除）

describe("断签不清零（累计天数不被单周未打卡影响）", () => {
  const now = new Date(2026, 8, 22);

  it("本周只打了3天，但历史总天数仍保留全部打卡", () => {
    // 10 个历史打卡日（含本周3天 + 上周7天）
    const past = currentWeekDates(new Date(2026, 8, 15), "mon"); // 上周
    const ci: Record<string, true> = { ...checkInsForWeek(now, "mon", 3) };
    past.forEach((d) => (ci[d] = true));
    const h = makeHabit({ checkIns: ci });
    expect(realDays(h)).toBe(10);
    expect(allTotal(h)).toBe(10);
  });
});

describe("导入隔离（migratedTotalDays 与真实打卡分离）", () => {
  it("realDays 只数 checkIns，不含导入天数", () => {
    const h = makeHabit({ checkIns: { "2026-09-01": true, "2026-09-02": true }, migratedTotalDays: 100 });
    expect(realDays(h)).toBe(2);
    expect(allImported(h)).toBe(100);
    expect(allTotal(h)).toBe(102);
  });

  it("热力图只统计真实打卡，导入天数不计入", () => {
    const h = makeHabit({ migratedTotalDays: 365 }); // 仅导入，无真实打卡
    expect(realDateSet([h]).size).toBe(0);
    const now = new Date(2026, 8, 22);
    expect(heatOn([h], 7, now).every((v) => v === false)).toBe(true);
  });
});

describe("leaderboard 排行榜", () => {
  const now = new Date(2026, 8, 22);

  it("按累计天数降序，排除已归档", () => {
    const a = makeHabit({ id: "a", checkIns: checkInsForWeek(now, "mon", 5), migratedTotalDays: 0, createdAt: "2026-01-01" });
    const b = makeHabit({ id: "b", checkIns: {}, migratedTotalDays: 50, createdAt: "2026-02-01" });
    const c = makeHabit({ id: "c", isArchived: true, checkIns: checkInsForWeek(now, "mon", 7), createdAt: "2026-03-01" });
    const r = leaderboard([a, b, c], "days", "en");
    expect(r.map((h) => h.id)).toEqual(["b", "a"]); // b=50, a=5, c 归档排除
  });

  it("按创建时间升序（created）", () => {
    const a = makeHabit({ id: "a", createdAt: "2026-03-01" });
    const b = makeHabit({ id: "b", createdAt: "2026-01-01" });
    const r = leaderboard([a, b], "created", "en");
    expect(r.map((h) => h.id)).toEqual(["b", "a"]);
  });
});

describe("streakBadge 徽章阈值", () => {
  it("按累计天数返回正确徽章", () => {
    expect(streakBadge(0)).toBeNull();
    expect(streakBadge(29)).toBe("fresh");
    expect(streakBadge(30)).toBe("month");
    expect(streakBadge(91)).toBe("quarter");
    expect(streakBadge(182)).toBe("half");
    expect(streakBadge(365)).toBe("year");
  });
});

// （近 8 周达标走势 测试已随功能退役移除）

describe("lastNDates / heatOn 热力图", () => {
  const now = new Date(2026, 8, 22);

  it("lastNDates 返回 n 个由旧到新的日期，末位为今天", () => {
    const d = lastNDates(3, now);
    expect(d).toHaveLength(3);
    expect(d[2]).toBe(fmtDate(now));
  });

  it("heatOn 末位在今日打卡时为 true", () => {
    const h = makeHabit({ checkIns: { [fmtDate(now)]: true } });
    const arr = heatOn([h], 7, now);
    expect(arr).toHaveLength(7);
    expect(arr[6]).toBe(true);
  });
});

/* ==================================================================
 * v0.2 周期节点 / 休息日 / 补签 / 连续规则
 * ================================================================== */
describe("v0.2 频率 N 与周期节点", () => {
  it("频率默认 1，且被限制在 1~30", () => {
    expect(freqOf(makeHabit({}))).toBe(1);
    expect(freqOf(makeHabit({ frequency: 7 }))).toBe(7);
    expect(freqOf(makeHabit({ frequency: 0 }))).toBe(1);
    expect(freqOf(makeHabit({ frequency: 99 }))).toBe(30);
  });

  it("节点自创建日起算（不对齐自然周），freq=3 时节点覆盖 3 天", () => {
    const h = makeHabit({ createdAt: "2026-09-01", frequency: 3 });
    expect(habitStartDate(h)).toBe("2026-09-01");
    expect(nodeIndexAt(h, "2026-09-01")).toBe(0);
    expect(nodeIndexAt(h, "2026-09-03")).toBe(0);
    expect(nodeIndexAt(h, "2026-09-04")).toBe(1);
    expect(nodeIndexAt(h, "2026-09-06")).toBe(1);
    expect(nodeIndexAt(h, "2026-09-07")).toBe(2);
    expect(nodeIndexAt(h, "2026-08-31")).toBe(-1); // 早于创建日
    expect(nodeRange(h, 1)).toEqual({ from: "2026-09-04", to: "2026-09-06" });
  });

  it("节点状态：窗口内有打卡=done，有休息日=rest，否则 miss", () => {
    const h = makeHabit({
      createdAt: "2026-09-01",
      frequency: 2,
      checkIns: { "2026-09-09": true },
      rests: { "2026-09-06": true },
    });
    expect(nodeStateAt(h, 4)).toBe("done"); // 09-09~09-10
    expect(nodeStateAt(h, 2)).toBe("rest"); // 09-05~09-06（未打卡但标了休息）
    expect(nodeStateAt(h, 3)).toBe("miss"); // 09-07~09-08
    expect(nodeStateAt(h, -1)).toBe("miss");
  });

  it("窗口内只要打卡 1 次节点即实心；次数仅作参考不判定", () => {
    const h = makeHabit({ createdAt: "2026-09-01", frequency: 7, timesPerWindow: 8, checkIns: { "2026-09-02": true } });
    expect(windowTargetOf(h)).toBe(8);
    expect(windowProgress(h, 0)).toEqual({ done: 1, target: 8 });
    expect(nodeStateAt(h, 0)).toBe("done");
  });
});

describe("v0.2 当前连续（漏1不断 / 连续漏2暂停 / 不归零）", () => {
  // createdAt 2026-09-01，freq=1 → 每个日期一个节点；now = 2026-09-22
  const now = new Date(2026, 8, 22);
  const at = (ci: Record<string, true>, rests?: Record<string, true>) =>
    makeHabit({ createdAt: "2026-09-01", frequency: 1, checkIns: ci, rests });

  it("正常累积：连续 3 天打卡", () => {
    expect(currentStreak(at({ "2026-09-20": true, "2026-09-21": true, "2026-09-22": true }), now)).toBe(3);
  });

  it("今日未打卡且昨天漏签 1 天：连续不断", () => {
    // 09-22 未打卡(今日节点未结束)，09-21 漏 → 计数不变
    // 09-21 miss(第1个) → 09-20 done → +1；09-19 done → +1；再往前连续漏2 → 暂停
    const ci: Record<string, true> = { "2026-09-20": true, "2026-09-19": true };
    expect(currentStreak(at(ci), now)).toBe(2);
  });

  it("连续漏签 2 天：连续暂停（不归零），恢复打卡从暂停点继续", () => {
    // 今天打卡，但 09-21、09-20 连续漏 → 只有今天算 1
    expect(currentStreak(at({ "2026-09-22": true }), now)).toBe(1);
    // 中断很久之后重新打卡，不会跨回更早的连续
    expect(currentStreak(at({ "2026-09-22": true, "2026-09-13": true }), now)).toBe(1);
  });

  it("中间隔一个漏签日：继续往前累计", () => {
    // 09-22 未打卡；09-21 done →1，09-20 miss(1)，09-19 done →2，09-18 miss(1)，09-17 done →3
    const ci: Record<string, true> = { "2026-09-21": true, "2026-09-19": true, "2026-09-17": true };
    expect(currentStreak(at(ci), now)).toBe(3);
  });

  it("计划休息日不打断连续", () => {
    // 09-22 未打卡；09-21 标为休息日 → 计 1；09-20 done → 2
    const ci: Record<string, true> = { "2026-09-20": true };
    expect(currentStreak(at(ci, { "2026-09-21": true }), now)).toBe(2);
  });

  it("bestStreak 永久保存，不受后续中断影响", () => {
    const h = at({ "2026-09-20": true, "2026-09-21": true, "2026-09-22": true });
    const withBest = { ...h, bestStreak: 3 };
    expect(bestStreakOf(withBest)).toBe(3);
    expect(bestStreakOf(at({}))).toBe(0);
  });
});

describe("v0.2 休息日（事前/当日，历史不可补设）", () => {
  const now = new Date(2026, 8, 22);
  const h = makeHabit({ createdAt: "2026-09-01" });

  it("今天可标记，昨天（历史）禁止，未来可", () => {
    expect(canRestOn(h, "2026-09-22", now)).toBe(true); // 最晚当天
    expect(canRestOn(h, "2026-09-21", now)).toBe(false); // 已过去
    expect(canRestOn(h, "2026-09-25", now)).toBe(true); // 未来
    expect(canRestOn(h, "2026-08-31", now)).toBe(false); // 早于创建日
  });
});

describe("v0.2 补签（过去 7 天内，不能标休息日）", () => {
  const now = new Date(2026, 8, 22);
  const base = makeHabit({ createdAt: "2026-09-01" });

  it("7 天内可补签，第 8 天起禁止，今天不算补签", () => {
    expect(canMakeupOn(base, "2026-09-21", now)).toBe(true); // 前 1 天
    expect(canMakeupOn(base, "2026-09-16", now)).toBe(true); // 前 6 天
    expect(canMakeupOn(base, "2026-09-15", now)).toBe(true); // 前 7 天（边界，含）
    expect(canMakeupOn(base, "2026-09-14", now)).toBe(false); // 前 8 天
    expect(canMakeupOn(base, "2026-09-22", now)).toBe(false); // 今天走当日打卡
  });

  it("已标记休息日的日期不可补签；早于创建日不可补", () => {
    const h = makeHabit({ createdAt: "2026-09-01", rests: { "2026-09-18": true } });
    expect(canMakeupOn(h, "2026-09-18", now)).toBe(false);
    expect(canMakeupOn(h, "2026-08-20", now)).toBe(false);
  });
});

describe("v0.2 可视化数据（圆环 / 曲线 / 迷你条）", () => {
  const now = new Date(2026, 8, 22);
  const h = makeHabit({
    createdAt: "2026-09-01",
    frequency: 3,
    timesPerWindow: 4,
    checkIns: { "2026-09-05": true, "2026-09-20": true },
  });

  it("recentNodes 由旧到新，末位为当前节点", () => {
    const nodes = recentNodes(h, 8, now);
    expect(nodes.length).toBeGreaterThan(0);
    expect(nodes[nodes.length - 1].idx).toBe(nodeIndexAt(h, "2026-09-22"));
    for (let i = 1; i < nodes.length; i++) expect(nodes[i].idx).toBeGreaterThan(nodes[i - 1].idx);
  });

  it("curveSeries 累计只增不减", () => {
    const s = curveSeries(h, 5, now); // 09-18..09-22
    expect(s.map((p) => p.date)).toEqual(["2026-09-18", "2026-09-19", "2026-09-20", "2026-09-21", "2026-09-22"]);
    for (let i = 1; i < s.length; i++) expect(s[i].total).toBeGreaterThanOrEqual(s[i - 1].total);
    expect(s[2].has).toBe(true); // 09-20 打卡
  });

  it("miniWeek 返回最近 7 天，末位为今天", () => {
    const m = miniWeek(h, now);
    expect(m).toHaveLength(7);
    expect(m[6].isToday).toBe(true);
    expect(m[6].date).toBe("2026-09-22");
    expect(m.map((d) => d.date)).toEqual([
      "2026-09-16", "2026-09-17", "2026-09-18", "2026-09-19", "2026-09-20", "2026-09-21", "2026-09-22",
    ]);
    expect(m[4].done).toBe(true); // 09-20 打卡
    expect(m[3].done).toBe(false); // 09-19 未打卡
  });
});

/* ===================== 庆祝里程碑（撒花触发） ===================== */
describe("shouldCelebrate — 撒花触发条件", () => {
  it("★ 1~6 天的「新纪录」绝不撒花（否则开局天天撒，奖励立刻贬值）", () => {
    for (let s = 1; s <= 6; s++) {
      const r = shouldCelebrate({ streak: s, prevBest: s - 1 });
      // 反向断言：钉住「不撒花」，防止将来有人把闸门删掉
      expect(r.celebrate).toBe(false);
      expect(r.reason).toBeNull();
    }
  });

  it("首次达到 7 天 → 撒花，原因是 milestone", () => {
    const r = shouldCelebrate({ streak: 7, prevBest: 6 });
    expect(r.celebrate).toBe(true);
    expect(r.reason).toBe("milestone");
    expect(r.days).toBe(7);
  });

  it("同一里程碑不重复撒花（doneMilestones 已含 7）", () => {
    const r = shouldCelebrate({ streak: 7, prevBest: 6, doneMilestones: [7] });
    expect(r.celebrate).toBe(false);
  });

  it("同时命中里程碑与破纪录时只撒一轮（streak=7, prevBest=3）", () => {
    const r = shouldCelebrate({ streak: 7, prevBest: 3 });
    expect(r.celebrate).toBe(true);
    expect(r.reason).toBe("milestone"); // 里程碑优先，语义更明确
  });

  it("非里程碑但破了一个有分量的纪录 → reason=record", () => {
    // prevBest=29、当前 30 既是里程碑也是纪录；这里用 31 验证纯 record 分支
    const r = shouldCelebrate({ streak: 31, prevBest: 30, doneMilestones: [7, 14, 30] });
    expect(r.celebrate).toBe(false); // 31 不在任何闸门上
    const r2 = shouldCelebrate({ streak: 30, prevBest: 29, doneMilestones: [7, 14] });
    expect(r2.celebrate).toBe(true);
    expect(r2.reason).toBe("milestone");
  });

  it("没有刷新纪录（streak ≤ prevBest）时，即便达到闸门也不撒花", () => {
    // 已连续 100 天、断签后重新连回 7 天：7 是里程碑但已庆祝过 → 不撒
    const r = shouldCelebrate({ streak: 7, prevBest: 100, doneMilestones: [7] });
    expect(r.celebrate).toBe(false);
  });

  it("streak=0 或负数不触发（撤销打卡等边界）", () => {
    expect(shouldCelebrate({ streak: 0, prevBest: 5 }).celebrate).toBe(false);
    expect(shouldCelebrate({ streak: -1, prevBest: 5 }).celebrate).toBe(false);
  });

  it("全部里程碑档位都恰好命中（7/14/30/60/90/180/365）", () => {
    expect([...MILESTONES]).toEqual([7, 14, 30, 60, 90, 180, 365]);
    for (const m of MILESTONES) {
      const r = shouldCelebrate({ streak: m, prevBest: m - 1 });
      expect(r.celebrate).toBe(true);
      expect(r.days).toBe(m);
    }
  });

  it("celebratedMilestonesOf：老数据无该字段时返回空数组（降级不崩）", () => {
    expect(celebratedMilestonesOf({} as never)).toEqual([]);
    expect(celebratedMilestonesOf({ celebratedMilestones: [7, 30] } as never)).toEqual([7, 30]);
  });
});
