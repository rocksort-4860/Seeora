/**
 * 内购封装（Seeora）：RevenueCat 对接 —— 单商品「终身买断」
 * 红线：绝不在模块顶层或 AppProvider 初始化时 import react-native-purchases / 不调用 Purchases.configure。
 *       仅在 Pro/Pay 弹层真正打开（usePlanPrices(enabled=true)）时才动态 import + configure。
 * 价格硬规：代码中不出现任何具体价格；数值运行时从 App Store Connect 后台经 RevenueCat 动态读取。
 * 未配置 EXPO_PUBLIC_RC_IOS_KEY 时为演示态：购买直接成功并写本地凭证，价格位显示占位符（由 UI 决定是否禁用）。
 */
import { useEffect, useState } from "react";
import { Platform } from "react-native";

// 唯一商品：一次性买断（价格挂在商品上，由苹果后台维护，改价无需改代码）
export type PlanKey = "l";
export const RC_PRODUCT_IDS: Record<PlanKey, string> = {
  l: "seeora_pro_lifetime",
};

// 兼容官方推荐与简写两种环境变量名称
const RC_KEY =
  process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ||
  process.env.EXPO_PUBLIC_RC_IOS_KEY ||
  "";

/** 是否配置了真实 RevenueCat key（原生端） */
export function hasRcKey(): boolean {
  return !!RC_KEY && Platform.OS !== "web";
}

/** 演示开关（安全兜底）：仅 EXPO_PUBLIC_DEMO_IAP=1 时，无 RC key 才允许演示态直接购买成功 */
export function demoIapEnabled(): boolean {
  return process.env.EXPO_PUBLIC_DEMO_IAP === "1";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let Purchases: any = null;
let purchasesLoaded = false;

// 懒加载 RevenueCat：仅原生 + 已配置 key 时才求值模块（避免冷启动触碰原生 TurboModule 崩溃）
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getPurchases(): Promise<any> {
  if (purchasesLoaded) return Purchases;
  purchasesLoaded = true;
  if (!RC_KEY || Platform.OS === "web") return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod: any = await import("react-native-purchases");
    Purchases = mod.default ?? mod;
    Purchases.configure({ apiKey: RC_KEY });
  } catch {
    Purchases = null;
  }
  return Purchases;
}

export type PlanPrices = Record<PlanKey, string>;

/**
 * 动态价格：从 RevenueCat Offerings 读取终身商品的本地化价格字符串。
 * 返回 prices（未取到为 ""）与 ready（是否成功取到）。
 * 仅当 enabled=true（Pro/Pay 弹层打开）才初始化 RevenueCat。
 */
export function usePlanPrices(enabled: boolean = false, nonce: number = 0): { prices: PlanPrices; ready: boolean } {
  const [prices, setPrices] = useState<PlanPrices>({ l: "" });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!enabled) return; // 弹层未打开：不初始化 RevenueCat，避免冷启动崩溃
    let on = true;
    (async () => {
      const rc = await getPurchases();
      if (!rc) return; // 演示态：无价格源，展示位保持占位符
      try {
        const off = await rc.getOfferings();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const all: any[] = off.current?.availablePackages || [];
        const targetId = RC_PRODUCT_IDS.l;
        const hit = all.find(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (p: any) =>
            p.product?.identifier === targetId ||
            p.identifier === targetId ||
            p.packageType === "LIFETIME" ||
            p.identifier === "$rc_lifetime"
        );
        const s = hit?.product?.priceString;
        if (on) {
          setPrices({ l: typeof s === "string" && s ? s : "" });
          setReady(typeof s === "string" && s ? true : false);
        }
      } catch {
        // 读取失败：保持占位符，由 UI 决定禁用或占位展示
      }
    })();
    return () => {
      on = false;
    };
  }, [enabled, nonce]);

  return { prices, ready };
}

/** 价格展示位统一出口：取到用 priceString；未取到显示占位符（配置中→loading 文案，演示态→"—"） */
export function priceLabel(prices: PlanPrices, key: PlanKey, ready: boolean, loadingTxt: string): string {
  return prices[key] || (hasRcKey() && !ready ? loadingTxt : "—");
}

// 购买：有 RC key → 走 RevenueCat 真实购买；无 key 且开了演示开关 → 演示成功；否则失败（不静默解锁）
export async function purchasePlan(_plan: PlanKey): Promise<boolean> {
  const rc = await getPurchases();
  if (!rc) return demoIapEnabled();
  try {
    const pkgs = await rc.getOfferings();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const all: any[] = pkgs.current?.availablePackages || [];
    const targetId = RC_PRODUCT_IDS.l;
    const hit =
      all.find(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (p: any) =>
          p.product?.identifier === targetId ||
          p.identifier === targetId ||
          p.packageType === "LIFETIME" ||
          p.identifier === "$rc_lifetime"
      ) || all[0];
    if (!hit) return false;
    const { customerInfo } = await rc.purchasePackage(hit);
    const ent = customerInfo?.entitlements?.active || {};
    const hasEntitlement = !!ent["seeora_pro"];
    const hasNonSubscription = Object.keys(customerInfo?.nonSubscriptionTransactions || {}).length > 0;
    const hasAllPurchased = (customerInfo?.allPurchasedProductIdentifiers || []).includes("seeora_pro_lifetime");
    return hasEntitlement || hasNonSubscription || hasAllPurchased;
  } catch {
    return false; // 用户取消 / 失败均视为未成功
  }
}

// 恢复购买：无 RC key → 演示态；有 key → restorePurchases
export async function restorePurchases(): Promise<boolean> {
  const rc = await getPurchases();
  if (!rc) return false;
  try {
    const info = await rc.restorePurchases();
    const ent = info?.entitlements?.active || {};
    const hasEntitlement = !!ent["seeora_pro"];
    const hasAllPurchased = (info?.allPurchasedProductIdentifiers || []).includes("seeora_pro_lifetime");
    return hasEntitlement || hasAllPurchased;
  } catch {
    return false;
  }
}
