/**
 * 设计令牌（Seeora）—— 全部样式的唯一来源
 *
 * 本文件已切换为《desing.md》（Apple 设计规范）口径：
 *   - 「唯一强调色 #2d7a6b（品牌绿）」是铁律：所有可点击元素只用它，功能语义（打卡/休息/无记录）
 *     改由「面色 + 中性灰」区分，不引入第二个强调色。
 *   - 字重阶梯只有 300 / 400 / 600 / 700（500 刻意空缺）。
 *   - 全系统仅一处投影，且只给落在台面上的产品图（成就卡图形），不给卡片/按钮/文字。
 *   - 层次靠「亮块 ↔ 暗块」的面切换，不靠描边和阴影。
 * 功能与交互逻辑仍以《Seeora产品设计文档 v0.2》为准。
 */

import { appleColors, appleColorsDark, appleType, appleSpacing, appleRadius } from "./appleDesign";

/* ------------------------------- 浅色令牌 ------------------------------- */

export const lightColors = {
  /* —— 规范色板直接落地 —— */
  bg: appleColors.canvasParchment, // 页面底：羊皮纸 #f5f5f7
  surface: appleColors.canvas, // 卡片 / 主面：纯白
  surface2: appleColors.surfacePearl, // 次级面：幽灵按钮、分组头
  surface3: appleColors.canvasParchment, // 三级面 / 按下态
  line: appleColors.hairline, // 发丝线 #e0e0e0
  line2: appleColors.hairline, // 控件描边
  line3: appleColors.dividerSoft, // 装饰性柔和环
  ink: appleColors.ink, // 一级文字 #1d1d1f
  ink2: appleColors.inkMuted80, // 二级文字 #333333
  ink3: appleColors.inkMuted80, // 三级文字
  ink4: appleColors.inkMuted48, // 占位符 / 禁用 #7a7a7a
  inkGroup: "#6e6e73", // 分组头/小标题：比正文弱一档，同时对比度仍过 AA 4.5:1
  accent: appleColors.primary, // 唯一强调色 #2d7a6b（品牌绿，图形填充 / 选中态）
  accentInk: appleColors.primary, // 按钮底色
  accentText: appleColors.primary, // 强调色文字（白底对比 ≥4.5:1）
  accentWash: appleColors.canvasParchment, // 强调色浅底
  accentLine: appleColors.primary, // 强调色描边
  /* —— 规范中性色承担功能语义 —— */
  done: appleColors.primary, // 打卡 = 行动色 #2d7a6b（品牌绿）
  rest: "#d2d2d7", // 计划休息 = 中性灰片（不引入第二个强调色）
  blank: appleColors.dividerSoft, // 无记录 / 漏签 = 近乎不可见的底色
  halo: appleColors.primary, // 仪式第二层光晕：与行动色同族
  focus: appleColors.primaryFocus, // 聚焦环 #1f5e52（深一档绿）
  inkInverse: appleColors.onPrimary, // 深底胶囊上的文字
  heroGlass: "rgba(245, 245, 247, 0.8)", // 吸顶毛玻璃（规范 frostedBar 落地）
  /* —— 保留但不参与界面语义（规范禁止第二个强调色，仅作为导出数据的旧字段兼容）—— */
  danger: "#FF3B30",
  dangerText: "#FF3B30",
  dangerWash: "#FDECEC",
  success: "#34C759",
  successText: "#2BA84B",
  successWash: "#E9F8EF",
  warn: "#FF9F0A",
  warnText: "#C77C00",
};

/* ------------------------------- 深色令牌 ------------------------------- */

