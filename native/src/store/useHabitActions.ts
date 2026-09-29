/**
 * 习惯 / 荣誉 / 打卡行为（Seeora）
 * 从 store/app.tsx 拆出；行为对齐 RockSort 范式（勾选打卡 / 添加编辑 / 删除 / 补录 / 导入导出）
 */
import { useCallback } from "react";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { type Dict, type Lang } from "@/lib/i18n";
import { todayStr } from "@/lib/dates";
import {
  currentStreak, bestStreakOf, canMakeupOn, canRestOn,
} from "@/lib/habitLogic";
import { habitColors } from "@/lib/tokens";
import { cancelTaskReminder, scheduleTaskReminder } from "@/lib/notify";
import { hapticTaskDone } from "@/lib/haptic";
import type { Snapshot } from "@/store/usePersist";
import type {
  Habit, HabitFormState, Honor, HonorFormState, SettingsState,
} from "@/store/app";

/** v0.2 免费版习惯数量上限（文档十一：免费版最多 5 个习惯，买断后不限） */
export const FREE_HABIT_LIMIT = 5;

export interface HabitActionsDeps {
  habits: Habit[];
  honors: Honor[];
  settings: SettingsState;
  /** 买断状态与买断弹层（用于「免费版 5 个习惯」的温和提示） */
  pro: boolean;
  openPay: () => void;
  setHabits: Dispatch<SetStateAction<Habit[]>>;
  setHonors: Dispatch<SetStateAction<Honor[]>>;
  persist: (snap: Snapshot) => void;
  snapshotNow: (over?: Partial<Snapshot>) => Snapshot;
  dict: Dict;
  lang: Lang;
  showToast: (msg: string, ok?: boolean) => void;
  fireBurst: (x?: number, y?: number) => void;
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

  pendingDel: MutableRefObject<{ kind: "habit" | "honor"; id: string } | null>;
  setConfirmVisible: Dispatch<SetStateAction<boolean>>;
  setBadgeCount: (n: number) => void;
}

export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function useHabitActions(d: HabitActionsDeps) {
  const {
    habits, honors, settings, pro, openPay, setHabits, setHonors, persist, snapshotNow,
    dict, lang, showToast, fireBurst, hapticsOn,
    habitForm, editingHabitId, setHabitFormState, setEditingHabitId, setHabitFormVisible,
    honorForm, editingHonorId, setHonorFormState, setEditingHonorId, setHonorFormVisible,
    backfillHabitId, setBackfillHabitId,
    pendingDel, setConfirmVisible, setBadgeCount,
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

  /* ===================== 当日打卡（v0.2：连续累积 + 最长记录永久保存） ===================== */
  /** 返回值供仪式感使用：newBest=true 表示本次刷新了历史最长连续 */
  const toggleToday = useCallback(
    (habitId: string, rect?: { x: number; y: number }): { newBest: boolean; streak: number } | null => {
      const h = habits.find((x) => x.id === habitId);
      if (!h) return null;
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
      return { newBest, streak };
    },
    [habits, settings.weekStartOn, lang, dict, showToast, fireBurst, hapticsOn, applyHabit]
  );

  /* ===================== 计划休息日（v0.2 3.1） ===================== */
  /** 只能提前或当天标记；历史日期禁止补设。当天实际打卡可直接覆盖为打卡 */
  const toggleRest = useCallback(
    (habitId: string, date: string) => {
      const h = habits.find((x) => x.id === habitId);
      if (!h) return;
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
    [habits, lang, showToast, applyHabit]
  );

  /* ===================== 7 天补录面板 ===================== */
  const openBackfill = useCallback((habitId: string) => setBackfillHabitId(habitId), [setBackfillHabitId]);
  const closeBackfill = useCallback(() => setBackfillHabitId(null), [setBackfillHabitId]);
  /** v0.2：补签只能生成打卡记录，仅限过去 7 天且未标记休息日；不刷新最长连续（不触发仪式） */
  const toggleBackfillDate = useCallback((habitId: string, date: string) => {
    const h = habits.find((x) => x.id === habitId);
    if (!h) return;
    if (!canMakeupOn(h, date)) { showToast(dict.backfillLocked); return; }
    const nh: Habit = { ...h, checkIns: { ...h.checkIns } };
    if (nh.checkIns[date]) delete nh.checkIns[date];
    else nh.checkIns[date] = true as const;
    applyHabit(nh);
  }, [habits, dict, showToast, applyHabit]);

  /* ===================== 习惯表单 ===================== */
  const openHabitForm = useCallback((h: Habit | null) => {
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
  }, [setEditingHabitId, setHabitFormState, setHabitFormVisible]);

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
      // v0.2 付费边界：免费版最多 5 个习惯；第 6 个温和提示一次，不反复弹窗、不主动推销
      if (!pro && habits.length >= FREE_HABIT_LIMIT) {
        openPay();
        showToast(lang === "zh"
          ? "免费版可创建 5 个习惯。买断一次，永久不限数量。"
          : "Free version allows 5 habits. Go unlimited with a one-time purchase.");
        return;
      }
      const nh: Habit = { id: uid(), createdAt: new Date().toISOString(), isArchived: false, checkIns: {}, ...base };
      const nl = [...habits, nh];
      setHabits(nl);
      persist(snapshotNow({ habits: nl }));
      showToast(lang === "zh" ? "习惯已添加" : "Habit added", true);
      if (base.reminderEnabled && base.reminderTime) void scheduleTaskReminder(nh.id, nh.name, base.reminderTime);
    }
    setHabitFormVisible(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [habitForm, editingHabitId, habits, pro, openPay, lang, dict, showToast, setHabits, persist, snapshotNow, setHabitFormVisible]);

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

  /* ===================== 删除确认 ===================== */
  const askDelete = useCallback((kind: "habit" | "honor", id: string) => {
    pendingDel.current = { kind, id };
    setConfirmVisible(true);
  }, [pendingDel, setConfirmVisible]);

  const closeConfirm = useCallback(() => { pendingDel.current = null; setConfirmVisible(false); }, [pendingDel, setConfirmVisible]);

  const doDelete = useCallback(() => {
    const p = pendingDel.current;
    if (!p) return;
    if (p.kind === "habit") {
      const nl = habits.filter((x) => x.id !== p.id);
      setHabits(nl);
      persist(snapshotNow({ habits: nl }));
      void cancelTaskReminder(p.id);
    } else {
      const nl = honors.filter((x) => x.id !== p.id);
      setHonors(nl);
      persist(snapshotNow({ honors: nl }));
    }
    pendingDel.current = null;
    setConfirmVisible(false);
    showToast(dict.delete === "Delete" ? (lang === "zh" ? "已删除" : "Deleted") : (lang === "zh" ? "已删除" : "Deleted"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [habits, honors, dict, lang, showToast, persist, snapshotNow, pendingDel, setConfirmVisible, setHabits, setHonors]);

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
    askDelete, closeConfirm, doDelete, importBackup,
  };
}
