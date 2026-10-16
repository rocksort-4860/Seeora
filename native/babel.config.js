/**
 * Babel 配置（2026-10-16 重写后标准化）：
 * 仅保留官方 babel-preset-expo，移除 miaoda-expo-devkit preset 与
 * NativeWind 所需的 jsxImportSource（样式已全部改为 RN 原生 StyleSheet）。
 */
module.exports = {
  presets: ['babel-preset-expo'],
};
