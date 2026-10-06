/**
 * 成就卡「SVG → PNG」的纯逻辑部分（不依赖 react-native，便于单测）。
 *
 * 背景（对齐 RockSort 台账 I-01/I-05，2026-10-06）：
 *   Seeora 此前「分享成就卡」实际只做了 `Clipboard.setStringAsync(纯文本)`，
 *   屏幕上的漂亮卡片**导不出图片** —— 买断用户会直接判定权益缩水。
 *
 * 技术路线（与 RockSort 2026-10-03 的修复同源，经真机验证）：
 *   卡片整体用 react-native-svg 绘制，导出走 **`Svg.toDataURL(callback, {width, height})`**，
 *   **不引入 react-native-view-shot 这类新的社区原生模块** —— 规避 iOS 26 / Xcode 26
 *   的编译风险（RockSort 当时正是为此放弃 view-shot）。
 *
 * ★ react-native-svg 15.x 的 toDataURL 是**回调式实例方法**（官方 d.ts）：
 *     toDataURL(callback: (base64: string) => void, options?: object): void
 *   三重易错点（错一个就静默失败，且失败会被 catch 吞成「操作失败」）：
 *     ① 首参是**回调**，不是组件实例；
 *     ② 返回 void、**不是 Promise**，`await` 必然拿到 undefined；
 *     ③ 它是**实例方法**（挂在 ref 实例上），`(Svg as any).toDataURL(ref, …)` 调用不存在。
 *
 * 本文件只放「与三方 SDK 无关、可单测」的纯函数，SDK 边界留在 share.tsx。
 */

/**
 * 把三方回调给的字符串兜成「干净纯 base64」。
 *
 * iOS 原生 `RNSVGSvgView.mm getDataURLWithBounds` 返回的是
 * `[imageData base64EncodedStringWithOptions:NSDataBase64EncodingEndLineWithLineFeed]`：
 *   · **不带** `data:image/png;base64,` 前缀（只有 web 版带）；
 *   · 带换行符（EndLineWithLineFeed）—— 直接喂给 expo-file-system 会写出坏文件。
 * 两端都得兼容，否则 `split(",")[1]` 恒为 undefined，又是一次静默失败。
 */
export function stripBase64(raw: string | null | undefined): string {
  if (typeof raw !== "string" || raw.length === 0) return "";
  /* 顺序很关键：**先**去所有空白，**再**判前缀、剥前缀。
   * iOS 的 base64 带换行，若先 split(",") 再 replace，换行会留在结果里；
   * 极端情况下（base64 里含空格）还可能让 startsWith("data:") 判错 —— 反过来更稳。 */
  const compact = raw.replace(/\s+/g, "");
  return compact.startsWith("data:") ? (compact.split(",")[1] ?? "") : compact;
}

/* ------------------------------------------------------------------ */
/* 文本排版：SVG 没有自动折行，必须自己算宽度                          */
/* ------------------------------------------------------------------ */

/** 全角/宽字符（CJK、假名、谚文、全角标点、emoji）—— 宽度按 1.0em 估 */
function isWide(code: number): boolean {
  return (
    (code >= 0x1100 && code <= 0x115f) || // 谚文字母
    (code >= 0x2e80 && code <= 0x303e) || // CJK 部首 / 康熙 / CJK 符号
    (code >= 0x3041 && code <= 0x33ff) || // 假名 / 注音 / CJK 兼容
    (code >= 0x3400 && code <= 0x4dbf) || // CJK 扩展 A
    (code >= 0x4e00 && code <= 0x9fff) || // CJK 基本区
    (code >= 0xa000 && code <= 0xa4cf) || // 彝文
    (code >= 0xac00 && code <= 0xd7a3) || // 谚文音节
    (code >= 0xf900 && code <= 0xfaff) || // CJK 兼容表意
    (code >= 0xfe30 && code <= 0xfe6f) || // CJK 兼容形式 / 小写变体
    (code >= 0xff00 && code <= 0xff60) || // 全角 ASCII
    (code >= 0xffe0 && code <= 0xffe6) || // 全角符号
    (code >= 0x1f300 && code <= 0x1faff) // emoji（含代理对，按码点判断）
  );
}

