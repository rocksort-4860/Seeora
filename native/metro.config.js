/**
 * Metro 配置（2026-10-16 重写后标准化）：
 * 使用 @expo/metro-config 默认配置，移除 miaoda-expo-devkit 的 withDevkit 包装
 * （其 patchNativeWindCachePath 会劫持缓存路径，是此前多次构建故障的来源之一）。
 */
const { getDefaultConfig } = require('expo/metro-config');

module.exports = getDefaultConfig(__dirname);
