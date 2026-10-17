#!/usr/bin/env node
/**
 * check-local.mjs —— 打包前本地校验（Windows 可跑，不需要 iOS 模拟器）
 *
 * 目的：在花掉一次 EAS 云构建额度之前，先在本地把「路由 404 / 编译失败 / 打包报错」
 * 这三类问题拦下来。上一版送到 TestFlight 的包启动报 Unmatched Route（根路径无页面），
 * 就是本脚本第 1、3 步要拦的东西。
 *
 * 做六件事（输出全部为 ASCII，避免 Windows PowerShell 5 控制台中文乱码）：
 *   1 ROUTE-MAP      src/app 文件树按 expo-router 规则解析成 URL 表；核对根路径 "/" 存在、
 *                    无两个文件抢同一 URL、每个路由文件都有 export default
 *   2 ROUTE-LINK     扫描 src 下所有代码里的 "/xxx" 字面量（router.push / href / Redirect 等），
 *                    逐个核对能否对上真实页面（能抓出 "/todayyy" 这类拼错）
 *   3 ROUTE-MANIFEST 起一次 expo 本地开发服务，读 expo-router **自己生成**的路由清单，
 *                    与第 1 步的解析结果逐条比对（这一步是权威证据，不是我手写的规则）
 *   4 TYPES          npx tsc --noEmit 必须 0 错误
 *   5 TESTS          npx jest 必须全过且用例数 > 0
 *   6 BUNDLE         npx expo export --platform ios 必须编译成功（打包期才会炸的问题在这里暴露）
 *
 * 退出码：0 = 全部通过（可打包）；非 0 = 有失败项（禁止打包）
 *
 * 用法：
 *   node scripts/check-local.mjs              完整校验
 *   node scripts/check-local.mjs --quick      跳过第 6 步 iOS 编译导出（省 1~2 分钟）
 *   node scripts/check-local.mjs --no-server  跳过第 3 步（本机端口占用 / 离线时用）
 *   node scripts/check-local.mjs --port 8090  指定本地开发服务端口（默认 8099）
 *
 * ★ 本脚本只读工程代码，不修改任何业务、页面、路由文件；
 *   唯一写入的是 .expo/ 下的生成物（已被 .gitignore 忽略）与一个临时导出目录（结束前删除）。
 */
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildInventory } from "./lib/route-inventory.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(HERE, ".."); // native/
const SRC = path.join(APP, "src");
const ROUTE_ROOT = path.join(SRC, "app"); // app.json: expo-router root = src/app
const TYPES_FILE = path.join(APP, ".expo", "types", "router.d.ts");
const EXPORT_DIR = path.join(APP, ".expo", "check-export");

const argv = process.argv.slice(2);
const QUICK = argv.includes("--quick");
const NO_SERVER = argv.includes("--no-server");
const portIdx = argv.indexOf("--port");
const PORT = portIdx >= 0 && argv[portIdx + 1] ? argv[portIdx + 1] : "8099";

const results = [];
let hardFail = false;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function record(name, ok, detail = "") {
  results.push({ name, ok, skipped: false, detail });
  if (!ok) hardFail = true;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  -- ${detail}` : ""}`);
}
function recordSkip(name, detail = "") {
  results.push({ name, ok: true, skipped: true, detail });
  console.log(`  SKIP  ${name}${detail ? `  -- ${detail}` : ""}`);
}
function step(n, msg) {
  console.log(`\n=== [${n}] ${msg} ===`);
}

/* ==========================================================================
 * expo-router 的 URL 规则（照官方实现翻译，仅用于本地核对）：
 *   · 圆括号目录是「分组」，不进 URL（(tabs)/today.tsx -> /today）
 *   · index 文件映射为所在目录本身（app/index.tsx -> / ；(tabs)/index.tsx -> /）
 *   · _layout / +not-found / 点开头文件不是路由
 *   · [id].tsx 是动态段
 * ========================================================================== */
function collectRoutes() {
  const list = [];
  (function walk(dir, segs) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const n = e.name;
      if (n.startsWith("_") || n.startsWith(".") || n.startsWith("+")) continue;
      const full = path.join(dir, n);
      if (e.isDirectory()) {
        const isGroup = /^\(.*\)$/.test(n);
        walk(full, isGroup ? segs : [...segs, n]);
      } else if (n.endsWith(".tsx")) {
        const base = n.slice(0, -4);
        const s = base === "index" ? segs : [...segs, base];
        list.push({ url: "/" + s.join("/"), file: full });
      }
    }
  })(ROUTE_ROOT, []);
  return list;
}

function walkTsx(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walkTsx(full, out);
    else if (e.name.endsWith(".tsx")) out.push(full);
  }
  return out;
}

