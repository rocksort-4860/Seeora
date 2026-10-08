/**
 * 设置页路由守卫生效测试（2026-10-07）
 *
 * ★ 为什么需要它
 *   `router.push(path as never)` 是为了绕开**过期的路由类型快照**
 *   （`.expo/types/router.d.ts` 是构建期产物，本机无法可靠触发重新生成）。
 *   代价是：路径拼错 TS 不会报错，只能等运行时才发现「点这行没反应」。
 *   本测试直接核对 **磁盘上的路由文件是否与代码里引用的路径一一对应**，
 *   把「路径写错」从运行时问题提前到 CI 问题。
 *
 * 断言方式：读 src/app 目录树，算出真实存在的路由集合，再与代码里出现的
 * `/settings/xxx` 字面量比对。**不 import 应用代码**（会拉起原生模块）。
 */
import fs from "node:fs";
import path from "node:path";

/* ⚠️ 这里既不能用 `__dirname`（ts-jest CommonJS 下 oxlint 报 no-undef），
   也不能用 `import.meta.url`（ts-jest 把它编译成 CommonJS，运行期是 SyntaxError）。
   jest 的工作目录就是项目根（native/），所以从 cwd 反解最稳。 */
const APP_DIR = path.resolve(process.cwd(), "src/app");

/** 收集 src/app 下所有可路由文件 → 路由路径集合（如 "/settings/language"） */
function collectRoutes(dir: string, prefix = ""): Set<string> {
  const out = new Set<string>();
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (e.name.startsWith("_") || e.name.startsWith(".")) continue; // _layout.tsx 不是路由
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      // 目录自身若含 index.tsx，它就映射为 prefix（这��必须登记，
      // 否则 `/settings` 及 `/settings/xxx` 会整段丢失 —— 实测栽过）。
      if (fs.existsSync(path.join(full, "index.tsx"))) out.add(prefix || "/");
      for (const r of collectRoutes(full, `${prefix}/${e.name}`)) out.add(r);
    } else if (e.name.endsWith(".tsx")) {
      const base = e.name.replace(/\.tsx$/, "");
      if (base === "index") {
        if (prefix) out.add(prefix); // 已由上面的目录分支登记，避免重复（Set 天然去重）
      } else {
        out.add(`${prefix}/${base}`);
      }
    }
  }
  return out;
}

/** 抓出源码里所有 router.push("/xxx") 的字面量 */
function collectPushedPaths(): { file: string; path: string }[] {
  const hits: { file: string; path: string }[] = [];
  const walk = (dir: string) => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (/\.(ts|tsx)$/.test(e.name)) {
        const src = fs.readFileSync(full, "utf8");
        for (const m of src.matchAll(/router\.(?:push|replace)\(\s*["'`]([^"'`]+)["'`]/g)) {
          hits.push({ file: path.relative(APP_DIR, full).replace(/\\/g, "/"), path: m[1] });
        }
      }
    }
  };
  walk(APP_DIR);
  return hits;
}

describe("设置页路由（防止 router.push 路径写错）", () => {
  const routes = collectRoutes(APP_DIR);
  const pushed = collectPushedPaths();

  it("路由集合非空（采集本身没失效）", () => {
    expect(routes.size).toBeGreaterThan(0);
    expect(routes.has("/settings")).toBe(true);
  });

  it("★ 所有 router.push/replace 的路径都真实存在", () => {
    // 这条在加子页却忘了建文件、或改了文件名时立刻变红
    const missing = pushed.filter((p) => !routes.has(p.path));
    expect(missing.map((m) => `${m.file} → ${m.path}`)).toEqual([]);
  });

  it("设置页：关于子页仍是独立路由；语言/外观已内联，不再是路由", () => {
    // 语言、外观现已内联到设置首页（Segmented 分段控件），不再有独立子页面，
    // 因此磁盘上不应再存在 /settings/language 与 /settings/appearance 路由文件。
    // 关于页（隐私/条款/版本）仍是独立路由。
    expect(routes.has("/settings/about")).toBe(true);
    expect(routes.has("/settings/language")).toBe(false);
    expect(routes.has("/settings/appearance")).toBe(false);
  });
});