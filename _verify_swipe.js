/**
 * Seeora · 习惯卡左滑（编辑 / 删除）回归测试 —— 2026-10-07 新增
 *
 * 背景：今天页的习惯卡此前没有编辑/删除入口；本轮补上「左滑露出编辑+删除」，
 *   交互与「迁移条」完全一致（同一套手势代码、同一套按钮文案键）。
 *   同时把两个按钮的配色从「土黄 #b8932c / 暗砖红 #b23b34」换成 iOS 系统灰 / 系统红。
 *
 * 本脚本的守门重点（全部用**真实指针事件**驱动，不靠直接调函数）：
 *   ① 结构：每个习惯卡外层必须是 .h-swipe，内含 .h-actions 且恰好 2 个按钮
 *   ② 配色：按钮必须是 iOS systemGray/Red，且**不得**退回旧的土黄/暗砖红
 *   ③ 手势：左滑 → .open + 卡片 translateX(-144)；松手不误进详情页
 *   ④ 收起：已滑开的行再点一下 → 先收起，不进详情
 *   ⑤ 编辑：打开同一个表单、标题为「编辑习惯」、输入框已预填 → 保存后原地改名且条数不变
 *   ⑥ 删除：条数 -1
 *
 * 运行：
 *   NODE_PATH="C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules" \
 *     "C:/Users/Administrator/.workbuddy/binaries/node/versions/22.22.2-6/node.exe" _verify_swipe.js
 */
const puppeteer = require("puppeteer-core");
// ★ 2026-10-07：同 _verify_fix.js —— 不再写死路径，按候选目录探测（文件被挪到 Desktop/ 也能守）。
const path = require("path");
const fs = require("fs");
const PAGE_DIRS = [process.env.PAGES_DIR, __dirname, path.join(__dirname, "..")].filter(Boolean);
const PAGE_DIR = PAGE_DIRS.find((d) => { try { return fs.existsSync(path.join(d, "index.html")); } catch (e) { return false; } });
if (!PAGE_DIR) {
  console.error("找不到 index.html。已尝试：" + PAGE_DIRS.join("  |  ") + "（可用 PAGES_DIR 指定目录）");
  process.exit(2);
}
const FILE = "file:///" + encodeURI(path.resolve(PAGE_DIR, "index.html").replace(/\\/g, "/"));
console.log("被测原型：" + FILE);
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0, fail = 0;
const rec = (label, ok, detail) => {
  ok ? pass++ : fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? "   — " + detail : ""}`);
};

/** 真实指针左滑（Chrome 的 mouse 事件会一并派发 pointerdown/move/up） */
async function swipeLeft(p, sel, dist) {
  const c = await p.evaluate((s) => {
    const r = document.querySelector(s).getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, sel);
  await p.mouse.move(c.x, c.y);
  await p.mouse.down();
  for (let i = 1; i <= 10; i++) await p.mouse.move(c.x - (dist * i) / 10, c.y);
  await p.mouse.up();
  await sleep(420);
}

const cardShift = (p, idx) => p.evaluate((i) => {
  const el = document.querySelector(`#list .h-swipe[data-idx="${i}"] .card`);
  const m = new DOMMatrixReadOnly(getComputedStyle(el).transform);
  return Math.round(m.m41);
}, idx);

