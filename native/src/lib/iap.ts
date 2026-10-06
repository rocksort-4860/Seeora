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

/** 网络 / StoreKit 调用硬超时：避免 getOfferings 等网络请求永久挂起，导致购买页一直转圈（苹果拒审项）。 */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("iap-timeout")), ms);
    p.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); }
    );
  });
}

const IAP_TIMEOUT_MS = 8000;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let loadPromise: Promise<any> | null = null;

/**
 * 懒加载 RevenueCat：仅原生 + 已配置 key 时才求值模块（避免冷启动触碰原生 TurboModule 崩溃）。
 *
 * ★ 缓存的是 **Promise 本身**，不是「已发起」的布尔量 —— 这是本文件最容易写错的一处：
 *   · 旧实现是 `purchasesLoaded: boolean` + 一个模块变量。布尔量只能表达「已发起」，
 *     表达不了「已完成」。弹层打开时价格 hook 先发起初始化，几百毫秒内用户/审核员
 *     点「买断」会**并发**进入这里 → 第二次调用立刻返回尚未赋值的模块变量（null）
 *     → 判定失败并提示「请检查网络」。冷启动后第一次点购买**必然**命中这条竞态。
 *   · 改成缓存 Promise 后，并发调用共享同一次加载；拿到 null 只可能是
 *     RC_KEY 未配 / web / import 失败，与调用时序无关。
 *
 * ★ 失败也缓存：import 失败 = 模块不存在（或构建里没打进原生模块），重试无意义。
 *   若将来要加「重试」按钮，**必须显式 `loadPromise = null;`** 后再调本函数 ——
 *   只调一次 getPurchases() 拿到的仍是那个已定局的旧 Promise，不会重新加载。
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getPurchases(): Promise<any> {
  if (!loadPromise) {
    loadPromise = (async () => {
      if (!RC_KEY || Platform.OS === "web") return null;
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mod: any = await import("react-native-purchases");
        const P = mod.default ?? mod;
        P.configure({ apiKey: RC_KEY });
        return P;
      } catch {
        return null;
      }
    })();
  }
  return loadPromise;
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
      /* ★ 无价格源（未配 key / web / 原生模块加载失败）也必须**结束加载态**。
       *   ready 若永远停在 false，会有两个后果，且都是拒审项：
       *     ① 价格位永久显示「价格加载中…」（用户以为卡死）；
       *     ② 买断按钮被 `disabled={... || !ready}` 永久禁用 —— 看得见却永远点不动，
       *        比 P0-1 那条竞态更严重（Guideline 2.1：功能不可用）。
       *   置 true 只影响「加载中 vs 已结束」的语义，「取到价没有」由 prices 表达。 */
      if (!rc) { if (on) setReady(true); return; }
      try {
        const off: any = await withTimeout(rc.getOfferings(), IAP_TIMEOUT_MS);
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
          /* ★ 这里**无条件**置 true：ready 的语义是「加载已结束」，不是「拿到价了」。
           *   旧写法按「有没有拿到价」置位，于是漏掉了第四条路：
           *     ① 未配 key / web / 原生模块加载失败 → 上面 `if (!rc)` 已置 true
           *     ② 超时 / getOfferings 抛错          → 下面的 catch 已置 true
           *     ③ 正常取到价                        → 置 true
           *     ④ ★ 请求成功、但 Offering 里没挂本商品 / priceString 为空
           *        （后台漏挂商品、或商品元数据尚未同步完整）→ 旧写法把 ready 留成 false
           *   第 ④ 条的后果与 ① 相同：价格位永久显示「价格加载中…」，
           *   买断按钮被 `disabled={... || !ready}` **永久禁用**且没有任何自救入口（拒审项）。
           *   所以这里必须无条件归位：「有没有价」由 prices 表达，
           *   「已结束但没价」由 priceState 判定 —— UI 必须给出可见原因 + 重试（见 pro.tsx）。 */
          setReady(true);
        }
      } catch {
        // 超时或读取失败：停止 loading，价格位回落占位符，由 UI 决定下一步
        if (on) setReady(true);
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

/**
 * 购买结果三态。★ 必须区分「用户主动取消」与「真失败」：
 *   StoreKit 上用户点「取消」也走异常路径，若与网络/配置故障合并成同一种结果，
 *   界面就会把「我自己点的取消」报成「购买未完成，请检查网络」——
 *   用户以为付不了款，审核员（测内购必点一次取消）会判内购功能损坏（Guideline 2.1）。
 */
export type PurchaseOutcome = "ok" | "cancelled" | "failed";

// 购买：有 RC key → 走 RevenueCat 真实购买；无 key 且开了演示开关 → 演示成功；否则失败（不静默解锁）
export async function purchasePlan(_plan: PlanKey): Promise<PurchaseOutcome> {
  const rc = await getPurchases();
  if (!rc) return demoIapEnabled() ? "ok" : "failed";
  try {
    const pkgs: any = await withTimeout(rc.getOfferings(), IAP_TIMEOUT_MS);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const all: any[] = pkgs.current?.availablePackages || [];
    const targetId = RC_PRODUCT_IDS.l;
    const hit =
      // 只认本 App 自己的商品 ID，绝不用 all[0] 兜底：
      // 兜底会在后台误挂其它商品 / 新增套餐时，把钱花到用户没选的东西上（退款 + 拒审风险）。
      all.find(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (p: any) =>
          p.product?.identifier === targetId ||
          p.identifier === targetId ||
          p.packageType === "LIFETIME" ||
          p.identifier === "$rc_lifetime"
      );
    if (!hit) return "failed"; // 后台没挂本 App 的商品：属配置故障，不是用户取消
    const { customerInfo } = await rc.purchasePackage(hit);
    const ent = customerInfo?.entitlements?.active || {};
    const hasEntitlement = !!ent["seeora_pro"];
    const hasNonSubscription = Object.keys(customerInfo?.nonSubscriptionTransactions || {}).length > 0;
    const hasAllPurchased = (customerInfo?.allPurchasedProductIdentifiers || []).includes("seeora_pro_lifetime");
    return hasEntitlement || hasNonSubscription || hasAllPurchased ? "ok" : "failed";
  } catch (e) {
    /* RevenueCat 用 error.userCancelled 标记「用户在 StoreKit 面板上点了取消」。
     * 这条必须单独成态：它不是故障，界面不提示、不涂红、不写「检查网络」。 */
    const cancelled = !!(e as { userCancelled?: boolean } | null | undefined)?.userCancelled;
    return cancelled ? "cancelled" : "failed";
  }
}

/** 恢复购买结果（带原因，供 UI 给出准确提示，避免把「按钮文案」当错误提示弹） */
export type RestoreResult = { ok: boolean; reason?: "none" | "error" | "timeout" | "unconfigured" };

// 恢复购买：无 RC key → 直接失败（非演示态，防止伪造权益）
export async function restorePurchases(): Promise<RestoreResult> {
  const rc = await getPurchases();
  /* ★ 必须与「网络故障」区分开：无 RC key / web端 时返回 unconfigured，
   *   否则 usePro 会把它渲染成「恢复失败，请检查网络连接」——
   *   把「原生模块没配」说成网络问题，用户按提示重试一万次也没用（台账 A4 少一态）。 */
  if (!rc) return { ok: false, reason: "unconfigured" };
  try {
    const info: any = await withTimeout(rc.restorePurchases(), IAP_TIMEOUT_MS);
    const ent = info?.entitlements?.active || {};
    const hasEntitlement = !!ent["seeora_pro"];
    const hasAllPurchased = (info?.allPurchasedProductIdentifiers || []).includes("seeora_pro_lifetime");
    return { ok: hasEntitlement || hasAllPurchased }; // ok=false 且无 reason = 没找到可恢复的购买
  } catch (e) {
    const msg = e && typeof (e as Error).message === "string" ? (e as Error).message : "";
    return { ok: false, reason: msg === "iap-timeout" ? "timeout" : "error" };
  }
}

/* ===================== 权益校验（台账 A-05 / A6） ===================== */

/**
 * 权益核验结果：
 *   active   —— 苹果侧确认有权益（或确有本商品的一次性购买记录）
 *   inactive —— 苹果侧**明确**回答「没有任何本商品购买记录」
 *   unknown  —— 说不上来（未配 key / web / 网络超时 / getCustomerInfo 抛错）
 */
export type EntitlementSync = "active" | "inactive" | "unknown";

/**
 * 与苹果侧核对买断权益（台账 A-05：本项目原先「只信本地 {pro:true} 布尔，全项目 0 处 getCustomerInfo」）。
 *
 * ★ 为什么不在冷启动调用：`iap.ts` 的红线是「启动时绝不初始化 RevenueCat」，
 *   冷启动 configure 会触碰原生 TurboModule —— 这正是 iOS 26 启动崩溃的触发路径。
 *   所以本函数只由**用户主动打开买断页 / 支付弹层**时触发（那时 RC 本来就要被 configure 来取价格）。
 *
 * ★ 语义边界（决定 usePro 怎么用）：
 *   · active  → 可以**补回**本地丢失的凭证（重装后没点「恢复购买」的用户，靠这条自动找回）。
 *   · inactive→ 只有在苹果侧**明确**返回「无购买记录」时才给出；unknown **绝不**等于未购买，
 *              据此降级会把网络抖动变成「已付费用户被剥夺权益」。
 *   三个信号任一成立即视为 active：entitlement 命中 / 存在非订阅交易 / 已购商品列表含本商品 ID。
 *   对一次性买断而言，`allPurchasedProductIdentifiers` 由 StoreKit 直接给出，最权威。
 */
export async function syncEntitlement(): Promise<EntitlementSync> {
  const rc = await getPurchases();
  if (!rc) return "unknown";
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const info: any = await withTimeout(rc.getCustomerInfo(), IAP_TIMEOUT_MS);
    const ent = info?.entitlements?.active || {};
    const hasEntitlement = !!ent["seeora_pro"];
    const hasNonSubscription = Object.keys(info?.nonSubscriptionTransactions || {}).length > 0;
    const hasAllPurchased = (info?.allPurchasedProductIdentifiers || []).includes(RC_PRODUCT_IDS.l);
    return hasEntitlement || hasNonSubscription || hasAllPurchased ? "active" : "inactive";
  } catch {
    return "unknown"; // 超时 / 无网络 / SDK 报错 —— 一律不下结论
  }
}
