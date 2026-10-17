/**
 * 路由清单与死链检测（check-local P2 的核心模块）
 * ============================================================
 * ★ 为什么需要它
 *   expo-router 的 Unmatched Route 事故本质是「代码里导航到的路径，磁盘上没有对应路由文件」。
 *   2026-10-17 本项目刚栽过一次：首页被挪进 (tabs) 分组后，根路径 / 没有任何页面对应，
 *   seeora:// 深链冷启动直接落 Unmatched Route 屏（TestFlight 实测，见 src/app/index.tsx 注释）。
 *   本模块把这件事从「运行时/真机问题」提前到「本地静态问题」：
 *     ① 扫 src/app 算出真实路由集合（分组透明、动态段/捕获段、index 归位）
 *     ② 扫全部源码抓导航字面量（router.push / Link href / Redirect href / href: / go() 等）
 *     ③ 逐一比对，输出死链清单（文件:行号 → 目标路径）
 *     ④ 根路径 / 必须存在（否则 seeora:// 裸 scheme 必挂）
 *
 * ★ 与 src/lib/__tests__/settingsRoutes.test.ts 的关系
 *   那个测试只覆盖 src/app 内的 router.push/replace 字面量；本模块范围更大（全源码、
 *   Link/Redirect/href:/go()、模板字面量前缀、路由冲突、根路由），
 *   两者互补而非重复——npm test 继续用它，check-local 用本模块。
 *
 * ★ 用法
 *   import { buildInventory } from "./lib/route-inventory.mjs";
 *   const inv = buildInventory(projectRoot);
 */

import fs from "node:fs";
import path from "node:path";

/** 可注册为路由的文件扩展名 */
const ROUTE_EXTS = [".tsx", ".ts", ".js", ".jsx"];
/** 源码扫描范围（路由死链可能藏在任何源码里，不止 src/app） */
const SCAN_EXTS = [".ts", ".tsx", ".js", ".jsx", ".mjs"];
/** 不该扫的目录 */
const SCAN_SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  ".expo",
  "dist",
  "dist-web",
  "android",
  "ios",
  "assets",
  "targets",
  "modules",
  "plugins",
  "docs",
  "_process",
  "history",
  "__tests__",
]);

/**
 * 从 app.json 解析 expo-router 的 routes 根目录。
 * 本项目 app.json 的 plugins 里有 ["expo-router", { "root": "src/app" }]，
 * 同时 extra.router.root 也指向 src/app —— 两处都读，取第一个命中的。
 * 解析失败时回退到常见约定（src/app → app）。
 */
export function resolveAppDir(root) {
  const appJsonPath = path.join(root, "app.json");
  let configured = null;
  try {
    const cfg = JSON.parse(fs.readFileSync(appJsonPath, "utf8"));
    const plugins = Array.isArray(cfg?.expo?.plugins) ? cfg.expo.plugins : [];
    for (const p of plugins) {
      if (Array.isArray(p) && p[0] === "expo-router" && p[1]?.root) {
        configured = p[1].root;
        break;
      }
    }
    if (!configured && cfg?.expo?.extra?.router?.root) {
      configured = cfg.expo.extra.router.root;
    }
  } catch {
    /* app.json 缺失或不可解析：走默认探测，由 P1 负责报错 */
  }
  for (const c of [configured, "src/app", "app"].filter(Boolean)) {
    const abs = path.join(root, c);
    try {
      if (fs.statSync(abs).isDirectory()) return abs;
    } catch {
      /* 不存在，试下一个 */
    }
  }
  return null;
}

/** 归一化路由路径：补前导 /、合并重复 /、去掉尾 /（根路径除外） */
function normalizePath(p) {
  let s = String(p).replace(/\/{2,}/g, "/");
  if (!s.startsWith("/")) s = "/" + s;
  if (s.length > 1) s = s.replace(/\/+$/, "");
  return s;
}

/** 单文件/目录段 → 路由模式段：[id]→:id，[...rest]→*rest，其余原样 */
function segmentToPattern(seg) {
  let m;
  if ((m = /^\[\.\.\.(.+)\]$/.exec(seg))) return "*" + m[1]; // 捕获段
  if ((m = /^\[(.+)\]$/.exec(seg))) return ":" + m[1]; // 动态段
  return seg;
}

/** 是否是可路由文件（_layout / +html / +not-found / 隐藏文件都不是路由） */
function isRouteFile(name) {
  if (name.startsWith("_") || name.startsWith("+") || name.startsWith(".")) return false;
  return ROUTE_EXTS.some((e) => name.endsWith(e));
}

