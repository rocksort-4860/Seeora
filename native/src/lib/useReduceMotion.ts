/**
 * 系统「减弱动态效果」开关（iOS：设置 › 辅助功能 › 动态效果 › 减弱动态效果）。
 * 来源：RockSort 已验证实现（922 工程），原样移植到 Seeora。
 * 撒花 / 位移 / 缩放等非必要动效应随系统设置关闭。
 *
 * ⚠️ 不能用 Reanimated 的 `useReducedMotion` —— 实测（react-native-reanimated 4.x，
 *    `src/hook/useReducedMotion.ts`）它在**模块加载时求值一次**就返回一个常量：
 *
 *      const IS_REDUCED_MOTION_ENABLED_IN_SYSTEM = isReducedMotionEnabledInSystem();
 *      export function useReducedMotion() { return IS_REDUCED_MOTION_ENABLED_IN_SYSTEM; }
 *
 *    而 `isReducedMotionEnabledInSystem()` 只读原生**启动时**注入的
 *    `global._REANIMATED_IS_REDUCED_MOTION`。库自己的注释就写着
 *    “Changing the reduced motion system setting doesn't cause your components to rerender”。
 *    也就是说：用户在 App 运行期间打开这个开关**不会生效**，必须杀掉 App 重开 ——
 *    对真正需要它的无障碍用户来说，这是实打实的失效（本项目消费方：Sheet / Confetti）。
 *
 * 这里自己实现：**同步**取初值（见下）+ 订阅 `reduceMotionChanged` 实时跟随。
 *
 * 副作用说明：`reduce` 会成为运行期可变的依赖，由它派生的动画时长也随之变化。
 * 因此 Sheet 已把时长挪进 ref、effect 依赖只留 `[visible, anim]` ——
 * 用户切换系统开关时 effect **不会重跑**，正在播的动画不会被打断。
 * 卸载路径本就不依赖动画回调：由 `setTimeout` 兜底 + `pointerEvents` 收紧共同保证
 * （详见 Sheet.tsx 内的说明）。
 */
import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

/**
 * 同步读一次系统开关 —— 只为拿到「第一帧就正确」的初值。
 *
 * `AccessibilityInfo.isReduceMotionEnabled()` 返回的是 Promise，拿不到同步初值：
 * 若把初值写死 false，则开关处于**开启**状态时，App 冷启动后最早开始的那次动画
 * 仍会按完整时长播一遍（漏网动画）。
 *
 * 这里读的是 Reanimated 原生端在**启动时同步注入**的同一个全局量 ——
 * 它在我们渲染之前就已就位，所以第一帧就是对的。
 * 取不到（未装 Reanimated / 字段改名 / 非布尔）即退回 false，与旧行为完全一致，无风险。
 */
function readSyncReduceMotion(): boolean {
  const g = (globalThis as { _REANIMATED_IS_REDUCED_MOTION?: unknown })._REANIMATED_IS_REDUCED_MOTION;
  return typeof g === "boolean" ? g : false;
}

export function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(readSyncReduceMotion);

  useEffect(() => {
    let alive = true;
    // 异步再读一次：既兜住上面同步初值取不到的情况，也覆盖「初值取到之后又被改动」的窗口。
    void AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      if (alive) setReduce(v);
    });
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", (v) => setReduce(v));
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);

  return reduce;
}
