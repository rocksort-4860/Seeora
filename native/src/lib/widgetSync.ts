/**
 * 主屏小组件数据同步（Seeora）：主 App → WidgetKit 扩展
 * 快照经 App Group（group.com.seeora.app）共享 UserDefaults 传递，
 * 键名 widget_snapshot，结构与 targets/widget/index.swift 的 WidgetSnapshot 严格一致。
 *
 * 红线（与 iap.ts 同一纪律）：绝不在模块顶层 require 原生模块 ——
 * 非 iOS / 原生模块未打进构建时一律静默降级，绝不影响 App 主流程。
 */
import { Platform } from "react-native";
import type { Habit } from "@/store/app";
import { todayStr } from "@/lib/dates";

interface WidgetNativeModule {
  setSnapshot?: (json: string) => void;
}

let cached: WidgetNativeModule | null | undefined;

function getModule(): WidgetNativeModule | null {
  if (cached !== undefined) return cached;
  cached = null;
  if (Platform.OS === "ios") {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { requireNativeModule } = require("expo-modules-core");
      const m = requireNativeModule("WidgetSync") as WidgetNativeModule;
      if (m && typeof m.setSnapshot === "function") cached = m;
    } catch {
      cached = null; // 模块未链接（web / Expo Go / 旧构建）：小组件不可用，App 不受影响
    }
  }
  return cached;
}

/**
 * 把今日进度快照推给主屏小组件。任何打卡/习惯/语言变化后调用（store 已挂 effect）。
 * best-effort：任何异常都吞掉，绝不让小组件同步影响打卡主链路。
 */
export function syncWidgetSnapshot(habits: Habit[], lang: "zh" | "en"): void {
  const m = getModule();
  if (!m?.setSnapshot) return;
  try {
    const today = todayStr();
    const active = habits.filter((h) => !h.isArchived);
    const done = active.filter((h) => !!h.checkIns?.[today]).length;
    const items = active.slice(0, 4).map((h) => ({
      emoji: h.emoji,
      name: lang === "zh" ? h.nameZh || h.name : h.name || h.nameZh,
      color: h.color,
      state: h.rests?.[today] ? "rest" : h.checkIns?.[today] ? "done" : "open",
    }));
    m.setSnapshot(JSON.stringify({ date: today, done, total: active.length, habits: items }));
  } catch {
    /* 静默降级 */
  }
}
