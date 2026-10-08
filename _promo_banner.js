/**
 * Seeora App Store 宣传图（Promotional Banner）生成器 —— 精确矢量渲染，非 AI 生图
 *
 * 为什么不用 AI 生图：AI 出图无法保证「精确 5244×2950 / 文字零拼写错误 /
 *   底部 35% 绝对干净（供 Apple 叠加 App 名与下载按钮）/ 品牌色严格一致」这几条硬指标，
 *   而这几条恰好是 ASC 传图失败与被拒的主因。本图全是几何图形 + 文字 → 用 SVG → canvas
 *   光栅化，像素级可控。
 *
 * 构图（依据最新 spec）：
 *   - 背景：暖米白 #f1ede6 + 右下角极柔薄荷光晕（淡到几乎不可见，绝不影响底部 35% 纯净）
 *   - 左：逼真的 iPhone 钛金属黑边框 + 灵动岛，屏内是 Seeora「今天」首页
 *     （Logo+Seeora+slogan / 4 张习惯卡 / 底部浅薄荷 Tab 栏）
 *   - 右：eyebrow「HABIT TRACKING」+ 大标题 3 行「See yourself getting better.」
 *     + 7 点习惯圆环（4 青绿 3 灰）+ 3 条特性要点
 *   - 底部 35%（y ≥ 1917）必须完全干净米白，无任何图形/文字。
 *
 * 产物：
 *   ./宣传图_PromotionalBanner_5244x2950.png   （直接拖进 ASC 的拖放区）
 *   ./_临时产物_20261008/_promo_preview.png    （缩略预览，供肉眼检查）
 *
 * 自检（硬断言，任一不过即 exit 1）：
 *   ① 画布必须严格 5244×2950
 *   ② 底部 35%（y ≥ 1917）与背景色 #f1ede6 偏差 ≤ 12（薄荷光晕必须淡到几乎不可见）
 *   ③ 顶部 65% 必须有实际内容（不是全空白）
 *   ④ 最终 PNG 颜色类型必须为 2（24 位 RGB 无 Alpha），且丢 Alpha 后 RGB 三通道逐字节无损
 */
const puppeteer = require("puppeteer-core");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const { toRgbPng, decodePng } = require("./_png_rgb");

const W = 5244, H = 2950;
const SAFE_TOP = Math.round(H * 0.65); // 1917 —— 这以下必须完全干净
const BG = "#f1ede6";
const TEAL = "#00A898";
const DEEP = "#2a2a2a";      // 深炭灰（标题/正文）
const GRAY = "#8a8a85";      // 次级灰
const MINT = "#e0f7f3";      // 浅薄荷（Tab 栏 / 光晕）
const CARD = "#ffffff";
const SCREEN = "#fcfbf8";    // 屏内暖白

const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";

/* ── 勾选图标（对号路径） ── */
function check(x, y, size, color, sw) {
  return `<path d="M ${(x + size * 0.18).toFixed(1)} ${(y + size * 0.55).toFixed(1)} ` +
    `L ${(x + size * 0.42).toFixed(1)} ${(y + size * 0.79).toFixed(1)} ` +
    `L ${(x + size * 0.85).toFixed(1)} ${(y + size * 0.21).toFixed(1)}" ` +
    `fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>`;
}

