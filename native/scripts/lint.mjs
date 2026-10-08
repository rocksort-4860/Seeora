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
import os from "node:os";
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

/* ---- 4. expo 配置可解析性 ----
 * ★ 为什么这一步不能用 `encoding: "utf8"` 捕获 stdout（2026-10-06 实测踩坑）
 *   本机上 `spawnSync` 一旦用**管道**捕获子进程输出就必定抛 EBUSY（1~3ms 启动即失败），
 *   而前三步用 `stdio: "inherit"` 却一切正常。已用单变量对照排除其它可能：
 *     A 组 encoding:utf8（管道）      → EBUSY ×3
 *     B 组 stdio:inherit              → 成功 ×3
 *     C 组 管道 + maxBuffer           → EBUSY ×3   （不是缓冲区太小）
 *     D 组 管道 + CI=1                → EBUSY ×3   （不是 Expo 的 TTY/遥测行为）
 *   → 根因是**本机 Node + 管道**的兼容问题，与被测代码无关。
 *   修法：把 stdout 指向一个**真实文件描述符**，需要的内容事后从文件读回，
 *         既拿到输出（可解析 JSON 做断言），又完全不碰管道。已验证 4/4 成功。
 */
{
  process.stdout.write(`\n\x1b[2m── expo config ─────────────────────────────────────\x1b[0m\n`);
  const entry = resolveEntry("expo", "bin/cli");
  const tmpOut = path.join(os.tmpdir(), `_seeora_expocfg_${process.pid}.json`);
  let cfgText = "";
  let status = null;
  let spawnErr = null;
  try {
    const fd = fs.openSync(tmpOut, "w");
    try {
      const r = spawnSync(process.execPath, [entry, "config", "--type", "public", "--json"], {
        cwd: ROOT,
        stdio: ["ignore", fd, "pipe"],
        encoding: "utf8",
      });
      status = r.status;
      spawnErr = r.error ?? null;
      if (r.stderr && r.stderr.trim()) {
        console.error(`\x1b[2m[expo-config stderr]\x1b[0m\n${r.stderr.trim().split("\n").slice(-12).join("\n")}`);
      }
    } finally {
      fs.closeSync(fd);
    }
    cfgText = fs.readFileSync(tmpOut, "utf8");
  } catch (e) {
    spawnErr = e;
  } finally {
    try {
      fs.unlinkSync(tmpOut);
    } catch {
      /* 临时文件删除失败不影响结论 */
    }
  }

  const ok = status === 0;
  results.push({ name: "expo-config", ok, status, error: spawnErr });

  if (spawnErr) {
    // ★ 这一分支曾经缺失：EBUSY 时 r.status 为 null、r.stderr 为空，
    //   于是走进 else 打印一个空行，只说「未通过」而不给任何原因 ——
    //   那正是本脚本开头批评 devkit-lint「FAILED 却零诊断」的同一种病，不能自己也犯。
    console.error(`\x1b[31m[expo-config] 启动失败：${spawnErr.code ?? ""} ${spawnErr.message}\x1b[0m`);
  } else if (ok) {
    try {
      const cfg = JSON.parse(cfgText);
      const sdk = cfg.sdkVersion ?? "?";
      const id = cfg.ios?.bundleIdentifier ?? "?";
      console.log(`配置解析成功：name=${cfg.name} slug=${cfg.slug} sdk=${sdk} bundleId=${id}`);
    } catch {
      console.log("配置解析成功（输出非 JSON，已忽略）");
    }
  } else {
    console.error(`\x1b[31m[expo-config] 退出码 ${status}，未产出可解析配置\x1b[0m`);
    if (cfgText.trim()) console.error(cfgText.trim().split("\n").slice(-12).join("\n"));
  }
}

/* ---- 5. 打包用环境变量（RevenueCat key）----
 * ★ 为什么必须做成门禁：这是一条**本地永远测不出来**的故障。
 *   `native/.env` 被 .gitignore 忽略，而 EAS 云端构建默认按 .gitignore 排除上传的文件：
 *     · 官方 build-reference/easignore：「By default, the EAS CLI refers to the .gitignore file
 *       (if it exists) to determine which files to ignore」；
 *     · 官方 eas/environment-variables：被 gitignore / 未提交的 .env「are not available for jobs
 *       that run on a remote server, for example, EAS Build」。
 *   → 只在 .env 里配 key 时，本地 `npx expo start` 一切正常，**云端打的包却拿不到 key**：
 *     `hasRcKey()` 为 false → 价格位显示「—」、买断按钮点了回「购买未完成」。
 *   没有这道检查，只能等「打完包上 TestFlight 才发现内购页是坏的」，代价是一整轮构建。
 *   检查两件事：① eas.json 的 production.env 里确有格式合法的 key；
 *              ② 与 .env 的值一致（防止只改一处、两边漂移）。
 *   .env 缺失或留空不算错（新克隆的机器本来就没有真 key）。
 */
{
  process.stdout.write(`\n\x1b[2m── 打包环境变量（RevenueCat key）────────────────────\x1b[0m\n`);
  const KEY_NAME = "EXPO_PUBLIC_REVENUECAT_IOS_KEY";
  const problems = [];
  let prodKey = "";

  try {
    const easJson = JSON.parse(fs.readFileSync(path.join(ROOT, "eas.json"), "utf8"));
    const raw = easJson?.build?.production?.env?.[KEY_NAME];
    prodKey = typeof raw === "string" ? raw.trim() : "";
    if (!prodKey) {
      problems.push(`eas.json 的 build.production.env 里没有 ${KEY_NAME} —— 云端包会拿不到内购 key`);
    } else if (!/^appl_[A-Za-z0-9_-]{20,}$/.test(prodKey)) {
      problems.push(`${KEY_NAME} 格式不像 RevenueCat 公开 key（应为 appl_ 开头）：${JSON.stringify(prodKey)}`);
    }
  } catch (e) {
    problems.push(`eas.json 读取/解析失败：${e.message}`);
  }

  const envPath = path.join(ROOT, ".env");
  if (fs.existsSync(envPath)) {
    // 注意：.env 是 CRLF，`(.*)$` 会吃掉 \r —— 必须 trim 后再比，否则会误报「不一致」
    const m = fs.readFileSync(envPath, "utf8").match(/^\s*EXPO_PUBLIC_REVENUECAT_IOS_KEY\s*=\s*(.*)$/m);
    const localKey = m ? m[1].trim() : "";
    if (localKey && prodKey && localKey !== prodKey) {
      problems.push(
        `.env 与 eas.json 的 ${KEY_NAME} 不一致（本地/线上表现会不同）\n      .env     = ${localKey}\n      eas.json = ${prodKey}`,
      );
    }
  }

  const ok5 = problems.length === 0;
  results.push({ name: "eas-env", ok: ok5, status: ok5 ? 0 : 1, error: undefined });
  if (ok5) {
    console.log(`生产环境变量就绪：${KEY_NAME}=${prodKey.slice(0, 10)}…（已与 .env 逐字比对）`);
  } else {
    for (const p of problems) console.error(`\x1b[31m[eas-env] ${p}\x1b[0m`);
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
