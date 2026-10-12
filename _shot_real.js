/**
 * Seeora 商店截图流水线（2026-10-11 重制版 / 双尺寸合规版）
 * 1) 无头 Edge 打开 expo web（http://localhost:8081），localStorage 注入演示数据
 * 2) 截取真实页面 raw：today / habit 详情×2 / pro
 * 3) 合成营销截图：奶油底 + 大标题 + 手机框（第 4 张附加小组件 mock）
 * 尺寸（按苹果官网 2026 截图规范）：
 *   - 1206×2622（402×874 @3x）：Dynamic Island 中屏，【必需】
 *   - 1320×2868（440×956 @3x）：Dynamic Island 大屏，Pro Max 原生，不提供则用缩放图
 * 用法：node _shot_real.js   （需先启动 expo web 服务）
 */
const fs = require("fs");
const path = require("path");
const puppeteer = require("C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core");

const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
// 静态导出服务（expo export --platform web + _serve_dist.js @8082）
// 注：expo start 开发服（8081）lazy 异步加载在本环境不派发分包请求，页面挂空，勿用
const BASE = "http://localhost:8082";
// 合成模板按 402×874 设计，大屏版用 CSS transform 等比放大，版式零偏差
const SIZES = [
  { w: 402, h: 874, out: "商店截图_1206x2622" },
  { w: 440, h: 956, out: "商店截图_1320x2868" },
];

/* ---------- 演示数据 ---------- */
const d = (off) => {
  const t = new Date();
  t.setDate(t.getDate() - off);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
};
const mkCheckIns = (pattern) => {
  const o = {};
  pattern.forEach((hit, i) => { if (hit) o[d(i)] = true; });
  return o;
};
// 近 42 天打卡模式（1=打了 0=漏了）， index 0 = 今天
const P_FULL =   [1,1,1,1,1,1,1, 1,1,1,1,1,1,1, 1,1,0,1,1,1,1, 1,1,1,1,1,0,1, 1,1,1,1,1,1,1, 1,1,1,0,1,1,1];
const P_GENTLE = [1,1,0,1,1,1,0, 1,0,1,1,1,1,1, 0,1,1,1,0,1,1, 1,1,0,1,1,1,1, 0,1,1,1,1,0,1, 1,1,1,1,0,1,1];
const P_RUN =    [0,1,1,0,1,1,1, 0,1,0,1,1,1,0, 1,1,1,0,1,0,1, 1,0,1,1,1,1,0, 1,1,0,1,1,1,0, 1,1,1,0,1,1,0];
const P_READ =   [1,0,1,1,0,1,1, 1,1,0,1,0,1,1, 1,0,1,1,0,1,1, 0,1,1,0,1,1,1, 1,0,1,1,0,1,1, 0,1,1,1,0,1,1];
const P_WATER =  [1,1,1,0,1,1,1, 1,1,1,1,0,1,1, 1,1,0,1,1,1,1, 1,0,1,1,1,1,1, 0,1,1,1,1,1,1, 1,1,1,1,1,0,1];

const habits = [
  { id: "h1", name: "Meditate", nameZh: "冥想", emoji: "🧘", color: "#2d7a6b", createdAt: d(41), isArchived: false,
    reminderEnabled: true, reminderTime: "07:30", migratedTotalDays: 0, migratedCurrentStreak: 0,
    migratedStartDate: "", migrationImportedAt: "", checkIns: mkCheckIns(P_FULL), detail: "10 minutes, morning", migratedSource: "",
    frequency: 1, timesPerWindow: 1, rests: { [d(16)]: true }, bestStreak: 13 },
  { id: "h2", name: "Morning run", nameZh: "晨跑", emoji: "🏃", color: "#e07840", createdAt: d(41), isArchived: false,
    reminderEnabled: true, reminderTime: "06:45", migratedTotalDays: 96, migratedCurrentStreak: 21,
    migratedStartDate: d(137), migrationImportedAt: d(41), checkIns: mkCheckIns(P_RUN), detail: "3 km easy pace", migratedSource: "Streaks",
    frequency: 1, timesPerWindow: 1, rests: { [d(0)]: true }, bestStreak: 21 },
  { id: "h3", name: "Read 20 min", nameZh: "阅读 20 分钟", emoji: "📚", color: "#7a5fa0", createdAt: d(40), isArchived: false,
    reminderEnabled: false, reminderTime: "", migratedTotalDays: 0, migratedCurrentStreak: 0,
    migratedStartDate: "", migrationImportedAt: "", checkIns: mkCheckIns(P_READ), detail: "", migratedSource: "",
    frequency: 1, timesPerWindow: 1, rests: {}, bestStreak: 9 },
  { id: "h4", name: "Drink water", nameZh: "喝水", emoji: "💧", color: "#3a7bd5", createdAt: d(39), isArchived: false,
    reminderEnabled: false, reminderTime: "", migratedTotalDays: 0, migratedCurrentStreak: 0,
    migratedStartDate: "", migrationImportedAt: "", checkIns: mkCheckIns(P_WATER), detail: "8 glasses", migratedSource: "",
    frequency: 1, timesPerWindow: 1, rests: {}, bestStreak: 11 },
  { id: "h5", name: "Journal", nameZh: "写日记", emoji: "✍️", color: "#c75b7a", createdAt: d(35), isArchived: false,
    reminderEnabled: true, reminderTime: "21:30", migratedTotalDays: 0, migratedCurrentStreak: 0,
    migratedStartDate: "", migrationImportedAt: "", checkIns: mkCheckIns(P_GENTLE), detail: "Three lines before bed", migratedSource: "",
    frequency: 1, timesPerWindow: 1, rests: {}, bestStreak: 7 },
];

