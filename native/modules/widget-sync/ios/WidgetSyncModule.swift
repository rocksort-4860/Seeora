import ExpoModulesCore
import WidgetKit

/**
 * WidgetSync —— 主 App → WidgetKit 扩展的数据桥
 * 把「今日打卡快照」JSON 写入 App Group 共享 UserDefaults，并触发小组件时间线刷新。
 * 仅 iOS 有意义；JS 侧（src/lib/widgetSync.ts）在非 iOS / 模块缺失时静默降级。
 */
public class WidgetSyncModule: Module {
  private let suiteName = "group.com.seeora.app"
  private let snapshotKey = "widget_snapshot"

  public func definition() -> ModuleDefinition {
    Name("WidgetSync")

    Function("setSnapshot") { (json: String) in
      UserDefaults(suiteName: self.suiteName)?.set(json, forKey: self.snapshotKey)
      WidgetCenter.shared.reloadAllTimelines()
    }
  }
}
