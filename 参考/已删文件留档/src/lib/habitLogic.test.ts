/**
 * habitLogic 单测（node 环境）：覆盖周统计 / 断签不清零 / 导入隔离 / 排行榜 / 徽章 / 近 8 周达标
 */
import { currentWeekDates } from "@/lib/dates";
import {
  allImported,
  allTotal,
  goalWeeks,
  heatOn,
  leaderboard,
  realDateSet,
  realDays,
  streakBadge,
  weekStats,
  type HabitLike,
} from "@/lib/habitLogic";

// 固定「现在」：2026-01-05（周一），保证周归零可确定
const NOW = new Date(2026, 0, 5);

function mk(over: Partial<HabitLike> = {}): HabitLike {
  return {
    id: "h1",
    name: "Run",
    nameZh: "跑步",
    isArchived: false,
    weeklyGoal: 5,
    migratedTotalDays: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    checkIns: {},
    ...over,
  };
}

describe("周统计 currentWeekDates", () => {
  it("周一为一周起始时首天是周一", () => {
    const w = currentWeekDates(NOW, "mon");
    expect(w).toHaveLength(7);
    expect(w[0]).toBe("2026-01-05"); // 周一
    expect(w[6]).toBe("2026-01-11"); // 周日
  });

  it("周日为一周起始时首天是周日", () => {
    const w = currentWeekDates(NOW, "sun");
    expect(w[0]).toBe("2026-01-04"); // 周日
    expect(w[6]).toBe("2026-01-10"); // 周六
  });

  it("周三的 now 也能正确归零到本周首天", () => {
    const wed = new Date(2026, 0, 7); // 周三
    expect(currentWeekDates(wed, "mon")[0]).toBe("2026-01-05");
    expect(currentWeekDates(wed, "sun")[0]).toBe("2026-01-04");
  });
});

describe("weekStats 达标判定", () => {
  it("done / met / remaining 正确", () => {
    const h = mk({ checkIns: { "2026-01-05": true, "2026-01-06": true, "2026-01-07": true } });
    const s = weekStats(h, "mon", NOW);
    expect(s.done).toBe(3);
    expect(s.met).toBe(false);
    expect(s.remaining).toBe(2);
  });

  it("达到 weeklyGoal 即达标", () => {
    const h = mk({
      checkIns: {
        "2026-01-05": true, "2026-01-06": true, "2026-01-07": true,
        "2026-01-08": true, "2026-01-09": true,
      },
    });
    const s = weekStats(h, "mon", NOW);
    expect(s.done).toBe(5);
    expect(s.met).toBe(true);
    expect(s.remaining).toBe(0);
  });

  it("上周打卡不计入本周 done（周归零）", () => {
    const h = mk({ checkIns: { "2026-01-02": true, "2026-01-03": true } }); // 上周（周日/周六）
    const s = weekStats(h, "mon", NOW);
    expect(s.done).toBe(0);
    expect(s.met).toBe(false);
  });
});

describe("断签不清零（累计不被单日未打卡影响）", () => {
  it("非连续打卡仍计入真实天数与累计", () => {
    const h = mk({ checkIns: { "2026-01-01": true, "2026-01-05": true, "2025-12-10": true } });
    expect(realDays(h)).toBe(3); // 3 个键，不论是否连续
    expect(allTotal(h)).toBe(3);
    const s = weekStats(h, "mon", NOW);
    expect(s.done).toBe(1); // 仅本周 1 天
    expect(allTotal(h)).toBe(3); // 累计不受本周 done 影响
  });

  it("累计 = 真实 + 导入，与周边界无关", () => {
    const h = mk({ migratedTotalDays: 40, checkIns: { "2026-01-05": true } });
    expect(realDays(h)).toBe(1);
    expect(allImported(h)).toBe(40);
    expect(allTotal(h)).toBe(41);
  });
});

