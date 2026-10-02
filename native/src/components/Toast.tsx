/**
 * 全局 Toast（说明文档 §6）：底部居中黑底胶囊，2200ms 自动消失；ok 态为青深底
 */
import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text } from "react-native";
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
    }
  }, [toastMsg, opacity]);

  if (!toastMsg) return null;
  return (
    <Animated.View
      pointerEvents="none"
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
      <Text style={styles.txt}>{toastMsg.msg}</Text>
    </Animated.View>
  );
}

const makeStyles = (c: Colors) => StyleSheet.create({
  toast: {
    position: "absolute", alignSelf: "center", left: spacing.s4, right: spacing.s4,
    alignItems: "center", borderRadius: radius.pill,
    paddingHorizontal: spacing.s3, paddingVertical: spacing.s2,
    zIndex: 999,
  },
  txt: { color: c.inkInverse, fontSize: fontSize.callout, fontWeight: fontWeight.medium, textAlign: "center" },
});

/** 主题化样式钩子：组件顶部 const { c, styles } = useStyles(); */
function useStyles() {
  const { colors: c } = useApp();
  return React.useMemo(() => ({ c, styles: makeStyles(c) }), [c]);
}