/** 估算一段文本在给定字号下的渲染宽度（pt）。窄字符按 0.55em，宽字符按 1.0em。 */
export function textWidth(s: string, fontSize: number): number {
  let w = 0;
  for (const ch of s) {
    const code = ch.codePointAt(0) ?? 0;
    // 换行/制表不产生宽度
    if (ch === "\n" || ch === "\r" || ch === "\t") continue;
    w += isWide(code) ? fontSize : fontSize * 0.55;
  }
  return w;
}

/**
 * 单行截断：超出最大宽度时在末尾加省略号。
 * 用于标题、"—— 签名"、页脚这类**必须单行**的位置。
 */
export function ellipsize(s: string, fontSize: number, maxWidth: number): string {
  const text = s.replace(/\s+/g, " ").trim();
  if (!text) return "";
  if (textWidth(text, fontSize) <= maxWidth) return text;
  const dots = "…";
  const dotsW = textWidth(dots, fontSize);
  let out = "";
  let w = 0;
  for (const ch of text) {
    const cw = textWidth(ch, fontSize);
    if (w + cw + dotsW > maxWidth) break;
    out += ch;
    w += cw;
  }
  return (out.trimEnd() || "") + dots;
}

/**
 * 按最大宽度折行，最多 maxLines 行；最后一行若仍放不下，用省略号收尾。
 * 断行规则：优先在空格处断（拉丁），中日韩逐字断。
 */
export function wrapText(s: string, fontSize: number, maxWidth: number, maxLines: number): string[] {
  const text = s.replace(/\s+/g, " ").trim();
  if (!text || maxLines <= 0) return [];
  // 分词：宽字符各自成词；窄字符累积到空格为止
  const tokens: string[] = [];
  let buf = "";
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    if (isWide(code) || ch === " ") {
      if (buf) { tokens.push(buf); buf = ""; }
      tokens.push(ch);
    } else {
      buf += ch;
    }
  }
  if (buf) tokens.push(buf);

  const lines: string[] = [];
  let cur = "";
  let truncated = false;
  for (const tk of tokens) {
    if (lines.length >= maxLines) { truncated = true; break; }
    const next = cur + tk;
    if (cur && textWidth(next.trim(), fontSize) > maxWidth) {
      lines.push(cur.trim());
      cur = tk === " " ? "" : tk;
      if (lines.length >= maxLines) { truncated = true; break; }
    } else {
      cur = next;
    }
  }
  if (cur.trim() && lines.length < maxLines) lines.push(cur.trim());
  else if (cur.trim()) truncated = true;

  // 放不下 → 收尾省略号
  const last = lines.length - 1;
  if (last >= 0 && textWidth(lines[last], fontSize) > maxWidth) {
    lines[last] = ellipsize(lines[last], fontSize, maxWidth);
  } else if (truncated && last >= 0) {
    lines[last] = ellipsize(lines[last] + "…", fontSize, maxWidth + textWidth("…", fontSize));
  }
  return lines.slice(0, maxLines);
}

/**
 * 卡片副标题用的日期串。
 * ★ 刻意不用 `toLocaleDateString` —— 它依赖 Intl 数据，在裁剪过 locale 的 Hermes/Android
 *   上可能抛错或回落到英文，导致卡片副标题与 UI 语言不一致。这里手工拼，确定性 100%。
 */
export function formatCardDate(d: Date, lang: "zh" | "en"): string {
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  if (lang === "zh") return `${y}年${m}月${day}日`;
  const mon = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getMonth()] ?? "";
  return `${mon} ${day}, ${y}`;
}

/**
 * 错误摘要：Release 包没有 console，失败原因只能靠 toast 留痕。
 * 只记 message 在跨层调用（尤其原生桥接）里常看不出是哪一环抛的，
 * 所以顺带带出 stack 前几行（够定位，又不至于把界面刷满）。
 */
export function describeError(e: unknown): string {
  if (e instanceof Error) {
    const where = (e.stack ?? "")
      .split("\n")
      .slice(1, 4)
      .map((s) => s.trim())
      .filter(Boolean)
      .join(" | ");
    return where ? `${e.name}: ${e.message} @ ${where}` : `${e.name}: ${e.message}`;
  }
  return String(e);
}