const seed = {
  "sd.lang": "en",
  "sd.visited": true,
  "sd.theme": "light",
  "sd.installAt": d(41),
  "sd.receipt": { pro: true }, // 让导出/分享等 Pro 功能在截图中可见（不影响页面结构）
  "sd.local": {
    habits,
    honors: [
      { id: "hn1", title: "100 days of running", titleZh: "跑步 100 天", source: "Streaks", days: 100, details: "", category: "Fitness" },
      { id: "hn2", title: "30 days of meditation", titleZh: "冥想 30 天", source: "Calm", days: 30, details: "", category: "Mindfulness" },
    ],
    settings: { weekStartOn: "mon", haptics: true, badge: false },
    installAt: d(41),
    updatedAt: new Date().toISOString(),
  },
};

/* ---------- 截图清单 ---------- */
const SHOTS = [
  { file: "1", headline: "A habit tracker\nfor ADHD minds", page: "/today", raw: "today" },
  { file: "2", headline: "Gentle routines,\nno streak guilt", page: "/habit/h1", raw: "habit1" },
  { file: "3", headline: "Backfill & rest days —\nno broken chains", page: "/habit/h2", raw: "habit2" },
  { file: "4", headline: "Widgets, offline,\nyour data stays yours", page: "/today", raw: "today", widget: true },
  { file: "5", headline: "No account, no subscription,\nyours forever", page: "/pro", raw: "pro" },
];

