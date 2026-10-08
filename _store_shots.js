/**
 * Seeora App Store 竖版截图生成器（5 张，1290×2796 = 6.7 英寸）
 *
 * 原理：用无头 Edge 打开原型 index.html（自带演示数据），导航到 5 个画面，
 *   逐个截取 #app（原型自带手机外框，399×844），再在 1290×2796 画布上
 *   合成「品牌米白底 + 英文标题 + 手机屏幕 + 底部品牌行」的商店截图。
 *
 * 为什么不用真机截图：本机是 Windows，跑不了 iOS；原型与真机是同一套设计，
 *   用原型渲染的截图文字清晰（deviceScaleFactor=3）、零拼写错误、随时可重出。
 *
 * 自检（硬断言，任一不过即 exit 1）：
 *   ① 每张严格 1290×2796
 *   ② 最终 PNG 为 24 位 RGB（颜色类型 2，无 Alpha）——苹果规格
 *   ③ 每张图必须有实际内容（标题区有深色像素、手机区非空白）
 *   ④ RGB 重编码往返无损
 *
 * 产物：
 *   ./商店截图_1290x2796/01_today.png … 05_pro.png
 *   ./_临时产物_20261008/_shots_preview.png （五张拼图预览，供肉眼检查）
 */
const puppeteer = require("puppeteer-core");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const { toRgbPng, decodePng } = require("./_png_rgb");

const W = 1290, H = 2796;
const BG = "#f1ede6";
const INK = "#2a2a2a";
const DEEP = "#006B5A";
const MUTED = "#8a8a85";
const EYEBROW = "#a9a49a";
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const PAGE_URL = encodeURI("file:///D:/Desktop/习惯927/index.html");

/* ── 五个画面：eyebrow（小顶注）+ 主标题 + 副标题 + 导航动作 ──
   文案全英文（北美商店），不写死价格（价格后台维护，截图会过期）。 */
const SHOTS = [
  { name: "01_today", eyebrow: "TODAY",
    title: "One tap to check in.",
    sub: "Gentle streaks — rest days included.",
    nav: async () => {} },
  { name: "02_progress", eyebrow: "PROGRESS",
    title: "Watch your streak grow.",
    sub: "Rings, curves and a 12-week heatmap.",
    nav: async (page) => {
      await page.click("#list .card");
      await sleep(1700); // 等圆环动画播完
    } },
  { name: "03_honors", eyebrow: "HONORS",
    title: "Milestones worth celebrating.",
    sub: "Badges for 7, 14, 30 days and beyond.",
    nav: async (page) => {
      await page.click("#tabHonors");
      await sleep(700);
      // 往下滚一点：让成就徽章网格居中（「导入历史」空态不必占半屏）
      await page.evaluate(() => { document.getElementById("view-honors").scrollTop = 190; });
      await sleep(300);
    } },
  { name: "04_share_card", eyebrow: "SHARE",
    title: "A card that's truly yours.",
    sub: "Export every milestone as an image.",
    nav: async (page) => {
      await page.click("#list .card");           // 先进详情（成就卡从详情页发起）
      await sleep(1500);
      await page.evaluate(() => openPoster());   // 再打开成就卡弹层
      await sleep(900);
    } },
  { name: "05_pro", eyebrow: "SEEORA PRO",
    title: "Unlock everything, once.",
    sub: "One purchase — yours forever.",
    nav: async (page) => {
      await page.evaluate(() => showPaywall("honors"));
      await sleep(2800); // 等模拟价格（800ms）+ 弹层动画
    } },
];

/* ── 版式参数（1290×2796 画布上的像素） ── */
const LAYOUT = {
  eyebrowY: 190, eyebrowSize: 40, eyebrowTrack: 14,
  titleY: 330, titleSize: 88,
  subY: 425, subSize: 42,
  phoneTop: 545, phoneBottom: 2700,   // 手机屏幕绘制区
  brandY: 2752, brandSize: 44,
};
const FONT = "'Segoe UI','Helvetica Neue',Arial,sans-serif";

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

