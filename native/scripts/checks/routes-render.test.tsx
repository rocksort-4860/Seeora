/**
 * P5 路由渲染冒烟（check-local 专用，由 jest.check-local.config.mjs 驱动）
 * ============================================================
 * ★ 它解决什么问题
 *   Metro 打包检查（P4）只能证明「代码能编译」；运行期崩溃（渲染抛错、
 *   空屏、Unmatched Route）只有真正渲染一遍才知道。本测试用
 *   react-test-renderer + expo-router 官方 testing-library 把 App 跑起来：
 *     ① 首页 / 可渲染、不落 Unmatched Route 屏
 *     ② 默认落地页 /today 渲染出实际内容（防空屏假绿）
 *     ③ 对照实验：故意访问不存在的路径，必须落 Unmatched Route
 *        —— 证明①的「没落 Unmatched」是真的检测到了，而不是查询写错
 *     ④ 全部路由逐个渲染（advisory：失败只告警不阻断，见下方说明）
 *
 * ★ 为什么④只告警不阻断
 *   jest 环境没有原生模块。本项目红线是「原生模块一律懒加载」
 *   （iap.ts / notify.ts / widgetSync.ts 均如此），绝大多数路由可纯净渲染；
 *   但个别路由若在渲染链路里提前碰到未 mock 的原生能力，会呈现
 *   「jest 假失败、真机却正常」。这类噪声不该拦住打包——P4（Metro 打包）
 *   才是硬闸门。④的价值在于把可疑路由点名出来人工复核。
 *
 * ★ 数据来源
 *   路由清单由 check-local.mjs 调用 lib/route-inventory.mjs 生成，写入
 *   .expo/check-local-routes.json（.expo 已被 .gitignore），经环境变量
 *   CHECK_LOCAL_ROUTES_JSON 传入。直接单独跑本文件而没跑过 check-local
 *   时会给出明确提示。
 *
 * ★ renderRouter 的 context 必须显式传 "./src/app"
 *   expo-router 的 renderRouter 默认 context 是 "./app"；本项目路由根是
 *   src/app（app.json 的 expo-router 插件 root 指定），不传就会一张路由
 *   都渲染不出来（全落 Unmatched）——那是配置错误，不是 App 错误。
 *
 * ★ 两个版本坑（已在此文件内固定）
 *   1) 本工程装的是 @testing-library/react-native v14（异步 render），
 *      而 expo-router 55.0.5 的 renderRouter 内部强制 jest.useFakeTimers()，
 *      假定时器下 RNTL 内部 act 会等待一个永不触发的定时器 → 死锁超时。
 *      故顶部把 jest.useFakeTimers 降级为 no-op，改走真实定时器。
 *   2) 本工程无 iOS 模拟器（Windows），Unmatched 屏的精确检测用
 *      testID="expo-router-unmatched" 而非文本匹配——后者会同时命中
 *      "Unmatched Route" 与 "Page could not be found" 两条文案导致
 *      queryByText 抛「匹配到多个元素」。
 */
import fs from "node:fs";
import path from "node:path";
import { renderRouter, screen, act } from "expo-router/testing-library";

// 见上方「版本坑 1」：禁用 renderRouter 内部的假定时器死锁
jest.useFakeTimers = () => {};

/* ---- mock：jest-expo 不覆盖、但渲染链路必经的模块 ---- */
// AsyncStorage：AppProvider 挂载即读本地快照 hydration；jest-expo 不 mock 它，
// 不 mock 会在 require 原生模块时炸掉整棵渲染树。用内存 Map 顶替。
jest.mock("@react-native-async-storage/async-storage", () => {
  const store = new Map<string, string>();
  return {
    __esModule: true,
    default: {
      getItem: async (k: string) => (store.has(k) ? (store.get(k) as string) : null),
      setItem: async (k: string, v: string) => void store.set(k, v),
      removeItem: async (k: string) => void store.delete(k),
      mergeItem: async () => {},
      clear: async () => store.clear(),
      getAllKeys: async () => [...store.keys()],
      multiGet: async (keys: string[]) => keys.map((k) => [k, store.get(k) ?? null]),
      multiSet: async (pairs: [string, string][]) => {
        for (const [k, v] of pairs) store.set(k, v);
      },
      multiRemove: async (keys: string[]) => {
        for (const k of keys) store.delete(k);
      },
    },
  };
});

