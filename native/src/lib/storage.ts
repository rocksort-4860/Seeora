/**
 * 本地持久化（说明文档 §3）：纯本地 8 个 key，无账号、无后端、无云同步
 * sd.local 主快照 / sd.receipt 内购凭证 / sd.visited / sd.installAt / sd.nudged / sd.lang / sd.theme / sd.notif
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

export const SK = {
  local: "sd.local",
  receipt: "sd.receipt",
  visited: "sd.visited",
  installAt: "sd.installAt",
  nudged: "sd.nudged",
  lang: "sd.lang",
  theme: "sd.theme",
  notif: "sd.notif",
  /** 7 天免费试用截止时间戳（ms）；null = 未启动。仅本地计时，与苹果/RevenueCat 无关 */
  trialUntil: "sd.trialUntil",
  /** v0.2 5.4：是否已在首次打开圆环视图时看过引导小字 */
  ringHint: "sd.ringHint",
} as const;

/** 本地 7 天免费试用（仅计时，与苹果 / RevenueCat 无关） */
export const TRIAL_DAYS = 7;
export const TRIAL_MS = TRIAL_DAYS * 24 * 60 * 60 * 1000;

export async function sget<T>(key: string, def: T): Promise<T> {
  try {
    const v = await AsyncStorage.getItem(key);
    return v == null ? def : (JSON.parse(v) as T);
  } catch {
    return def;
  }
}

export async function sset(key: string, v: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(v));
  } catch {
    // 本地写入失败静默降级：下次启动重读
  }
}
