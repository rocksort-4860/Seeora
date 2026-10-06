/**
 * 习惯 / 荣誉 / 打卡行为（Seeora）
 * 从 store/app.tsx 拆出；行为对齐 Seeora 范式（勾选打卡 / 添加编辑 / 删除 / 补录 / 导入导出）
 */
import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";
import { type Dict, type Lang } from "@/lib/i18n";
import { FREE_HABIT_LIMIT } from "@/lib/limits";
import { todayStr } from "@/lib/dates";
import {
  currentStreak, bestStreakOf, canMakeupOn, canRestOn,
} from "@/lib/habitLogic";
import { habitColors } from "@/lib/tokens";
import { cancelTaskReminder, scheduleTaskReminder } from "@/lib/notify";
import { hapticTaskDone } from "@/lib/haptic";
import type { Snapshot } from "@/store/usePersist";
import type { ProReason } from "@/store/usePro";
import type {
  Habit, HabitFormState, Honor, HonorFormState, SettingsState,
} from "@/store/app";

/** 免费版习惯数量上限（定义见 @/lib/limits，此处 re-export 供既有引用） */
export { FREE_HABIT_LIMIT } from "@/lib/limits";

export interface HabitActionsDeps {
  habits: Habit[];
  honors: Honor[];
  settings: SettingsState;
  /** 买断状态与买断页入口（用于「免费版 5 个习惯」的升级引导） */
  pro: boolean;
  /** 免费版冻结的习惯 id（试用结束且未买断时超出上限的部分）：
   *  冻结 = 数据保留、可见，但不可打卡 / 补签 / 标休息 / 编辑 */
  frozenIds: Set<string>;
  /** 打开 /pro 买断页；reason 让该页能说明「为什么被带到这里」 */
  openPro: (reason?: ProReason) => void;
  setHabits: Dispatch<SetStateAction<Habit[]>>;
  setHonors: Dispatch<SetStateAction<Honor[]>>;
  persist: (snap: Snapshot) => void;
  snapshotNow: (over?: Partial<Snapshot>) => Snapshot;
  dict: Dict;
  lang: Lang;
  /** ms 可选：长文案需要更长的展示时间（默认 2200ms 对两行文案不够） */
  showToast: (msg: string, ok?: boolean, ms?: number) => void;
  fireBurst: (x?: number, y?: number) => void;
  /** 全部习惯完成今日目标时触发顶部彩纸撒花（ConfettiHost 消费） */
  fireConfetti: () => void;
  hapticsOn: () => void;

  habitForm: HabitFormState;
  editingHabitId: string | null;
  setHabitFormState: Dispatch<SetStateAction<HabitFormState>>;
  setEditingHabitId: Dispatch<SetStateAction<string | null>>;
  setHabitFormVisible: Dispatch<SetStateAction<boolean>>;

  honorForm: HonorFormState;
  editingHonorId: string | null;
  setHonorFormState: Dispatch<SetStateAction<HonorFormState>>;
  setEditingHonorId: Dispatch<SetStateAction<string | null>>;
  setHonorFormVisible: Dispatch<SetStateAction<boolean>>;

  backfillHabitId: string | null;
  setBackfillHabitId: Dispatch<SetStateAction<string | null>>;

  setBadgeCount: (n: number) => void;
}