/* 打开一个干净的页面：预置 localStorage（跳过引导弹层、锁定英文/浅色） */
async function freshPage(browser) {
  const page = await browser.newPage();
  await page.setViewport({ width: 520, height: 960, deviceScaleFactor: 3 });
  await page.evaluateOnNewDocument(() => {
    try {
      localStorage.clear();
      localStorage.setItem("seeora_intro", "1");   // 跳过首次引导
      localStorage.setItem("seeora_guide", "1");   // 跳过详情页引导
      localStorage.setItem("seeora_lang", "en");   // 北美商店：英文
      localStorage.setItem("seeora_theme", "light"); // 商店截图统一浅色（无头浏览器默认跟随深色）
    } catch (e) {}
  });
  await page.goto(PAGE_URL, { waitUntil: "load" });
  await sleep(1900);                               // 等启动屏隐藏 + 首次渲染
  // 页面底色统一成品牌米白 → #app 圆角四角露出的就是它，合成时无缝
  await page.evaluate(() => { document.body.style.background = "#f1ede6"; });
  return page;
}

/* 截取 #app（原型手机外框），返回 { buf, w, h } */
async function shootApp(page) {
  const el = await page.$("#app");
  const box = await el.boundingBox();
  const b64 = await page.screenshot({
    encoding: "base64",
    clip: { x: box.x, y: box.y, width: box.width, height: box.height },
  });
  return { b64, w: Math.round(box.width), h: Math.round(box.height) };
}

/* 在 1290×2796 画布上合成一张商店截图 */
function compose(appImg, shot) {
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const g = cv.getContext("2d", { alpha: false });
  g.fillStyle = BG; g.fillRect(0, 0, W, H);

  // 标题区
  g.fillStyle = EYEBROW;
  g.font = `500 ${LAYOUT.eyebrowSize}px ${FONT}`;
  g.textAlign = "center";
  // 手动画字距（canvas 没有 letter-spacing 的老实现兼容）：逐字符绘制
  drawTracked(g, shot.eyebrow, W / 2, LAYOUT.eyebrowY, LAYOUT.eyebrowTrack);

  g.fillStyle = INK;
  g.font = `600 ${LAYOUT.titleSize}px ${FONT}`;
  g.fillText(shot.title, W / 2, LAYOUT.titleY);

  g.fillStyle = MUTED;
  g.font = `400 ${LAYOUT.subSize}px ${FONT}`;
  g.fillText(shot.sub, W / 2, LAYOUT.subY);

  // 手机屏幕：保持 399:844 比例，放进 phoneTop..phoneBottom
  const availH = LAYOUT.phoneBottom - LAYOUT.phoneTop;
  const scale = availH / 844;
  const pw = Math.round(399 * scale), ph = Math.round(844 * scale);
  const px = Math.round((W - pw) / 2);
  const img = new Image();
  img.src = "data:image/png;base64," + appImg.b64;
  g.drawImage(img, px, LAYOUT.phoneTop, pw, ph);

  // 底部品牌行
  g.fillStyle = DEEP;
  g.font = `600 ${LAYOUT.brandSize}px ${FONT}`;
  g.fillText("Seeora", W / 2, LAYOUT.brandY);

  return {
    png: cv.toDataURL("image/png"),
    // 自检数据：标题区要有深色文字像素；手机区要有非背景像素
    titleDark: countPixels(g, 0, LAYOUT.titleY - LAYOUT.titleSize, W, LAYOUT.titleSize + 20,
      (r, gg, b) => r < 120 && gg < 120 && b < 120),
    phoneContent: countPixels(g, px + 30, LAYOUT.phoneTop + 30, pw - 60, ph - 60,
      (r, gg, b) => Math.abs(r - 241) > 10 || Math.abs(gg - 237) > 10 || Math.abs(b - 230) > 10),
  };
}

