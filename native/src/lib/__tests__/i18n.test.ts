/**
 * i18n 守卫（zh / en 一致性）
 * 运行：node node_modules/jest/bin/jest.js src/lib/__tests__/i18n.test.ts
 *
 * 为什么需要这个文件：
 *   `Dict` 接口已经用 TypeScript 保证「两个语言包键集相同」，但**保证不了**下面三件事，
 *   而这三件事的失败方式全都是**静默的** —— 界面上少一个词、多一行空白、或者直接显示
 *   字面量 `{n}`，都不会报错、不会被 lint 抓到，只有真机逐页翻才能发现：
 *     ① 某个键被填成空串（"占位占了个寂寞"）；
 *     ② 中文写了 `{n}`、英文漏了（或反过来）→ 数字根本不渲染，界面出现 `{n}` 字样；
 *     ③ 两个包里有键被写重复/漏合并。
 *   ★ 2026-10-06 本轮清理了 20 个「声明了但全项目零引用」的退役键（排行榜 / 徽章 /
 *     每周目标 / 每日提醒等），一并把这条守卫补上，避免退役键再次堆积。
 */
import { describe, expect, it } from "@jest/globals";
import { I18N } from "@/lib/i18n";

const LANGS = ["zh", "en"] as const;

/** 当成普通字符串字典来遍历（Dict 没有索引签名，按 keyof 遍历会把测试写死） */
const bag = (l: (typeof LANGS)[number]): Record<string, string> =>
  I18N[l] as unknown as Record<string, string>;

describe("i18n：zh / en 必须严格一一对应", () => {
  it("键集完全一致（含新增/删除同步）", () => {
    const zh = Object.keys(I18N.zh).sort();
    const en = Object.keys(I18N.en).sort();
    expect(en).toEqual(zh);
  });

  it("没有任何空字符串值（占位键会让界面缺词）", () => {
    const empties: string[] = [];
    for (const l of LANGS) {
      for (const [k, v] of Object.entries(bag(l))) {
        if (typeof v === "string" && v.trim() === "") empties.push(`${l}.${k}`);
      }
    }
    expect(empties).toEqual([]);
  });

  it("★ 插值占位符必须两边都有：只在一侧写 {n} 会让另一侧原样显示「{n}」", () => {
    const bad: string[] = [];
    for (const k of Object.keys(I18N.zh)) {
      const ph = (s: string) => (s.match(/\{[a-zA-Z0-9_]+\}/g) ?? []).sort().join(",");
      const a = ph(bag("zh")[k]);
      const b = ph(bag("en")[k]);
      if (a !== b) bad.push(`${k}: zh=[${a}] en=[${b}]`);
    }
    expect(bad).toEqual([]);
  });

  it("fmt() 用到的键确实带占位符（防「传了参数却没插值」）", () => {
    // 这几个键在代码里一定带参数调用，占位符丢了就等于白传
    const mustHavePlaceholder = ["nodeDays", "newBest", "version", "proTrialLeft", "impOk", "habitLimitTitle"];
    for (const k of mustHavePlaceholder) {
      for (const l of LANGS) {
        expect(bag(l)[k]).toMatch(/\{[a-zA-Z0-9_]+\}/);
      }
    }
  });
});