export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function useHabitActions(d: HabitActionsDeps) {
  const {
    habits, honors, settings, pro, frozenIds, openPro, setHabits, setHonors, persist, snapshotNow,
    dict, lang, showToast, fireBurst, fireConfetti, hapticsOn,
    habitForm, editingHabitId, setHabitFormState, setEditingHabitId, setHabitFormVisible,
    honorForm, editingHonorId, setHonorFormState, setEditingHonorId, setHonorFormVisible,
    backfillHabitId, setBackfillHabitId,
    setBadgeCount,
  } = d;

  const applyHabit = useCallback((nh: Habit) => {
    const nl = habits.map((h) => (h.id === nh.id ? nh : h));
    if (!nl.some((h) => h.id === nh.id)) nl.push(nh);
    setHabits(nl);
    persist(snapshotNow({ habits: nl }));
    // 应用角标：未打卡今日（且未达标）的习惯数
    if (settings.badge) {
      const t = todayStr();
      const left = nl.filter((h) => !h.checkIns[t]).length;
      setBadgeCount(left);
    }
  }, [habits, settings.badge, setHabits, persist, snapshotNow, setBadgeCount]);

  /* ===================== 冻结拦截（免费版边界） =====================
   * 试用结束且未买断时，超出上限的习惯被冻结：**数据完整保留，但一切写操作失效**。
   * 四个入口（打卡 / 标休息 / 补签 / 编辑）统一走这一个函数 ——
   * 分散判断最容易漏掉某一处，留下「明明冻结了却还能改」的口子。
   * 返回 true = 已拦截（调用方必须立刻 return）。 */
  const blockIfFrozen = useCallback((id: string): boolean => {
    if (!frozenIds.has(id)) return false;
    showToast(dict.habitFrozenToast, false, 2600);
    openPro("habitLimit");
    return true;
  }, [frozenIds, dict, showToast, openPro]);

  /* ===================== 当日打卡（v0.2：连续累积 + 最长记录永久保存） ===================== */
  /** 返回值供仪式感使用：newBest=true 表示本次刷新了历史最长连续 */
  const toggleToday = useCallback(
    (habitId: string, rect?: { x: number; y: number }): { newBest: boolean; streak: number } | null => {
      const h = habits.find((x) => x.id === habitId);
      if (!h) return null;
      if (blockIfFrozen(habitId)) return null; // 冻结习惯：只读，引导升级
      const t = todayStr();
      if (h.checkIns[t]) {
        // 撤销今日打卡
        const nh = { ...h, checkIns: { ...h.checkIns } };
        delete nh.checkIns[t];
        applyHabit(nh);
        showToast(lang === "zh" ? "已取消今日打卡" : "Check-in undone");
        return null;
      }
      hapticsOn();
      fireBurst(rect?.x, rect?.y);
      const nh: Habit = { ...h, checkIns: { ...h.checkIns, [t]: true as const } };
      // 打卡后刷新连续；若刷新历史最长则永久保存（断签不清零，记录永不消失）
      const streak = currentStreak(nh);
      const prevBest = bestStreakOf(h);
      const newBest = streak > prevBest;
      if (newBest) nh.bestStreak = streak;
      applyHabit(nh);

      /* ===== 全部完成 → 顶部撒花（设计文档 §M7「完成庆祝动效」）=====
       * 此前由恒为 false 的 celVisible 驱动，从未真正播放过（死功能）。
       * 判定口径：**可操作的习惯**（排除冻结 —— 它们无法打卡，算进去就永远不可能全部完成）
       * 全部满足「今日已打卡」或「今天被标记为计划休息日」时撒花。
       * 一次只撒一轮：从「差一个」到「全完成」的这一步才触发。 */
      const all = habits
        .filter((x) => !frozenIds.has(x.id))
        .map((x) => (x.id === nh.id ? nh : x));
      if (all.length > 0 && all.every((x) => x.checkIns[t] || !!x.rests?.[t])) fireConfetti();

      return { newBest, streak };
    },
    [habits, frozenIds, settings.weekStartOn, lang, dict, showToast, fireBurst, fireConfetti, hapticsOn, applyHabit, blockIfFrozen]
  );

  /* ===================== 计划休息日（v0.2 3.1） ===================== */
  /** 只能提前或当天标记；历史日期禁止补设。当天实际打卡可直接覆盖为打卡 */
  const toggleRest = useCallback(
    (habitId: string, date: string) => {
      const h = habits.find((x) => x.id === habitId);
      if (!h) return;
      if (blockIfFrozen(habitId)) return; // 冻结习惯：只读，引导升级
      if (!canRestOn(h, date)) {
        showToast(lang === "zh" ? "休息日只能提前或当天标记" : "Rest can only be planned ahead or for today");
        return;
      }
      const rests = { ...(h.rests || {}) };
      if (rests[date]) delete rests[date];
      else rests[date] = true;
      const nh: Habit = { ...h, rests };
      applyHabit(nh);
    },
    [habits, lang, showToast, applyHabit, blockIfFrozen]
  );

  /* ===================== 7 天补录面板 ===================== */
  const openBackfill = useCallback((habitId: string) => setBackfillHabitId(habitId), [setBackfillHabitId]);
  const closeBackfill = useCallback(() => setBackfillHabitId(null), [setBackfillHabitId]);
  /** v0.2：补签只能生成打卡记录，仅限过去 7 天且未标记休息日；不刷新最长连续（不触发仪式） */
  const toggleBackfillDate = useCallback((habitId: string, date: string) => {
    const h = habits.find((x) => x.id === habitId);
    if (!h) return;
    if (blockIfFrozen(habitId)) return; // 冻结习惯：只读，引导升级
    if (!canMakeupOn(h, date)) { showToast(dict.backfillLocked); return; }
    const nh: Habit = { ...h, checkIns: { ...h.checkIns } };
    if (nh.checkIns[date]) delete nh.checkIns[date];
    else nh.checkIns[date] = true as const;
    applyHabit(nh);
  }, [habits, dict, showToast, applyHabit, blockIfFrozen]);

  /* ===================== 习惯表单 ===================== */
  const openHabitForm = useCallback((h: Habit | null) => {
    // 冻结习惯不可编辑（表单会把改动写回同一个对象，等于绕过冻结）
    if (h && h.id && blockIfFrozen(h.id)) return;
    setEditingHabitId(h && h.id ? h.id : null);
    if (h && h.id) {
      setHabitFormState({
        name: h.name, nameZh: h.nameZh, detail: h.detail, emoji: h.emoji, color: h.color,
        reminderEnabled: h.reminderEnabled, reminderTime: h.reminderTime,
        frequency: h.frequency ?? 1, timesPerWindow: h.timesPerWindow ?? 1,
        migratedTotalDays: h.migratedTotalDays, migratedCurrentStreak: h.migratedCurrentStreak,
        migratedStartDate: h.migratedStartDate, migratedSource: h.migratedSource,
      });
    } else {
      setHabitFormState({
        name: "", nameZh: "", detail: "", emoji: "🔥", color: habitColors[0],
        reminderEnabled: false, reminderTime: "20:00",
        frequency: 1, timesPerWindow: 1,
        migratedTotalDays: 0, migratedCurrentStreak: 0, migratedStartDate: "", migratedSource: "",
      });
    }
    setHabitFormVisible(true);
  }, [setEditingHabitId, setHabitFormState, setHabitFormVisible, blockIfFrozen]);

  const closeHabitForm = useCallback(() => setHabitFormVisible(false), [setHabitFormVisible]);
  const setHabitForm = useCallback(
    (f: Partial<HabitFormState>) => setHabitFormState((p) => ({ ...p, ...f })),
    [setHabitFormState]
  );

  const saveHabit = useCallback(() => {
    const f = habitForm;
    const name = f.name.trim();
    if (!name) { showToast(lang === "zh" ? "请输入标题" : "Please enter a title"); return; }
    const base = {
      name,
      nameZh: f.nameZh.trim() || name,
      detail: f.detail.trim(),
      emoji: f.emoji || "🔥",
      color: f.color || habitColors[0],
      // v0.2：频率 N（1~30，节点代表 N 天）与窗口次数（1~20）
      frequency: Math.min(30, Math.max(1, Math.round(f.frequency) || 1)),
      timesPerWindow: Math.min(20, Math.max(1, Math.round(f.timesPerWindow) || 1)),
      reminderEnabled: f.reminderEnabled,
      reminderTime: f.reminderTime || "",
      migratedTotalDays: Math.max(0, Math.round(f.migratedTotalDays) || 0),
      migratedCurrentStreak: Math.max(0, Math.round(f.migratedCurrentStreak) || 0),
      migratedStartDate: f.migratedStartDate || "",
      migratedSource: f.migratedSource.trim(),
      migrationImportedAt: editingHabitId
        ? (habits.find((h) => h.id === editingHabitId)?.migrationImportedAt || todayStr())
        : todayStr(),
    };
    if (editingHabitId) {
      const nl = habits.map((h) => (h.id === editingHabitId ? { ...h, ...base } : h));
      setHabits(nl);
      persist(snapshotNow({ habits: nl }));
      showToast(lang === "zh" ? "习惯已更新" : "Habit updated", true);
      const edited = nl.find((h) => h.id === editingHabitId);
      if (edited) {
        if (base.reminderEnabled && base.reminderTime) void scheduleTaskReminder(edited.id, edited.name, base.reminderTime);
        else void cancelTaskReminder(edited.id);
      }
    } else {
      // v0.2 付费边界：免费版最多 5 个习惯。
      // ★ 必须走 openPro（push /pro 路由页），**绝不能**用 openPay：
      //   openPay 只把 payVisible 置真，而该状态的唯一消费者是 /pro 路由页内部的弹层，
      //   从 Today 触发时 /pro 未挂载 → 弹层无处渲染 → 用户看到「点了买断没反应」。
      if (!pro && habits.length >= FREE_HABIT_LIMIT) {
        // 先关表单再引导：HabitForm 是原生 Modal，会整片盖住随后 push 上来的 /pro 页
        // （正常路径在 Today 入口就已被拦下，这里是兜底防线）
        setHabitFormVisible(false);
        showToast(dict.habitLimitToast.replace("{n}", String(FREE_HABIT_LIMIT)), false, 2600);
        openPro("habitLimit");
        return;
      }
      // C-04 变体修复：createdAt 用本地日期串，绝不用 toISOString()。
      // toISOString 是 UTC，东八区 00:00–07:59 写入会落到「昨天」，
      // habitStartDate() 取日期部分后，习惯起始日 / 已坚持天数会整体偏一天且不可回溯。
      const nh: Habit = { id: uid(), createdAt: todayStr(), isArchived: false, checkIns: {}, ...base };
      const nl = [...habits, nh];
      setHabits(nl);
      persist(snapshotNow({ habits: nl }));
      showToast(lang === "zh" ? "习惯已添加" : "Habit added", true);
      if (base.reminderEnabled && base.reminderTime) void scheduleTaskReminder(nh.id, nh.name, base.reminderTime);
    }
    setHabitFormVisible(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [habitForm, editingHabitId, habits, pro, openPro, lang, dict, showToast, setHabits, persist, snapshotNow, setHabitFormVisible]);

  /* ===================== 荣誉表单 ===================== */
  const openHonorForm = useCallback((hr: Honor | null) => {
    setEditingHonorId(hr && hr.id ? hr.id : null);
    if (hr && hr.id) {
      setHonorFormState({
        title: hr.title, titleZh: hr.titleZh, source: hr.source, days: hr.days,
        details: hr.details, category: hr.category,
      });
    } else {
      setHonorFormState({ title: "", titleZh: "", source: "", days: 0, details: "", category: "" });
    }
    setHonorFormVisible(true);
  }, [setEditingHonorId, setHonorFormState, setHonorFormVisible]);

  const closeHonorForm = useCallback(() => setHonorFormVisible(false), [setHonorFormVisible]);
  const setHonorForm = useCallback(
    (f: Partial<HonorFormState>) => setHonorFormState((p) => ({ ...p, ...f })),
    [setHonorFormState]
  );

  const saveHonor = useCallback(() => {
    const f = honorForm;
    const title = (f.title || f.titleZh).trim();
    if (!title) { showToast(lang === "zh" ? "请输入标题" : "Please enter a title"); return; }
    const base = {
      title, titleZh: f.titleZh.trim() || title, source: f.source.trim(),
      days: Math.max(0, Math.round(f.days) || 0), details: f.details.trim(), category: f.category.trim(),
    };
    if (editingHonorId) {
      const nl = honors.map((h) => (h.id === editingHonorId ? { ...h, ...base } : h));
      setHonors(nl);
      persist(snapshotNow({ honors: nl }));
      showToast(lang === "zh" ? "荣誉已更新" : "Honor updated", true);
    } else {
      const nh: Honor = { id: uid(), type: "", ...base };
      const nl = [...honors, nh];
      setHonors(nl);
      persist(snapshotNow({ honors: nl }));
      showToast(lang === "zh" ? "荣誉已添加" : "Honor added", true);
    }
    setHonorFormVisible(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [honorForm, editingHonorId, honors, lang, dict, showToast, setHonors, persist, snapshotNow, setHonorFormVisible]);

  /* ===================== 删除习惯（内联二次确认） =====================
   * ★ 2026-10-06：删除确认从「关掉表单 → 再开一个确认弹层」改为**表单内联第二步**。
   *   原路径会先卸载 HabitForm 的 Modal、再挂载 ConfirmDialog 的 Modal ——
   *   两个原生 Modal 在退场 270ms 内并存（RN 0.83 会留下全屏透明层，关掉后整页点不动），
   *   靠 sheetArbiter 兜底才没出事。内联确认后这条路彻底不存在，同时更贴 iOS 的
   *   「破坏性操作就地二次确认」习惯。确认后**直接删**，不再经过 pendingDel 中转。 */
  const deleteHabitNow = useCallback((id: string) => {
    const nl = habits.filter((x) => x.id !== id);
    setHabits(nl);
    persist(snapshotNow({ habits: nl }));
    void cancelTaskReminder(id);
    showToast(lang === "zh" ? "已删除" : "Deleted");
  }, [habits, lang, showToast, persist, snapshotNow, setHabits]);

  /* ===================== 导入备份（JSON） ===================== */
  // 解析 Seeora 备份 JSON；合并 habits/honors（按 id 覆盖）；破坏或非 JSON → 抛错
  const importBackup = useCallback((raw: string): number => {
    let obj: unknown;
    try {
      obj = JSON.parse(raw);
    } catch {
      throw new Error("parse");
    }
    if (!obj || typeof obj !== "object") throw new Error("format");
    const o = obj as Record<string, unknown>;
    const inHabits = Array.isArray(o.habits) ? (o.habits as Habit[]) : [];
    const inHonors = Array.isArray(o.honors) ? (o.honors as Honor[]) : [];
    if (!inHabits.length && !inHonors.length) throw new Error("empty");
    const hMap = new Map(habits.map((h) => [h.id, h]));
    for (const h of inHabits) if (h && h.id) hMap.set(h.id, { ...h, checkIns: h.checkIns || {} });
    const nlH = Array.from(hMap.values());
    const hrMap = new Map(honors.map((x) => [x.id, x]));
    for (const x of inHonors) if (x && x.id) hrMap.set(x.id, x);
    const nlHr = Array.from(hrMap.values());
    setHabits(nlH);
    setHonors(nlHr);
    persist(snapshotNow({ habits: nlH, honors: nlHr }));
    return nlH.length + nlHr.length;
  }, [habits, honors, setHabits, setHonors, persist, snapshotNow]);

  return {
    toggleToday, toggleRest, openBackfill, closeBackfill, toggleBackfillDate,
    openHabitForm, closeHabitForm, setHabitForm, saveHabit,
    openHonorForm, closeHonorForm, setHonorForm, saveHonor,
    deleteHabitNow, importBackup,
  };
}