/** 段级匹配：支持 [id] 动态段与模板字面量替换出的 * 通配段 */
function matchRoute(url, routes) {
  const target = url.split("/").filter(Boolean);
  for (const r of routes) {
    const segs = r.url.split("/").filter(Boolean);
    if (segs.length !== target.length) continue;
    let ok = true;
    for (let i = 0; i < segs.length; i++) {
      if (segs[i].startsWith("[")) continue;
      if (target[i] === "*") continue;
      if (segs[i] !== target[i]) { ok = false; break; }
    }
    if (ok) return r;
  }
  return null;
}

/* ------------------------------------------------------------------ 第 1 步 */
function checkRouteMap(routes) {
  let ok = true;
  // ① 根路径必须存在 —— 上次 Unmatched Route 就是缺这一条（seeora:// 打开的是 "/"）
  const root = routes.find((r) => r.url === "/");
  if (!root) {
    ok = false;
    console.log('         -> MISSING root route "/". Add src/app/index.tsx (it may <Redirect href="/today" />).');
  } else {
    console.log(`         root route "/" -> ${path.relative(APP, root.file)}`);
  }
  // ② 不允许两个文件抢同一个 URL
  const byUrl = new Map();
  for (const r of routes) byUrl.set(r.url, [...(byUrl.get(r.url) ?? []), path.relative(APP, r.file)]);
  const dup = [...byUrl.entries()].filter(([, files]) => files.length > 1);
  for (const [url, files] of dup) {
    ok = false;
    console.log(`         -> DUPLICATE URL ${url}: ${files.join(" , ")}`);
  }
  // ③ 每个路由文件（含 _layout）都必须 export default，否则该路由渲染不出任何东西
  for (const f of walkTsx(ROUTE_ROOT, [])) {
    const text = fs.readFileSync(f, "utf8");
    if (!/export\s+default\s/.test(text)) {
      ok = false;
      console.log(`         -> NO default export: ${path.relative(APP, f)}`);
    }
  }
  record("ROUTE-MAP", ok, `${routes.length} routes parsed from src/app`);
  return ok;
}

