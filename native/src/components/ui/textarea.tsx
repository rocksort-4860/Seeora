/**
 * ui/textarea（重写版）：StyleSheet 多行输入框。
 * 原 shadcn 口径：min-h-16、rounded-md、border-input、text-base、native numberOfLines=8。
 */
import * as React from "react";
import { StyleSheet, TextInput } from "react-native";
import { useApp } from "@/store/app";

type TextareaProps = React.ComponentProps<typeof TextInput>;

function Textarea({
  style,
  editable,
  multiline = true,
  numberOfLines = 8,
  placeholderTextColor,
  ...props
}: TextareaProps) {
  const { colors: c } = useApp();
  return (
    <TextInput
      editable={editable}
      multiline={multiline}
      numberOfLines={numberOfLines}
      textAlignVertical="top"
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

export { Textarea };

const styles = StyleSheet.create({
  base: {
    borderWidth: 1,
    borderRadius: 6,
    minHeight: 64,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    textAlignVertical: "top",
  },
  disabled: { opacity: 0.5 },
});
