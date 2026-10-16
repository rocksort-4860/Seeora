/**
 * ui/card（重写版）：StyleSheet 卡片。
 * 原 shadcn 令牌口径映射到设计令牌：bg-card→c.surface、border-border→c.line；
 * 结构保持 Card / CardHeader / CardTitle / CardDescription / CardContent / CardFooter。
 */
import * as React from "react";
import { StyleSheet, Text as RNText, View } from "react-native";
import { useApp } from "@/store/app";
import { Text } from "@/components/ui/text";

type ViewProps = React.ComponentProps<typeof View>;
type TextProps = React.ComponentProps<typeof RNText>;

function Card({ style, ...props }: ViewProps) {
  const { colors: c } = useApp();
  return <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.line }, style]} {...props} />;
}

function CardHeader({ style, ...props }: ViewProps) {
  return <View style={[styles.header, style]} {...props} />;
}

function CardTitle({ style, ...props }: TextProps) {
  return <Text role="heading" aria-level={3} style={[styles.title, style]} {...props} />;
}

function CardDescription({ style, ...props }: TextProps) {
  return <Text style={[styles.description, style]} {...props} />;
}

function CardContent({ style, ...props }: ViewProps) {
  return <View style={[styles.content, style]} {...props} />;
}

function CardFooter({ style, ...props }: ViewProps) {
  return <View style={[styles.footer, style]} {...props} />;
}

export { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle };

const styles = StyleSheet.create({
  card: { borderRadius: 12, borderWidth: 1, flexDirection: "column", paddingVertical: 24, gap: 24 },
  header: { flexDirection: "column", paddingHorizontal: 24, gap: 6 },
  title: { fontSize: 16, fontWeight: "600", lineHeight: 18 },
  description: { fontSize: 14 },
  content: { paddingHorizontal: 24 },
  footer: { flexDirection: "row", alignItems: "center", paddingHorizontal: 24 },
});