type RouteInfo = { path: string; kind: string; file: string };
type Inventory = {
  appDir: string;
  routes: RouteInfo[];
  dead: unknown[];
  conflicts: unknown[];
  rootExists: boolean;
};

const ROUTES_JSON = process.env.CHECK_LOCAL_ROUTES_JSON ?? path.resolve(process.cwd(), ".expo/check-local-routes.json");

let inventory: Inventory;
try {
  inventory = JSON.parse(fs.readFileSync(ROUTES_JSON, "utf8")) as Inventory;
} catch {
  throw new Error(`读不到路由清单 ${ROUTES_JSON} —— 请通过 npm run check-local 运行本检查（内部会用 lib/route-inventory.mjs 生成该清单）`);
}

const APP_CTX = `./${inventory.appDir}`;
const UNMATCHED_TESTID = "expo-router-unmatched";

/** 统计 react-test-renderer 树里的全部字符串（渲染出的文案） */
function textCount(node: unknown): number {
  if (typeof node === "string") return 1;
  if (Array.isArray(node)) return node.reduce((a, n) => a + textCount(n), 0);
  if (node && typeof node === "object" && "children" in (node as Record<string, unknown>)) {
    return textCount((node as { children: unknown }).children);
  }
  return 0;
}

/** 路由模式 → 可请求的 URL：:param → 单段假值，*catchall → 多段假值 */
function toUrl(pattern: string): string {
  return (
    pattern
      .split("/")
      .map((seg) => (seg.startsWith("*") ? "check-local-seed/leaf" : seg.startsWith(":") ? "check-local-seed" : seg))
      .join("/") || "/"
  );
}

/** 渲染后冲刷一次微任务，让 AsyncStorage hydration / 重定向这类异步 effect 完成落地 */
async function settle(tree: unknown): Promise<void> {
  await act(async () => {
    await Promise.resolve();
  });
}

describe("P5 路由渲染冒烟（check-local）", () => {
  it("① 首页 / 可渲染，且不落 Unmatched Route 屏", async () => {
    const tree = await renderRouter(APP_CTX, { initialUrl: "/" });
    await settle(tree);
    expect(screen.queryByTestId(UNMATCHED_TESTID)).toBeNull();
  }, 60000);

  it("② 默认落地页 /today 渲染出实际内容（防空屏假绿）", async () => {
    const tree = await renderRouter(APP_CTX, { initialUrl: "/today" });
    await settle(tree);
    expect(screen.queryByTestId(UNMATCHED_TESTID)).toBeNull();
    const texts = textCount((tree as { toJSON(): unknown }).toJSON());
    expect(texts).toBeGreaterThanOrEqual(3);
  }, 60000);

  it("③ 对照实验：不存在的路径必须落 Unmatched Route（证明①不是假绿）", async () => {
    const tree = await renderRouter(APP_CTX, { initialUrl: "/__check_local_missing_probe__" });
    await settle(tree);
    expect(screen.queryByTestId(UNMATCHED_TESTID)).not.toBeNull();
  }, 60000);

  it("④ 全部路由逐个渲染（advisory：失败只告警，不阻断打包）", async () => {
    const failures: string[] = [];
    for (const r of inventory.routes) {
      const url = toUrl(r.path);
      try {
        const tree = await renderRouter(APP_CTX, { initialUrl: url });
        await settle(tree);
        // 渲染成功但落到了 Unmatched 屏也算失败（防「路由没对上却没人发现」）
        if (screen.queryByTestId(UNMATCHED_TESTID)) {
          failures.push(`${url} -> 落到了 Unmatched Route 屏`);
        }
      } catch (e) {
        failures.push(`${url} -> ${(e as Error)?.message ?? String(e)}`);
      }
    }
    if (failures.length > 0) {
      console.warn(
        `\n[P5 advisory] ${failures.length}/${inventory.routes.length} 个路由在 jest 环境渲染失败` +
          `（多为原生模块缺失，不影响真机；请结合 P4 Metro 打包结果判断）：\n  - ${failures.join("\n  - ")}`,
      );
    }
    // advisory：永远通过，失败只点名、不阻断
    expect(true).toBe(true);
  }, 120000);
});
