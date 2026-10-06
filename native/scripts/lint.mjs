#!/usr/bin/env node
/**
 * Seeora 可信 lint 门禁（`npm run lint` 的实际目标）
 * ============================================================
 * ★ 为什么不再直接用 miaoda-expo-devkit 自带的 devkit-lint
 *   它的 run() 是 `spawnSync("oxlint", [...])` / `spawnSync("biome", ...)` / `spawnSync("tsc", ...)`
 *   —— 一律用**裸命令名**，既没有 `shell: true`，也没走 `node_modules/.bin`。
 *   Windows 的 CreateProcess 不认 PATHEXT，裸名字（实际是 oxlint.CMD 垫片）根本起不来，
 *   每次 spawnSync 都返回 `status = null`。于是它打印：
 *
 *       RESULT: FAILED — Found errors in: oxlint, biome, tsc
 *
 *   但**一条诊断信息都没有**（stdio 是 inherit，工具压根没被执行）。
 *   实测同一时刻 oxlint 其实是 115 条错误、biome 0 条、tsc 0 条 —— 报告完全不可信：
 *   既漏报真问题（115 条一条都没显示），也误报干净的工具（biome / tsc 明明是绿的）。
 *   所以这个门禁必须重写。
 *
 * ★ 本脚本的做法
 *   一律用 `process.execPath`（当前这台机器实际在跑的 node）+ 解析到的 **JS 入口**调用，
 *   不依赖 shell、不依赖 PATHEXT、不依赖 .bin 垫片 —— Windows / macOS / Linux 行为一致。
 *
 * ★ 门禁内容（与 devkit 对齐，只增不减）
 *   1) oxlint   用 .oxlintrc.json（继承 devkit 规则集，另加两处 env 覆盖去噪音）
 *   2) biome    lint，用 devkit 的 biome-config.json
 *   3) tsc      --noEmit，TypeScript 类型检查
 *   4) expo     config --type public，确认 app.config / app.json 能被 Expo 正常解析
 *               （devkit-lint 里那步 app.json schema 校验收在内部 bundle 里、未导出，
 *                 这里用 expo 官方 CLI 做等价且更权威的「配置可否解析」校验）
 *
 * ★ 用法
 *   npm run lint          # 全量
 *   node scripts/lint.mjs src/store     # 只 lint 指定路径（仅 oxlint / biome 支持）
 */
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const require = createRequire(path.join(ROOT, "package.json"));

/** 解析包内 JS 入口：先走 Node 解析（尊重 exports），失败则回落到 node_modules 真实路径。 */
function resolveEntry(pkg, subpath) {
  try {
    return require.resolve(`${pkg}/${subpath}`);
  } catch {
    const p = path.join(ROOT, "node_modules", pkg, subpath);
    if (fs.existsSync(p)) return p;
    throw new Error(`找不到入口：${pkg}/${subpath}（请先在 native/ 下执行 pnpm install）`);
  }
}

const DEVKIT = path.join(ROOT, "node_modules", "miaoda-expo-devkit");
const OXLINT_CONFIG = path.join(ROOT, ".oxlintrc.json");
const BIOME_CONFIG = path.join(DEVKIT, "biome-config.json");

const targets = process.argv.slice(2).filter((a) => !a.startsWith("-"));
const lintTargets = targets.length > 0 ? targets : ["."];

const results = [];

/** 用当前 node 直接执行一个 JS 入口。返回退出码（null / 非 0 均视为失败）。 */
function runWithNode(name, entry, args, cwd) {
  process.stdout.write(`\n\x1b[2m── ${name} ──────────────────────────────────────────\x1b[0m\n`);
  const r = spawnSync(process.execPath, [entry, ...args], { stdio: "inherit", cwd });
  const ok = r.status === 0;
  results.push({ name, ok, status: r.status, error: r.error });
  if (r.error) {
    console.error(`\x1b[31m[${name}] 启动失败：${r.error.message}\x1b[0m`);
  } else if (r.status !== 0) {
    console.error(`\x1b[31m[${name}] 退出码 ${r.status}\x1b[0m`);
  }
  return ok;
}

/* ---- 0. 前置：配置存在性（缺文件要报清楚，而不是让工具抛一堆看不懂的错） ---- */
for (const f of [OXLINT_CONFIG, BIOME_CONFIG]) {
  if (!fs.existsSync(f)) {
    console.error(`\x1b[31m缺少配置文件：${f}\x1b[0m`);
    process.exit(2);
  }
}

/* ---- 1. oxlint ---- */
runWithNode("oxlint", resolveEntry("oxlint", "bin/oxlint"), ["--config", OXLINT_CONFIG, ...lintTargets], ROOT);

/* ---- 2. biome ---- */
runWithNode(
  "biome",
  resolveEntry("@biomejs/biome", "bin/biome"),
  ["lint", "--config-path", BIOME_CONFIG, ...lintTargets],
  ROOT,
);

/* ---- 3. tsc（不受 targets 影响：类型检查必须全量，否则等于没查） ---- */
runWithNode("tsc --noEmit", resolveEntry("typescript", "bin/tsc"), ["--noEmit"], ROOT);

/* ---- 4. expo 配置可解析性 ---- */
{
  process.stdout.write(`\n\x1b[2m── expo config ─────────────────────────────────────\x1b[0m\n`);
  const entry = resolveEntry("expo", "bin/cli");
  const r = spawnSync(process.execPath, [entry, "config", "--type", "public", "--json"], {
    cwd: ROOT,
    encoding: "utf8",
  });
  const ok = r.status === 0;
  results.push({ name: "expo-config", ok, status: r.status, error: r.error });
  if (ok) {
    try {
      const cfg = JSON.parse(r.stdout);
      const sdk = cfg.sdkVersion ?? "?";
      const id = cfg.ios?.bundleIdentifier ?? "?";
      console.log(`配置解析成功：name=${cfg.name} slug=${cfg.slug} sdk=${sdk} bundleId=${id}`);
    } catch {
      console.log("配置解析成功（输出非 JSON，已忽略）");
    }
  } else {
    console.error((r.stderr || r.stdout || "").trim().split("\n").slice(-12).join("\n"));
  }
}

/* ---- 汇总 ---- */
const failed = results.filter((r) => !r.ok);
const line = "─".repeat(60);
console.log(`\n${line}`);
if (failed.length > 0) {
  console.error(`\x1b[31mRESULT: FAILED —— 未通过：${failed.map((r) => r.name).join(", ")}\x1b[0m`);
  console.error("请修掉上面列出的问题，再重新执行 `npm run lint`。");
  console.log(line);
  process.exit(1);
} else {
  console.log(`\x1b[32mRESULT: PASSED —— ${results.map((r) => r.name).join(" / ")} 全部通过\x1b[0m`);
  console.log(line);
  process.exit(0);
}
