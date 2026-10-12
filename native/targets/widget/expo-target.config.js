/**
 * Seeora 主屏小组件（WidgetKit 扩展）— @bacons/apple-targets 目标配置
 * 构建：EAS Build / prebuild 时自动生成本地 Widget Extension target
 * 数据：主 App 经 App Group（group.com.seeora.app）共享 UserDefaults 写入快照
 */
module.exports = {
  type: "widget",
  name: "SeeoraWidget",
  displayName: "Seeora",
  deploymentTarget: "17.0",
  entitlements: {
    "com.apple.security.application-groups": ["group.com.seeora.app"],
  },
};