/* ── iPhone 外框 + 屏内「今天」首页 ── */
function phoneSvg() {
  const PX = 120, PY = 40, PW = 800, PH = 1700;     // 外框；底部 1740 + 阴影 < 1917
  const BZ = 38;
  const SX = PX + BZ, SY = PY + BZ, SW = PW - 2 * BZ, SH = PH - 2 * BZ; // 屏
  const SR = 118;                                  // 屏圆角
  const DIW = 200, DIH = 56, DIR = 28;             // 灵动岛
  const dix = SX + SW / 2 - DIW / 2, diy = SY + 44;

  // 4 张习惯卡
  const habits = [
    { name: "Read", days: "12 days", k: 8, filled: true },
    { name: "Workout", days: "5 days", k: 4, filled: false },
    { name: "Meditate", days: "6 days", k: 6, filled: true },
    { name: "Water", days: "9 days", k: 9, filled: false },
  ];
  const cardX = SX + 32, cardW = SW - 64, cardH = 190, gap = 26, cardY0 = 370;
  const dots = 10, dotR = 7, dotGap = 36, barX = cardX + 50, barY0 = cardY0 + 150;

  let cards = "";
  habits.forEach((hb, i) => {
    const cy = cardY0 + i * (cardH + gap);
    const cx = cardX, cw = cardW;
    const chkCx = cx + cw - 66, chkCy = cy + cardH / 2, chkR = 42;
    // 点状进度条（相对每卡基线）
    const by = cy + 150;
    let barDots = "";
    for (let d = 0; d < dots; d++) {
      const dx = barX + d * dotGap;
      barDots += `<circle cx="${dx + dotR}" cy="${by + dotR}" r="${dotR}" fill="${d < hb.k ? TEAL : "#e3ded4"}"/>`;
    }
    const chkBtn = hb.filled
      ? `<circle cx="${chkCx}" cy="${chkCy}" r="${chkR}" fill="${TEAL}"/>` +
        check(chkCx - 25, chkCy - 25, 50, "#ffffff", 7)
      : `<circle cx="${chkCx}" cy="${chkCy}" r="${chkR}" fill="none" stroke="${TEAL}" stroke-width="6"/>`;
    cards += `
      <g filter="url(#cardShadow)">
        <rect x="${cx}" y="${cy}" width="${cw}" height="${cardH}" rx="36" fill="${CARD}" stroke="rgba(0,0,0,0.05)" stroke-width="2"/>
      </g>
      <text x="${cx + 50}" y="${cy + 72}" font-family="${FONT}" font-size="40" font-weight="600" fill="${DEEP}">${hb.name}</text>
      <text x="${cx + 50}" y="${cy + 118}" font-family="${FONT}" font-size="25" fill="${GRAY}">${hb.days}</text>
      ${barDots}
      ${chkBtn}`;
  });

  // Tab 栏
  const tbX = SX + 32, tbY = 1290, tbW = SW - 64, tbH = 150;
  const tabBar = `
    <rect x="${tbX}" y="${tbY}" width="${tbW}" height="${tbH}" rx="38" fill="${MINT}"/>
    <text x="${tbX + tbW * 0.3}" y="${tbY + 95}" text-anchor="middle" font-family="${FONT}" font-size="38" font-weight="700" fill="${TEAL}">Habits</text>
    <text x="${tbX + tbW * 0.7}" y="${tbY + 95}" text-anchor="middle" font-family="${FONT}" font-size="38" font-weight="500" fill="${GRAY}">Honors</text>`;

  return `
  <g filter="url(#phoneShadow)">
    <rect x="${PX}" y="${PY}" width="${PW}" height="${PH}" rx="150" fill="url(#titanium)"/>
  </g>
  <rect x="${PX}" y="${PY}" width="${PW}" height="${PH}" rx="150" fill="none" stroke="#6e6e73" stroke-width="2" opacity="0.5"/>
  <clipPath id="screenClip"><rect x="${SX}" y="${SY}" width="${SW}" height="${SH}" rx="${SR}"/></clipPath>
  <g clip-path="url(#screenClip)">
    <rect x="${SX}" y="${SY}" width="${SW}" height="${SH}" fill="${SCREEN}"/>
    <!-- 灵动岛 -->
    <rect x="${dix}" y="${diy}" width="${DIW}" height="${DIH}" rx="${DIR}" fill="#000000"/>
    <!-- 顶部：Logo + Seeora + slogan -->
    <circle cx="226" cy="192" r="38" fill="${TEAL}"/>
    ${check(198, 164, 56, "#ffffff", 8)}
    <text x="286" y="212" font-family="${FONT}" font-size="48" font-weight="700" fill="${DEEP}">Seeora</text>
    <text x="200" y="284" font-family="${FONT}" font-size="22" fill="${GRAY}">See yourself getting better.</text>
    <!-- 4 张习惯卡 -->
    ${cards}
    <!-- Tab 栏 -->
    ${tabBar}
  </g>`;
}