function baseName(name) {
  return name.replace(/\.[^.]+$/, "");
}

/**
 * 扫 app 目录，产出路由清单。
 * 规则（与 expo-router 约定对齐，细节对齐 settingsRoutes.test.ts 的 collectRoutes）：
 *   - (group) 目录：括号段不进 URL，递归时 prefix 不变
 *   - _ 开头目录/文件：布局或私有，不进路由
 *   - + 开头文件：+html/+not-found 等特殊文件，不进路由
 *   - 目录含 index 文件：该目录自身注册为 prefix（如 settings/index.tsx → /settings）
 *   - [param] / [...param]：动态段 / 捕获段
 * 冲突：两个不同文件映射到同一路径（如 app/foo.tsx 与 app/foo/index.tsx）→ expo-router 行为未定义，报冲突。
 */
export function collectRoutes(appDir) {
  const byPath = new Map(); // path -> { path, file, kind }
  const conflicts = [];

  const add = (p, file) => {
    const routePath = normalizePath(p);
    const kind = routePath === "/" ? "root" : routePath.includes("*") ? "catchall" : routePath.includes(":") ? "dynamic" : "static";
    const existing = byPath.get(routePath);
    if (existing) {
      if (existing.file !== file) {
        conflicts.push({ path: routePath, files: [existing.file, file] });
      }
      return;
    }
    byPath.set(routePath, { path: routePath, file, kind });
  };

  const walk = (dir, prefix) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.name.startsWith(".")) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name.startsWith("_") || e.name.startsWith("+")) continue;
        if (/^\(.+\)$/.test(e.name)) {
          // 分组目录：URL 透明，原样向下递归
          walk(full, prefix);
          continue;
        }
        const childPrefix = `${prefix}/${e.name}`;
        // 目录自身含 index 文件 → 该目录本身就是路由（如 settings/index.tsx → /settings）
        // ★ 必须登记 childPrefix（目录自身路径），不是 prefix（父路径）——
        //   登记 prefix 会把分组内任意带 index 的子目录错挂到父路径上
        //   （本项目 (tabs)/settings 就会错挂成 /，与根 index 撞车）。
        try {
          const idx = fs.readdirSync(full).find((f) => isRouteFile(f) && baseName(f) === "index");
          if (idx) add(childPrefix, path.join(full, idx));
        } catch {
          /* 读不动的目录跳过 */
        }
        walk(full, childPrefix);
      } else if (isRouteFile(e.name)) {
        const base = baseName(e.name);
        if (base === "index") add(prefix || "/", full);
        else add(`${prefix}/${segmentToPattern(base)}`, full);
      }
    }
  };

  walk(appDir, "");
  return { routes: [...byPath.values()].sort((a, b) => a.path.localeCompare(b.path)), conflicts };
}

/** 路由模式匹配：:param 匹配单个非空段，*catchall 匹配剩余 ≥1 段 */
export function matchRoute(pattern, target) {
  const t = normalizePath(target.split("?")[0].split("#")[0]);
  const tSegs = t.split("/").filter(Boolean);
  const pSegs = pattern.split("/").filter(Boolean);
  for (let i = 0; i < pSegs.length; i += 1) {
    const p = pSegs[i];
    if (p.startsWith("*")) return tSegs.length > i; // 捕获段至少要吃掉一段
    if (p.startsWith(":")) {
      if (tSegs[i] === undefined) return false;
      continue;
    }
    if (p !== tSegs[i]) return false;
  }
  return tSegs.length === pSegs.length;
}

/**
 * 模板字面量的静态前缀匹配（如 router.push(`/habit/${id}`) → 前缀 "/habit/"）。
 * 前缀的每个完整段都必须与某个路由模式的对应段兼容（字面量相等或该段是 :param/*catchall）。
 */
export function matchPrefix(pattern, prefix) {
  const pSegs = String(prefix).split("/").filter(Boolean);
  const patSegs = pattern.split("/").filter(Boolean);
  for (let i = 0; i < pSegs.length; i += 1) {
    const ps = patSegs[i];
    if (ps === undefined) return false; // 模式比前缀还短，不可能是它的前缀
    if (ps.startsWith("*")) return true;
    if (ps.startsWith(":")) continue;
    if (ps !== pSegs[i]) return false;
  }
  return true;
}

/**
 * 导航目标提取规则。按确信度分两组：
 *   高确信（expo-router 官方 API）：router.push/replace/navigate、href=、href:
 *   启发式（项目自定义导航助手，如 settings 页的 go()）：go/to/navigate/redirect/openRoute
 * 启发式组若误报，输出里带 文件:行号，人工一眼可判。
 */
