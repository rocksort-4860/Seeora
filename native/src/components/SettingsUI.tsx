/**
 * SettingsUI —— 设置页的 iOS 规范组件集（2026-10-07）
 *
 * ★ 为什么单独建这套组件
 *   原设置页的每一行都是自写的 `View` + `flex-row`，列表观感与 iOS「设置」不一致：
 *   缺标准间距、缺「右侧当前值 + 箭头」、缺按压态反馈、分组头样式不统一。
 *   本文件把 iOS 设置的经典结构固化下来，全项目设置类页面共用：
 *
 *     分组标题（小字 secondary，字母间距略宽，左对齐）
 *       └ 圆角分组卡片（inset grouped）
 *          └ 行：左标题 … 右「当前值」(secondary) + › 箭头
 *
 * ★ 关键交互规范（照 iOS 设置做）
 *   ① 行高 44pt（iOS 标准可点高度），横向内边距 16/12
 *   ② 分组之间靠标题 + 卡片圆角分组，卡片内行之间 0.5pt 细线，**最后一根线不画**
 *   ③ 可点行有按压态（背景变灰）→ 用 NativeWind 安全的「静态 style + useState」
 *   ④ 无值无箭头的行（如 Switch 行）不显示箭头
 *   ⑤ 破坏性行（抹掉数据）文字用 danger 色，但**不加底色**（Apple 规范：红字不红底）
 */
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ChevronRight } from "lucide-react-native";
import { Icon } from "@/components/ui/icon";
import type { useApp } from "@/store/app";

type Colors = ReturnType<typeof useApp>["colors"];

/* ===================== 分组标题 ===================== */
export function GroupTitle({ children, colors: c }: { children: React.ReactNode; colors: Colors }) {
  return (
    <Text
      style={styles.groupTitle}
      maxFontSizeMultiplier={1.4}
      accessibilityRole="header"
    >
      <Text style={{ color: c.inkGroup }}>{String(children)}</Text>
    </Text>
  );
}