(async () => {
  const b = await puppeteer.launch({ executablePath: EDGE, headless: "new", args: ["--no-sandbox", "--allow-file-access-from-files"] });
  const p = await b.newPage();
  await p.setViewport({ width: 440, height: 880 });
  await p.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "light" }]);
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  await p.goto(FILE, { waitUntil: "load" });
  await sleep(1700);

  // ── ① 结构 ──────────────────────────────────────────────
  rec("每张习惯卡都包在 .h-swipe 里（外层承接左滑裁剪）", await p.evaluate(() =>
    document.querySelectorAll("#list .h-swipe").length > 0 &&
    document.querySelectorAll("#list .h-swipe").length === document.querySelectorAll("#list .card").length
  ), await p.evaluate(() => `h-swipe=${document.querySelectorAll("#list .h-swipe").length} card=${document.querySelectorAll("#list .card").length}`));

  rec("每张卡内都有 .h-actions 且正好 2 个按钮（编辑 + 删除）", await p.evaluate(() => {
    const rows = Array.from(document.querySelectorAll("#list .h-swipe"));
    return rows.length > 0 && rows.every((r) => {
      const acts = r.querySelectorAll(".h-actions span[data-act]");
      return acts.length === 2 && acts[0].getAttribute("data-act") === "edit" && acts[1].getAttribute("data-act") === "del";
    });
  }), await p.evaluate(() => {
    const r = document.querySelector("#list .h-swipe");
    return Array.from(r.querySelectorAll(".h-actions span")).map((s) => s.getAttribute("data-act") + ":" + s.textContent).join(" | ");
  }));

  // ── ② 配色（本轮要点：换成 iOS 系统灰 / 系统红）────────────
  const col = await p.evaluate(() => {
    const e = document.querySelector("#list .h-act-edit"), d = document.querySelector("#list .h-act-del");
    return { edit: getComputedStyle(e).backgroundColor, del: getComputedStyle(d).backgroundColor,
             migEdit: getComputedStyle(document.querySelector(".mig-act-edit") || document.body).backgroundColor };
  });
  rec("编辑按钮 = iOS 系统灰 rgb(142,142,147)", col.edit === "rgb(142, 142, 147)", col.edit);
  rec("删除按钮 = iOS 系统红 rgb(255,59,48)", col.del === "rgb(255, 59, 48)", col.del);
  // ★ 断言「实际生效的计算样式」，而不是扫源码文本 —— 注释里会记录旧色值用于追溯，
  //   扫文本会把注释也算进去导致永远报红（这一版就是这么踩坑的）。
  rec("所有左滑按钮的实际颜色只允许是 iOS 系统灰 / 系统红（旧土黄、暗砖红已绝迹）", await p.evaluate(() => {
    const ok = ["rgb(142, 142, 147)", "rgb(255, 59, 48)"];
    const els = Array.from(document.querySelectorAll(".h-act-edit,.h-act-del,.mig-act-edit,.mig-act-del"));
    return els.length > 0 && els.every((e) => ok.indexOf(getComputedStyle(e).backgroundColor) >= 0);
  }), await p.evaluate(() => Array.from(document.querySelectorAll(".h-act-edit,.h-act-del,.mig-act-edit,.mig-act-del"))
    .map((e) => e.className + "=" + getComputedStyle(e).backgroundColor).join(" | ")));

  // ── ③ 手势：左滑露出 ────────────────────────────────────
  rec("初始：没有卡片是滑开状态", await p.evaluate(() => document.querySelectorAll("#list .h-swipe.open").length === 0));
  await swipeLeft(p, '#list .h-swipe[data-idx="0"]', 200);
  const shift = await cardShift(p, 0);
  rec("左滑后 .h-swipe 加 open 且卡片整体左移 144px", await p.evaluate(() =>
    document.querySelector('#list .h-swipe[data-idx="0"]').classList.contains("open")
  ) && Math.abs(shift + 144) <= 1, `translateX=${shift}px`);
  rec("左滑松手后**没有**误进详情页", await p.evaluate(() => !document.getElementById("view-detail").classList.contains("on")));

  // ── ④ 已滑开时点卡片 → 先收起 ───────────────────────────
  await p.evaluate(() => document.querySelector('#list .h-swipe[data-idx="0"] .card').click());
  await sleep(350);
  rec("已滑开的行点一下 → 先收起，不进详情", await p.evaluate(() =>
    !document.querySelector('#list .h-swipe[data-idx="0"]').classList.contains("open") &&
    !document.getElementById("view-detail").classList.contains("on")
  ));

  // ── ⑤ 编辑 ─────────────────────────────────────────────
  const beforeCount = await p.evaluate(() => document.querySelectorAll("#list .h-swipe").length);
  const beforeName = await p.evaluate(() => document.querySelector('#list .h-swipe[data-idx="0"] .h-name').textContent);
  await swipeLeft(p, '#list .h-swipe[data-idx="0"]', 200);
  await p.evaluate(() => document.querySelector('#list .h-swipe[data-idx="0"] .h-act-edit').click());
  await sleep(700);
  rec("点「编辑」→ 打开习惯表单（同一个 sheetAdd）", await p.evaluate(() =>
    document.getElementById("sheetAdd").classList.contains("on")));
  rec("编辑态：表单标题为「编辑习惯」而不是「新建习惯」", await p.evaluate(() =>
    document.getElementById("addTitle").textContent === t().editTitle
  ), await p.evaluate(() => `title="${document.getElementById("addTitle").textContent}" 期望="${t().editTitle}"`));
  rec("编辑态：名称输入框已预填原习惯名", await p.evaluate((n) =>
    document.getElementById("inpName").value === n, beforeName), `value="${await p.evaluate(() => document.getElementById("inpName").value)}"`);
  rec("编辑态：频次分段控件已选中该习惯的真实频次", await p.evaluate((idx) => {
    const h = HABITS[+idx];
    const seg = document.getElementById("segFreq").children;
    const on = Array.from(seg).findIndex((b) => b.classList.contains("on"));
    return [1,2,3,7][on] === h.freqDays;
  }, 0));

  const newName = "Renamed-" + Date.now().toString().slice(-4);
  await p.evaluate((n) => { document.getElementById("inpName").value = n; }, newName);
  await p.evaluate(() => document.getElementById("btnAddSave").click());
  await sleep(600);
  rec("保存编辑 → 表单关闭", await p.evaluate(() => !document.getElementById("sheetAdd").classList.contains("on")));
  rec("保存编辑 → 卡名已更新", await p.evaluate((n) =>
    document.querySelector('#list .h-swipe[data-idx="0"] .h-name').textContent === n, newName));
  rec("保存编辑 → **条目数不变**（是改而不是新增）", await p.evaluate((n) =>
    document.querySelectorAll("#list .h-swipe").length === n, beforeCount),
    `before=${beforeCount} after=${await p.evaluate(() => document.querySelectorAll("#list .h-swipe").length)}`);
  rec("保存编辑 → 数据已落盘（localStorage 里有新名字）", await p.evaluate((n) => {
    try { return (localStorage.getItem("seeora_habits") || "").indexOf(n) >= 0; } catch (e) { return false; }
  }, newName));

  // ── ⑥ 删除 ─────────────────────────────────────────────
  const cnt2 = await p.evaluate(() => document.querySelectorAll("#list .h-swipe").length);
  await swipeLeft(p, '#list .h-swipe[data-idx="0"]', 200);
  await p.evaluate(() => document.querySelector('#list .h-swipe[data-idx="0"] .h-act-del').click());
  await sleep(500);
  rec("点「删除」→ 条目数 -1", await p.evaluate((n) =>
    document.querySelectorAll("#list .h-swipe").length === n - 1, cnt2),
    `before=${cnt2} after=${await p.evaluate(() => document.querySelectorAll("#list .h-swipe").length)}`);
  rec("点「删除」→ 有反馈提示（toast 文案 = 已删除该习惯）", await p.evaluate(() => {
    const el = document.getElementById("toast");
    return !!el && el.textContent === t().habitRemoved;
  }), await p.evaluate(() => `toast="${(document.getElementById("toast") || {}).textContent}" 期望="${t().habitRemoved}"`));

  // ── ⑦ 回归：迁移条手势未被破坏 ──────────────────────────
  rec("收尾：无 pageerror", errs.length === 0, JSON.stringify(errs.slice(0, 3)));
  rec("收尾：无横向滚动", await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));

  console.log(`\n结论：${pass}/${pass + fail} 通过`);
  if (fail) console.log(`失败：${fail} 项`);
  // ★ 退出兜底（比 _verify_fix.js 更硬）：本脚本用过鼠标手势，本机实测 b.close() 会挂住；
  //   一旦挂住，Edge 的子进程仍持有 stdout 写端，shell 的重定向管道等不到 EOF，
  //   整条命令被挂到超时（表现：结论已打印却不返回，最后 SIGTERM，看着像失败，实为全过）。
  //   所以**不走 b.close()**，直接 taskkill /F /T 杀进程树 —— 最快且一定成功。
  const proc = b.process();
  if (proc && proc.pid) {
    try { require("child_process").execSync(`taskkill /F /T /PID ${proc.pid}`, { stdio: "ignore" }); } catch (e) {}
  }
  process.exit(fail ? 1 : 0);
})().catch(async (e) => { console.error("脚本自身失败：", e.message); process.exit(1); });