function drawTracked(g, text, cx, y, tracking) {
  const widths = [...text].map(ch => g.measureText(ch).width);
  const total = widths.reduce((a, b) => a + b, 0) + tracking * (text.length - 1);
  let x = cx - total / 2;
  for (let i = 0; i < text.length; i++) {
    g.fillText(text[i], x + widths[i] / 2, y);
    x += widths[i] + tracking;
  }
}

function countPixels(g, x, y, w, h, pred) {
  const d = g.getImageData(x, y, w, h).data;
  let n = 0;
  for (let i = 0; i < d.length; i += 16) {
    if (pred(d[i], d[i + 1], d[i + 2])) n++;
  }
  return n;
}

(async () => {
  const outDir = path.join(__dirname, "商店截图_1290x2796");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const prevDir = path.join(__dirname, "_临时产物_20261008");
  if (!fs.existsSync(prevDir)) fs.mkdirSync(prevDir, { recursive: true });

  const browser = await puppeteer.launch({
    executablePath: EDGE,
    headless: "new",
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--force-color-profile=srgb"],
  });

  const results = [];
  const thumbs = [];
  for (const shot of SHOTS) {
    const page = await freshPage(browser);
    await shot.nav(page);
    const app = await shootApp(page);
    const r = await page.evaluate(async (appImg, shot, L, W2, H2) => {
      /* 在浏览器里重建 compose（函数体无法跨进程传，逻辑保持一致） */
      const cv = document.createElement("canvas");
      cv.width = W2; cv.height = H2;
      const g = cv.getContext("2d", { alpha: false });
      g.fillStyle = "#f1ede6"; g.fillRect(0, 0, W2, H2);
      g.textAlign = "center";
      const FONT2 = "'Segoe UI','Helvetica Neue',Arial,sans-serif";
      g.fillStyle = "#a9a49a";
      g.font = `500 ${L.eyebrowSize}px ${FONT2}`;
      const widths = [...shot.eyebrow].map(ch => g.measureText(ch).width);
      const total = widths.reduce((a, b) => a + b, 0) + L.eyebrowTrack * (shot.eyebrow.length - 1);
      let x = W2 / 2 - total / 2;
      for (let i = 0; i < shot.eyebrow.length; i++) {
        g.fillText(shot.eyebrow[i], x + widths[i] / 2, L.eyebrowY);
        x += widths[i] + L.eyebrowTrack;
      }
      g.fillStyle = "#2a2a2a";
      g.font = `600 ${L.titleSize}px ${FONT2}`;
      g.fillText(shot.title, W2 / 2, L.titleY);
      g.fillStyle = "#8a8a85";
      g.font = `400 ${L.subSize}px ${FONT2}`;
      g.fillText(shot.sub, W2 / 2, L.subY);
      const availH = L.phoneBottom - L.phoneTop;
      const scale = availH / 844;
      const pw = Math.round(399 * scale), ph = Math.round(844 * scale);
      const px = Math.round((W2 - pw) / 2);
      const img = new Image();
      await new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error("截图绘制失败")); img.src = "data:image/png;base64," + appImg; });
      g.drawImage(img, px, L.phoneTop, pw, ph);
      g.fillStyle = "#006B5A";
      g.font = `600 ${L.brandSize}px ${FONT2}`;
      g.fillText("Seeora", W2 / 2, L.brandY);
      const count = (cx2, cy2, cw, ch2, pred) => {
        const d = g.getImageData(cx2, cy2, cw, ch2).data; let n = 0;
        for (let i = 0; i < d.length; i += 16) if (pred(d[i], d[i + 1], d[i + 2])) n++;
        return n;
      };
      return {
        png: cv.toDataURL("image/png"),
        titleDark: count(0, L.titleY - L.titleSize, W2, L.titleSize + 20, (r, gg, b) => r < 120 && gg < 120 && b < 120),
        phoneContent: count(px + 30, L.phoneTop + 30, pw - 60, ph - 60, (r, gg, b) => Math.abs(r - 241) > 10 || Math.abs(gg - 237) > 10 || Math.abs(b - 230) > 10),
      };
    }, app.b64, shot, LAYOUT, W, H);

    // RGBA → 严格 RGB（颜色类型 2）
    const src = Buffer.from(r.png.split(",")[1], "base64");
    const rgb = toRgbPng(src);
    const outPath = path.join(outDir, shot.name + ".png");
    fs.writeFileSync(outPath, rgb.png);

    // 往返校验
    const a = decodePng(src), c = decodePng(rgb.png);
    let diff = 0;
    for (let i = 0, n = a.width * a.height; i < n; i++) {
      if (a.pixels[i * a.bpp] !== c.pixels[i * 3] ||
          a.pixels[i * a.bpp + 1] !== c.pixels[i * 3 + 1] ||
          a.pixels[i * a.bpp + 2] !== c.pixels[i * 3 + 2]) diff++;
    }

    results.push({
      name: shot.name, path: outPath,
      size: `${rgb.width}x${rgb.height}`,
      colorType: rgb.png[25],
      titleDark: r.titleDark, phoneContent: r.phoneContent, diff,
      bytes: fs.statSync(outPath).size,
    });
    thumbs.push(Buffer.from(r.png.split(",")[1], "base64"));
    await page.close();
  }

  // 五张拼图预览（每张缩到 380 宽）
  await page_preview(browser, thumbs, path.join(prevDir, "_shots_preview.png"));

  console.log("── 自检 ──────────────────────────────────────────");
  let allOk = true;
  for (const r of results) {
    const ok = r.size === `${W}x${H}` && r.colorType === 2 && r.titleDark > 50
      && r.phoneContent > 500 && r.diff === 0;
    allOk = allOk && ok;
    console.log(`${ok ? "PASS" : "FAIL"}  ${r.name.padEnd(14)} ${r.size}  颜色类型=${r.colorType}  标题像素=${r.titleDark}  内容像素=${r.phoneContent}  往返差异=${r.diff}  ${(r.bytes / 1024).toFixed(0)}KB`);
  }
  console.log("── 产物 ──────────────────────────────────────────");
  console.log(outDir);
  console.log(path.join(prevDir, "_shots_preview.png"));

  const proc = browser.process();
  await Promise.race([browser.close().catch(() => {}), new Promise(r2 => setTimeout(r2, 2000))]);
  if (proc && proc.pid) { try { execSync(`taskkill /F /T /PID ${proc.pid}`, { stdio: "ignore" }); } catch (e) {} }
  process.exit(allOk ? 0 : 1);

  async function page_preview(browser2, pngBufs, outPath) {
    const page = await browser2.newPage();
    await page.goto("about:blank");
    const dataUrls = pngBufs.map(b => "data:image/png;base64," + b.toString("base64"));
    const b64 = await page.evaluate(async (urls) => {
      const TW = 380, GAP = 24;
      const imgs = await Promise.all(urls.map(u => new Promise((res, rej) => {
        const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = u;
      })));
      const th = Math.round(TW * imgs[0].height / imgs[0].width);
      const cv = document.createElement("canvas");
      cv.width = imgs.length * TW + (imgs.length + 1) * GAP;
      cv.height = th + GAP * 2;
      const g = cv.getContext("2d", { alpha: false });
      g.fillStyle = "#ffffff"; g.fillRect(0, 0, cv.width, cv.height);
      imgs.forEach((im, i) => g.drawImage(im, GAP + i * (TW + GAP), GAP, TW, th));
      return cv.toDataURL("image/png");
    }, dataUrls);
    require("fs").writeFileSync(outPath, Buffer.from(b64.split(",")[1], "base64"));
    await page.close();
  }
})().catch((e) => { console.error("脚本异常：", e.message); process.exit(1); });
