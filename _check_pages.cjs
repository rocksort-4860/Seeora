/**
 * 网页文案守卫（常驻回归脚本）
 *
 * 为什么需要它：Seeora 有四个双语静态页（privacy / terms / support / landing）
 * 外加 index.html 原型里内嵌的隐私与条款全文。改文案时最容易出的错是
 * **只改了中文或只改了英文** —— 页面不会报错，但在另一种语言下会出现空白段落，
 * 或者中英说法不一致（上架审核会当作「声明不准确」）。
 *
 * 本脚本守住 5 条不变量：
 *   1. 三个双语页里，同一标签的 en / zh 段落数量必须相等；
 *   2. 四个文件的 HTML 标签必须成对（div/ul/ol/li/p/main/header/footer/nav/h1-h3）；
 *   3. index.html 内嵌文档的 doc-h 段落计数（privacy 10x2 + terms 8x2 = 36）；
 *   4. privacy.html 含苹果 5.1.1 要求的必备章节（保留与删除、权利与控制、第三方保护、开发者身份）；
 *   5. 不得回退到旧的绝对化表述（「不收集任何…」「数据从未离开你的设备」等）。
 *
 * 用法：node _check_pages.cjs      （退出码 0 = 全通过）
 */
const fs = require("fs");
const path = require("path");
// ★ 2026-10-07：网页文件会被哥哥在「习惯927/」与上级「Desktop/」之间挪动（上传 GitHub 用），
//   原先把 BASE 写死成 __dirname → 文件一挪，守卫就检查不到（甚至 file not found 直接崩）。
//   改为按候选目录探测，并打印实际命中目录；可用 PAGES_DIR 强制指定。
const CANDIDATES = [process.env.PAGES_DIR, __dirname, path.join(__dirname, "..")].filter(Boolean);
const BASE = CANDIDATES.find((d) => {
  try { return fs.existsSync(path.join(d, "privacy.html")) && fs.existsSync(path.join(d, "index.html")); } catch (e) { return false; }
});
if (!BASE) {
  console.error("找不到网页文件（privacy.html + index.html）。已尝试：" + CANDIDATES.join("  |  ") + "（可用 PAGES_DIR 指定目录）");
  process.exit(2);
}
console.log("检查目录：" + BASE);

let pass = 0;
let fail = 0;
const log = (ok, msg) => {
  if (ok) { pass++; } else { fail++; console.log("  FAIL: " + msg); }
};
const countAll = (s, re) => (s.match(re) || []).length;

const PAGES = ["privacy.html", "terms.html", "support.html", "landing.html"];
const DOCS = ["privacy.html", "terms.html", "support.html", "landing.html", "index.html"];

console.log("=== 1. 双语静态页 en/zh 对称性 ===");
for (const f of PAGES) {
  const s = fs.readFileSync(path.join(BASE, f), "utf8");
  for (const t of ["h1", "h2", "h3", "p", "li", "ol"]) {
    const re = new RegExp("<" + t + " class=\"([^\"]*)\"", "g");
    let en = 0, zh = 0, m;
    while ((m = re.exec(s)) !== null) {
      const cls = m[1].split(/\s+/);
      if (cls.includes("en")) en++;
      if (cls.includes("zh")) zh++;
    }
    log(en === zh, f + " <" + t + "> en=" + en + " zh=" + zh + " 不对等");
  }
  console.log("  " + f + " 双语对称检查完成");
}

console.log("=== 2. 标签平衡 ===");
const PAIRS = ["div", "ul", "ol", "li", "p", "main", "header", "footer", "nav", "h1", "h2", "h3"];
for (const f of DOCS) {
  const s = fs.readFileSync(path.join(BASE, f), "utf8");
  for (const t of PAIRS) {
    const open = countAll(s, new RegExp("<" + t + "(\\s|>)", "g"));
    const close = countAll(s, new RegExp("</" + t + ">", "g"));
    log(open === close, f + " <" + t + "> 开=" + open + " 闭=" + close);
  }
  console.log("  " + f + " 标签平衡检查完成");
}

