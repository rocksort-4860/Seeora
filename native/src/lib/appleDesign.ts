/**
 * 设计令牌库 —— 唯一设计真源
 *
 * 来源：《D:\Desktop\别人家的规范文档参考\desing.md》（Apple 官方设计规范逐条转译）
 * 定位分工：
 *   - 本文件 = 视觉规范（配色 / 圆角 / 字体 / 间距 / 阴影 / 组件规格）
 *   - 功能与交互逻辑仍以《Streakora产品设计文档 v0.2》为准（两套文档各司其职）
 *
 * 规范铁律（严格遵守，不得推翻）：
 *   1. 唯一强调色 Action Blue #0066cc —— 所有可点击元素只用它，禁止第二个强调色。
 *   2. 正文 17px / 400 / 行高 1.47；字重阶梯只有 300 / 400 / 600 / 700（500 刻意空缺）。
 *   3. 展示级字号必须负字距（-0.28 ~ -0.374px），即「Apple tight」招牌节奏。
 *   4. 全系统只有一处投影，且只给「落在台面上的产品图」，绝不给卡片/按钮/文字。
 *   5. 按压态统一 transform: scale(0.95)（全系统微交互）。
 *   6. 圆角语法不混用：sm=8 工具类 / lg=18 卡片 / pill=9999 行动件；中间只有 pearl 的 md=11。
 *   7. 禁止装饰性渐变；层次靠「亮块 ↔ 暗块」的面切换，不靠描边和阴影。
 *   8. 桌面字号到移动端按规范断点收敛（hero 56 → 40 → 34 → 28）。
 */

/* ================================ 颜色 ================================ */

export const appleColors = {
  /** 唯一强调色：所有交互（链接、主按钮、选中、打卡节点） */
  primary: "#0066cc",
  /** 聚焦环 */
  primaryFocus: "#0071e3",
  /** 暗底上的链接色（Action Blue 在深块上会消失） */
  primaryOnDark: "#2997ff",

  /** 主画面：纯白 */
  canvas: "#ffffff",
  /** 羊皮纸米白：分块节奏面、页脚 */
  canvasParchment: "#f5f5f7",
  /** 珍珠白：次级幽灵按钮 */
  surfacePearl: "#fafafc",

  /** 近黑块 1/2/3（微步进，用于相邻暗块的分隔） */
  tile1: "#272729",
  tile2: "#2a2a2c",
  tile3: "#252527",
  /** 纯黑：仅用于极致空无（全局导航、播放器、满幅照片） */
  surfaceBlack: "#000000",
  /** 半透明浅灰片：压在图上时的圆形控件底 */
  surfaceChip: "#d2d2d7",
  /** 浅灰片实际落地透明度（规范：约 64% alpha） */
  surfaceChipAlpha: "rgba(210, 210, 215, 0.64)",

  /** 文字：近黑墨 */
  ink: "#1d1d1f",
  body: "#1d1d1f",
  bodyOnDark: "#ffffff",
  bodyMuted: "#cccccc",
  inkMuted80: "#333333",
  inkMuted48: "#7a7a7a",

  /** 发丝线 */
  dividerSoft: "#f0f0f0",
  hairline: "#e0e0e0",

  onPrimary: "#ffffff",
  onDark: "#ffffff",
} as const;

/** 深色模式：规范明示「暗色 counterparts 未赋值」，此处按规范暗块语义补齐，仅做微步进迁移 */
export const appleColorsDark: Record<keyof typeof appleColors, string> = {
  primary: "#2997ff",
  primaryFocus: "#0071e3",
  primaryOnDark: "#2997ff",
  canvas: "#272729",
  canvasParchment: "#1d1d1f",
  surfacePearl: "#2a2a2c",
  tile1: "#252527",
  tile2: "#1d1d1f",
  tile3: "#000000",
  surfaceBlack: "#000000",
  surfaceChip: "rgba(210, 210, 215, 0.28)",
  surfaceChipAlpha: "rgba(210, 210, 215, 0.28)",
  ink: "#f5f5f7",
  body: "#f5f5f7",
  bodyOnDark: "#ffffff",
  bodyMuted: "#cccccc",
  inkMuted80: "#9a9a9e",
  inkMuted48: "#7a7a7a",
  dividerSoft: "#2c2c2e",
  hairline: "#3a3a3c",
  onPrimary: "#ffffff",
  onDark: "#ffffff",
};