/* ---------- 合成模板 ---------- */
function compositeHTML(shot, rawFile, k) {
  const title = shot.headline.split("\n").join("<br>");
  const widgetMock = shot.widget ? `
    <div style="position:absolute;left:22px;bottom:210px;width:150px;height:150px;background:#FAF9F4;border-radius:26px;box-shadow:0 12px 32px rgba(0,0,0,.28);padding:14px;box-sizing:border-box;">
      <div style="position:relative;width:72px;height:72px;margin:4px auto 8px;">
        <svg viewBox="0 0 72 72" width="72" height="72">
          <circle cx="36" cy="36" r="30" stroke="#dcebe6" stroke-width="7" fill="none"/>
          <circle cx="36" cy="36" r="30" stroke="#2d7a6b" stroke-width="7" fill="none" stroke-linecap="round"
            stroke-dasharray="188.5" stroke-dashoffset="75.4" transform="rotate(-90 36 36)"/>
        </svg>
        <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;">
          <b style="font-size:17px;color:#2a2a28;">3/5</b><span style="font-size:8px;color:#8a8a85;">today</span>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:5px;font-size:11px;color:#2a2a28;">🧘 <span style="flex:1;font-weight:600;">Meditate</span><span style="color:#2d7a6b;">●</span></div>
    </div>
    <div style="position:absolute;right:20px;bottom:120px;width:210px;height:96px;background:#FAF9F4;border-radius:22px;box-shadow:0 12px 32px rgba(0,0,0,.28);padding:10px 12px;box-sizing:border-box;display:flex;gap:10px;align-items:center;">
      <div style="position:relative;width:52px;height:52px;flex:0 0 auto;">
        <svg viewBox="0 0 52 52" width="52" height="52">
          <circle cx="26" cy="26" r="21" stroke="#dcebe6" stroke-width="6" fill="none"/>
          <circle cx="26" cy="26" r="21" stroke="#2d7a6b" stroke-width="6" fill="none" stroke-linecap="round"
            stroke-dasharray="131.9" stroke-dashoffset="52.8" transform="rotate(-90 26 26)"/>
        </svg>
        <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;"><b style="font-size:12px;color:#2a2a28;">3/5</b></div>
      </div>
      <div style="flex:1;display:flex;flex-direction:column;gap:4px;font-size:10px;color:#2a2a28;">
        <div style="display:flex;align-items:center;gap:4px;">🧘<span style="flex:1;font-weight:600;">Meditate</span><span style="color:#2d7a6b;">✓</span></div>
        <div style="display:flex;align-items:center;gap:4px;">🏃<span style="flex:1;font-weight:600;">Morning run</span><span style="color:#8a8a85;">☾</span></div>
        <div style="display:flex;align-items:center;gap:4px;">📚<span style="flex:1;font-weight:600;">Read 20 min</span><span style="color:#b9b9b4;">○</span></div>
      </div>
    </div>` : "";
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    * { box-sizing: border-box; margin: 0; }
    body { overflow: hidden; }
    .stage { width: 402px; height: 874px; overflow: hidden; position: relative;
      transform: scale(${k}); transform-origin: top left;
      background: linear-gradient(180deg, #F3EEE3 0%, #EFE9DB 100%);
      font-family: -apple-system, "Segoe UI", sans-serif; }
    .head { position: absolute; top: 58px; left: 0; right: 0; text-align: center;
      font-size: 34px; font-weight: 800; line-height: 1.22; color: #2a2a28; letter-spacing: -0.5px; }
    .phone { position: absolute; top: 220px; left: 50%; transform: translateX(-50%);
      width: 330px; height: 717px; border-radius: 52px; background: #000;
      padding: 9px; box-shadow: 0 30px 70px rgba(60,50,30,.35); }
    .screen { width: 100%; height: 100%; border-radius: 44px; overflow: hidden; background: #fff; }
    .screen img { width: 100%; height: 100%; object-fit: cover; object-position: top; display: block; }
  </style></head><body>
    <div class="stage">
      <div class="head">${title}</div>
      <div class="phone"><div class="screen"><img src="${rawFile}"></div></div>
      ${widgetMock}
    </div>
  </body></html>`;
}

/* ---------- 主流程 ---------- */
(async () => {
  const browser = await puppeteer.launch({
    executablePath: EDGE,
    headless: true,
    args: ["--headless=new", "--disable-gpu", "--no-sandbox", "--force-device-scale-factor=3"],
  });

  for (const size of SIZES) {
    const OUT = path.join(__dirname, size.out);
    const RAW = path.join(OUT, "_raw");
    fs.mkdirSync(RAW, { recursive: true });
    const k = size.h / 874;
    console.log(`\n=== ${size.out}（${size.w}×${size.h} @3x = ${size.w * 3}×${size.h * 3}，scale=${k.toFixed(4)}）===`);

    // —— 第 1 步：截取真实页面 ——
    const page = await browser.newPage();
    await page.setViewport({ width: size.w, height: size.h, deviceScaleFactor: 3 });
    page.on("console", (m) => { if (m.type() === "error") console.log("[page-err]", m.text().slice(0, 160)); });

    // 注入演示数据（首次打开前）
    await page.evaluateOnNewDocument((seedObj) => {
      for (const [k2, v] of Object.entries(seedObj)) {
        try { window.localStorage.setItem(k2, JSON.stringify(v)); } catch (e) {}
      }
    }, seed);

    const raws = [...new Set(SHOTS.map((s) => s.page))];
    for (const route of raws) {
      const url = BASE + route;
      await page.goto(url, { waitUntil: "networkidle0", timeout: 90000 });
      await new Promise((r) => setTimeout(r, 3500)); // 等字体/动画稳定
      const name = SHOTS.find((s) => s.page === route).raw;
      await page.screenshot({ path: path.join(RAW, `${name}.png`) });
      console.log("raw ✓", route, "→", name);
    }
    await page.close();

    // —— 第 2 步：合成营销图 ——
    for (const shot of SHOTS) {
      const rawFile = `${shot.raw}.png`;
      const htmlPath = path.join(RAW, `_compose_${shot.file}.html`);
      fs.writeFileSync(htmlPath, compositeHTML(shot, rawFile, k));
      const cp = await browser.newPage();
      await cp.setViewport({ width: size.w, height: size.h, deviceScaleFactor: 3 });
      await cp.goto("file:///" + htmlPath.replace(/\\/g, "/"), { waitUntil: "networkidle0" });
      await new Promise((r) => setTimeout(r, 600));
      await cp.screenshot({ path: path.join(OUT, `${shot.file}.png`) });
      await cp.close();
      console.log("final ✓", `${shot.file}.png`);
    }
  }

  await browser.close();
  console.log("\nALL DONE");
})().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
