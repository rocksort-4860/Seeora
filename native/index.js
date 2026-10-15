/**
 * 自定义入口（Seeora）
 * 存在意义：iOS 26 + Fabric 黑屏修复（build 12-14 二分定案：RNSScreen 原生层不绘制）。
 * enableScreens(false) 必须早于 expo-router 导航容器及其任何 Screen 的 import/渲染——
 * 放在 expo-router/entry 之前的模块顶层，是全应用最早的同步执行点，时序风险归零。
 * 门控：仅 EXPO_PUBLIC_DISABLE_SCREENS=1（diagnose 诊断档 / 修复确认后的生产档）生效；
 * Metro 构建时内联该变量，未设时整段为死代码，零开销。
 */
if (process.env.EXPO_PUBLIC_DISABLE_SCREENS === "1") {
  require("react-native-screens").enableScreens(false);
}

import "expo-router/entry";
