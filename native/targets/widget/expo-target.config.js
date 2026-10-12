/**
 * Seeora 主屏小组件（WidgetKit 扩展）— @bacons/apple-targets 目标配置
 * 构建：EAS Build 云端 prebuild 时自动生成本地 Widget Extension target
 * 数据：主 App 经 App Group（group.com.seeora.app）共享 UserDefaults 写入快照
 *
 * ⚠️ bundleIdentifier 必须与 Apple Developer 后台注册的 Widget App ID 一字不差。
 *    不写这个字段时，@bacons/apple-targets 会按「主 App bundleId + name」推导，
 *    得到 com.seeora.app.SeeoraWidget —— 与后台实际注册的 com.seeora.app.widget
 *    不符，结果是找不到对应 App ID、profile 生成失败，或小组件读不到 App Group 数据。
 *    （2026-10-12 后台已注册 com.seeora.app.widget 并绑定 group.com.seeora.app）
 *
 * appleTeamId 显式写出，不依赖「继承主 App target」的默认行为——
 * 本次盘点刚发现主 App 的 appleTeamId 曾被误填成 API Key ID，显式化便于审计。
 */
module.exports = {
  type: "widget",
  name: "SeeoraWidget",
  displayName: "Seeora",
  bundleIdentifier: "com.seeora.app.widget",
  appleTeamId: "ZFVWH8644U",
  deploymentTarget: "17.0",
  entitlements: {
    // 手动定义后，插件会跳过「自动同步主 App app groups」的默认分支，值原样写入
    // generated.entitlements，不会被二次加 group. 前缀（已读 with-widget.js 源码确认）。
    "com.apple.security.application-groups": ["group.com.seeora.app"],
  },
};
