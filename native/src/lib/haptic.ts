/**
 * iOS 原生触觉反馈封装（带 Web / Android / 无马达安全静默降级）
 * - hapticTaskDone: 单项任务勾选打卡时触发 Light Impact（清脆物理敲击感）
 * - hapticAllDone: 全清成就达成弹窗弹出时触发 Success Notification（振奋双震动）
 */
import * as Haptics from "expo-haptics";

export function hapticTaskDone(): void {
  try {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {
    // 非真机或不支持触觉反馈平台静默忽略
  }
}

export function hapticAllDone(): void {
  try {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {
    // 静默忽略
  }
}