/* ===================== 分组卡片 ===================== */
export function Group({ children, colors: c, style }: { children: React.ReactNode; colors: Colors; style?: object }) {
  return (
    <View
      style={[
        styles.group,
        { backgroundColor: c.surface, borderColor: c.line },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/* ===================== 行 ===================== */
export function Row({
  label,
  /** 右侧当前值（iOS 里显示已选项，如「中文」「浅色」） */
  value,
  /** 显示右侧箭头：有子页面才显示 */
  chevron,
  onPress,
  danger,
  children,
  colors: c,
  first,
  last,
}: {
  label: string;
  value?: string;
  chevron?: boolean;
  onPress?: () => void;
  danger?: boolean;
  /** 行内自定义内容（Switch / 分段控件），有它就不显示 value 与箭头 */
  children?: React.ReactNode;
  colors: Colors;
  /** 分组内第一行：去掉上边线 */
  first?: boolean;
  /** 分组内最后一行：去掉下边线 */
  last?: boolean;
}) {
  const [pressed, setPressed] = React.useState(false);
  const interactive = !!onPress;

  const inner = (
    <>
      <Text
        style={[styles.label, { color: danger ? c.danger : c.ink }]}
        maxFontSizeMultiplier={1.5}
        numberOfLines={1}
      >
        {label}
      </Text>
      {children ??
        (value || chevron ? (
          <View style={styles.right}>
            {value ? (
              <Text style={[styles.value, { color: c.ink3 }]} maxFontSizeMultiplier={1.4} numberOfLines={1}>
                {value}
              </Text>
            ) : null}
            {chevron ? <Icon as={ChevronRight} color={c.ink4} size={17} /> : null}
          </View>
        ) : null)}
    </>
  );

  if (!interactive) {
    return <View style={[styles.row, first && styles.rowFirst, last && styles.rowLast]}>{inner}</View>;
  }

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      // ★ 必须静态 style + useState：函数式 style 在 NativeWind v4 的 Android 上
      //   会被静默丢弃（iOS 正常），结果是这一行在 Android 上不响应、看起来像坏了。
      style={[
        styles.row,
        first && styles.rowFirst,
        last && styles.rowLast,
        pressed && { backgroundColor: c.surface3 },
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={value ? `${label}, ${value}` : undefined}
    >
      {inner}
    </Pressable>
  );
}

/* ===================== 页头（子页面用） ===================== */
/**
 * iOS 导航栏：大标题（或紧凑标题）+ 左侧返回。
 * 返回按钮用 `router.back()` 以保留原生层级手势。
 */
export function NavHeader({
  title,
  subtitle,
  backLabel,
  colors: c,
  onBack,
}: {
  title: string;
  /** 返回按钮文字（走 i18n，不要裸英文） */
  backLabel: string;
  subtitle?: string;
  colors: Colors;
  onBack: () => void;
}) {
  /* ★ 返回按钮同样必须「useState + 静态 style」：函数式 style 在 NativeWind v4 的
     Android 上会被静默丢弃 → 按压态失效（iOS 正常，安卓摸不出变化）。 */
  const [pressed, setPressed] = React.useState(false);
  return (
    <View style={[styles.navHeader, { borderBottomColor: c.line, backgroundColor: c.bg }]}>
      <Pressable
        onPress={onBack}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        accessibilityRole="button"
        accessibilityLabel={subtitle ? `${backLabel} ${subtitle}` : backLabel}
        hitSlop={8}
        style={[styles.backBtn, { opacity: pressed ? 0.5 : 1 }]}
      >
        <Text style={[styles.backTxt, { color: c.accent }]} maxFontSizeMultiplier={1.4} numberOfLines={1}>
          {"‹"} {backLabel}
        </Text>
      </Pressable>
      <Text style={[styles.navTitle, { color: c.ink }]} maxFontSizeMultiplier={1.3} numberOfLines={1}>
        {title}
      </Text>
    </View>
  );
}

/* ===================== 选项行（单选列表） ===================== */
/**
 * iOS 单选列表行：标题 + 右侧 ✓。
 * 选中态同时用 c.accent 着色 + 加粗，符合 iOS 设置「Appearance → 选中项」的习惯。
 */
export function OptionRow({
  label,
  selected,
  onPress,
  colors: c,
  last,
  danger,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  colors: Colors;
  last?: boolean;
  danger?: boolean;
}) {
  const [pressed, setPressed] = React.useState(false);
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      style={[styles.row, last && styles.rowLast, pressed && { backgroundColor: c.surface3 }]}
    >
      <Text
        style={[styles.label, { color: danger ? c.danger : c.ink, fontWeight: selected ? "600" : "400" }]}
        maxFontSizeMultiplier={1.5}
      >
        {label}
      </Text>
      {selected ? <Text style={[styles.check, { color: c.accent }]}>✓</Text> : null}
    </Pressable>
  );
}

/* ===================== 分段控件（模仿 RockSort 设置页） =====================
 * 语言 / 外观这类「二~三选一」在设置页内联展示：不进子页、不叠 Modal，
 * 触发点紧贴当前行、关闭按钮在视线内（修复早先「从底部弹整屏、关闭键远且盖住大半屏」）。
 * 选中态用 accentWash 浅底 + accentText 文字（与项目唯一强调色 #2d7a6b 同族）。
 * 按压态用 useState + 静态 style（函数式 style 在 NativeWind v4 的 Android 上被静默丢弃）。 */
export interface SegmentOption {
  value: string;
  /** 显示文案（语言按钮固定写死本语言名，不跟随当前语言） */
  label: string;
  /** 无障碍标签，缺省等于 label */
  a11y?: string;
}

export function Segmented({
  options, selected, onSelect, colors: c, first, last,
}: {
  options: SegmentOption[];
  selected: string;
  onSelect: (value: string) => void;
  colors: Colors;
  first?: boolean;
  last?: boolean;
}) {
  return (
    <View style={[styles.segRow, first && styles.rowFirst, last && styles.rowLast]}>
      {options.map((o) => {
        const on = o.value === selected;
        const [pressed, setPressed] = React.useState(false);
        return (
          <Pressable
            key={o.value}
            onPress={() => onSelect(o.value)}
            onPressIn={() => setPressed(true)}
            onPressOut={() => setPressed(false)}
            accessibilityRole="button"
            accessibilityLabel={o.a11y ?? o.label}
            accessibilityState={{ selected: on }}
            style={[
              styles.seg,
              { borderColor: on ? c.accentText : c.line3, backgroundColor: on ? c.accentWash : c.surface2 },
              pressed && { opacity: 0.8 },
            ]}
          >
            <Text style={[styles.segTxt, { color: on ? c.accentText : c.ink2 }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ===================== 分段卡片（标题 + 当前值 + 分段控件） ===================== */
export function SegmentCard({
  title, value, children, colors: c,
}: {
  title: string;
  /** 右侧当前值（如「中文」「浅色」），可空 */
  value?: string;
  children: React.ReactNode;
  colors: Colors;
}) {
  return (
    <View style={[styles.segCard, { backgroundColor: c.surface, borderColor: c.line }]}>
      <View style={styles.segHead}>
        <Text style={[styles.segHeadTitle, { color: c.ink }]}>{title}</Text>
        {value ? <Text style={[styles.segHeadValue, { color: c.ink3 }]}>{value}</Text> : null}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  groupTitle: {
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.5,
    marginBottom: 7,
    marginLeft: 16,
    textTransform: "none",
  },
  group: {
    borderRadius: 10,
    marginHorizontal: 16,
    marginBottom: 22,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
  },
  row: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingLeft: 16,
    paddingRight: 12,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "transparent", // 各页面用 colors.line 覆盖
  },
  rowFirst: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "transparent" },
  rowLast: { borderBottomWidth: 0 },
  label: { fontSize: 16, flexShrink: 1 },
  value: { fontSize: 16, marginRight: 4 },
  right: { flexDirection: "row", alignItems: "center", flexShrink: 0, marginLeft: 8 },
  navHeader: {
    paddingHorizontal: 8,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  backBtn: { paddingVertical: 6, paddingRight: 10, paddingLeft: 4, minHeight: 44, justifyContent: "center" },
  backTxt: { fontSize: 17 },
  navTitle: { fontSize: 17, fontWeight: "600", flex: 1 },
  check: { fontSize: 16, fontWeight: "600" },
  segCard: {
    borderRadius: 11,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    gap: 12,
    marginHorizontal: 16,
    marginBottom: 22,
  },
  segHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  segHeadTitle: { flex: 1, fontSize: 16, fontWeight: "600" },
  segHeadValue: { fontSize: 14, marginLeft: 8 },
  segRow: { flexDirection: "row", gap: 8 },
  seg: {
    flex: 1, minHeight: 44, borderRadius: 10,
    borderWidth: 1, alignItems: "center", justifyContent: "center",
  },
  segTxt: { fontSize: 15, fontWeight: "500" },
});