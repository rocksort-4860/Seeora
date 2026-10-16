/**
 * HonorRoom 荣誉室：展示迁移来的历史成果（独立留存，不计入周达标/热力图）
 * 有记录时由 History 置顶；无记录时由 History 沉底并显示占位添加行
 */
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useApp } from "@/store/app";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Text as T } from "@/components/ui/text";
import { Icon } from "@/components/ui/icon";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react-native";

export function HonorRoom() {
  const { honors, colors: c, dict: d, openHonorForm, lang } = useApp();

  if (honors.length === 0) {
    return (
      <Card style={styles.card}>
        <CardHeader>
          <CardTitle style={styles.title}>{d.hallOfFame}</CardTitle>
        </CardHeader>
        <Pressable
          onPress={() => openHonorForm(null)}
          accessibilityRole="button"
          accessibilityLabel={d.addHonor}
          style={[styles.addRow, { borderColor: c.line2 }]}
        >
          <Icon as={Plus} color={c.ink4} size={18} />
          <T style={[styles.addText, { color: c.ink4 }]}>{d.hallEmpty}</T>
        </Pressable>
      </Card>
    );
  }

  return (
    <Card style={styles.card}>
      <CardHeader style={styles.headRow}>
        <CardTitle style={styles.title}>{d.hallOfFame}</CardTitle>
        {/* ★ 纯图标按钮必须给 accessibilityLabel：VoiceOver 下「+」无任何可读名，
            审核与无障碍都算缺陷。d.addHonor 这个键此前声明了却一直没被使用。 */}
        <Pressable
          onPress={() => openHonorForm(null)}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={d.addHonor}
        >
          <Icon as={Plus} color={c.accent} size={20} />
        </Pressable>
      </CardHeader>
      <View style={styles.list}>
        {honors.map((h) => (
          <Pressable
            key={h.id}
            onPress={() => openHonorForm(h)}
            style={[styles.row, { backgroundColor: c.surface2 }]}
          >
            <View style={styles.info}>
              <T style={[styles.honorTitle, { color: c.ink }]}>{lang === "zh" ? h.titleZh : h.title}</T>
              <T style={[styles.honorMeta, { color: c.ink3 }]}>
                {h.source ? h.source + " · " : ""}{h.days} {lang === "zh" ? "天" : "days"}
                {h.category ? " · " + h.category : ""}
              </T>
            </View>
            <Badge style={[styles.badge, { backgroundColor: c.accentWash }]}>
              <T style={[styles.badgeText, { color: c.accentText }]}>{h.days}d</T>
            </Badge>
          </Pressable>
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 16 },
  title: { fontSize: 21, fontWeight: "800" },
  headRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  addRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: "dashed",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  addText: { fontSize: 16, fontWeight: "500" },
  list: { marginTop: 8, gap: 8 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  info: { flex: 1 },
  honorTitle: { fontSize: 16, fontWeight: "600" },
  honorMeta: { marginTop: 2, fontSize: 12 },
  badge: { marginLeft: 8 },
  badgeText: { fontSize: 12, fontWeight: "600" },
});
