/**
 * History 页：①累计坚持天数卡（拆分导入/真实）②荣誉室(有记录置顶·无记录沉底占位)
 * ③排行榜 ④打卡热力图（仅真实打卡）
 */
import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Share2 } from "lucide-react-native";
import { useApp } from "@/store/app";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Text as T } from "@/components/ui/text";
import { Icon } from "@/components/ui/icon";
import { HonorRoom } from "@/components/HonorRoom";
import { Heatmap } from "@/components/Heatmap";

export default function HistoryScreen() {
  const { dict: d, colors: c, habits, honors, importedTotalAll, lang, openShare } = useApp();
  const insets = useSafeAreaInsets();

  const realTotal = habits.reduce((acc, h) => acc + Object.keys(h.checkIns).length, 0);
  const imported = importedTotalAll();
  const total = realTotal + imported;

  return (
    <View style={[styles.flex1, { backgroundColor: c.bg }]}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Text style={[styles.title, { color: c.ink }]}>{d.historyTitle}</Text>
      </View>

      <ScrollView style={[styles.flex1, styles.scrollH]} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {honors.length > 0 && <HonorRoom />}

        {/* ① 累计坚持天数卡 */}
        <Card style={styles.card}>
          <CardHeader>
            <View style={styles.cardHeadRow}>
              <CardTitle style={styles.cardTitle}>{d.totalCard}</CardTitle>
              <Pressable
                onPress={() => openShare()}
                hitSlop={8}
                style={[styles.shareBtn, { backgroundColor: c.surface2 }]}
                accessibilityLabel={d.shareTitle}
              >
                <Icon as={Share2} color={c.accent} size={18} />
              </Pressable>
            </View>
          </CardHeader>
          <View style={styles.totalWrap}>
            <Text style={[styles.totalBig, { color: c.accent }]}>{total}</Text>
            <T style={[styles.totalLabel, { color: c.ink3 }]}>{d.statTotal}</T>
          </View>
          <View style={styles.splitRow}>
            <View style={[styles.splitCol, { borderColor: c.line, borderRightWidth: 1 }]}>
              <Text style={[styles.splitNum, { color: c.ink }]}>{imported}</Text>
              <T style={[styles.splitLabel, { color: c.ink3 }]}>{d.totalImported}</T>
            </View>
            <View style={styles.splitCol}>
              <Text style={[styles.splitNum, { color: c.ink }]}>{realTotal}</Text>
              <T style={[styles.splitLabel, { color: c.ink3 }]}>{d.totalReal}</T>
            </View>
          </View>
        </Card>

        {/* 注：v0.2 九·1 明确不做排行榜，原 Leaderboard 不再挂入（组件文件保留待删除） */}

        {/* ④ 打卡热力图（仅真实打卡，见下方） */}

        <Heatmap />

        {honors.length === 0 && <HonorRoom />}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex1: { flex: 1 },
  scrollH: { paddingHorizontal: 16 },
  header: { paddingHorizontal: 20, paddingBottom: 8 },
  title: { fontSize: 28, fontWeight: "800", letterSpacing: -0.5 },
  card: { marginTop: 16 },
  cardHeadRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardTitle: { fontSize: 21, fontWeight: "800" },
  shareBtn: { height: 36, width: 36, alignItems: "center", justifyContent: "center", borderRadius: 9999 },
  totalWrap: { marginTop: 4, alignItems: "center", paddingVertical: 8 },
  totalBig: { fontSize: 44, fontWeight: "800", fontVariant: ["tabular-nums"] },
  totalLabel: { fontSize: 14 },
  splitRow: { marginTop: 8, flexDirection: "row" },
  splitCol: { flex: 1, alignItems: "center" },
  splitNum: { fontSize: 24, fontWeight: "700", fontVariant: ["tabular-nums"] },
  splitLabel: { fontSize: 12 },
});
