/**
 * InlineExpand —— 原地展开面板（2026-10-06 新增，替代设置页的底部 Sheet）
 *
 * ★ 为什么要有这个组件
 *   设置页里「导出数据」「抹除数据」原本用底部抽屉（Sheet）承载。问题有三：
 *     ① 触发点与结果**分离** —— 点上面第 3 行，内容从屏幕最下方升起，
 *        中间隔着整屏，眼睛要来回找，「我点的这一项弹了什么」不直观；
 *     ② 关闭按钮在抽屉右上角、离触发点很远，且抽屉盖住大半屏；
 *     ③ 抽屉适合「要填/要选」的表单，不适合「点一下就完成」的短列表。
 *   本组件把内容**就地展开在触发行下方**：触发点与选项同一屏、视线不用移动，
 *   点空白处或再点一次原按钮即可关闭（触点就在手边）。
 *
 * ★ 为什么不用「贴边浮层（popover）」
 *   贴边浮层要测量触发按钮的屏幕坐标、处理贴边翻转、还要一个透明背景层吃掉点击，
 *   复杂度高且容易出「浮层盖住自己」的问题。而设置页这几项都是**短纵向列表**，
 *   原地展开零坐标计算、天然不会出「关不掉」，可访问性也更好（选项就在 DOM 顺序里，
 *   读屏能顺着念下去）。
 *
 * ★ 使用约束
 *   本组件是**页内 View**，不是原生 Modal —— 不参与 sheetArbiter 仲裁，
 *   因此可以安全地与任意弹层共存（不会触发 RN 0.83 的双 Modal 透明层问题）。
 */
import React, { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "@/store/app";
import { useReduceMotion } from "@/lib/useReduceMotion";
import { duration, radius, spacing } from "@/lib/tokens";

interface InlineExpandProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

/**
 * 原地展开面板。渲染在触发元素**下方**，带一小段展开动画。
 * @param visible  是否展开
 * @param onClose  点空白处 / 再点触发按钮时调用
 */
export function InlineExpand({ visible, onClose, children }: InlineExpandProps) {
  const { colors: c } = useApp();
  const insets = useSafeAreaInsets();
  const reduce = useReduceMotion();
  const anim = useRef(new Animated.Value(0)).current;
  /* ★ 绝不能写 `if (!visible) return null`（同 Sheet 的教训）：
   *   组件会在 visible 变 false 的同一帧被卸载 → 收动画永远不播。
   *   改为「高度/透明度动画播完后才卸载内容」。 */
  const [mounted, setMounted] = React.useState(visible);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.timing(anim, {
        toValue: 1,
        duration: reduce ? 0 : duration.d2,
        useNativeDriver: false, // 高度动画不能用 native driver
      }).start();
      return;
    }
    Animated.timing(anim, {
      toValue: 0,
      duration: reduce ? 0 : duration.d1,
      useNativeDriver: false,
    }).start(({ finished }) => {
      // 与 Sheet 同款兜底：不依赖 finished，避免动画被打断时永久挂在屏幕上
      setTimeout(() => setMounted(false), 40);
      void finished;
    });
  }, [visible, anim, reduce]);

  if (!mounted) return null;

  return (
    <Animated.View
      style={{
        opacity: anim,
        transform: [
          {
            translateY: anim.interpolate({
              inputRange: [0, 1],
              outputRange: [-6, 0], // 轻微下落，暗示「从上面展开」
            }),
          },
        ],
        // 高度动画：0 → auto（RN 不支持 auto，用 minHeight 兜底即可）
        maxHeight: anim.interpolate({ inputRange: [0, 1], outputRange: [0, 520] }),
        overflow: "hidden",
      }}
    >
      {/* 点空白处关闭：绝对定位铺满下方区域，透明。
          zIndex/elevation 要低于内容，否则会盖住选项本身。 */}
      <Pressable
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="close"
        style={StyleSheet.absoluteFill}
      />
      <View
        style={[
          styles.panel,
          { backgroundColor: c.surface2, borderColor: c.line },
        ]}
      >
        {children}
      </View>
      {/* 底部留白，避免最后一项贴到分组卡片边缘 */}
      <View style={{ height: Math.max(insets.bottom, spacing.s2) }} />
    </Animated.View>
  );
}

/** 面板内的一行选项 */
export function ExpandOption({
  label,
  sub,
  onPress,
  icon,
  danger,
  last,
  colors,
}: {
  label: string;
  sub?: string;
  onPress: () => void;
  icon?: React.ReactNode;
  danger?: boolean;
  /** 面板内最后一项：去掉下边框，避免和面板圆角打架 */
  last?: boolean;
  colors: ReturnType<typeof useApp>["colors"];
}) {
  const [pressed, setPressed] = React.useState(false);
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[
        styles.option,
        {
          backgroundColor: pressed ? colors.surface3 : "transparent",
          borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
          borderColor: colors.line,
        },
      ]}
    >
      {icon}
      <View style={{ flex: 1 }}>
        {/* NativeWind v4 在 Android 会静默丢弃函数式 style —— 一律静态 style */}
        <Text style={{ color: danger ? colors.danger : colors.ink, fontSize: 16 }}>{label}</Text>
        {sub ? (
          <Text style={{ color: colors.ink3, fontSize: 12, marginTop: 2 }}>{sub}</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  panel: {
    marginHorizontal: spacing.s2,
    marginTop: spacing.s1,
    borderRadius: radius.r3,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: spacing.s1,
    overflow: "hidden",
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.s2,
    paddingHorizontal: spacing.s3,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});