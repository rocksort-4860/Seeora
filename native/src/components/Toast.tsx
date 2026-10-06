/**
 * 全局 Toast（说明文档 §6）：底部居中黑底胶囊，2200ms 自动消失；ok 态为青深底
 * 模式来源：RockSort 已验证实现（922 工程）——「同一份数据源、两处渲染」。
 *
 * ⚠️ 弹层打开时，**这一个看不见** —— `Sheet` 是 RN 原生 `<Modal>`，跑在根视图之上，
 *    而本组件是普通 View（渲染在根层），会被整个压住：渲染了、也播报了，屏幕上却没有。
 *    所以同一份 `toastMsg` 要在**两处**渲染：
 *      ① 这里（`ToastHost`，弹层没开时用）
 *      ② `SheetToast`（弹层内部用，见 components/Sheet.tsx）
 *    绝不能反过来给 Toast 套一层 Modal 来解决 —— 那就成了两个并列的原生 Modal，
 *    在 RN 0.83 上会留下全屏透明层吃掉触摸（详见 Sheet.tsx 文件头铁律）。
 */
import React, { useEffect, useRef } from "react";
import { AccessibilityInfo, Animated, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "@/store/app";
import { type Colors, duration, fontSize, fontWeight, radius, spacing } from "@/lib/tokens";

export function ToastHost() {
  const { c, styles } = useStyles();
  const { toastMsg } = useApp();
  const insets = useSafeAreaInsets();
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (toastMsg) {
      opacity.setValue(0);
      Animated.timing(opacity, { toValue: 1, duration: duration.d1, useNativeDriver: true }).start();
      // Toast 是瞬时视觉反馈，VoiceOver 用户只能靠播报获知
      AccessibilityInfo.announceForAccessibility(toastMsg.msg);
    }
  }, [toastMsg, opacity]);

  if (!toastMsg) return null;
  /* 注意：这里保持普通 View，**不要**用 RN Modal 承载。
   * 弹层（Sheet）本身就是原生 Modal，再给 Toast 套一层 Modal 会形成嵌套 Modal，
   * 在 iOS 上会加剧「关闭弹层后触摸失效」。因此弹层**内部**的关键提示
   * （买断失败、恢复购买失败）一律走弹层内联渲染 + SheetToast，不走嵌套 Modal。 */
  return (
    <Animated.View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      style={[
        styles.toast,
        {
          bottom: insets.bottom + 96,
          // 深色模式下旧写法拿 c.ink 当底色、c.inkInverse 当文字，两个令牌语义同时在深色翻转，
          // 结果白字压浅底 = 1.09:1（等于不可见）。胶囊底/字固定成深底浅底两档，不随主题翻转语义。
          backgroundColor: toastMsg.ok ? c.accentInk : "#1d1d1f",
          opacity,
        },
      ]}
    >
      <Text maxFontSizeMultiplier={1.6} style={styles.txt}>{toastMsg.msg}</Text>
    </Animated.View>
  );
}

/**
 * 弹层内部专用的 Toast —— **必须是同一个 `toastMsg` 数据源的另一处渲染**。
 *
 * 为什么必须有它：只要支付弹层开着，全局那个 ToastHost 就被原生 Modal 盖住。
 * 典型漏网场景（都是「渲染了但看不见」）：
 *   · usePro 的「买断失败」—— 弹层没关，提示发在弹层背后
 *   · usePro 的「恢复购买失败 / 该账户没有可恢复的购买」
 *   · usePro 的「这是 Pro 功能」—— 提示刚发出弹层就打开了，正好被自己盖住
 * 现在统一由 Sheet 内部渲染一份，上述调用点无需逐个改。
 *
 * 定位与全局版一致，因此两处同时存在时完全重叠，视觉上仍是一个。
 */
export function SheetToast() {
  const { c, styles } = useStyles();
  const { toastMsg } = useApp();
  const insets = useSafeAreaInsets();
  if (!toastMsg) return null;
  return (
    /* 刻意不带 accessibilityLiveRegion：全局 ToastHost 已经负责 announceForAccessibility，
       两处都标会在 Android 上把同一句话播两遍（iOS 上该属性本身不生效）。 */
    <View
      pointerEvents="none"
      style={[
        styles.toast,
        {
          bottom: insets.bottom + 96,
          backgroundColor: toastMsg.ok ? c.accentInk : "#1d1d1f",
        },
      ]}
    >
      <Text maxFontSizeMultiplier={1.6} style={styles.txt}>{toastMsg.msg}</Text>
    </View>
  );
}

const makeStyles = (c: Colors) => StyleSheet.create({
  toast: {
    // 超长文案（如恢复购买失败提示）不再顶满整屏：限宽 + 居中胶囊，长文本自动换行
    position: "absolute", alignSelf: "center", left: spacing.s4, right: spacing.s4,
    alignItems: "center", borderRadius: radius.pill,
    paddingHorizontal: spacing.s3, paddingVertical: spacing.s2,
    maxWidth: 340, flexShrink: 1,
    zIndex: 999,
  },
  txt: {
    color: c.inkInverse, fontSize: fontSize.callout, fontWeight: fontWeight.medium,
    textAlign: "center", flexShrink: 1,
  },
});

/** 主题化样式钩子：组件顶部 const { c, styles } = useStyles(); */
function useStyles() {
  const { colors: c } = useApp();
  return React.useMemo(() => ({ c, styles: makeStyles(c) }), [c]);
}