/* ================================ 字体 ================================ */

/** iOS 上 -apple-system 即解析为 SF Pro；非苹果平台回退 system-ui */
export const fontStack = "-apple-system, system-ui, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

export type TypeToken =
  | "heroDisplay" | "displayLg" | "displayMd" | "lead" | "leadAiry"
  | "tagline" | "bodyStrong" | "body" | "denseLink" | "caption"
  | "captionStrong" | "buttonLarge" | "buttonUtility" | "finePrint"
  | "microLegal" | "navLink";

/** 桌面原值（来自规范 typography 表） */
export const specType: Record<TypeToken, { size: number; weight: "300" | "400" | "600" | "700"; lh: number; ls: number }> = {
  heroDisplay: { size: 56, weight: "600", lh: 1.07, ls: -0.28 },
  displayLg: { size: 40, weight: "600", lh: 1.1, ls: 0 },
  displayMd: { size: 34, weight: "600", lh: 1.47, ls: -0.374 },
  lead: { size: 28, weight: "400", lh: 1.14, ls: 0.196 },
  leadAiry: { size: 24, weight: "300", lh: 1.5, ls: 0 },
  tagline: { size: 21, weight: "600", lh: 1.19, ls: 0.231 },
  bodyStrong: { size: 17, weight: "600", lh: 1.24, ls: -0.374 },
  body: { size: 17, weight: "400", lh: 1.47, ls: -0.374 },
  denseLink: { size: 17, weight: "400", lh: 2.41, ls: 0 },
  caption: { size: 14, weight: "400", lh: 1.43, ls: -0.224 },
  captionStrong: { size: 14, weight: "600", lh: 1.29, ls: -0.224 },
  buttonLarge: { size: 18, weight: "300", lh: 1.0, ls: 0 },
  buttonUtility: { size: 14, weight: "400", lh: 1.29, ls: -0.224 },
  finePrint: { size: 12, weight: "400", lh: 1.0, ls: -0.12 },
  microLegal: { size: 10, weight: "400", lh: 1.3, ls: -0.08 },
  navLink: { size: 12, weight: "400", lh: 1.0, ls: -0.12 },
};

/**
 * 移动端收敛：规范「Responsive Behavior」显示 hero 56 → 40(1068px) → 34(640px) → 28(419px)。
 * App 只跑手机宽度，故直接取 ≤419px 档，并对展示级字号做 0.7 收敛，正文/工具类保持规范原值。
 */
const MOBILE_DISPLAY_SCALE = 0.7;

/** RN 可直接消费的字型：lineHeight 为绝对值，letterSpacing 单位 pt */
export const appleType: Record<TypeToken, { fontSize: number; fontWeight: "300" | "400" | "600" | "700"; lineHeight: number; letterSpacing: number }> = (() => {
  const out = {} as Record<TypeToken, { fontSize: number; fontWeight: "300" | "400" | "600" | "700"; lineHeight: number; letterSpacing: number }>;
  (Object.keys(specType) as TypeToken[]).forEach((k) => {
    const t = specType[k];
    const isDisplay = ["heroDisplay", "displayLg", "displayMd", "tagline", "lead"].includes(k);
    const size = isDisplay ? Math.round(t.size * MOBILE_DISPLAY_SCALE) : t.size;
    out[k] = {
      fontSize: size,
      fontWeight: t.weight,
      lineHeight: Math.round(size * t.lh),
      letterSpacing: t.ls,
    };
  });
  return out;
})();

