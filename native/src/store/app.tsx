/**
 * 全局数据层（Seeora）：纯本地，无账号、无后端、无云同步
 * React Context + useState 承载全部状态；每次变更后持久化 sd.local 快照
 * 拆为 app.tsx（Context + 状态 + 派生算法 + 装配）/ usePersist.ts / usePro.ts / useHabitActions.ts
 */
import React, {
  createContext, useCallback, useContext, useMemo, useRef, useState,
} from "react";
import { useColorScheme } from "react-native";
import { useRouter } from "expo-router";
import { sget, sset, SK } from "@/lib/storage";
import { fmt as fmtTpl, getDict, I18N, type Dict, type Lang } from "@/lib/i18n";
import { lightColors, darkColors, type Colors } from "@/lib/tokens";
import { todayStr } from "@/lib/dates";
import {
  allImported, allTotal, heatOn, leaderboard, realDateSet, streakBadge,
  currentStreak, bestStreakOf, recentNodes, curveSeries, miniWeek,
  canRestOn, canMakeupOn, nodeStateAt, nodeIndexAt, freqOf,
  type Badge, type HabitLike, type LeaderSort, type NodeView, type CurvePoint, type NodeState,
} from "@/lib/habitLogic";
import { setAppBadge } from "@/lib/notify";
import { useHydration, usePersist, type Snapshot } from "@/store/usePersist";
import { usePro } from "@/store/usePro";
import { useHabitActions } from "@/store/useHabitActions";

/* ===================== 类型（数据模型） ===================== */
export interface Habit {
  id: string;
  name: string;
  nameZh: string;
  emoji: string;
  color: string;
  createdAt: string;
  isArchived: boolean;
  reminderEnabled: boolean;
  reminderTime: string;
  migratedTotalDays: number;
  migratedCurrentStreak: number;
  migratedStartDate: string;
  migrationImportedAt: string;
  checkIns: Record<string, true>; // YYYY-MM-DD -> true
  detail: string;
  migratedSource: string;
  /* === v0.2（可选，老数据自动兼容；读取请用 habitLogic 的 freqOf / bestStreakOf 等兜底函数） === */
  /** 频率 N：一个圆环节点代表 N 天（1~30） */
  frequency?: number;
  /** 一个周期窗口内的目标打卡次数（1~20）；节点实心只看窗口内是否至少打卡 1 次 */
  timesPerWindow?: number;
  /** 计划休息日（YYYY-MM-DD -> true）；只能未来或当日标记 */
  rests?: Record<string, true>;
  /** 历史最长连续（永久保存，永不消失） */
  bestStreak?: number;
}

export interface Honor {
  id: string;
  title: string;
  titleZh: string;
  source: string;
  type: string;
  days: number;
  details: string;
  category: string;
}

export type ThemeMode = "system" | "light" | "dark";
export type WeekStartOn = "mon" | "sun";

export interface SettingsState {
  weekStartOn: WeekStartOn;
  haptics: boolean;
  icloudSync: boolean;
  badge: boolean;
  dailyReminder: boolean;
}

export interface HabitFormState {
  name: string; nameZh: string; detail: string; emoji: string; color: string;
  reminderEnabled: boolean; reminderTime: string;
  /** v0.2：频率 N（1~30，节点代表 N 天）与窗口次数（1~20） */
  frequency: number; timesPerWindow: number;
  migratedTotalDays: number; migratedCurrentStreak: number; migratedStartDate: string; migratedSource: string;
}
export interface HonorFormState {
  title: string; titleZh: string; source: string; days: number; details: string; category: string;
}

interface ToastMsg { msg: string; ok: boolean; nonce: number; }
export interface BurstReq { x?: number; y?: number; nonce: number; }

interface AppCtx {
  hydrated: boolean;
  lang: Lang;
  dict: Dict;
  t: (k: keyof Dict) => string;
  fmt: (s: string, o: Record<string, string | number>) => string;
  setLang: (l: Lang) => void;
  theme: ThemeMode;
  setTheme: (m: ThemeMode) => void;
  dark: boolean;
  colors: Colors;

  visited: boolean; installAt: string;
  enterApp: () => void; openOnboarding: () => void;

  habits: Habit[]; honors: Honor[]; settings: SettingsState;
  setWeekStartOn: (w: WeekStartOn) => void;
  setHaptics: (v: boolean) => void;
  setIcloudSync: (v: boolean) => void;
  setBadge: (v: boolean) => void;
  setDailyReminder: (v: boolean) => void;