export const darkColors: Record<keyof typeof lightColors, string> = {
  bg: appleColorsDark.canvasParchment,
  surface: appleColorsDark.canvas,
  surface2: appleColorsDark.surfacePearl,
  surface3: appleColorsDark.canvasParchment,
  line: appleColorsDark.hairline,
  line2: appleColorsDark.hairline,
  line3: appleColorsDark.dividerSoft,
  ink: appleColorsDark.ink,
  ink2: "#c9c9ce",
  ink3: "#a1a1a6",
  /* 深底占位符 / 禁用：原 #7a7a7a 压近黑底仅 3.92:1（不达 AA），提亮一档。
   * 与 appleColorsDark.inkMuted48 保持一致（真正的源在 appleDesign.ts）。 */
  ink4: "#8e8e93",
  inkGroup: "#8e8e93", // 分组头：深底上提亮一档，保证 AA 4.5:1（#7a7a7a 在深底只有 3.92:1）
  accent: appleColorsDark.primary, // 深底上的图形/图标：保持亮绿，可读
  // 实心块底色（按钮 / 胶囊 / 圆底，其上压白字白图标）必须用深一档绿：
  // 亮绿 #4fb3a1 上压白字只有 2.53:1，不达 WCAG AA；#2d7a6b + 白字 = 5.11:1。
  accentInk: appleColors.primary,
  accentText: appleColorsDark.primary,
  accentWash: "rgba(45,122,107,0.16)",
  accentLine: appleColorsDark.primary,
  done: appleColorsDark.primary,
  rest: "#4a4a50",
  blank: appleColorsDark.dividerSoft,
  halo: appleColorsDark.primary,
  focus: appleColorsDark.primary,
  inkInverse: appleColorsDark.bodyOnDark,
  heroGlass: "rgba(29, 29, 31, 0.8)",
  danger: "#FF453A",
  dangerText: "#FF6B62",
  dangerWash: "#3A221F",
  success: "#30D158",
  successText: "#5BE584",
  successWash: "#15291C",
  warn: "#FF9F0A",
  warnText: "#FFB340",
};

export type Colors = Record<keyof typeof lightColors, string>;

/* --------------------------- 习惯主题色（内容，非 UI 装饰） --------------------------- */

export const habitColors = [
  "#0066cc", "#1d1d1f", "#7a7a7a", "#d2d2d7",
  "#0071e3", "#434345", "#a1a1a6", "#e0e0e0",
] as const;

export const burstColors = [
  "#0066cc", "#0071e3", "#1d1d1f", "#7a7a7a",
  "#d2d2d7", "#c9c9ce", "#434345", "#e0e0e0",
] as const;

/* --------------------------------- 字型 --------------------------------- */

/**
 * 规范 typography 表按移动端断点（≤419px）收敛后的 9 档。
 * 展示级字号用负字距复刻「Apple tight」节奏。
 */
export const fontSize = {
  display: appleType.heroDisplay.fontSize, // 28（规范 56 在 ≤419px 档收敛值）
  h1: appleType.displayLg.fontSize, // 28
  h2: appleType.displayMd.fontSize, // 24
  h3: appleType.tagline.fontSize, // 15
  body: appleType.body.fontSize, // 17 —— 规范正文铁律，不得改 16
  sub: appleType.body.fontSize, // 17
  callout: appleType.caption.fontSize, // 14
  cap: appleType.caption.fontSize, // 14
  micro: appleType.finePrint.fontSize, // 12
} as const;

export const fontWeight = {
  light: "300" as const, // 规范阶梯：300
  regular: "400" as const, // 规范阶梯：400
  medium: "600" as const, // 规范无 500，中等强调一律用 600
  semibold: "600" as const,
  bold: "700" as const, // 规范仅在需要更强断言时用 700
};

export const lineHeight = { tight: 1.14, base: 1.47, loose: 2.41 } as const;

/* --------------------------------- 间距 --------------------------------- */

/** 规范 spacing：8pt 基线 + 少量排版微调值 */
export const spacing = {
  s05: appleSpacing.xxs, // 4
  s1: appleSpacing.xs, // 8
  s2: appleSpacing.sm, // 12
  s3: appleSpacing.md, // 17
  s4: appleSpacing.lg, // 24
  s5: appleSpacing.xl, // 32
  s6: appleSpacing.xxl, // 48
  s7: appleSpacing.section, // 80（满幅分块内边距）
} as const;

/* --------------------------------- 圆角 --------------------------------- */

/** 规范 rounded 语法，不混用：工具类 sm / 卡片 lg / 行动件 pill */
export const radius = {
  r1: appleRadius.xs, // 5
  r2: appleRadius.sm, // 8 —— 暗底工具类
  r3: appleRadius.md, // 11 —— 珍珠胶囊
  r4: appleRadius.lg, // 18 —— 工具类卡片
  r5: appleRadius.lg, // 18
  pill: appleRadius.pill, // 9999 —— 行动件
} as const;

/* --------------------------------- 动效 --------------------------------- */

export const duration = { d1: 150, d2: 250, d3: 400 } as const;

/** 规范：全系统按压态统一 scale(0.95) */
export const pressScale = 0.95;

/** 数字等宽，避免时间线跳动（规范：数字使用 font-variant-numeric 特性） */
export const numFont = {
  fontVariant: ["tabular-nums"] as ["tabular-nums"],
  fontFamily: "-apple-system, system-ui, sans-serif",
  letterSpacing: -0.374,
};