const NAV_PATTERNS = [
  { via: "router.push/replace/navigate", re: /(?:\brouter|\bnav\b|\bnavigation\b)\.(?:push|replace|navigate)\s*\(\s*(["'`])([^"'`\n]*)\1/g },
  { via: "Link/Redirect href", re: /\bhref\s*=\s*\{?\s*(["'`])([^"'`\n]*)\1/g },
  { via: "href 对象属性", re: /\bhref\s*:\s*(["'`])([^"'`\n]*)\1/g },
  { via: "go/to/navigate 调用（启发式）", re: /\b(?:go|to|navigate|redirect|openRoute)\s*\(\s*(["'`])([^"'`\n]*)\1/g },
];

/** 非站内路由的目标直接跳过（外链、scheme、mailto 等） */
function isSkippableTarget(t) {
  if (!t) return true;
  if (!t.startsWith("/")) return true; // 相对路径 / 非路径字符串
  if (/^[a-z][a-z0-9+.-]*:/i.test(t.replace(/^\//, "")) && !t.startsWith("//")) {
    // "/x" 之后又跟 scheme 形态的极端情况忽略即可；真正的 scheme 不以 / 开头，上面已拦
  }
  return false;
}

/**
 * 扫全部源码抓导航字面量。返回 [{ file, line, raw, via }]（file 为相对项目根的路径）。
 */
export function extractNavTargets(root) {
  const hits = [];
  const seen = new Set();
  const walk = (dir) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.name.startsWith(".")) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (SCAN_SKIP_DIRS.has(e.name)) continue;
        walk(full);
      } else if (SCAN_EXTS.some((ext) => e.name.endsWith(ext))) {
        let src;
        try {
          src = fs.readFileSync(full, "utf8");
        } catch {
          continue;
        }
        const rel = path.relative(root, full).replace(/\\/g, "/");
        const lines = src.split(/\r?\n/);
        lines.forEach((lineText, idx) => {
          for (const { via, re } of NAV_PATTERNS) {
            re.lastIndex = 0;
            let m;
            while ((m = re.exec(lineText)) !== null) {
              const raw = m[2];
              const key = `${rel}:${idx + 1}:${raw}`;
              if (seen.has(key)) continue;
              seen.add(key);
              hits.push({ file: rel, line: idx + 1, raw, via });
            }
          }
        });
      }
    }
  };
  walk(root);
  return hits;
}

/**
 * 汇总一次完整勘察（check-local P5 的 jest 测试也消费这份 JSON）。
 * 返回结构稳定、可 JSON 序列化。
 */
export function buildInventory(root) {
  const appDir = resolveAppDir(root);
  if (!appDir) {
    return { appDir: null, routes: [], conflicts: [], dead: [], skipped: [], rootExists: false, appDirError: "找不到路由目录（src/app 或 app）" };
  }
  const { routes, conflicts } = collectRoutes(appDir);
  const rel = (f) => path.relative(root, f).replace(/\\/g, "/");
  const relRoutes = routes.map((r) => ({ ...r, file: rel(r.file) }));
  const relConflicts = conflicts.map((c) => ({ path: c.path, files: c.files.map(rel) }));
  const targets = extractNavTargets(root);
  const dead = [];
  const skipped = [];

  for (const t of targets) {
    if (isSkippableTarget(t.raw)) {
      skipped.push(t);
      continue;
    }
    // 模板字面量：`/habit/${id}` → 只校验静态前缀
    const tplIdx = t.raw.indexOf("${");
    if (tplIdx !== -1) {
      const prefix = t.raw.slice(0, tplIdx);
      if (prefix === "" || prefix === "/") {
        skipped.push(t); // 整个路径都是动态拼的，静态层无法校验
        continue;
      }
      const ok = routes.some((r) => matchPrefix(r.path, prefix));
      if (!ok) dead.push({ ...t, target: `${prefix}{…}`, reason: `模板前缀 ${prefix} 没有对应路由` });
      continue;
    }
    if (!routes.some((r) => matchRoute(r.path, t.raw))) {
      dead.push({ ...t, target: t.raw, reason: "路由不存在" });
    }
  }

  return {
    appDir: path.relative(root, appDir).replace(/\\/g, "/"),
    routes: relRoutes,
    conflicts: relConflicts,
    dead,
    skipped,
    rootExists: routes.some((r) => r.path === "/"),
  };
}
