/**
 * 内购守卫测试（RevenueCat 懒加载 / 失败分级 / 权益核验）
 * 运行：node node_modules/jest/bin/jest.js src/lib/__tests__/iap.test.ts
 *
 * 为什么必须有这个文件（2026-10-02 实证）：
 *   原实现用 `purchasesLoaded: boolean`（只表达「已发起」）当幂等守卫。
 *   冷启动后第一次打开买断页 → 价格 hook 先发起模块加载 → 用户在几百毫秒内
 *   点「买断永久使用」→ 两条调用**并发**进入 getPurchases() →
 *   第二次立刻拿到尚未赋值的模块变量（null）→ 判失败 → 弹「购买未完成，请检查网络」。
 *   而「打开买断页、尽快点购买」正是审核员测内购的标准动作。
 *
 *   这条竞态只在**同一 tick 内并发**时出现，顺序调用永远正常 ——
 *   正因为如此，它是最容易「改完就算数」的漏网场景，必须用测试钉住。
 *
 * ★ 2026-10-06 修订（台账 P2-10）：
 *   原第二个用例自称「反向验证」，但它是**在测试里手写复刻一遍旧逻辑**再断言那个复刻品
 *   返回 null —— 与生产代码零关联，无论 iap.ts 怎么改都恒过，属于「看起来很有说服力
 *   其实什么都没测」的假测试。已删除，替换为两个对生产代码真实可观测行为的断言：
 *     ① 并发调用只 configure 一次（直接钉住「缓存 Promise」这个修复点本身）；
 *     ② 未配 RC key 时 restorePurchases 返回 unconfigured（不是「网络故障」）。
 */
import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";

/** 每个用例可改的桩状态（名字必须以 mock 开头，jest.mock 的工厂提升后才能安全引用） */
const mockRc = {
  configureCalls: 0,
  /** purchasePackage 的返回；null 表示用默认的「成功且带权益」 */
  purchaseResult: null as unknown,
  /** restorePurchases 的返回 */
  restoreResult: null as unknown,
  /** restorePurchases 抛出 */
  restoreError: null as Error | null,
  /** getCustomerInfo 的返回 */
  customerInfo: null as unknown,
  /** getCustomerInfo 抛出（用来造 unknown） */
  customerInfoError: null as Error | null,
};

const OK_INFO = { entitlements: { active: { seeora_pro: {} } } };

function resetMockRc() {
  mockRc.configureCalls = 0;
  mockRc.purchaseResult = null;
  mockRc.restoreResult = null;
  mockRc.restoreError = null;
  mockRc.customerInfo = null;
  mockRc.customerInfoError = null;
}

const RC_TEST_KEY = "appl_guard_test";

function setRcKey(on: boolean) {
  if (on) {
    process.env.EXPO_PUBLIC_RC_IOS_KEY = RC_TEST_KEY;
    delete process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY;
  } else {
    delete process.env.EXPO_PUBLIC_RC_IOS_KEY;
    delete process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY;
  }
}

// Platform 用桩：node 环境加载不了 react-native 的 Flow 源码；且必须是非 web 平台
// （web 会让 getPurchases() 直接返回 null，那就测不到真实加载路径了）
jest.mock("react-native", () => ({ Platform: { OS: "ios" } }));

// 内购 SDK 用桩：只保留守卫与失败分级所需的最小面
jest.mock("react-native-purchases", () => {
  const product = { identifier: "seeora_pro_lifetime", priceString: "$4.99" };
  const pkg = { identifier: "$rc_lifetime", packageType: "LIFETIME", product };
  return {
    __esModule: true,
    default: {
      configure: () => {
        mockRc.configureCalls += 1;
      },
      getOfferings: async () => ({ current: { availablePackages: [pkg] } }),
      purchasePackage: async () => mockRc.purchaseResult ?? { customerInfo: OK_INFO },
      restorePurchases: async () => {
        if (mockRc.restoreError) throw mockRc.restoreError;
        return mockRc.restoreResult ?? OK_INFO;
      },
      getCustomerInfo: async () => {
        if (mockRc.customerInfoError) throw mockRc.customerInfoError;
        return mockRc.customerInfo ?? OK_INFO;
      },
    },
  };
});

// iap.ts 在**模块顶层**读取 RC_KEY 与 Platform.OS —— 必须在 import 之前准备好，
// 否则 getPurchases() 会直接返回 null（那样测的就不是竞态了）。
// 每个用例都重新求值模块 —— loadPromise 是模块级缓存，不重置就测不到「首次加载」
const loadIap = () => import("@/lib/iap");

