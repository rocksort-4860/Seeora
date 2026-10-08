/**
 * Seeora 原型弹层回归测试（2026-10-07 第二次改版后重写）
 *
 * 背景：弹层已从「底部抽屉」整体改为「从右侧滑入的整页 + 导航栈」。
 *   旧脚本断言的是旧模型（打开新层时旧层被强制关闭），对新模型会误报，故重写。
 *
 * 新模型的两条核心不变量（本脚本的守门重点）：
 *   ① 同一时刻「正位可交互」的面板最多 1 个（rest === 1）；
 *      被压到左侧的上一层为 .behind：仍 .on，但 pointer-events:none 且被完全遮盖 → 不参与交互。
 *   ② 收起的弹层必须「真收起」：visibility:hidden 且被推到右侧屏外（dx≈+375）→ 不产生幽灵弹层、不拦点击。
 *
 * 运行（Windows，需先在隔离工作区装好 puppeteer-core）：
 *   NODE_PATH="C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules" \
 *     "C:/Users/Administrator/.workbuddy/binaries/node/versions/22.22.2-6/node.exe" _verify_fix.js
 */
const puppeteer = require("puppeteer-core");
// ★ 2026-10-07：原型/网页文件会被哥哥在「习惯927/」与上级「Desktop/」之间挪动（上传 GitHub 用），
//   原先写死 `file:///D:/Desktop/习惯927/index.html` —— 文件一挪，脚本就**静默失联**（报一堆假 FAIL）。
//   改为按候选目录顺序探测并打印实际命中目录，可用 PAGES_DIR 环境变量强制指定。
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