/* ── 右侧文字列 + 习惯圆环 + 要点 ── */
function rightSvg() {
  const RX = 2760;
  const eyebrow = `<text x="${RX}" y="200" font-family="${FONT}" font-size="42" font-weight="500" letter-spacing="14" fill="${GRAY}">HABIT TRACKING</text>`;
  const headline = `
    <text x="${RX}" y="430" font-family="${FONT}" font-size="196" font-weight="700" fill="${DEEP}">See yourself</text>
    <text x="${RX}" y="632" font-family="${FONT}" font-size="196" font-weight="700" fill="${DEEP}">getting</text>
    <text x="${RX}" y="834" font-family="${FONT}" font-size="196" font-weight="700" fill="${DEEP}">better.</text>`;

  // 7 点圆环
  const RCX = 3500, RCY = 1200, RR = 150, DR = 32;
  let ringDots = `<circle cx="${RCX}" cy="${RCY}" r="${RR}" fill="none" stroke="#d8d4cc" stroke-width="3"/>`;
  for (let i = 0; i < 7; i++) {
    const a = (-90 + (360 / 7) * i) * (Math.PI / 180);
    const x = RCX + RR * Math.cos(a), y = RCY + RR * Math.sin(a);
    ringDots += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${DR}" fill="${i < 4 ? TEAL : "#cfcabf"}"/>`;
  }
  ringDots += check(RCX - 36, RCY - 36, 72, TEAL, 12);
  const ring = `<g filter="url(#ringShadow)">${ringDots}</g>`;

  // 3 条要点
  const items = ["No account needed", "No ads, no tracking", "Your data stays on device"];
  let bullets = "";
  items.forEach((t, i) => {
    const by = 1530 + i * 120;
    bullets += `
      <circle cx="2792" cy="${by}" r="24" fill="${TEAL}"/>
      ${check(2779, by - 13, 26, "#ffffff", 5)}
      <text x="2840" y="${by + 16}" font-family="${FONT}" font-size="46" font-weight="500" fill="${DEEP}">${t}</text>`;
  });

  return eyebrow + headline + ring + bullets;
}

const FONT = "'Helvetica Neue', Helvetica, Arial, sans-serif";

function buildSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="titanium" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#4a4a4d"/>
      <stop offset="50%" stop-color="#2c2c2e"/>
      <stop offset="100%" stop-color="#1a1a1c"/>
    </linearGradient>
    <radialGradient id="blob" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${MINT}" stop-opacity="0.16"/>
      <stop offset="60%" stop-color="${MINT}" stop-opacity="0.06"/>
      <stop offset="100%" stop-color="${MINT}" stop-opacity="0"/>
    </radialGradient>
    <filter id="phoneShadow" x="-40%" y="-40%" width="180%" height="190%">
      <feDropShadow dx="0" dy="28" stdDeviation="42" flood-color="#7a6f5e" flood-opacity="0.16"/>
    </filter>
    <filter id="cardShadow" x="-30%" y="-30%" width="160%" height="180%">
      <feDropShadow dx="0" dy="10" stdDeviation="20" flood-color="#7a6f5e" flood-opacity="0.13"/>
    </filter>
    <filter id="ringShadow" x="-60%" y="-60%" width="220%" height="220%">
      <feDropShadow dx="0" dy="14" stdDeviation="26" flood-color="#7a6f5e" flood-opacity="0.12"/>
    </filter>
  </defs>

  <!-- 背景：纯净米白 -->
  <rect x="0" y="0" width="${W}" height="${H}" fill="${BG}"/>
  <!-- 右下角极柔和薄荷光晕（半径受限，底部 35% 处已淡至近乎 0） -->
  <circle cx="4620" cy="1180" r="1050" fill="url(#blob)"/>

  <!-- 左侧 iPhone 实物感 mockup -->
  ${phoneSvg()}

  <!-- 右侧文字列 -->
  ${rightSvg()}