describe("导入隔离（迁移天数不计入热力图 / 周统计）", () => {
  it("导入天数不出现在真实打卡日期集合中", () => {
    const real = mk({ id: "a", checkIns: { "2026-01-05": true } });
    const migrated = mk({ id: "b", migratedTotalDays: 100, checkIns: {} });
    const set = realDateSet([real, migrated]);
    expect(set.has("2026-01-05")).toBe(true);
    expect(set.size).toBe(1); // 导入不计入
  });

  it("heatOn 仅反映真实打卡，且长度正确", () => {
    const habits = [mk({ id: "a", checkIns: { "2026-01-05": true } }), mk({ id: "b", migratedTotalDays: 50 })];
    const heat = heatOn(habits, 10, NOW);
    expect(heat).toHaveLength(10);
    expect(heat[heat.length - 1]).toBe(true); // 最近一天 2026-01-05 打卡
    expect(heat.filter(Boolean).length).toBe(1);
  });
});

describe("排行榜排序", () => {
  const habits: HabitLike[] = [
    mk({ id: "a", name: "Run", nameZh: "跑步", createdAt: "2026-01-03", checkIns: {}, migratedTotalDays: 10 }),
    mk({ id: "b", name: "Read", nameZh: "阅读", createdAt: "2026-01-01", checkIns: { "2026-01-05": true }, migratedTotalDays: 50 }),
    mk({ id: "c", name: "Yoga", nameZh: "瑜伽", createdAt: "2026-01-02", checkIns: { "2026-01-05": true, "2026-01-06": true } }),
  ];

  it("按坚持天数降序", () => {
    const ids = leaderboard(habits, "days").map((h) => h.id);
    expect(ids).toEqual(["b", "c", "a"]); // 51 / 2 / 10
  });

  it("按名称升序（en）", () => {
    const ids = leaderboard(habits, "name", "en").map((h) => h.id);
    expect(ids).toEqual(["b", "c", "a"]); // Read / Yoga / Run
  });

  it("按创建时间升序", () => {
    const ids = leaderboard(habits, "created").map((h) => h.id);
    expect(ids).toEqual(["b", "c", "a"]); // 01-01 / 01-02 / 01-03
  });

  it("归档习惯不参与排行", () => {
    const archived = mk({ id: "x", isArchived: true, migratedTotalDays: 999 });
    const ids = leaderboard([...habits, archived], "days").map((h) => h.id);
    expect(ids).not.toContain("x");
  });
});

describe("时间段徽章阈值", () => {
  it("0 天无徽章", () => {
    expect(streakBadge(0)).toBeNull();
  });
  it("分段阈值正确", () => {
    expect(streakBadge(10)).toBe("fresh");
    expect(streakBadge(30)).toBe("month");
    expect(streakBadge(91)).toBe("quarter");
    expect(streakBadge(182)).toBe("half");
    expect(streakBadge(365)).toBe("year");
    expect(streakBadge(400)).toBe("year");
  });
});

describe("近 8 周达标走势", () => {
  it("返回 8 周且按时间升序", () => {
    const h = mk({ weeklyGoal: 5 });
    const g = goalWeeks(h, "mon", 8, NOW);
    expect(g).toHaveLength(8);
    expect(g[0].start <= g[7].start).toBe(true);
  });

  it("本周达标则 met=true", () => {
    const h = mk({
      weeklyGoal: 2,
      checkIns: { "2026-01-05": true, "2026-01-06": true },
    });
    const g = goalWeeks(h, "mon", 8, NOW);
    expect(g[g.length - 1].met).toBe(true); // 最近一周
    expect(g[g.length - 1].done).toBe(2);
  });

  it("达标归零重算：跨周不累计", () => {
    const h = mk({
      weeklyGoal: 5,
      checkIns: {
        "2025-12-29": true, "2025-12-30": true, "2025-12-31": true, "2026-01-01": true, "2026-01-02": true,
        "2026-01-05": true, "2026-01-06": true, // 本周仅 2 天
      },
    });
    const g = goalWeeks(h, "mon", 8, NOW);
    expect(g[g.length - 1].met).toBe(false); // 本周未达标
    expect(g[g.length - 1].done).toBe(2);
  });
});
