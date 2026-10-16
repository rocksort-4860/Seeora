/**
 * BuyoutCard 买断说明卡（设置 › 数据安全）：展示「一次买断，永久属于你」+ 去买断按钮
 */
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useApp } from "@/store/app";
import { Text as T } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Gem } from "lucide-react-native";

export function BuyoutCard({ onPress }: { onPress: () => void }) {
  const { dict: d, colors: c } = useApp();
  return (
    <View style={[styles.wrap, { borderBottomWidth: 1, borderColor: c.line }]}>
      <View style={styles.headRow}>
        <Icon as={Gem} color={c.accent} size={18} />
        <T style={[styles.title, { color: c.ink }]}>{d.buyoutTitle}</T>
      </View>
      <T style={[styles.body, { color: c.ink3 }]}>{d.buyoutBody}</T>
      <Button style={[styles.btn, { backgroundColor: c.accent }]} onPress={onPress}>
        <Text style={styles.btnText}>{d.dataBuyout}</Text>
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 16, paddingVertical: 12 },
  headRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { fontSize: 16, fontWeight: "600" },
  body: { marginTop: 6, fontSize: 14, lineHeight: 24 },
  btn: { marginTop: 12, minHeight: 40 },
  btnText: { fontSize: 16, fontWeight: "700", color: "#FFFFFF" },
});