</svg>`;
}

(async () => {
  const svg = buildSvg();
  const b64 = Buffer.from(svg, "utf8").toString("base64");

  const browser = await puppeteer.launch({
    executablePath: EDGE,
    headless: "new",
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--force-color-profile=srgb"],
  });
  const page = await browser.newPage();
  await page.goto("about:blank");

  const out = await page.evaluate(async (W, H, SAFE_TOP, BG, b64) => {
    const img = new Image();
    img.src = "data:image/svg+xml;base64," + b64;
    await new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error("SVG 光栅化失败")); });

    const cv = document.createElement("canvas");
    cv.width = W; cv.height = H;
    const g = cv.getContext("2d", { alpha: false });
    g.drawImage(img, 0, 0, W, H);

    const exp = [parseInt(BG.slice(1, 3), 16), parseInt(BG.slice(3, 5), 16), parseInt(BG.slice(5, 7), 16)];
    const TOL = 12; // 底部 35% 允许的极淡薄荷偏差
    const imgData = g.getImageData(0, SAFE_TOP, W, H - SAFE_TOP).data;
    let maxDev = 0, badCount = 0, firstBad = null;
    for (let y = 0; y < H - SAFE_TOP; y += 3) {
      for (let x = 0; x < W; x += 3) {
        const i = (y * W + x) * 4;
        const d = Math.max(
          Math.abs(imgData[i] - exp[0]),
          Math.abs(imgData[i + 1] - exp[1]),
          Math.abs(imgData[i + 2] - exp[2])
        );
        if (d > maxDev) maxDev = d;
        if (d > TOL) { badCount++; if (!firstBad) firstBad = { x, y: y + SAFE_TOP, rgb: [imgData[i], imgData[i + 1], imgData[i + 2]] }; }
      }
    }

    const topData = g.getImageData(0, 0, W, SAFE_TOP).data;
    let nonBg = 0;
    for (let i = 0; i < topData.length; i += 4 * 97) {
      if (Math.abs(topData[i] - exp[0]) > 6 || Math.abs(topData[i + 1] - exp[1]) > 6 || Math.abs(topData[i + 2] - exp[2]) > 6) nonBg++;
    }

    const pw = 1560, ph = Math.round((pw * H) / W);
    const pcv = document.createElement("canvas");
    pcv.width = pw; pcv.height = ph;
    pcv.getContext("2d").drawImage(cv, 0, 0, pw, ph);

    return {
      png: cv.toDataURL("image/png"),
      preview: pcv.toDataURL("image/png"),
      width: cv.width, height: cv.height,
      maxDev, badCount, firstBad, nonBg,
    };
  }, W, H, SAFE_TOP, BG, b64);

  const dir = __dirname;
  const mainPath = path.join(dir, "宣传图_PromotionalBanner_5244x2950.png");
  const prevDir = path.join(dir, "_临时产物_20261008");
  if (!fs.existsSync(prevDir)) fs.mkdirSync(prevDir, { recursive: true });
  const prevPath = path.join(prevDir, "_promo_preview.png");

  // ★ 浏览器产物是 RGBA（颜色类型 6），重编码为严格的 24 位 RGB（颜色类型 2）
  const srcPng = Buffer.from(out.png.split(",")[1], "base64");
  const rgb = toRgbPng(srcPng);
  fs.writeFileSync(mainPath, rgb.png);
  fs.writeFileSync(prevPath, Buffer.from(out.preview.split(",")[1], "base64"));

  const a = decodePng(srcPng), c = decodePng(rgb.png);
  let diff = 0;
  for (let i = 0, n = a.width * a.height; i < n; i++) {
    if (a.pixels[i * a.bpp] !== c.pixels[i * 3] ||
        a.pixels[i * a.bpp + 1] !== c.pixels[i * 3 + 1] ||
        a.pixels[i * a.bpp + 2] !== c.pixels[i * 3 + 2]) diff++;
  }
  const finalColorType = rgb.png[25];

  console.log("── 自检 ──────────────────────────────");
  console.log(`画布尺寸        : ${out.width} × ${out.height}  ${out.width === W && out.height === H ? "PASS" : "FAIL"}`);
  console.log(`底部 35% 纯净度 : 最大偏差 ${out.maxDev}（容差 12），越界采样点 ${out.badCount}  ${out.maxDev <= 12 ? "PASS" : "FAIL"}`);
  if (out.firstBad) console.log(`   首个越界点   : x=${out.firstBad.x} y=${out.firstBad.y} rgb(${out.firstBad.rgb.join(",")})`);
  console.log(`顶部 65% 有内容 : 非背景采样 ${out.nonBg}  ${out.nonBg > 200 ? "PASS" : "FAIL"}`);
  console.log(`最终颜色类型    : ${finalColorType}（2=RGB 无 Alpha）  ${finalColorType === 2 ? "PASS" : "FAIL"}`);
  console.log(`RGB 往返无损    : 不一致像素 ${diff}  ${diff === 0 ? "PASS" : "FAIL"}`);
  console.log("── 产物 ──────────────────────────────");
  console.log("主图  : " + mainPath + "  (" + (fs.statSync(mainPath).size / 1024).toFixed(0) + " KB)");
  console.log("预览  : " + prevPath);

  const ok = out.width === W && out.height === H && out.maxDev <= 12
    && out.nonBg > 200 && finalColorType === 2 && diff === 0 && rgb.width === W && rgb.height === H;
  const proc = browser.process();
  await Promise.race([browser.close().catch(() => {}), new Promise(r => setTimeout(r, 2000))]);
  if (proc && proc.pid) { try { execSync(`taskkill /F /T /PID ${proc.pid}`, { stdio: "ignore" }); } catch (e) {} }
  process.exit(ok ? 0 : 1);
})().catch((e) => { console.error("脚本异常：", e.message); process.exit(1); });
