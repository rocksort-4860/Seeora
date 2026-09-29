/**
 * 持久化与首载（Seeora）：sd.local 快照写入 + 首载 hydration
 * 从 store/app.tsx 拆出；行为对齐 Seeora 范式
 */
import { useCallback, useEffect } from "react";
import type { Dispatch, SetStateAction } from "react";
import { sget, sset, SK, TRIAL_MS } from "@/lib/storage";
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
      // 本地 7 天试用：首次打开（未买断且无试用记录）自动开启计时，仅本地、无关苹果
      let trialUntil = tuRaw;
      if (!isPurchased && trialUntil == null) {
        trialUntil = Date.now() + TRIAL_MS;
        void sset(SK.trialUntil, trialUntil);
      }
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
