/**
 * ui/button（重写版）：StyleSheet 按钮。
 * 保留 variant：default / outline / destructive / secondary / ghost / link
 * （业务实际用到 default / outline / destructive）。
 * 颜色语义映射自原 shadcn 令牌：primary→c.accent、destructive→c.rest（规范无红，中性灰）、
 * outline→c.bg 底 + c.line 描边；调用处的 style 覆盖优先生效。
 */
import * as React from "react";
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { useApp } from "@/store/app";

type Variant = "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";

export type ButtonProps = Omit<React.ComponentProps<typeof Pressable>, "style"> & {
  variant?: Variant;
  style?: StyleProp<ViewStyle>;
};

function Button({ variant = "default", style, disabled, ...props }: ButtonProps) {
  const { colors: c } = useApp();
  const variantStyle =
    variant === "outline"
      ? { backgroundColor: c.bg, borderWidth: 1, borderColor: c.line }
      : variant === "destructive"
        ? { backgroundColor: c.rest }
        : variant === "secondary"
          ? { backgroundColor: c.surface2 }
          : variant === "ghost" || variant === "link"
            ? { backgroundColor: "transparent" }
            : { backgroundColor: c.accent };
  return (
    <Pressable
      {...props}
      role="button"
      disabled={disabled}
      style={[styles.base, variantStyle, disabled ? styles.disabled : null, style]}
    />
  );
}

export { Button };

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 6,
    minHeight: 40,
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexShrink: 0,
  },
  disabled: { opacity: 0.5 },
});