/* ------------------------------------------------------------------ 第 2 步 */
function checkRouteLinks(routes) {
  const hits = [];
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      // 跳过测试目录与测试文件：里面的 "/xxx" 多为断言样例（如 settingsRoutes.test.ts），
      // 不是真实导航目标，扫进去会误报死链、进而误拦打包。
      if (e.isDirectory()) {
        if (e.name === "__tests__" || e.name === "_process" || e.name === "node_modules" || e.name.startsWith(".")) continue;
        walk(full);
        continue;
      }
      if (!/\.(ts|tsx)$/.test(e.name)) continue;
      if (/\.(test|spec)\.(ts|tsx)$/.test(e.name)) continue;
      const lines = fs.readFileSync(full, "utf8").split(/\r?\n/);
      lines.forEach((line, i) => {
        const re = /"([^"\n]*)"|'([^'\n]*)'|`([^`\n]*)`/g;
        let m;
        while ((m = re.exec(line))) {
          const raw = m[1] ?? m[2] ?? m[3] ?? "";
          if (!raw.startsWith("/") || raw.startsWith("//")) continue;
          // 模板字面量里的 ${...} 替换成通配段，随后按段匹配
          const wild = raw.replace(/\$\{[^}]*\}/g, "*");
          if (wild.includes("${")) continue;
          // 只认「像路径」的字面量，排除正则、格式化串等
          if (!/^\/[A-Za-z0-9_\-/*\[\]]*$/.test(wild)) continue;
          const clean = wild.split("?")[0].split("#")[0].replace(/\/+$/, "") || "/";
          hits.push({ path: clean, file: path.relative(APP, full), line: i + 1, raw });
        }
      });
    }
  })(SRC);

  const bad = hits.filter((h) => !matchRoute(h.path, routes));
  const seen = new Set();
  const printed = [];
  for (const h of bad) {
    const key = `${h.path}|${h.file}`;
    if (seen.has(key)) continue;
    seen.add(key);
    printed.push(`         -> "${h.raw}" does not match any route  (${h.file}:${h.line})`);
  }
  const ok = bad.length === 0;
  for (const p of printed.slice(0, 10)) console.log(p);
  if (printed.length > 10) console.log(`         -> ... and ${printed.length - 10} more`);
  record("ROUTE-LINK", ok, `${hits.length} literal paths checked in src/`);
  return ok;
}

/* ------------------------------------------------------------------ 第 3 步 */
function killTree(pid) {
  if (!pid) return;
  try {
    if (process.platform === "win32") {
      spawnSync("taskkill", ["/pid", String(pid), "/T", "/F"], { stdio: "ignore" });
    } else {
      process.kill(-pid, "SIGKILL");
    }
  } catch { /* 进程可能已退出 */ }
}

/** 读 expo-router 自己生成的路由清单，与本地解析结果比对 */
async function checkRouteManifest(routes) {
  const before = fs.existsSync(TYPES_FILE) ? fs.statSync(TYPES_FILE).mtimeMs : 0;
  console.log(`         starting: npx expo start --port ${PORT} (CI mode, no prompts)`);
  const child = spawn(`npx expo start --port ${PORT}`, {
    cwd: APP,
    shell: true,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, CI: "1", EXPO_NO_TELEMETRY: "1" },
  });
  let log = "";
  child.stdout.on("data", (d) => { log += d.toString(); });
  child.stderr.on("data", (d) => { log += d.toString(); });

  const deadline = Date.now() + 120000;
  let regenerated = false;
  while (Date.now() < deadline) {
    if (fs.existsSync(TYPES_FILE)) {
      const now = fs.statSync(TYPES_FILE).mtimeMs;
      if (now !== before) { regenerated = true; break; }
    }
    if (child.exitCode !== null) break; // server 已退出（多为端口占用）
    await sleep(1000);
  }
  killTree(child.pid);
  await sleep(500);

  if (!regenerated) {
    const tail = log.split(/\r?\n/).filter(Boolean).slice(-6).join("\n         ");
    record("ROUTE-MANIFEST", false, "route manifest was not regenerated within 120s");
    console.log(`         -> is another exporter/expo process holding port ${PORT}?`);
    console.log(`         -> try: node scripts/check-local.mjs --port 8101   (or --no-server to skip)`);
    if (tail) console.log(`         server output tail: ${tail}`);
    return false;
  }

  const text = fs.readFileSync(TYPES_FILE, "utf8");
  const manifest = new Set();
  const re = /`([^`]+)`/g;
  let m;
  while ((m = re.exec(text))) {
    let s = m[1].replace(/\$\{[^}]*\}/g, ""); // 去掉 ${'/(tabs)'} 这类分组前缀
    if (s.includes("${") || !s.startsWith("/")) continue;
    s = s.split("?")[0].replace(/\/+$/, "") || "/";
    if (s === "/_sitemap") continue; // expo-router 自带，不是业务路由
    manifest.add(s);
  }

  const mine = new Set(routes.map((r) => r.url));
  const missing = [...mine].filter((u) => !manifest.has(u));
  const extra = [...manifest].filter((u) => !mine.has(u));
  const ok = missing.length === 0 && extra.length === 0;
  console.log(`         expo-router manifest: ${[...manifest].sort().join(" ")}`);
  if (missing.length) console.log(`         -> in my parse but NOT in manifest: ${missing.join(" ")}`);
  if (extra.length) console.log(`         -> in manifest but NOT in my parse: ${extra.join(" ")}`);
  record("ROUTE-MANIFEST", ok, `${manifest.size} routes per expo-router`);
  return ok;
}

/* ------------------------------------------------------------------ 第 4~6 步 */
/** 生成路由清单 JSON（供 P5 渲染冒烟测试消费） */
function genRoutesJson() {
  try {
    const inv = buildInventory(APP);
    fs.mkdirSync(path.join(APP, ".expo"), { recursive: true });
    fs.writeFileSync(path.join(APP, ".expo", "check-local-routes.json"), JSON.stringify(inv, null, 2));
    console.log(`         wrote .expo/check-local-routes.json (${inv.routes.length} routes, rootExists=${inv.rootExists})`);
  } catch (e) {
    console.log(`         !! 生成路由清单失败：${e?.message ?? String(e)}`);
  }
}

/** P5 渲染冒烟：用 jest.check-local.config.mjs 把 App 真正渲染一遍，捕获 Unmatched Route / 空屏 */
function checkRenderSmoke() {
  const routesJson = path.join(APP, ".expo", "check-local-routes.json");
  if (!fs.existsSync(routesJson)) {
    record("RENDER-SMOKE", false, "路由清单缺失（应在 TESTS 步之前生成）");
    return false;
  }
  const r = spawnSync("npx jest --config jest.check-local.config.mjs --silent", {
    cwd: APP,
    shell: true,
    encoding: "utf8",
    timeout: 300000,
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, CI: "1", EXPO_NO_TELEMETRY: "1", CHECK_LOCAL_ROUTES_JSON: routesJson },
  });
  const out = `${r.stdout}\n${r.stderr}`;
  const passedM = out.match(/Tests:\s+[^\n]*?(\d+) passed/);
  const failedM = out.match(/Tests:\s+[^\n]*?(\d+) failed/);
  const passed = passedM ? Number(passedM[1]) : 0;
  const failed = failedM ? Number(failedM[1]) : 0;
  const ok = r.status === 0 && passed > 0 && failed === 0;
  if (!ok) console.log(`         ${tail(out)}`);
  record("RENDER-SMOKE", ok, `${passed} passed, ${failed} failed (jest.check-local.config.mjs)`);
  return ok;
}

function runCapture(cmd, timeoutMs) {
  return spawnSync(cmd, {
    cwd: APP,
    shell: true,
    encoding: "utf8",
    timeout: timeoutMs,
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, CI: "1", EXPO_NO_TELEMETRY: "1" },
  });
}
function tail(out, n = 20) {
  return out.split(/\r?\n/).filter((l) => l.trim()).slice(-n).join("\n         ");
}

function checkTypes() {
  const r = runCapture("npx tsc --noEmit", 300000);
  const ok = r.status === 0;
  if (!ok) console.log(`         ${tail(r.stdout + r.stderr)}`);
  record("TYPES", ok, ok ? "tsc --noEmit: 0 errors" : "tsc reported errors (see above)");
  return ok;
}

function checkTests() {
  const r = runCapture("npx jest --silent", 300000);
  const out = `${r.stdout}\n${r.stderr}`;
  const passedM = out.match(/Tests:\s+[^\n]*?(\d+) passed/);
  const failedM = out.match(/Tests:\s+[^\n]*?(\d+) failed/);
  const passed = passedM ? Number(passedM[1]) : 0;
  const failed = failedM ? Number(failedM[1]) : 0;
  const ok = r.status === 0 && passed > 0 && failed === 0;
  if (!ok) console.log(`         ${tail(out)}`);
  record("TESTS", ok, `${passed} passed, ${failed} failed`);
  return ok;
}

function checkBundle() {
  if (QUICK) { recordSkip("BUNDLE", "--quick: iOS export skipped"); return true; }
  try { fs.rmSync(EXPORT_DIR, { recursive: true, force: true }); } catch { /* ignore */ }
  const r = runCapture(`npx expo export --platform ios --output-dir .expo/check-export`, 900000);
  const ok = r.status === 0;
  if (!ok) console.log(`         ${tail(r.stdout + r.stderr)}`);
  try { fs.rmSync(EXPORT_DIR, { recursive: true, force: true }); } catch { /* ignore */ }
  record("BUNDLE", ok, ok ? "expo export ios: bundle built" : "expo export ios FAILED (see above)");
  return ok;
}

/* -------------------------------------------------------------------- 主流程 */
(async function main() {
  console.log("Seeora local pre-build check  (see Seeora local validation doc for pass/fail rules)");
  console.log(`project: ${APP}`);
  if (QUICK) console.log("mode: --quick (step 6 skipped)");
  if (NO_SERVER) console.log("mode: --no-server (step 3 skipped)");
  if (!fs.existsSync(ROUTE_ROOT)) {
    console.log(`\nFATAL: route folder not found: ${ROUTE_ROOT}`);
    process.exit(2);
  }

  step("1/6", "ROUTE-MAP  parse src/app into URLs, verify root route and default exports");
  const routes = collectRoutes();
  checkRouteMap(routes);

  step("2/6", "ROUTE-LINK  every \"/path\" literal in src/ must resolve to a real route");
  checkRouteLinks(routes);

  step("3/6", "ROUTE-MANIFEST  cross-check against expo-router's own generated manifest");
  if (NO_SERVER) recordSkip("ROUTE-MANIFEST", "--no-server");
  else await checkRouteManifest(routes);

  step("4/6", "TYPES  npx tsc --noEmit");
  checkTypes();

  step("5/6", "TESTS  npx jest (unit)  +  RENDER-SMOKE (jest.check-local.config.mjs)");
  genRoutesJson();
  checkRenderSmoke();
  checkTests();

  step("6/6", "BUNDLE  npx expo export --platform ios");
  checkBundle();

  const width = 34;
  console.log(`\n================ SUMMARY ================`);
  for (const r of results) {
    const label = r.name.padEnd(width - 10);
    console.log(`  ${label} ${r.skipped ? "SKIP" : r.ok ? "PASS" : "FAIL"}${r.detail ? `   ${r.detail}` : ""}`);
  }
  console.log("-----------------------------------------");
  if (hardFail) {
    console.log("  RESULT: BUILD BLOCKED  -- do not run eas build; fix the FAIL lines above first.");
    process.exit(1);
  }
  console.log("  RESULT: BUILD ALLOWED");
  console.log("");
  console.log("  REMINDER: the checks above never look at the screen. Before shipping to TestFlight,");
  console.log("  install the build on a real device and confirm: 1) app opens on the Today page, not");
  console.log("  an 'Unmatched Route' screen; 2) the three bottom tabs switch; 3) tapping + opens the");
  console.log("  habit form; 4) a check-in shows the confetti; 5) Settings > About opens; 6) no blank");
  console.log("  or black screen. Any failure: screenshot it and report back.");
  process.exit(0);
})();
