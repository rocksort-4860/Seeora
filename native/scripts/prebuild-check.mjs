#!/usr/bin/env node
/**
 * EAS 打包前置门禁（`npm run build:ios` 的实际目标）
 * ============================================================
 * ★ 它解决什么问题
 *   EAS Build 按次计数，云端失败一次就白花一次额度。本脚本把
 *   「本地校验」变成打包的硬前置：校验不过， eas 命令根本不会被调起，
 *   云端构建零触发。
 *
 * ★ 与 eas CLI 的关系
 *   eas CLI 没有官方 hook 机制，无法从底层拦截裸 `eas build`。
 *   本脚本是「包装」方案：一律通过 npm run build:ios / build:android
 *   进入打包流程。绕过的唯一方式是手动敲 eas 命令——文档里已明示后果。
 *
 * ★ 本机纪律（同 scripts/lint.mjs）
 *   - 本地校验子进程：process.execPath + JS 入口 + stdio inherit（零管道）；
 *   - eas 调用：项目内 eas-cli 优先（node 直起）；否则用全局 eas
 *     （shell:true，让 cmd.exe / sh 自己解析 PATHEXT——本机 CreateProcess
 *     不认裸名字，这是 lint.mjs 用踩坑换来的结论）。
 *
 * ★ 用法
 *   npm run build:ios                        # 全量校验 + eas build -p ios --profile production
 *   npm run build:android                    # 同上，Android
 *   node scripts/prebuild-check.mjs --quick -- eas build -p ios --profile production
 *                                             # 快速校验（跳过 Metro/jest）+ 打包
 */
import { spawn, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");

const C = {
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
};

const argv = process.argv.slice(2);
const sep = argv.indexOf("--");
const ownArgs = sep === -1 ? [] : argv.slice(0, sep); // 传给 check-local 的参数
const easArgs = sep === -1 ? [] : argv.slice(sep + 1); // 真正要执行的 eas 命令

if (sep === -1 || easArgs.length === 0) {
  console.error(C.red("用法：node scripts/prebuild-check.mjs [check-local 参数] -- <eas 命令>"));
  console.error("示例：npm run build:ios   （内部等价于 ... -- eas build -p ios --profile production）");
  process.exit(2);
}

if (easArgs.some((a) => a === "submit")) {
  console.log(C.dim("提醒：本次将执行 eas submit（提交审核），不只是打包。"));
}

/* ---- 1. 本地校验（硬闸门）---- */
console.log(C.dim(`── 打包前本地校验（check-local${ownArgs.length ? ` ${ownArgs.join(" ")}` : " 全量"}）──`));
const check = spawnSync(process.execPath, [path.join(HERE, "check-local.mjs"), ...ownArgs], {
  cwd: ROOT,
  stdio: "inherit",
});
if (check.status !== 0) {
  console.error(C.red("\n══ 本地校验未通过，已阻止 EAS 云端构建 ══"));
  console.error("请修掉上面标 ✗ 的问题，然后重新执行 npm run build:ios。");
  console.error("如确需强行打包（不推荐），只能手动运行 eas 命令——那将绕过全部本地保护。");
  process.exit(1);
}

/* ---- 2. 解析 eas 入口：项目内 eas-cli 优先，全局 eas 回退 ---- */
function resolveEas() {
  try {
    const pkgPath = createRequire(path.join(ROOT, "package.json")).resolve("eas-cli/package.json");
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
    const binRel = typeof pkg.bin === "string" ? pkg.bin : pkg.bin?.eas;
    if (binRel) {
      const entry = path.join(path.dirname(pkgPath), binRel);
      if (fs.existsSync(entry)) return { mode: "node", entry };
    }
  } catch {
    /* 项目内没有 eas-cli，走全局 */
  }
  return { mode: "shell", entry: "eas" };
}

const eas = resolveEas();
console.log(C.green(`── 本地校验通过，开始执行：${easArgs.join(" ")} ──`));

const child =
  eas.mode === "node"
    ? spawn(process.execPath, [eas.entry, ...easArgs], { cwd: ROOT, stdio: "inherit" })
    : spawn("eas", easArgs, { cwd: ROOT, stdio: "inherit", shell: true });

child.on("error", (e) => {
  console.error(C.red(`eas 启动失败：${e.message}`));
  console.error("全局 eas CLI 是否已安装？（npm i -g eas-cli）");
  process.exit(1);
});
child.on("exit", (code, signal) => {
  process.exit(code ?? (signal ? 1 : 0));
});
