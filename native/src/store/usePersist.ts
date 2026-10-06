/**
 * 持久化与首载（Seeora）：sd.local 快照写入 + 首载 hydration
 * 从 store/app.tsx 拆出；行为对齐 Seeora 范式
 */
import { useCallback, useEffect } from "react";
import type { Dispatch, SetStateAction } from "react";
import { sget, sset, SK } from "@/lib/storage";
import type { Lang } from "@/lib/i18n";
import type { Habit, Honor, SettingsState, ThemeMode } from "@/store/app";

/* ===================== 快照 ===================== */
// 持久化快照：本地全部状态的序列化形态（habits / honors / settings / 安装日 / 更新时间）
export interface Snapshot {
  habits: Habit[];
  honors: Honor[];
  settings: SettingsState;
  installAt: string;
  updatedAt: string;
}

export interface PersistState {
  habits: Habit[];
  honors: Honor[];
  settings: SettingsState;
  installAt: string;
}

export function usePersist(s: PersistState) {
  const { habits, honors, settings, installAt } = s;
  const persist = useCallback((snap: Snapshot) => {
    void sset(SK.local, snap);
  }, []);
  const snapshotNow = useCallback(
    (over: Partial<Snapshot> = {}): Snapshot => ({
      habits,
      honors,
      settings,
      installAt,
      updatedAt: new Date().toISOString(),
      ...over,
    }),
    [habits, honors, settings, installAt]
  );
  return { persist, snapshotNow };
}

export interface HydrationSetters {
  setLangState: Dispatch<SetStateAction<Lang>>;
  setThemeState: Dispatch<SetStateAction<ThemeMode>>;
  setVisited: Dispatch<SetStateAction<boolean>>;
  setInstallAt: Dispatch<SetStateAction<string>>;
  setHabits: Dispatch<SetStateAction<Habit[]>>;
  setHonors: Dispatch<SetStateAction<Honor[]>>;
  setSettings: Dispatch<SetStateAction<SettingsState>>;
  setPurchased: Dispatch<SetStateAction<boolean>>;
  setTrialUntil: Dispatch<SetStateAction<number | null>>;
  setHydrated: Dispatch<SetStateAction<boolean>>;
}

// 首载 hydration：读 sd.* 恢复全部状态
export function useHydration(d: HydrationSetters) {
  useEffect(() => {
    // 冷启动崩溃二分诊断：DIAG 且 STAGE<5 时跳过 AsyncStorage 首载，避免干扰定位
    if (process.env.EXPO_PUBLIC_DIAG === "1" && Number(process.env.EXPO_PUBLIC_DIAG_STAGE ?? "0") < 5) {
      d.setHydrated(true);
      return;
    }
    (async () => {
      const [lg, vi, ia, g, r, th, tuRaw] = await Promise.all([
        sget<Lang>(SK.lang, "en"),
        sget<boolean>(SK.visited, false),
        sget<string>(SK.installAt, ""),
        sget<Snapshot | null>(SK.local, null),
        sget<{ pro?: boolean } | null>(SK.receipt, null),
        sget<ThemeMode>(SK.theme, "system"),
        sget<number | null>(SK.trialUntil, null),
      ]);
      const arr = (v: unknown): Habit[] =>
        Array.isArray(v) ? (v as Habit[]).filter((x) => x && typeof x === "object") : [];
      const hrs = (v: unknown): Honor[] =>
        Array.isArray(v) ? (v as Honor[]).filter((x) => x && typeof x === "object") : [];
      const snap = g;
      const defSettings: SettingsState = {
        weekStartOn: "mon", haptics: true, icloudSync: false, badge: false, dailyReminder: false,
      };
      const mergedSettings: SettingsState = {
        ...defSettings,
        ...(snap && snap.settings && typeof snap.settings === "object" ? snap.settings : {}),
      } as SettingsState;
      const isPurchased = !!(r && r.pro);
      /* 本地 7 天试用：**用户手动领取**才开始计时（领取动作见 store/app.tsx 的 startTrial）。
       *   原实现是「装完首次启动自动开启」—— 用户全程无感知，第 8 天突然被降级，
       *   属于「服务悄悄变了」的差评来源；且与网页原型（点按钮才计时）口径分裂。
       *   改为手动领取后三种状态由 trialUntil 单一表达：
       *     trialUntil == null   → 从未领取（纯免费版，Pro 页显示「开始 7 天免费试用」）
       *     trialUntil > now     → 试用进行中（享完整专业版功能）
       *     trialUntil <= now    → 试用已结束（超限习惯冻结，见 app.tsx 的 frozenIds）
       *   ★ 本函数只负责把已存的值**读回来**，绝不在此写入任何试用时间。 */
      const trialUntil = tuRaw;
      d.setLangState(lg === "zh" ? "zh" : "en");
      d.setThemeState(th === "light" || th === "dark" ? th : "system");
      d.setVisited(!!vi);
      d.setInstallAt(ia || "");
      d.setHabits(arr(snap?.habits));
      d.setHonors(hrs(snap?.honors));
      d.setSettings(mergedSettings);
      d.setPurchased(isPurchased); // 从设备凭证恢复买断
      d.setTrialUntil(trialUntil);
      d.setHydrated(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
