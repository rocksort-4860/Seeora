/**
 * 本地通知（说明文档 §M1/M6）：expo-notifications 封装
 * 原生：每日重复触发；Web：模块空操作（懒加载，Web 永不求值），toast 提示保持不变
 */
import { Platform } from "react-native";
import type { DailyTriggerInput } from "expo-notifications";

let Notifications: typeof import("expo-notifications") | null = null;
let loaded = false;

// 懒加载原生模块：首次调用时才求值，Web / 异常环境降级为 null
async function getNotifications(): Promise<typeof import("expo-notifications") | null> {
  if (loaded) return Notifications;
  loaded = true;
  if (Platform.OS === "web") return null;
  try {
    const mod = await import("expo-notifications");
    mod.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
    Notifications = mod;
  } catch {
    Notifications = null;
  }
  return Notifications;
}

// 申请通知权限（用户首次添加带提醒任务时调用）
export async function requestNotifPermission(): Promise<void> {
  const mod = await getNotifications();
  if (!mod) return;
  try {
    await mod.requestPermissionsAsync();
  } catch {
    /* 权限被拒静默降级 */
  }
}

// 取消某任务的本地提醒（删除任务 / 提醒被清空时调用，identifier = 任务 id）
export async function cancelTaskReminder(taskId: string): Promise<void> {
  const mod = await getNotifications();
  if (!mod) return;
  await requestNotifPermission();
  try {
    await mod.cancelScheduledNotificationAsync(taskId);
  } catch {
    /* 通知不存在时静默 */
  }
}

// 为任务设置本地提醒（每日 HH:mm 重复；原生生效，Web 跳过）
// fix: 去掉 as never 强转，改用 Notifications.SchedulableTriggerInputTypes.DAILY 枚举值
export async function scheduleTaskReminder(
  taskId: string,
  text: string,
  remindAt: string,
  _dueDate?: string
): Promise<void> {
  const mod = await getNotifications();
  if (!mod) return;
  await requestNotifPermission();
  try {
    await mod.cancelScheduledNotificationAsync(taskId); // 先取消旧通知
    if (!remindAt) return; // 提醒时间被清空 → 仅取消不重建
    const m = remindAt.match(/^(\d{1,2}):(\d{2})/);
    if (!m) return;
    const trigger = {
      type: "daily",
      hour: +m[1],
      minute: +m[2],
    } as DailyTriggerInput;
    await mod.scheduleNotificationAsync({
      identifier: taskId,
      content: { title: "Streakora", body: text },
      trigger,
    });
  } catch {
    /* Web / 模拟器静默降级 */
  }
}

// 设置应用角标数字（懒加载原生模块；count<=0 时清空）。Web / 异常静默降级
export async function setAppBadge(count: number): Promise<void> {
  const mod = await getNotifications();
  if (!mod || !mod.setBadgeCountAsync) return;
  try {
    await mod.setBadgeCountAsync(Math.max(0, count));
  } catch {
    /* 静默降级 */
  }
}