  pro: boolean;            // 有效 Pro：买断 或 试用未到期
  purchased: boolean;      // 是否已买断终身版（原始凭证）
  trialActive: boolean;    // 是否处于 7 天试用窗口内
  trialDaysLeft: number;   // 试用剩余天数（0 = 已结束 / 未开始）
  openPro: () => void; closePro: () => void; openPay: () => void; closePay: () => void;
  payDone: () => Promise<void>; payRestore: () => Promise<void>; gatePro: (k: "dataExport" | "shareTitle") => boolean;
  payPlan: "l";

  habitFormVisible: boolean; editingHabitId: string | null; habitForm: HabitFormState;
  honorFormVisible: boolean; editingHonorId: string | null; honorForm: HonorFormState;
  backfillHabitId: string | null;
  proVisible: boolean; payVisible: boolean; shareVisible: boolean; exportVisible: boolean;
  confirmVisible: boolean; wipeVisible: boolean; celVisible: boolean;

  openHabitForm: (h: Habit | null) => void; closeHabitForm: () => void;
  setHabitForm: (f: Partial<HabitFormState>) => void; saveHabit: () => void;
  openHonorForm: (hr: Honor | null) => void; closeHonorForm: () => void;
  setHonorForm: (f: Partial<HonorFormState>) => void; saveHonor: () => void;
  openBackfill: (id: string) => void; closeBackfill: () => void;
  toggleBackfillDate: (id: string, date: string) => void;
  /** 返回本次是否刷新了历史最长连续（供仪式二层使用）；补签不触发 */
  toggleToday: (id: string, rect?: { x: number; y: number }) => { newBest: boolean; streak: number } | null;
  /** v0.2 计划休息日 */
  toggleRest: (id: string, date: string) => void;

  /** v0.2 八：成就卡片按习惯生成；不传则沿用全站总览卡 */
  openShare: (habitId?: string) => void; closeShare: () => void;
  openExport: () => void; closeExport: () => void;
  askDelete: (kind: "habit" | "honor", id: string) => void; closeConfirm: () => void; doDelete: () => void;
  openWipe: () => void; closeWipe: () => void; doWipe: () => void;

  showToast: (msg: string, ok?: boolean) => void;
  fireBurst: (x?: number, y?: number) => void;
  toastMsg: ToastMsg | null;
  burst: BurstReq | null;

  /* 派生 */
  /* === v0.2：周期节点 / 连续 / 可视化 === */
  streakOf: (h: HabitLike) => number;
  bestOf: (h: HabitLike) => number;
  nodesOf: (h: HabitLike, count?: number) => NodeView[];
  curveOf: (h: HabitLike, days?: number) => CurvePoint[];
  miniOf: (h: HabitLike) => ReturnType<typeof miniWeek>;
  nodeStateOf: (h: HabitLike, idx: number) => NodeState;
  nodeIdxOf: (h: HabitLike, date: string) => number;
  freqOf: (h: HabitLike) => number;
  canRestOf: (h: HabitLike, date: string) => boolean;
  canMakeupOf: (h: HabitLike, date: string) => boolean;
  allTotalOf: (h: HabitLike) => number;
  allImportedOf: (h: HabitLike) => number;
  leaderboardOf: (sort: LeaderSort) => Habit[];
  badgeOf: (totalDays: number) => Badge | null;
  heatDates: boolean[];
  realSet: Set<string>;
  importedTotalAll: () => number;

  exportJson: () => string;
  importJson: (raw: string) => void;
}

