/**
 * ui/badge（重写版）：StyleSheet 胶囊小标。
 * 原 shadcn 令牌映射：default→c.accent、secondary→c.surface2、destructive→c.rest、
 * outline→透明底 + c.line 描边；调用处 style 覆盖优先生效（如 HonorRoom 的 accentWash）。
 */
import * as React from "react";
import { StyleSheet, View } from "react-native";
import { useApp } from "@/store/app";

type Variant = "default" | "secondary" | "destructive" | "outline";

type BadgeProps = React.ComponentProps<typeof View> & {
  variant?: Variant;
};

function Badge({ style, variant = "default", ...props }: BadgeProps) {
  const { colors: c } = useApp();
  const variantStyle =
    variant === "secondary"
      ? { backgroundColor: c.surface2 }
      : variant === "destructive"
        ? { backgroundColor: c.rest }
        : variant === "outline"
          ? { backgroundColor: "transparent", borderWidth: 1, borderColor: c.line }
          : { backgroundColor: c.accent };
  return <View style={[styles.base, variantStyle, style]} {...props} />;
}

export { Badge };

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    borderRadius: 9999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    overflow: "hidden",
    flexShrink: 0,
  },
});
