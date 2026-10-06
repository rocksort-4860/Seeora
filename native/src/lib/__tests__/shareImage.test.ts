/**
 * 成就卡导出用到的纯排版 / 清洗逻辑（shareImage.ts）
 * 运行：node node_modules/jest/bin/jest.js src/lib/__tests__/shareImage.test.ts
 *
 * 为什么值得钉住：这些函数全都服务于「导出 PNG + 分享到社交平台」这条链路，
 * 而它们的失败方式**全是静默的** —— 卡片照样渲染、不报错，只是导出白图 /
 * 文字溢出卡片 / 标题被切一半。这种问题只有真机肉眼才能发现，所以必须靠单测兜住。
 */
import { describe, expect, it } from "@jest/globals";
import {
  describeError,
  ellipsize,
  formatCardDate,
  stripBase64,
  textWidth,
  wrapText,
} from "@/lib/shareImage";

describe("stripBase64：兼容 iOS 原生与 web 两种返回格式", () => {
  it("空值一律返回空串（绝不返回 undefined 让下游写坏文件）", () => {
    expect(stripBase64(null)).toBe("");
    expect(stripBase64(undefined)).toBe("");
    expect(stripBase64("")).toBe("");
  });

  it("web 版带 data: 前缀 → 剥掉前缀", () => {
    expect(stripBase64("data:image/png;base64,AAAB")).toBe("AAAB");
  });

  it("iOS 原生格式（无前缀）→ 原样返回", () => {
    expect(stripBase64("AAAB")).toBe("AAAB");
  });

  it("★ iOS 的 base64 带换行（NSDataBase64EncodingEndLineWithLineFeed）→ 必须去掉换行", () => {
    expect(stripBase64("AAAB\nCCCD\nEEEF\n")).toBe("AAABCCCDEEEF");
  });

  it("★ 换行 + data: 前缀同时出现 → 也要正确剥前缀（顺序错就会残留换行）", () => {
    expect(stripBase64("data:image/png;base64,AAAB\nCCCD\n")).toBe("AAABCCCD");
  });

  it("前后空白也要吃掉", () => {
    expect(stripBase64("  AAAB  ")).toBe("AAAB");
  });
});

describe("textWidth：宽窄字符按 1.0em / 0.55em 估宽", () => {
  it("拉丁字母按 0.55em", () => {
    expect(textWidth("abcd", 10)).toBeCloseTo(22, 5);
  });

  it("中文按 1.0em", () => {
    expect(textWidth("中文", 16)).toBeCloseTo(32, 5);
  });

  it("emoji 按 1.0em（含代理对，必须按码点判断而不是按 UTF-16 长度）", () => {
    expect(textWidth("🔥", 20)).toBeCloseTo(20, 5);
  });

  it("换行 / 制表符不产生宽度", () => {
    expect(textWidth("a\nb", 10)).toBeCloseTo(11, 5);
  });

  it("空串宽度为 0", () => {
    expect(textWidth("", 10)).toBe(0);
  });
});

describe("ellipsize：单行截断", () => {
  it("放得下就原样返回（不画蛇添足加省略号）", () => {
    expect(ellipsize("short", 10, 100)).toBe("short");
  });

  it("放不下 → 以省略号收尾，且宽度不超过上限", () => {
    const r = ellipsize("这是一个很长的中文标题需要被截断处理", 16, 60);
    expect(r.endsWith("…")).toBe(true);
    expect(textWidth(r, 16)).toBeLessThanOrEqual(60);
  });

  it("截断必须保留原文前缀（不能变成一坨省略号）", () => {
    const src = "这是一个很长的中文标题需要被截断处理";
    const r = ellipsize(src, 16, 60);
    expect(src.startsWith(r.slice(0, -1))).toBe(true);
  });

  it("空白串 → 空串", () => {
    expect(ellipsize("   \n  ", 16, 60)).toBe("");
  });

  it("内部连续空白会被折叠成一个空格（SVG 不会自己折叠）", () => {
    expect(ellipsize("a   b", 10, 999)).toBe("a b");
  });
});

describe("wrapText：折行 + 最多 maxLines 行", () => {
  const FS = 12;

  it("空串 / maxLines<=0 → 空数组", () => {
    expect(wrapText("", FS, 100, 3)).toEqual([]);
    expect(wrapText("abc", FS, 100, 0)).toEqual([]);
  });

  it("短文本一行放得下 → 恰好 1 行且不加省略号", () => {
    const lines = wrapText("hi there", FS, 500, 3);
    expect(lines).toEqual(["hi there"]);
  });

  it("拉丁按空格断行，不把单词劈开", () => {
    const lines = wrapText("The quick brown fox jumps over the lazy dog", FS, 80, 3);
    expect(lines.length).toBeLessThanOrEqual(3);
    for (const l of lines) expect(l).not.toMatch(/^\s|\s$/);
  });

  it("中日韩逐字断行", () => {
    const lines = wrapText("每天坚持一点点就会有大变化", 16, 48, 5);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.join("")).toContain("每天");
  });

  it("行数永远不超过 maxLines", () => {
    const lines = wrapText("每天坚持一点点就会有大变化", 16, 32, 2);
    expect(lines.length).toBeLessThanOrEqual(2);
  });

  it("★ 每行宽度不得超过上限 + 一个省略号的宽容量（这是卡片不出框的底线）", () => {
    const dots = textWidth("…", FS);
    const lines = wrapText("The quick brown fox jumps over the lazy dog", FS, 80, 3);
    for (const l of lines) expect(textWidth(l, FS)).toBeLessThanOrEqual(80 + dots);
  });

  it("被截断时最后一行以省略号收尾", () => {
    const lines = wrapText("一二三四五六七八九十十一十二十三", 16, 32, 2);
    expect(lines.length).toBe(2);
    expect(lines[lines.length - 1].endsWith("…")).toBe(true);
  });
});

describe("formatCardDate：不依赖 Intl（Hermes 裁剪 locale 会抛错）", () => {
  it("中文：YYYY年M月D日，且不补零", () => {
    expect(formatCardDate(new Date(2026, 0, 5), "zh")).toBe("2026年1月5日");
  });

  it("英文：Mon D, YYYY", () => {
    expect(formatCardDate(new Date(2026, 9, 6), "en")).toBe("Oct 6, 2026");
  });

  it("两位月日不出现前导零（1 月 5 日 ≠ 01 月 05 日）", () => {
    expect(formatCardDate(new Date(2026, 11, 31), "en")).toBe("Dec 31, 2026");
  });
});

describe("describeError：Release 无 console，失败原因要靠它留痕", () => {
  it("Error 带 name 与 message", () => {
    const r = describeError(new TypeError("boom"));
    expect(r).toContain("TypeError");
    expect(r).toContain("boom");
  });

  it("非 Error 值也能给出可读字符串", () => {
    expect(describeError("just a string")).toBe("just a string");
    expect(describeError(42)).toBe("42");
  });
});