const Ctx = createContext<AppCtx | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [lang, setLangState] = useState<Lang>("en");
  const [theme, setThemeState] = useState<ThemeMode>("system");
  const sysScheme = useColorScheme();
  const dark = theme === "system" ? sysScheme === "dark" : theme === "dark";
  const colors = dark ? darkColors : lightColors;

  const [visited, setVisited] = useState(false);
  const [installAt, setInstallAt] = useState("");
  const [habits, setHabits] = useState<Habit[]>([]);
  const [honors, setHonors] = useState<Honor[]>([]);
  const [settings, setSettings] = useState<SettingsState>({
    weekStartOn: "mon", haptics: true, icloudSync: false, badge: false, dailyReminder: false,
  });

  const [purchased, setPurchased] = useState(false);
  const [trialUntil, setTrialUntil] = useState<number | null>(null);
  // 有效 Pro = 已买断 或 本地 7 天试用未到期；试用仅为本地计时，与苹果 / RevenueCat 无关
  const pro = purchased || (trialUntil != null && Date.now() < trialUntil);
  const trialActive = trialUntil != null && Date.now() < trialUntil;
  const trialDaysLeft = trialUntil == null
    ? 0
    : Math.max(0, Math.ceil((trialUntil - Date.now()) / 86400000));

  const [habitFormVisible, setHabitFormVisible] = useState(false);
  const [editingHabitId, setEditingHabitId] = useState<string | null>(null);
  const [habitForm, setHabitFormState] = useState<HabitFormState>({
    name: "", nameZh: "", detail: "", emoji: "🔥", color: "#5B5BD6",
    reminderEnabled: false, reminderTime: "20:00",
    frequency: 1, timesPerWindow: 1,
    migratedTotalDays: 0, migratedCurrentStreak: 0, migratedStartDate: "", migratedSource: "",
  });
  const [honorFormVisible, setHonorFormVisible] = useState(false);
  const [editingHonorId, setEditingHonorId] = useState<string | null>(null);
  const [honorForm, setHonorFormState] = useState<HonorFormState>({
    title: "", titleZh: "", source: "", days: 0, details: "", category: "",
  });
  const [backfillHabitId, setBackfillHabitId] = useState<string | null>(null);

  const [proVisible, setProVisible] = useState(false);
  const [payVisible, setPayVisible] = useState(false);
  const [shareVisible, setShareVisible] = useState(false);
  const [exportVisible, setExportVisible] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [wipeVisible, setWipeVisible] = useState(false);
  const [celVisible] = useState(false);

  const [toastMsg, setToastMsg] = useState<ToastMsg | null>(null);
  const [burst, setBurst] = useState<BurstReq | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingDel = useRef<{ kind: "habit" | "honor"; id: string } | null>(null);

  const dict = getDict(lang);
  const t = useCallback((k: keyof Dict) => dict[k] as string, [dict]);
  const fmt = useCallback((s: string, o: Record<string, string | number>) => fmtTpl(s, o), []);

  const showToast = useCallback((msg: string, ok = false) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToastMsg({ msg: String(msg).replace(/\n/g, " "), ok, nonce: Date.now() });
    toastTimer.current = setTimeout(() => setToastMsg(null), 2200);
  }, []);

  const fireBurst = useCallback((x?: number, y?: number) => {
    setBurst({ x, y, nonce: Date.now() + Math.random() });
  }, []);

  const hapticsOn = useCallback(() => {
    if (settings.haptics) {
      // 动态 import 避免冷启动触碰 haptics 原生模块（expo-haptics 已懒加载）
      void import("@/lib/haptic").then((m) => m.hapticTaskDone()).catch(() => {});
    }
  }, [settings.haptics]);

  const setBadgeCount = useCallback((n: number) => { void setAppBadge(n); }, []);

  /* ===================== 持久化 + 首载 ===================== */
  const { persist, snapshotNow } = usePersist({ habits, honors, settings, installAt });
  useHydration({
    setLangState, setThemeState, setVisited, setInstallAt,
    setHabits, setHonors, setSettings, setPurchased, setTrialUntil, setHydrated,
  });

  /* ===================== Pro ===================== */
  const router = useRouter();
  const nav = useMemo(
    () => ({ push: (h: string) => router.push(h), back: () => router.back() }),
    [router]
  );
  const {
    payPlan, openPro, closePro, openPay, closePay, payDone, payRestore, gatePro,
  } = usePro({ pro, purchased, setPurchased, lang, dict, showToast, setProVisible, setPayVisible, nav });

  /* ===================== 习惯行为 ===================== */
  const {
    toggleToday, toggleRest, openBackfill, closeBackfill, toggleBackfillDate,
    openHabitForm, closeHabitForm, setHabitForm, saveHabit,
    openHonorForm, closeHonorForm, setHonorForm, saveHonor,
    askDelete, closeConfirm, doDelete, importBackup,
  } = useHabitActions({
    habits, honors, settings, pro, openPay, setHabits, setHonors, persist, snapshotNow,
    dict, lang, showToast, fireBurst, hapticsOn,
    habitForm, editingHabitId, setHabitFormState, setEditingHabitId, setHabitFormVisible,
    honorForm, editingHonorId, setHonorFormState, setEditingHonorId, setHonorFormVisible,
    backfillHabitId, setBackfillHabitId,
    pendingDel, setConfirmVisible, setBadgeCount,
  });

  /* ===================== 首次进入 / 重看引导 ===================== */
  const enterApp = useCallback(() => {
    setVisited(true);
    void sset(SK.visited, true);
    if (!installAt) {
      const ds = todayStr();
      setInstallAt(ds);
      void sset(SK.installAt, ds);
    }
  }, [installAt]);

  const openOnboarding = useCallback(() => { setVisited(false); }, []);

  const setLang = useCallback((l: Lang) => { setLangState(l); void sset(SK.lang, l); }, []);
  const setTheme = useCallback((m: ThemeMode) => { setThemeState(m); void sset(SK.theme, m); }, []);

  const patchSettings = useCallback((over: Partial<SettingsState>) => {
    setSettings((prev) => {
      const next = { ...prev, ...over };
      persist(snapshotNow({ settings: next }));
      return next;
    });
  }, [persist, snapshotNow]);

  const setWeekStartOn = useCallback((w: WeekStartOn) => patchSettings({ weekStartOn: w }), [patchSettings]);
  const setHaptics = useCallback((v: boolean) => patchSettings({ haptics: v }), [patchSettings]);
  const setIcloudSync = useCallback((v: boolean) => patchSettings({ icloudSync: v }), [patchSettings]);
  const setDailyReminder = useCallback((v: boolean) => patchSettings({ dailyReminder: v }), [patchSettings]);
  const setBadge = useCallback((v: boolean) => {
    patchSettings({ badge: v });
    if (!v) void setAppBadge(0);
    else {
      const t0 = todayStr();
      const left = habits.filter((h) => !h.checkIns[t0]).length;
      void setAppBadge(left);
    }
  }, [patchSettings, habits]);

  /* ===================== 分享 / 导出弹层 ===================== */
  const openShare = useCallback((habitId?: string) => {
    if (!gatePro("shareTitle")) return;
    setShareVisible(true);
    nav.push(habitId ? `/share?habit=${encodeURIComponent(habitId)}` : "/share"); // modal 路由呈现 Share Card
  }, [gatePro, setShareVisible, nav]);
  const closeShare = useCallback(() => {
    setShareVisible(false);
    nav.back();
  }, [setShareVisible, nav]);

  const openExport = useCallback(() => {
    if (!gatePro("dataExport")) return;
    setExportVisible(true);
  }, [gatePro, setExportVisible]);
  const closeExport = useCallback(() => setExportVisible(false), [setExportVisible]);

  /* ===================== 抹掉数据（二次确认） ===================== */
  const openWipe = useCallback(() => setWipeVisible(true), [setWipeVisible]);
  const closeWipe = useCallback(() => setWipeVisible(false), [setWipeVisible]);
  const doWipe = useCallback(() => {
    setHabits([]);
    setHonors([]);
    persist(snapshotNow({ habits: [], honors: [] }));
    void setAppBadge(0);
    setWipeVisible(false);
    showToast(lang === "zh" ? "已抹掉全部数据" : "All data erased");
  }, [setHabits, setHonors, persist, snapshotNow, setWipeVisible, showToast, lang]);

  /* ===================== 派生算法 ===================== */
  /* === v0.2：周期节点 / 连续 / 可视化 === */
  const streakOf = useCallback((h: HabitLike) => currentStreak(h), []);
  const bestOf = useCallback((h: HabitLike) => bestStreakOf(h), []);
  const nodesOf = useCallback((h: HabitLike, count = 21) => recentNodes(h, count), []);
  const curveOf = useCallback((h: HabitLike, days = 60) => curveSeries(h, days), []);
  const miniOf = useCallback((h: HabitLike) => miniWeek(h), []);
  const nodeStateOf = useCallback((h: HabitLike, idx: number) => nodeStateAt(h, idx), []);
  const nodeIdxOf = useCallback((h: HabitLike, date: string) => nodeIndexAt(h, date), []);
  const freqOfH = useCallback((h: HabitLike) => freqOf(h), []);
  const canRestOf = useCallback((h: HabitLike, date: string) => canRestOn(h, date), []);
  const canMakeupOf = useCallback((h: HabitLike, date: string) => canMakeupOn(h, date), []);

  const allTotalOf = useCallback((h: HabitLike) => allTotal(h), []);
  const allImportedOf = useCallback((h: HabitLike) => allImported(h), []);
  const leaderboardOf = useCallback((sort: LeaderSort) => leaderboard(habits, sort, lang) as Habit[], [habits, lang]);
  const badgeOf = useCallback((totalDays: number) => streakBadge(totalDays), []);
  const heatDates = useMemo(() => heatOn(habits, 119), [habits]);
  const realSet = useMemo(() => realDateSet(habits), [habits]);
  const importedTotalAll = useCallback(
    () => habits.reduce((acc, h) => acc + (h.migratedTotalDays || 0), 0),
    [habits]
  );

  /* ===================== 导出 / 导入 JSON ===================== */
  const exportJson = useCallback((): string => {
    const snap: Snapshot = snapshotNow();
    return JSON.stringify({ version: 1, habits: snap.habits, honors: snap.honors, settings: snap.settings }, null, 2);
  }, [snapshotNow]);

  const importJson = useCallback((raw: string) => {
    try {
      const n = importBackup(raw);
      showToast(fmtTpl(dict.impOk, { n }), true);
    } catch (e) {
      const kind = (e as Error).message;
      if (kind === "empty") showToast(dict.impEmpty);
      else if (kind === "format") showToast(dict.impFormat);
      else showToast(dict.impFail);
    }
  }, [importBackup, dict, showToast]);

  const value: AppCtx = useMemo(() => ({
    hydrated, lang, dict, t, fmt, setLang, theme, setTheme, dark, colors,
    visited, installAt, enterApp, openOnboarding,
    habits, honors, settings, setWeekStartOn, setHaptics, setIcloudSync, setBadge, setDailyReminder,
    pro, purchased, trialActive, trialDaysLeft, openPro, closePro, openPay, closePay, payDone, payRestore, gatePro, payPlan,
    habitFormVisible, editingHabitId, habitForm, honorFormVisible, editingHonorId, honorForm,
    backfillHabitId, proVisible, payVisible, shareVisible, exportVisible, confirmVisible, wipeVisible, celVisible,
    openHabitForm, closeHabitForm, setHabitForm, saveHabit,
    openHonorForm, closeHonorForm, setHonorForm, saveHonor,
    openBackfill, closeBackfill, toggleBackfillDate, toggleToday, toggleRest,
    openShare, closeShare, openExport, closeExport,
    askDelete, closeConfirm, doDelete, openWipe, closeWipe, doWipe,
    showToast, fireBurst, toastMsg, burst,
    streakOf, bestOf, nodesOf, curveOf, miniOf, nodeStateOf, nodeIdxOf, freqOf: freqOfH, canRestOf, canMakeupOf,
    allTotalOf, allImportedOf, leaderboardOf, badgeOf, heatDates, realSet, importedTotalAll,
    exportJson, importJson,
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [
    hydrated, lang, dict, t, fmt, setLang, theme, setTheme, dark, colors,
    visited, installAt, enterApp, openOnboarding,
    habits, honors, settings, setWeekStartOn, setHaptics, setIcloudSync, setBadge, setDailyReminder,
    pro, purchased, trialActive, trialDaysLeft, openPro, closePro, openPay, closePay, payDone, payRestore, gatePro, payPlan,
    habitFormVisible, editingHabitId, habitForm, honorFormVisible, editingHonorId, honorForm,
    backfillHabitId, proVisible, payVisible, shareVisible, exportVisible, confirmVisible, wipeVisible, celVisible,
    openHabitForm, closeHabitForm, setHabitForm, saveHabit,
    openHonorForm, closeHonorForm, setHonorForm, saveHonor,
    openBackfill, closeBackfill, toggleBackfillDate, toggleToday, toggleRest,
    openShare, closeShare, openExport, closeExport,
    askDelete, closeConfirm, doDelete, openWipe, closeWipe, doWipe,
    showToast, fireBurst, toastMsg, burst,
    streakOf, bestOf, nodesOf, curveOf, miniOf, nodeStateOf, nodeIdxOf, freqOfH, canRestOf, canMakeupOf,
    allTotalOf, allImportedOf, leaderboardOf, badgeOf,
    heatDates, realSet, importedTotalAll, exportJson, importJson,
  ]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp must be used within AppProvider");
  return v;
}

export { I18N };
export type { Snapshot };