describe("iap 懒加载守卫（P0-1 首次点买断必然失败）", () => {
  beforeEach(() => {
    jest.resetModules();
    setRcKey(true);
    resetMockRc();
  });
  afterEach(() => {
    jest.resetModules();
  });

  it("同一 tick 内并发调用共享同一次加载：两次都成功，第二次不得拿到 null", async () => {
    const { purchasePlan } = await loadIap();
    // 模拟「打开买断页 → 价格还在加载时就点购买」：两次调用发生在同一 tick
    const [first, second] = await Promise.all([purchasePlan("l"), purchasePlan("l")]);
    expect(first).toBe("ok");
    // 旧实现里这里是 "failed" —— 即 UI 上那句「购买未完成，请检查网络」
    expect(second).toBe("ok");
  });

  it("并发调用只 configure 一次（钉住「缓存 Promise」这一修复点本身）", async () => {
    const { purchasePlan } = await loadIap();
    await Promise.all([purchasePlan("l"), purchasePlan("l"), purchasePlan("l")]);
    // 缓存布尔量的旧实现里，这里会是 3（每次都重新 configure）；
    // 缓存 Promise 的实现必须严格为 1 —— 重复 configure 会重置 SDK 内部状态。
    expect(mockRc.configureCalls).toBe(1);
  });
});

describe("失败分级：不把「没配 key」说成「网络故障」（台账 A4）", () => {
  beforeEach(() => {
    jest.resetModules();
    resetMockRc();
  });
  afterEach(() => {
    jest.resetModules();
    setRcKey(true); // 还原，避免影响其它用例
  });

  it("未配 RC key 时 restorePurchases 返回 unconfigured", async () => {
    setRcKey(false);
    const { restorePurchases } = await loadIap();
    await expect(restorePurchases()).resolves.toEqual({ ok: false, reason: "unconfigured" });
  });

  it("有 RC key 但苹果侧没有购买记录 → ok:false 且不带 reason（属正常态，不该涂红）", async () => {
    mockRc.restoreResult = { entitlements: { active: {} }, allPurchasedProductIdentifiers: [] };
    const { restorePurchases } = await loadIap();
    const r = await restorePurchases();
    expect(r.ok).toBe(false);
    expect(r.reason).toBeUndefined();
  });

  it("恢复购买抛超时 → reason=timeout（与真实报错 error 区分）", async () => {
    mockRc.restoreError = new Error("iap-timeout");
    const { restorePurchases } = await loadIap();
    await expect(restorePurchases()).resolves.toEqual({ ok: false, reason: "timeout" });
  });
});

describe("权益核验 syncEntitlement（台账 A-05：三个信号任一成立即 active）", () => {
  beforeEach(() => {
    jest.resetModules();
    setRcKey(true);
    resetMockRc();
  });
  afterEach(() => {
    jest.resetModules();
  });

  it("entitlement 命中 → active", async () => {
    mockRc.customerInfo = OK_INFO;
    const { syncEntitlement } = await loadIap();
    await expect(syncEntitlement()).resolves.toBe("active");
  });

  it("只有 allPurchasedProductIdentifiers 含本商品 → 仍判 active（一次性买断最权威的信号）", async () => {
    mockRc.customerInfo = {
      entitlements: { active: {} },
      allPurchasedProductIdentifiers: ["seeora_pro_lifetime"],
    };
    const { syncEntitlement } = await loadIap();
    await expect(syncEntitlement()).resolves.toBe("active");
  });

  it("只有非订阅交易记录 → 仍判 active", async () => {
    mockRc.customerInfo = {
      entitlements: { active: {} },
      nonSubscriptionTransactions: { t1: { productIdentifier: "seeora_pro_lifetime" } },
    };
    const { syncEntitlement } = await loadIap();
    await expect(syncEntitlement()).resolves.toBe("active");
  });

  it("苹果侧明确回答「什么都没买」→ inactive", async () => {
    mockRc.customerInfo = {
      entitlements: { active: {} },
      allPurchasedProductIdentifiers: [],
      nonSubscriptionTransactions: {},
    };
    const { syncEntitlement } = await loadIap();
    await expect(syncEntitlement()).resolves.toBe("inactive");
  });

  it("★ 查询抛错 → unknown，绝不能是 inactive（否则网络抖动会剥夺已付费用户权益）", async () => {
    mockRc.customerInfoError = new Error("boom");
    const { syncEntitlement } = await loadIap();
    const r = await syncEntitlement();
    expect(r).toBe("unknown");
    expect(r).not.toBe("inactive");
  });

  it("未配 key → unknown（同样不得当成未购买）", async () => {
    setRcKey(false);
    jest.resetModules();
    const { syncEntitlement } = await loadIap();
    await expect(syncEntitlement()).resolves.toBe("unknown");
  });
});
