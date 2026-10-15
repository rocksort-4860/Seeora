/**
 * 全局数据层（Seeora）：纯本地，无账号、无后端、无云同步
 * React Context + useState 承载全部状态；每次变更后持久化 sd.local 快照
 * 拆为 app.tsx（Context + 状态 + 派生算法 + 装配）/ usePersist.ts / usePro.ts / useHabitActions.ts
 */
import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from "react";
import { AppState, useColorScheme } from "react-native";
import { useRouter } from "expo-router";
import type { Href } from "expo-router";
import { sget, sset, SK, TRIAL_MS } from "@/lib/storage";
import { FREE_HABIT_LIMIT } from "@/lib/limits";
import { fmt as fmtTpl, getDict, I18N, type Dict, type Lang } from "@/lib/i18n";
import { lightColors, darkColors, habitColors, type Colors } from "@/lib/tokens";
import { todayStr } from "@/lib/dates";
import {
  currentStreak, bestStreakOf, streakPausedDays, recentNodes, curveSeries, miniWeek,
  canRestOn, canMakeupOn, nodeStateAt, nodeIndexAt, freqOf,
  type HabitLike, type NodeView, type CurvePoint, type NodeState,
} from "@/lib/habitLogic";
import { setAppBadge } from "@/lib/notify";
import { syncWidgetSnapshot } from "@/lib/widgetSync";
import { useHydration, usePersist, type Snapshot } from "@/store/usePersist";
import { usePro, type PayRestoreResult, type ProReason } from "@/store/usePro";
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
  /** 已撒花庆祝过的里程碑天数（避免同档位反复撒花）；老数据无此字段 → 视为空 */
  celebratedMilestones?: number[];
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
  badge: boolean;
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
  setLang: (l: Lang) => void;
  theme: ThemeMode;
  setTheme: (m: ThemeMode) => void;
  dark: boolean;
  colors: Colors;

  visited: boolean;
  enterApp: () => void; openOnboarding: () => void;

  habits: Habit[]; honors: Honor[]; settings: SettingsState;
  setWeekStartOn: (w: WeekStartOn) => void;
  setHaptics: (v: boolean) => void;
  setBadge: (v: boolean) => void;

  pro: boolean;            // 有效 Pro：买断 或 试用未到期
  purchased: boolean;      // 是否已买断终身版（原始凭证）
  trialActive: boolean;    // 是否处于 7 天试用窗口内
  trialDaysLeft: number;   // 试用剩余天数（0 = 已结束 / 未开始）
  /** 试用截止时间戳；null = **从未领取**（≠ 已结束，两者在 /pro 页的文案与入口不同） */
  trialUntil: number | null;
  /** 手动领取 7 天试用（幂等：已买断或已领取过则无操作） */
  startTrial: () => void;
  /** 免费版「冻结」的习惯 id 集合：试用结束且未买断时，超出上限的部分（数据保留、不可操作） */
  frozenIds: Set<string>;
  /** reason 仅在 /pro 页用于说明「为什么被带到这里」（如 habitLimit = 免费版习惯数达上限） */
  openPro: (reason?: ProReason) => void; closePro: () => void; openPay: () => void; closePay: () => void;
  /** 返回 null = 成功/已买断；非空字符串 = 失败原因的本地化文案（供弹层内联渲染） */
  payDone: () => Promise<string | null>;
  /** 返回 outcome 供弹层分级渲染（none = 没买过属正常态，不该涂红） */
  payRestore: () => Promise<PayRestoreResult>;

  habitFormVisible: boolean; editingHabitId: string | null; habitForm: HabitFormState;
  honorFormVisible: boolean; editingHonorId: string | null; honorForm: HonorFormState;
  backfillHabitId: string | null;
  payVisible: boolean; exportVisible: boolean;
  wipeVisible: boolean;

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
  /** 删除习惯：由 HabitForm 内联二次确认后直接调用（不再有独立的确认弹层） */
  deleteHabitNow: (id: string) => void;
  /** 归档 / 取消归档：就地切换 isArchived，数据完整保留；归档不释放免费版 5 条上限额度 */
  archiveHabit: (id: string, value: boolean) => void;
  openWipe: () => void; closeWipe: () => void; doWipe: () => void;

  /** ms：可选展示时长（失败类长文案需要比默认 2200ms 更久，否则一闪而过等于没提示） */
  showToast: (msg: string, ok?: boolean, ms?: number) => void;
  /** 全部习惯完成今日目标 → 顶部彩纸撒花（设计文档 §M7）。
   *  ★ 此前这里是 `const [celVisible] = useState(false)`（**没有 setter**，恒为 false），
   *    于是 Confetti.tsx 里那段 60 片彩纸的代码从来没跑过 = 死功能。现已接上真实触发。 */
  confettiNonce: number;
  toastMsg: ToastMsg | null;
  burst: BurstReq | null;

  /* 派生 */
  /* === v0.2：周期节点 / 连续 / 可视化 === */
  streakOf: (h: HabitLike) => number;
  pausedOf: (h: HabitLike) => number;
  bestOf: (h: HabitLike) => number;
  nodesOf: (h: HabitLike, count?: number) => NodeView[];
  curveOf: (h: HabitLike, days?: number) => CurvePoint[];
  miniOf: (h: HabitLike) => ReturnType<typeof miniWeek>;
  nodeStateOf: (h: HabitLike, idx: number) => NodeState;
  nodeIdxOf: (h: HabitLike, date: string) => number;
  freqOf: (h: HabitLike) => number;
  canRestOf: (h: HabitLike, date: string) => boolean;
  canMakeupOf: (h: HabitLike, date: string) => boolean;
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
    weekStartOn: "mon", haptics: true, badge: false,
  });

  const [purchased, setPurchased] = useState(false);
  const [trialUntil, setTrialUntil] = useState<number | null>(null);
  // 有效 Pro = 已买断 或 本地 7 天试用未到期；试用仅为本地计时，与苹果 / RevenueCat 无关
  const pro = purchased || (trialUntil != null && Date.now() < trialUntil);
  const trialActive = trialUntil != null && Date.now() < trialUntil;
  const trialDaysLeft = trialUntil == null
    ? 0
    : Math.max(0, Math.ceil((trialUntil - Date.now()) / 86400000));

  /* ===================== 试用到期边界（台账 P2） =====================
   * pro / trialActive / trialDaysLeft 都是**渲染期**用 Date.now() 算的，frozenIds 又是 useMemo。
   * 若用户停在某个页面跨过到期时刻，本次渲染的 pro 仍是 true → 「到期后的第一次操作」
   * 会被放行（本该被冻结的习惯漏过一次写操作）。
   * 修法：① 在到期那一刻安排一次重渲染；② App 回到前台时补一次
   * （覆盖「改系统时间」「长时间后台被挂起，定时器不触发」两种情况）。
   * 两者都是纯 JS 定时/订阅，不触碰任何原生模块，不影响冷启动红线。 */
  const [, setTrialTick] = useState(0);
  useEffect(() => {
    if (trialUntil == null || trialUntil <= Date.now()) return;
    const t = setTimeout(() => setTrialTick((n) => n + 1), trialUntil - Date.now() + 1000);
    return () => clearTimeout(t);
  }, [trialUntil]);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") setTrialTick((n) => n + 1);
    });
    return () => sub.remove();
  }, []);

  /* 手动领取 7 天试用（★ 替代原「装完首次启动自动开启」，见 usePersist.ts）。
   * 幂等：已买断 / 已领取过（无论进行中还是已结束）都不再重置 ——
   * 否则用户可反复点按钮把结束的试用续上，等于永久免费。
   * ★ 必须落盘：trialUntil 只在 hydration 时从存储读一次，不写盘则杀进程即丢失。 */
  const startTrial = useCallback(() => {
    if (purchased || trialUntil != null) return;
    const until = Date.now() + TRIAL_MS;
    void sset(SK.trialUntil, until);
    setTrialUntil(until);
  }, [purchased, trialUntil]);

  /* 免费版超限习惯「冻结」集合（试用结束且未买断时非空）。
   * 规则：按创建时间升序保留最早的 FREE_HABIT_LIMIT 个可用，其余冻结。
   *  · 为什么按 createdAt 而不是数组下标：导入备份按 id 合并会重排数组，
   *    用下标会让「升级/降级后哪个习惯能用」变得不可预期（今天能用、明天不能用）。
   *  · createdAt 同日的（一天建多条）用数组原索引做稳定排序，结果确定。
   *  · 删除靠前的习惯会让后面的自动解冻 —— 与「免费版最多 N 个」的直觉一致。 */
  const frozenIds = useMemo(() => {
    if (pro) return new Set<string>();
    const ordered = habits
      .map((h, i) => ({ id: h.id, at: h.createdAt || "", i }))
      .sort((a, b) => a.at.localeCompare(b.at) || a.i - b.i);
    return new Set(ordered.slice(FREE_HABIT_LIMIT).map((x) => x.id));
  }, [habits, pro]);

  const [habitFormVisible, setHabitFormVisible] = useState(false);
  const [editingHabitId, setEditingHabitId] = useState<string | null>(null);
  const [habitForm, setHabitFormState] = useState<HabitFormState>({
    /* ★ 默认色必须取自 habitColors 调色板（此前写死 "#5B5BD6" 是调色板外的紫色：
     *   新建习惯时 8 个色块**全无选中态**，用户以为颜色没生效；
     *   且那个紫还违反「全系统唯一强调色 #2d7a6b」的规范。 */
    name: "", nameZh: "", detail: "", emoji: "🔥", color: habitColors[0],
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

  const [payVisible, setPayVisible] = useState(false);
  const [exportVisible, setExportVisible] = useState(false);
  const [wipeVisible, setWipeVisible] = useState(false);

  const [toastMsg, setToastMsg] = useState<ToastMsg | null>(null);
  const [burst, setBurst] = useState<BurstReq | null>(null);
  /** 撒花计数器：每次 +1 触发一轮顶部彩纸（用计数而非布尔，连点两次也各播一轮） */
  const [confettiNonce, setConfettiNonce] = useState(0);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dict = getDict(lang);
  const t = useCallback((k: keyof Dict) => dict[k] as string, [dict]);

  const showToast = useCallback((msg: string, ok = false, ms = 2200) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToastMsg({ msg: String(msg).replace(/\n/g, " "), ok, nonce: Date.now() });
    toastTimer.current = setTimeout(() => setToastMsg(null), ms);
  }, []);

  const fireBurst = useCallback((x?: number, y?: number) => {
    setBurst({ x, y, nonce: Date.now() + Math.random() });
  }, []);

  const fireConfetti = useCallback(() => setConfettiNonce((n) => n + 1), []);

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

  /* ===================== 主屏小组件 =====================
   * habits / 语言任一变化 → 同步今日快照到 App Group（WidgetKit 扩展读取）。
   * 仅在首载完成后同步，避免 hydration 中途的空数组把小组件清成空态。
   * 非 iOS / 原生模块缺失时 widgetSync 内部静默降级，不触碰任何原生调用。 */
  useEffect(() => {
    if (hydrated) syncWidgetSnapshot(habits, lang);
  }, [hydrated, habits, lang]);

  /* ===================== Pro ===================== */
  const router = useRouter();
  const nav = useMemo(
    () => ({ push: (h: Href) => router.push(h), back: () => router.back() }),
    [router]
  );
  const {
    payPlan, openPro, closePro, openPay, closePay, payDone, payRestore, gatePro,
  } = usePro({ pro, purchased, setPurchased, lang, dict, showToast, setPayVisible, nav });

  /* ===================== 习惯行为 ===================== */
  const {
    toggleToday, toggleRest, openBackfill, closeBackfill, toggleBackfillDate,
    openHabitForm, closeHabitForm, setHabitForm, saveHabit,
    openHonorForm, closeHonorForm, setHonorForm, saveHonor,
    deleteHabitNow, archiveHabit, importBackup,
  } = useHabitActions({
    habits, honors, settings, pro, frozenIds, openPro, setHabits, setHonors, persist, snapshotNow,
    dict, lang, showToast, fireBurst, fireConfetti, hapticsOn,
    habitForm, editingHabitId, setHabitFormState, setEditingHabitId, setHabitFormVisible,
    honorForm, editingHonorId, setHonorFormState, setEditingHonorId, setHonorFormVisible,
    backfillHabitId, setBackfillHabitId,
    setBadgeCount,
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
    nav.push(habitId ? `/share?habit=${encodeURIComponent(habitId)}` : "/share"); // modal 路由呈现 Share Card
  }, [gatePro, nav]);
  const closeShare = useCallback(() => {
    nav.back();
  }, [nav]);

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
    showToast(dict.wipeDone);
  }, [setHabits, setHonors, persist, snapshotNow, setWipeVisible, showToast, dict]);

  /* ===================== 派生算法 ===================== */
  /* === v0.2：周期节点 / 连续 / 可视化 === */
  const streakOf = useCallback((h: HabitLike) => currentStreak(h), []);
  const pausedOf = useCallback((h: HabitLike) => streakPausedDays(h), []);
  const bestOf = useCallback((h: HabitLike) => Math.max(bestStreakOf(h), currentStreak(h)), []);
  const nodesOf = useCallback((h: HabitLike, count = 21) => recentNodes(h, count), []);
  const curveOf = useCallback((h: HabitLike, days = 60) => curveSeries(h, days), []);
  const miniOf = useCallback((h: HabitLike) => miniWeek(h), []);
  const nodeStateOf = useCallback((h: HabitLike, idx: number) => nodeStateAt(h, idx), []);
  const nodeIdxOf = useCallback((h: HabitLike, date: string) => nodeIndexAt(h, date), []);
  const freqOfH = useCallback((h: HabitLike) => freqOf(h), []);
  const canRestOf = useCallback((h: HabitLike, date: string) => canRestOn(h, date), []);
  const canMakeupOf = useCallback((h: HabitLike, date: string) => canMakeupOn(h, date), []);

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
    hydrated, lang, dict, t, setLang, theme, setTheme, dark, colors,
    visited, enterApp, openOnboarding,
    habits, honors, settings, setWeekStartOn, setHaptics, setBadge,
    pro, purchased, trialActive, trialDaysLeft, trialUntil, startTrial, frozenIds, openPro, closePro, openPay, closePay, payDone, payRestore,
    habitFormVisible, editingHabitId, habitForm, honorFormVisible, editingHonorId, honorForm,
    backfillHabitId, payVisible, exportVisible, wipeVisible,
    openHabitForm, closeHabitForm, setHabitForm, saveHabit,
    openHonorForm, closeHonorForm, setHonorForm, saveHonor,
    openBackfill, closeBackfill, toggleBackfillDate, toggleToday, toggleRest,
    openShare, closeShare, openExport, closeExport,
    deleteHabitNow, archiveHabit, openWipe, closeWipe, doWipe,
    showToast, confettiNonce, toastMsg, burst,
    streakOf, bestOf, pausedOf, nodesOf, curveOf, miniOf, nodeStateOf, nodeIdxOf, freqOf: freqOfH, canRestOf, canMakeupOf,
    importedTotalAll,
    exportJson, importJson,
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [
    hydrated, lang, dict, t, setLang, theme, setTheme, dark, colors,
    visited, enterApp, openOnboarding,
    habits, honors, settings, setWeekStartOn, setHaptics, setBadge,
    pro, purchased, trialActive, trialDaysLeft, trialUntil, startTrial, frozenIds, openPro, closePro, openPay, closePay, payDone, payRestore,
    habitFormVisible, editingHabitId, habitForm, honorFormVisible, editingHonorId, honorForm,
    backfillHabitId, payVisible, exportVisible, wipeVisible,
    openHabitForm, closeHabitForm, setHabitForm, saveHabit,
    openHonorForm, closeHonorForm, setHonorForm, saveHonor,
    openBackfill, closeBackfill, toggleBackfillDate, toggleToday, toggleRest,
    openShare, closeShare, openExport, closeExport,
    deleteHabitNow, archiveHabit, openWipe, closeWipe, doWipe,
    showToast, confettiNonce, toastMsg, burst,
    streakOf, bestOf, pausedOf, nodesOf, curveOf, miniOf, nodeStateOf, nodeIdxOf, freqOfH, canRestOf, canMakeupOf,
    importedTotalAll, exportJson, importJson,
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