const results = [];
const rec = (label, ok, detail) => {
  results.push({ label, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? "   — " + detail : ""}`);
};

/** 汇总当前所有弹层的状态，并算出两条不变量 */
const snapshot = (page) =>
  page.evaluate(() => {
    const appEl = document.getElementById("app");
    const ab = appEl.getBoundingClientRect();
    // ★ 2026-10-07：加了手机外框（#app 有 12px border）后，弹层的 left:0 基准是
    //   **内边距框**（padding box），而 getBoundingClientRect() 给的是**边框框**（border box）。
    //   必须补 clientLeft，否则所有 dx 都会整体偏移 12px，误判成「没停在正位」。
    const appLeft = ab.left + appEl.clientLeft;
    const all = Array.from(document.querySelectorAll(".sheet")).map((e) => {
      const r = e.getBoundingClientRect(), cs = getComputedStyle(e);
      return {
        id: e.id,
        dx: Math.round(r.left - appLeft),
        on: e.classList.contains("on"),
        behind: e.classList.contains("behind"),
        vis: cs.visibility, pe: cs.pointerEvents, z: Number(e.style.zIndex || cs.zIndex),
      };
    });
    const rest = all.filter((s) => s.on && !s.behind && s.vis === "visible" && s.pe === "auto" && Math.abs(s.dx) < 4).map((s) => s.id);
    const ghosts = all.filter((s) => !s.on && s.vis === "visible" && s.pe !== "none").map((s) => s.id);
    return { all, rest, ghosts };
  });

const one = (s, id) => s.all.find((x) => x.id === id) || {};

/** 真实坐标点击（先等可见，避免点到异步才出现的元素上） */
async function click(page, sel) {
  await page.waitForFunction((s) => {
    const e = document.querySelector(s); if (!e) return false;
    const r = e.getBoundingClientRect();
    return r.width > 1 && r.height > 1 && getComputedStyle(e).visibility !== "hidden";
  }, { timeout: 5000 }, sel).catch(() => {});
  const probe = await page.evaluate((s) => {
    const e = document.querySelector(s); if (!e) return "no-el";
    e.scrollIntoView({ block: "center" });
    const r = e.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    if (hit && (hit === e || e.contains(hit) || hit.contains(e))) return "real";
    return "fallback";
  }, sel);
  if (probe === "real") {
    const p = await page.evaluate((s) => { const b = document.querySelector(s).getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; }, sel);
    await page.mouse.click(p.x, p.y);
  } else if (probe === "fallback") { await page.evaluate((s) => document.querySelector(s).click(), sel); }
  else throw new Error("selector not found: " + sel);
  await sleep(540); // 等 0.34s 动画
}

(async () => {
  const b = await puppeteer.launch({ executablePath: EDGE, headless: "new", args: ["--no-sandbox", "--allow-file-access-from-files"] });
  const p = await b.newPage();
  await p.setViewport({ width: 430, height: 860 });
  await p.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "light" }]);
  const errs = [], cerrs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  p.on("console", (m) => { if (m.type() === "error") cerrs.push(m.text()); });
  await p.goto(FILE, { waitUntil: "load" });
  await sleep(1600);

  // 0) 初始态
  let s = await snapshot(p);
  rec("初始：无弹层打开、无幽灵弹层", s.rest.length === 0 && s.ghosts.length === 0, JSON.stringify({ rest: s.rest, ghosts: s.ghosts }));
  rec("初始：无横向页面滚动", await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));

  // 1) 设置页：右侧滑入、停在正位、有顶部返回、拖拽条隐藏
  await click(p, "#btnSet");
  s = await snapshot(p);
  rec("设置页从右侧滑入并停在正位", s.rest.length === 1 && s.rest[0] === "sheetSet", JSON.stringify(s.rest));
  rec("设置页有顶部返回键", await p.evaluate(() => !!document.querySelector("#sheetSet .page-nav .page-back")));
  rec("拖拽条 .sheet-bar 已隐藏", await p.evaluate(() => getComputedStyle(document.querySelector("#sheetSet .sheet-bar")).display === "none"));

  // 2) 设置 → 语言：语言正位、设置退居背后（不可交互）
  await click(p, "#rowLang");
  s = await snapshot(p);
  rec("点「语言」→ 语言页正位，设置退居背后", s.rest.length === 1 && s.rest[0] === "sheetLang" && one(s, "sheetSet").behind === true && one(s, "sheetSet").pe === "none", JSON.stringify({ rest: s.rest, set: one(s, "sheetSet") }));

  // 3) 返回：语言滑出屏外(hidden)，设置滑回正位
  await click(p, "#sheetLang .page-back");
  s = await snapshot(p);
  rec("返回 → 语言页收起到屏外(visibility:hidden)", one(s, "sheetLang").vis === "hidden" && one(s, "sheetLang").dx > 300, JSON.stringify(one(s, "sheetLang")));
  rec("返回 → 设置页滑回正位（回到上一层，而不是首页）", s.rest.length === 1 && s.rest[0] === "sheetSet", JSON.stringify(s.rest));

  // 4) 外观往返
  await click(p, "#rowTheme");
  s = await snapshot(p);
  rec("点「外观」→ 外观页正位", s.rest.length === 1 && s.rest[0] === "sheetTheme", JSON.stringify(s.rest));
  await click(p, "#sheetTheme .page-back");
  s = await snapshot(p);
  rec("外观返回 → 回设置页", s.rest.length === 1 && s.rest[0] === "sheetSet", JSON.stringify(s.rest));

  // 5) 隐私文档往返
  await click(p, "#rowPrivacy");
  s = await snapshot(p);
  rec("点「隐私」→ 文档页正位", s.rest.length === 1 && s.rest[0] === "sheetDoc", JSON.stringify(s.rest));
  await click(p, "#sheetDoc .page-back");
  s = await snapshot(p);
  rec("隐私返回 → 回设置页", s.rest.length === 1 && s.rest[0] === "sheetSet", JSON.stringify(s.rest));

  // 5b) 设置页「数据」组（2026-10-07 哥哥定稿）：只留 导出 / 导入 两行
  //     恢复购买入口已从设置页**删除**，全站只留付费墙那一处（两个入口容易行为不一致）
  rec("设置页「数据」组只剩 导出/导入 两行（恢复购买已移至付费墙）", await p.evaluate(() => {
    const list = document.getElementById("rowExport").parentElement;
    const rows = Array.from(list.querySelectorAll(".set-row")).map((r) => r.id);
    return rows.join(",") === "rowExport,rowImport" && !document.getElementById("rowRestore");
  }), await p.evaluate(() => {
    const list = document.getElementById("rowExport").parentElement;
    return "rows=" + Array.from(list.querySelectorAll(".set-row")).map((r) => r.id).join(">")
      + " hasRowRestore=" + !!document.getElementById("rowRestore");
  }));
  // ★ 设置页「数据」组的灰色小字说明取消，只留标题
  rec("设置页「数据」组已取消灰色小字说明（只留标题）", await p.evaluate(() => {
    return ["rowExport", "rowImport"].every((id) => {
      const r = document.getElementById(id);
      return r && !r.querySelector(".t2");
    });
  }), await p.evaluate(() => ["rowExport", "rowImport"]
    .map((id) => id + ":" + (document.getElementById(id).querySelector(".t2") ? "HAS-SUB" : "no-sub")).join(" | ")));
  // ★ 2026-10-07（哥哥第二轮反馈「设置页字体不美观」）—— 行标题改用「品牌深档 + 中等字重」：
  //   ① 颜色必须是 --brand-soft-text（亮色 #006B5A / 深色 #4dd8c4），**不能是给图形/按钮用的亮档 --brand**
  //      —— #00A898 在白底上对比度仅 2.9:1（低于 AA 的 4.5:1），大面积做正文会「发飘、像链接」。
  //      苹果的分层做法就是同色系不同明度：面/图形走亮档、文字走深档。
  //   ② 字重必须是 500：Windows 的微软雅黑只有 400/700 两档，请求 600 会被**向上取整成 Bold**，
  //      中文标题糊成一坨；500 在雅黑落到 Regular、在 iOS PingFang 落到 Medium，两平台都干净。
  //   反向断言：颜色 ≠ 亮档 --brand、字重 < 600 —— 以后再改回去会立刻报红。
  rec("设置页行标题用品牌深档 --brand-soft-text（不是给图形用的亮档 --brand）", await p.evaluate(() => {
    const hex2rgb = (h) => { h = h.trim().replace("#", ""); return "rgb(" + parseInt(h.slice(0, 2), 16) + ", " + parseInt(h.slice(2, 4), 16) + ", " + parseInt(h.slice(4, 6), 16) + ")"; };
    const cs = getComputedStyle(document.documentElement);
    const got = getComputedStyle(document.querySelector("#rowExport .t1")).color;
    return got === hex2rgb(cs.getPropertyValue("--brand-soft-text")) && got !== hex2rgb(cs.getPropertyValue("--brand"));
  }), await p.evaluate(() => {
    const cs = getComputedStyle(document.documentElement);
    return "t1=" + getComputedStyle(document.querySelector("#rowExport .t1")).color
      + "  深档(--brand-soft-text)=" + cs.getPropertyValue("--brand-soft-text").trim()
      + "  亮档(--brand)=" + cs.getPropertyValue("--brand").trim();
  }));
  rec("设置页行标题字重 500（避开雅黑把 600 取整成 Bold）", await p.evaluate(() =>
    Number(getComputedStyle(document.querySelector("#rowExport .t1")).fontWeight) === 500
  ), await p.evaluate(() => "weight=" + getComputedStyle(document.querySelector("#rowExport .t1")).fontWeight
    + " size=" + getComputedStyle(document.querySelector("#rowExport .t1")).fontSize));
  // ★ 2026-10-07：分层规则 —— **可点行**才用品牌色（tint），**纯信息行**（Version）用普通文字色。
  //   苹果规范里 tint 色携带「可操作」语义，给信息行上色会让用户误以为能点进去。
  rec("设置页只有「可点行」用品牌色，纯信息行(Version)用普通色", await p.evaluate(() => {
    const brand = getComputedStyle(document.querySelector("#rowExport .t1")).color;
    const vs = document.querySelector("#versionLab").closest(".set-row");
    const ink = getComputedStyle(document.querySelector("#versionLab")).color;
    return ink !== brand && vs.classList.contains("is-static") && vs.getAttribute("style") === null;
  }), await p.evaluate(() => {
    const vs = document.querySelector("#versionLab").closest(".set-row");
    return "clickable=" + getComputedStyle(document.querySelector("#rowExport .t1")).color
      + "  static=" + getComputedStyle(document.querySelector("#versionLab")).color
      + "  class=" + vs.className + "  inlineStyle=" + JSON.stringify(vs.getAttribute("style"));
  }));
  // ★ Tab 栏（哥哥第二轮反馈「tab 入口的底色和下方的白色色块大小不一致」）：
  //   原来的 padding 是 9px 12px → 左右 12、上下 9，选中色块四周留白不对称。
  //   现已统一为 12px；用反向断言钉住「四边必须相等」，避免以后被单边改动破坏。
  rec("Tab 栏选中块四周留白一致（左=右=上=下）", await p.evaluate(() => {
    const tb = document.querySelector(".tabbar").getBoundingClientRect();
    const a = document.querySelector("#tabHabits").getBoundingClientRect();
    const b2 = document.querySelector("#tabHonors").getBoundingClientRect();
    // 右边距要用**右侧那块**的右边界来量；拿左侧块的右边去量会把整块 Honors 的宽度算进去。
    const L = Math.round(a.left - tb.left), R = Math.round(tb.right - b2.right);
    const T = Math.round(a.top - tb.top), B = Math.round(tb.bottom - a.bottom);
    return L === R && T === B && L === T;
  }), await p.evaluate(() => {
    const tb = document.querySelector(".tabbar").getBoundingClientRect();
    const a = document.querySelector("#tabHabits").getBoundingClientRect();
    const b2 = document.querySelector("#tabHonors").getBoundingClientRect();
    return "L=" + Math.round(a.left - tb.left) + " R=" + Math.round(tb.right - b2.right)
      + " T=" + Math.round(a.top - tb.top) + " B=" + Math.round(tb.bottom - a.bottom)
      + " | 两块间距=" + Math.round(b2.left - a.right)
      + " | tabbar=" + Math.round(tb.width) + "×" + Math.round(tb.height)
      + " tab=" + Math.round(a.width) + "×" + Math.round(a.height);
  }));

  // 6) 付费墙 → 其内再开隐私页（DOM 顺序靠前，靠动态 z-index 盖在上层）→ 逐层返回
  await click(p, "#proEntry");
  s = await snapshot(p);
  rec("Pro 入口 → 付费墙正位", s.rest.length === 1 && s.rest[0] === "sheetPay", JSON.stringify(s.rest));
  // ★ 2026-10-07：付费墙顶部图标必须是 Seeora 品牌标（三联圆＋两条连线，viewBox 240:80），
  //   不能再退回旧的「绿圈白对号」占位图（viewBox 24:24、1 个圆、0 条连线）。
  //   反向断言：只要结构对不上就报红，避免以后被无意改回去。
  rec("付费墙顶部图标已是 Seeora 品牌标（不再是旧的绿圈白对号）", await p.evaluate(() => {
    const svg = document.querySelector("#sheetPay .pay-icon");
    if (!svg) return false;
    return svg.getAttribute("viewBox") === "0 0 240 80"
      && svg.querySelectorAll("circle").length === 3
      && svg.querySelectorAll("line").length === 2;
  }), await p.evaluate(() => {
    const svg = document.querySelector("#sheetPay .pay-icon");
    if (!svg) return "no #sheetPay .pay-icon";
    return "viewBox=" + svg.getAttribute("viewBox")
      + " circle=" + svg.querySelectorAll("circle").length
      + " line=" + svg.querySelectorAll("line").length;
  }));
  // ★ 2026-10-07（哥哥定稿）：付费墙四条权益前统一为「绿圈白对号」徽章 ——
  //   实心 var(--brand) 圆 + 白色对号，与 App 的绿色主视觉一致。
  //   演变史：li::before 字符对号 → 四条各自线性图标（中途试过，哥哥否掉）→ 统一徽章。
  //   双向断言：① 每条都有 svg.pay-ic 且是「圆(fill=--brand) + 白色对号」结构 ② 旧 ✓ 伪元素不复活（下一条）。
  rec("付费墙四条权益前均为绿圈白对号徽章", await p.evaluate(() => {
    const ls = Array.from(document.querySelectorAll("#sheetPay .pay-benefits li"));
    if (ls.length !== 4) return false;
    return ls.every((l) => {
      const s = l.querySelector("svg.pay-ic");
      if (!s) return false;
      const c = s.querySelector("circle"), pth = s.querySelector("path");
      return !!c && !!pth
        && /var\(--brand\)/.test(c.getAttribute("fill") || "")
        && (pth.getAttribute("stroke") || "").toLowerCase() === "#fff";
    });
  }), await p.evaluate(() => Array.from(document.querySelectorAll("#sheetPay .pay-benefits li")).map((l) => {
    const s = l.querySelector("svg.pay-ic");
    if (!s) return "MISSING";
    const c = s.querySelector("circle"), pth = s.querySelector("path");
    const r = s.getBoundingClientRect();
    return (c ? "circle(" + c.getAttribute("fill") + ")" : "-")
      + (pth ? "+check(" + pth.getAttribute("stroke") + ")" : "")
      + " " + Math.round(r.width) + "px";
  }).join(" | ")));
  // ⚠️ 不能量 getBoundingClientRect：付费墙打开时价格仍在异步加载，
  //    此时 .pay-benefits 是 display:none（见 setPaywallState），量出来恒为 0×0。
  //    改用计算样式（不受 display:none 影响），顺带把尺寸精确钉成 20px。
  rec("权益前徽章尺寸 20px（白对号看得清，不是细线）", await p.evaluate(() => {
    const cs = getComputedStyle(document.querySelector("#sheetPay .pay-ic"));
    return cs.width === "20px" && cs.height === "20px";
  }), await p.evaluate(() => {
    const cs = getComputedStyle(document.querySelector("#sheetPay .pay-ic"));
    return cs.width + " x " + cs.height;
  }));
  // ★ 2026-10-07（按哥哥要求）：付费墙权益卡片取消每条下方的灰色说明，只留四条标题。
  rec("付费墙权益卡片已取消每条下方的灰色说明", await p.evaluate(() => {
    const ls = Array.from(document.querySelectorAll("#sheetPay .pay-benefits li"));
    return ls.length === 4 && ls.every((l) => !l.querySelector("span"));
  }), await p.evaluate(() => Array.from(document.querySelectorAll("#sheetPay .pay-benefits li"))
    .map((l) => (l.querySelector("span") ? "HAS-SUB" : "no-sub")).join(",")));
  rec("权益前的旧 ✓ 伪元素已移除", await p.evaluate(() => {
    const li = document.querySelector("#sheetPay .pay-benefits li");
    return !/✓/.test(getComputedStyle(li, "::before").content);
  }), await p.evaluate(() => "::before content=" + getComputedStyle(document.querySelector("#sheetPay .pay-benefits li"), "::before").content));
  rec("付费墙顶部图标按 3:1 横版铺开（不被正方形框压成细条）", await p.evaluate(() => {
    const r = document.querySelector("#sheetPay .pay-icon").getBoundingClientRect();
    return r.width >= 100 && Math.abs(r.width / r.height - 3) < 0.15;
  }), await p.evaluate(() => {
    const r = document.querySelector("#sheetPay .pay-icon").getBoundingClientRect();
    return "w=" + Math.round(r.width) + " h=" + Math.round(r.height) + " ratio=" + (r.width / r.height).toFixed(2);
  }));
  // ★ 2026-10-07（按哥哥要求）：恢复购买由付费墙页脚的小灰字 → 改为「直接购买」下方的正式按钮。
  //   反向断言：① 必须是 <button> ② 在 .pay-actions 内、排在 btnBuy 之后
  //   ③ .pay-actions 是纵向排列（保证 DOM 顺序 = 视觉上下）④ 页脚不再残留旧入口
  rec("恢复购买已改为「直接购买」下方的按钮", await p.evaluate(() => {
    const acts = document.querySelector("#sheetPay .pay-actions");
    const b = document.getElementById("btnRestore");
    if (!acts || !b || b.tagName !== "BUTTON" || !acts.contains(b)) return false;
    if (getComputedStyle(acts).flexDirection !== "column") return false;
    return Array.from(acts.querySelectorAll(".btn")).map((e) => e.id).join(",") === "btnTrial,btnBuy,btnRestore";
  }), await p.evaluate(() => {
    const acts = document.querySelector("#sheetPay .pay-actions");
    const b = document.getElementById("btnRestore");
    return "tag=" + (b ? b.tagName : "-")
      + " flexDir=" + (acts ? getComputedStyle(acts).flexDirection : "-")
      + " order=" + Array.from((acts || document).querySelectorAll(".btn")).map((e) => e.id).join(">");
  }));
  rec("付费墙页脚不再残留旧的「恢复购买」小灰字", await p.evaluate(() => !document.querySelector("#sheetPay .pay-foot #btnRestore")));
  // 价格加载中 .pay-actions 是 display:none（量出来会是 0），必须等它可见再量高度
  await p.waitForFunction(() => {
    const e = document.getElementById("btnTrial");
    return e && e.getBoundingClientRect().height > 1;
  }, { timeout: 8000 }).catch(() => {});
  rec("试用 / 买断按钮高度已加高到 56（此前 48，偏矮不好点）", await p.evaluate(() => {
    const h = (id) => Math.round(parseFloat(getComputedStyle(document.getElementById(id)).height));
    return h("btnTrial") === 56 && h("btnBuy") === 56;
  }), await p.evaluate(() => {
    const h = (id) => Math.round(parseFloat(getComputedStyle(document.getElementById(id)).height));
    return "trial=" + h("btnTrial") + " buy=" + h("btnBuy");
  }));
  // 此时按钮已可见，量真实位置与高度（恢复购买须在「直接购买」正下方，且够高好点）
  rec("恢复购买按钮在「直接购买」下方且够高（可见态实测）", await p.evaluate(() => {
    const b = document.getElementById("btnRestore").getBoundingClientRect();
    const buy = document.getElementById("btnBuy").getBoundingClientRect();
    return b.top >= buy.bottom - 1 && b.height >= 40;
  }), await p.evaluate(() => {
    const b = document.getElementById("btnRestore").getBoundingClientRect();
    const buy = document.getElementById("btnBuy").getBoundingClientRect();
    return "buyBottom=" + Math.round(buy.bottom) + " restoreTop=" + Math.round(b.top) + " h=" + Math.round(b.height);
  }));
  // ★ 恢复购买现在**只**在付费墙 → busy / 归位改在这里测（原先测的是已被删掉的设置页那行）
  {
    await p.evaluate(() => document.getElementById("btnRestore").click());
    await sleep(150); // 模拟的 restorePurchases 有 1.5s 延迟 → busy 文案窗口充足
    const busyTxt = await p.evaluate(() => (document.getElementById("btnRestore").textContent || "").trim());
    rec("付费墙「恢复购买」→ 立即进入 busy 文案（防连点）", busyTxt === "正在恢复…" || busyTxt === "Restoring…", busyTxt);
    await p.waitForFunction(() => {
      const t = (document.getElementById("btnRestore").textContent || "").trim();
      return t === "恢复购买" || t === "Restore Purchases";
    }, { timeout: 6000 }).catch(() => {});
    const after = await p.evaluate(() => (document.getElementById("btnRestore").textContent || "").trim());
    rec("付费墙恢复流程结束后文案归位（不会永远停在「正在恢复…」）", after === "恢复购买" || after === "Restore Purchases", after);
  }
  await click(p, "#btnPayPrivacy");
  s = await snapshot(p);
  rec("付费墙内开隐私页 → 文档盖在最上层(z 更高)", s.rest.length === 1 && s.rest[0] === "sheetDoc" && one(s, "sheetDoc").z > one(s, "sheetPay").z, "doc.z=" + one(s, "sheetDoc").z + " pay.z=" + one(s, "sheetPay").z);
  rec("付费墙页脚「隐私政策」链接可见可点（文字非空）", await p.evaluate(() => (document.getElementById("btnPayPrivacy").textContent || "").trim().length > 0));
  await click(p, "#sheetDoc .page-back");
  s = await snapshot(p);
  rec("文档返回 → 回付费墙", s.rest.length === 1 && s.rest[0] === "sheetPay", JSON.stringify(s.rest));
  await click(p, "#sheetPay .page-back");
  s = await snapshot(p);
  rec("付费墙返回 → 回设置页", s.rest.length === 1 && s.rest[0] === "sheetSet", JSON.stringify(s.rest));

  // 7) 新增习惯 → 嵌套权限层 → 逐层返回
  await click(p, "#sheetSet .page-back");
  await click(p, "#btnAdd");
  s = await snapshot(p);
  rec("新增习惯页正位", s.rest.length === 1 && s.rest[0] === "sheetAdd", JSON.stringify(s.rest));
  await click(p, "#swAddRem");
  s = await snapshot(p);
  const permOpen = s.rest.length === 1 && s.rest[0] === "sheetPerm";
  if (permOpen) {
    rec("新增页内开提醒 → 权限页盖在其上(权限层 DOM 在新增层之前)", one(s, "sheetPerm").z > one(s, "sheetAdd").z, "perm.z=" + one(s, "sheetPerm").z + " add.z=" + one(s, "sheetAdd").z);
    rec("新增页退居背后", one(s, "sheetAdd").behind === true, JSON.stringify(one(s, "sheetAdd")));
    await click(p, "#sheetPerm .page-back");
    s = await snapshot(p);
    rec("权限页返回 → 回新增页", s.rest.length === 1 && s.rest[0] === "sheetAdd", JSON.stringify(s.rest));
  } else {
    rec("该环境已授权，开关直接放行（跳过权限层链路）", true);
  }
  await click(p, "#sheetAdd .page-back");
  s = await snapshot(p);
  rec("新增页返回 → 收起，无幽灵弹层", s.rest.length === 0 && s.ghosts.length === 0, JSON.stringify({ rest: s.rest, ghosts: s.ghosts }));

  // 8) 荣誉页 → 迁移页 / Pro 付费墙
  await click(p, "#tabHonors");
  rec("切到荣誉页", await p.evaluate(() => document.getElementById("view-honors").classList.contains("on")));
  await click(p, "#migEmptyRow");
  s = await snapshot(p);
  rec("迁移页正位", s.rest.length === 1 && s.rest[0] === "sheetMig", JSON.stringify(s.rest));
  await click(p, "#sheetMig .page-back");
  await click(p, "#proCard");
  s = await snapshot(p);
  rec("荣誉页 Pro 卡 → 付费墙正位", s.rest.length === 1 && s.rest[0] === "sheetPay", JSON.stringify(s.rest));
  await click(p, "#sheetPay .page-back");
  s = await snapshot(p);
  rec("付费墙返回 → 收起", s.rest.length === 0 && s.ghosts.length === 0, JSON.stringify({ rest: s.rest, ghosts: s.ghosts }));

  // 9b) 手机外框 + Tab 栏改造（2026-10-07）
  rec("手机外框：内容宽仍为 375（边框不挤压既有布局）", await p.evaluate(() => {
    const el = document.getElementById("app");
    return el.clientWidth === 375 && el.clientLeft > 0;
  }), await p.evaluate(() => {
    const el = document.getElementById("app");
    return "clientWidth=" + el.clientWidth + " borderLeft=" + el.clientLeft;
  }));
  rec("Tab 栏：左图标 + 右文字（横向并列）", await p.evaluate(() => getComputedStyle(document.getElementById("tabHabits")).flexDirection === "row"));
  rec("Tab 栏：图标 ≥24px、文字 ≥15px（原为 16/11，太小不好点）", await p.evaluate(() => {
    const ti = parseFloat(getComputedStyle(document.querySelector("#tabHabits .ti")).fontSize);
    const lb = parseFloat(getComputedStyle(document.getElementById("labHabits")).fontSize);
    return ti >= 24 && lb >= 15;
  }), await p.evaluate(() => {
    const ti = parseFloat(getComputedStyle(document.querySelector("#tabHabits .ti")).fontSize);
    const lb = parseFloat(getComputedStyle(document.getElementById("labHabits")).fontSize);
    return "ti=" + ti + " label=" + lb;
  }));
  rec("Tab 选中态：只换底色、字体颜色两态一致", await p.evaluate(() => {
    const on = getComputedStyle(document.getElementById("tabHonors"));
    const off = getComputedStyle(document.getElementById("tabHabits"));
    return on.color === off.color && on.backgroundColor !== off.backgroundColor;
  }), await p.evaluate(() => {
    const on = getComputedStyle(document.getElementById("tabHonors"));
    const off = getComputedStyle(document.getElementById("tabHabits"));
    return "selectedBg=" + on.backgroundColor + " unselectedBg=" + off.backgroundColor + " sameText=" + (on.color === off.color);
  }));
  rec("Tab 栏：两块等宽、命中区够高", await p.evaluate(() => {
    const a = document.getElementById("tabHabits").getBoundingClientRect();
    const b2 = document.getElementById("tabHonors").getBoundingClientRect();
    return Math.abs(a.width - b2.width) < 2 && a.height > 40 && b2.height > 40;
  }));

  // 9) 收尾
  rec("收尾后仍无横向滚动", await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  rec("零 pageerror", errs.length === 0, JSON.stringify(errs.slice(0, 3)));
  rec("零 console.error", cerrs.length === 0, JSON.stringify(cerrs.slice(0, 3)));

  // ★ 2026-10-07 修（与 _verify_swipe.js 统一）：不再走 b.close()。
  //   原因：b.close() 在本机偶发挂住，而 Chrome 的子进程会**继承 stdout 写端**，
  //   于是 Node 即便 process.exit 了，shell 的重定向管道仍等不到 EOF，整条命令被挂到超时
  //   （表现：结论已打印却不返回 → 被 SIGTERM，看着像失败，实为全过）。
  //   直接 taskkill /F /T 杀进程树最快且一定成功，实测把耗时从 ~20s 降到 ~7s。
  const failed = results.filter((r) => !r.ok);
  console.log(`\n结论：${results.length - failed.length}/${results.length} 通过`);
  if (failed.length) console.log("失败：" + failed.map((f) => f.label).join(" ; "));
  const proc = b.process();
  if (proc && proc.pid) {
    try { require("child_process").execSync(`taskkill /F /T /PID ${proc.pid}`, { stdio: "ignore" }); } catch (e) {}
  }
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error("脚本自身失败：", e.message); process.exit(1); });