/* ================================ 间距 ================================ */

export const appleSpacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 17,
  lg: 24,
  xl: 32,
  xxl: 48,
  section: 80,
} as const;

/* ================================ 圆角 ================================ */

export const appleRadius = {
  none: 0,
  xs: 5,
  sm: 8,
  md: 11,
  lg: 18,
  pill: 999,
  full: 999,
} as const;

/* ================================ 阴影 ================================ */

/**
 * 规范：全系统仅一处投影，且只给「落在台面上的产品图」（成就卡上的图形）。
 * UI 层次一律靠面色切换与发丝线，不给卡片/按钮/文字加影子。
 */
export const appleElevation = {
  /** 无 */
  flat: {},
  /** 1px 发丝线，用于工具类卡片与分栏 */
  hairline: {},
  /** 产品投影：仅成就卡图形使用 */
  product: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.22,
    shadowRadius: 15, // 规范 3px 5px 30px → RN 侧按等效模糊收敛
    elevation: 0,
  },
} as const;

/* ================================ 组件规格 ================================ */

export const appleComponents = {
  /** 主按钮：唯一行动色胶囊 */
  buttonPrimary: { bg: appleColors.primary, text: appleColors.onPrimary, type: "body" as TypeToken, radius: appleRadius.pill, padY: 11, padX: 22, minHeight: 44 },
  /** 主按钮按压：统一 scale(0.95)，不改色 */
  buttonActiveScale: 0.95,
  /** 幽灵胶囊：透明底 + 1px 强调色描边 */
  buttonSecondaryPill: { bg: "transparent", text: appleColors.primary, border: appleColors.primary, radius: appleRadius.pill, padY: 11, padX: 22, minHeight: 44 },
  /** 暗底工具类：近黑填充 + 8px 圆角 */
  buttonDarkUtility: { bg: appleColors.ink, text: appleColors.onDark, radius: appleRadius.sm, padY: 8, padX: 15 },
  /** 珍珠胶囊：次级按钮，3px 柔和描边而非可见细线 */
  buttonPearlCapsule: { bg: appleColors.surfacePearl, text: appleColors.inkMuted80, border: appleColors.dividerSoft, borderWidth: 3, radius: appleRadius.md, padY: 8, padX: 14 },
  /** 圆形控件：44×44，压在图上 */
  buttonIconCircular: { size: 44, bg: appleColors.surfaceChipAlpha, text: appleColors.ink, radius: appleRadius.full },
  /** 工具类卡片：白底 + 发丝线 + 18px 圆角 + 24px 内边距 */
  utilityCard: { bg: appleColors.canvas, border: appleColors.hairline, radius: appleRadius.lg, pad: appleSpacing.lg },
  /** 搜索/输入：胶囊，44px 高 */
  searchInput: { bg: appleColors.canvas, border: "rgba(0,0,0,0.08)", radius: appleRadius.pill, padY: 12, padX: 20, height: 44 },
  /** 满幅分块：0 圆角，靠面色切换分隔 */
  tile: { radius: appleRadius.none, padY: appleSpacing.section },
  /** 吸顶栏：羊皮纸 80% + 毛玻璃 */
  frostedBar: { bg: appleColors.canvasParchment, alpha: 0.8, blur: 20, height: 52 },
  /** 全局导航：纯黑 44px */
  globalNav: { bg: appleColors.surfaceBlack, text: appleColors.onDark, height: 44 },
} as const;

/** 毛玻璃底色（吸顶栏 / 吸底条） */
export const frostedBg = (alpha = 0.8) => {
  const c = appleColors.canvasParchment;
  const r = parseInt(c.slice(1, 3), 16);
  const g = parseInt(c.slice(3, 5), 16);
  const b = parseInt(c.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

/** 按压态：全系统统一微交互 */
export const pressScale = 0.95;