console.log("=== 3. index.html 内嵌文档 ===");
{
  const s = fs.readFileSync(path.join(BASE, "index.html"), "utf8");
  const docH = countAll(s, /'<div class="doc-h">/g);
  log(docH === 36, "doc-h 段落总数应为 36（privacy 10x2 + terms 8x2），实际 " + docH);
  const keys = [
    "你的习惯数据保存在你自己的设备上",
    "your habit data stays on your device",
    "不含任何第三方崩溃上报",
    "no third-party crash-reporting",
    "第三方保护",
    "Third-party protection",
    "数据保留与删除",
    "Data retention and deletion",
    "你的权利与控制",
    "Your rights and choices",
  ];
  for (const k of keys) log(s.includes(k), "index.html 缺少新文案: " + k);
}

console.log("=== 4. privacy.html 必备章节（苹果 5.1.1） ===");
{
  const s = fs.readFileSync(path.join(BASE, "privacy.html"), "utf8");
  const must = [
    "Data retention and deletion",
    "数据保留与删除",
    "Your rights and choices",
    "你的权利与控制",
    "Third-party protection",
    "第三方保护",
    "Zhang Xinhua",
    "张新华",
  ];
  for (const k of must) log(s.includes(k), "privacy.html 缺少必备内容: " + k);
}

console.log("=== 5. 禁止回退到旧的绝对化表述 ===");
for (const f of DOCS) {
  const s = fs.readFileSync(path.join(BASE, f), "utf8");
  const bad = [
    "不收集任何个人",
    "不收集任何信息",
    "we don't collect your data",
    "never leaves your device",
    "数据从未离开你的设备",
    "绝不上传至我们的服务器",
    "never your personal identity",
    // ★ 2026-10-07：口径收紧 —— 不再声称「我们会收集/写入崩溃诊断信息」。
    //   代码实况是零上传、零分析 SDK；写「我们收集崩溃日志」既与 ASC 隐私标签
    //   对不上（Crash Data 不勾），也属过度声明。这两条钉子防止以后回退。
    "写入设备上应用自身的沙盒文件",
    "into a file inside its own sandbox",
    // ★ 2026-10-07 第二轮回溯：线上 GitHub Pages 那版（2026-09-30 上传）仍是旧的绝对化口径，
    //   和「第 3 节 RevenueCat 接收购买信息」自相矛盾 —— 审查员一眼就能看出声明不实。
    //   这几条钉子把线上旧版的原话全部钉死，任何一次回退都会立刻报红。
    "We do not proactively collect any personal information",
    "我们不会主动收集任何个人信息",
    "do not sell, rent, or share your personal data",
    "不会出售、出租或共享你的个人数据",
    // ★ 代码实况：全项目搜 `icloudSync` 只有「定义 / 持久化 / 设置页开关」三处，
    //   **没有任何一处消费它** —— 即 iCloud 同步是一个空开关，功能并不存在。
    //   政策里承诺「开启 iCloud 同步则存于私有 iCloud」= 写了代码里没有的东西（Guideline 2.3.1）。
    //   在功能真正实现之前，这两句话不许回到任何页面。
    "If you enable iCloud sync",
    "开启 iCloud 同步",
    // ★ 2026-10-07 第三轮：买断制不得使用订阅专属术语（Guideline 3.1.1 / 3.1.2）。
    //   Seeora 是 Non-Consumable 一次性买断，不是自动续期订阅；该术语属订阅语境，
    //   买断制宣传会被审核误判为「订阅描述不实」。
    //   全站已统一为 "Pro preview / Pro 体验"，并在体验按钮下方明确「不会自动扣费、一次性买断」。
    "free trial",
    "Free trial",
    "免费试用",
    "Pro trial",
    "Pro 试用",
    "7-day trial",
    // ★ 2026-10-08：Slogan 定稿为原型那句（英文 See yourself getting better. / 中文 看见自己越来越好）。
    //   此前项目里并存三套标语（真机 i18n、成就卡页脚、落地页各一套），已全部统一。
    //   这几条旧标语不许回到任何网页 —— 与 ASC 描述、App 内文案必须同口径。
    "Make good habits grow naturally",
    "Let good habits grow naturally",
    "让好习惯，自然生长",
    "让好习惯自然生长",
    "Record habits. Rest is allowed",
    "记录习惯，允许休息",
    "Track habits. Rest is allowed",
  ];
  for (const b of bad) log(!s.includes(b), f + " 仍含旧表述: " + b);
}

console.log("=== 6. Slogan 必须是定稿那句（2026-10-08 拍板，以原型为准） ===");
{
  const s = fs.readFileSync(path.join(BASE, "landing.html"), "utf8");
  const SLOGAN_EN = "See yourself getting better.";
  const SLOGAN_ZH = "看见自己越来越好";
  log(s.includes(SLOGAN_EN), "landing.html 缺少英文 slogan: " + SLOGAN_EN);
  log(s.includes(SLOGAN_ZH), "landing.html 缺少中文 slogan: " + SLOGAN_ZH);
}

console.log("");
console.log("结果: " + pass + " 通过 / " + fail + " 失败");
process.exit(fail ? 1 : 0);
