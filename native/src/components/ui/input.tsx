/**
 * ui/input（重写版）：StyleSheet 输入框。
 * 原 shadcn 口径：h-10、rounded-md、border-input、text-base；占位符 muted-foreground/50。
 */
import * as React from "react";
import { StyleSheet, TextInput } from "react-native";
import { useApp } from "@/store/app";

type InputProps = React.ComponentProps<typeof TextInput>;

function Input({ style, editable, placeholderTextColor, ...props }: InputProps) {
  const { colors: c } = useApp();
  return (
    <TextInput
      editable={editable}
      placeholderTextColor={placeholderTextColor ?? "rgba(122,122,122,0.5)"}
      style={[
        styles.base,
        { color: c.ink, backgroundColor: c.bg, borderColor: c.line },
        editable === false ? styles.disabled : null,
        style,
      ]}
      {...props}
    />
  );
}

export { Input };

const styles = StyleSheet.create({
  base: {
    borderWidth: 1,
    borderRadius: 6,
    minHeight: 40,
    paddingHorizontal: 12,
    paddingVertical: 4,
    fontSize: 16,
    lineHeight: 20,
  },
  disabled: { opacity: 0.5 },
});
