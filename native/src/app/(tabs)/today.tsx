/**
 * Today（默认页）：习惯列表；每条左侧序号 + 标题/详情 + 本周目标；右侧圆形按钮两步打卡
 * 列表底部常驻灰度虚线占位引导行；无习惯时额外大尺寸虚线引导卡
 *
 * 免费版上限（5 个习惯）的升级引导在**入口层**拦截：
 *   达上限时点击「添加习惯」不再展开表单（否则用户填完标题、点保存才被告知超限，
 *   白做一遍且体验像"点了没反应"），而是直接进买断页 /pro，并在该页说明原因。
 */
import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "@/components/ui/icon";
import { ChevronDown, Gem, Plus } from "lucide-react-native";
import { useApp } from "@/store/app";
import { FREE_HABIT_LIMIT } from "@/lib/limits";
import { HabitRow } from "@/components/HabitRow";
import { Text as T } from "@/components/ui/text";

export default function TodayScreen() {
  const { dict: d, colors: c, lang, habits, openHabitForm, openPro, pro, hydrated, archiveHabit, deleteHabitNow } = useApp();
  const insets = useSafeAreaInsets();

  // 免费版已满：pro 为 false（未买断且试用已结束）且习惯数达上限
  const atLimit = !pro && habits.length >= FREE_HABIT_LIMIT;
  // 上限数字走插值，避免文案把「5」写死、日后改常量却不改文案
  const limitTitle = d.habitLimitTitle.replace("{n}", String(FREE_HABIT_LIMIT));

  // 主列表只显示未归档习惯；已归档的收进底部「已归档」区（可取消归档 / 删除）。
  // ★ 归档**不释放**免费版 5 条上限额度（frozenIds 统计含已归档，归档仍占位），
  //    所以「已归档」区必须 visibly 呈现这些习惯，否则用户会困惑「我有 5 条却只看到 4 条、还加不了第 5 条」。
  const active = habits.filter((h) => !h.isArchived);
  const archived = habits.filter((h) => h.isArchived);
  const [archOpen, setArchOpen] = useState(false);

  const open = () => {
    if (atLimit) {
      openPro("habitLimit");
      return;
    }
    openHabitForm(null);
  };

  return (
    <View style={[styles.flex1, { backgroundColor: c.bg }]}>
      {/* 顶部标题栏 */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <View>
          <Text style={[styles.brand, { color: c.ink }]}>{d.brand}</Text>
          <T style={[styles.slogan, { color: c.ink3 }]}>{d.slogan}</T>
        </View>
        <Pressable
          onPress={open}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={atLimit ? limitTitle : d.addHabit}
          style={[styles.addBtn, { backgroundColor: c.accent }]}
        >
          <Icon as={atLimit ? Gem : Plus} color="#FFFFFF" size={22} />
        </Pressable>
      </View>

      <ScrollView style={[styles.flex1, styles.scrollH]} contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        {hydrated && habits.length === 0 && (
          <Pressable
            onPress={open}
            style={[styles.emptyCard, { borderColor: c.line2 }]}
          >
            <Text style={{ fontSize: 46 }}>🌱</Text>
            <T style={[styles.emptyTitle, { color: c.ink2 }]}>{d.emptyTitle}</T>
            <T style={[styles.emptySub, { color: c.ink3 }]}>{d.emptySub}</T>
          </Pressable>
        )}

        {active.map((h) => (
          <HabitRow key={h.id} habit={h} />
        ))}

        {/* 常驻灰度虚线占位引导行；达免费版上限时切换为升级引导样式 */}
        <Pressable
          onPress={open}
          accessibilityRole="button"
          accessibilityLabel={atLimit ? `${limitTitle} · ${d.habitLimitBody}` : d.addHabit}
          style={[styles.guideRow, { borderColor: atLimit ? c.accent : c.line2, opacity: 0.9 }]}
        >
          <View style={[styles.guideIcon, { borderColor: atLimit ? c.accent : c.line2 }]}>
            <Icon as={atLimit ? Gem : Plus} color={atLimit ? c.accent : c.ink4} size={18} />
          </View>
          <View style={styles.flex1}>
            <T style={[styles.guideTitle, { color: atLimit ? c.ink : c.ink4 }]}>
              {atLimit ? limitTitle : d.addHabit}
            </T>
            <T style={[styles.guideHint, { color: atLimit ? c.accentText : c.ink4 }]}>
              {atLimit ? d.habitLimitBody : d.addHabitHint}
            </T>
          </View>
        </Pressable>

        {/* 已归档区：折叠展示，展开后可取消归档 / 删除。归档仍计入免费版 5 条上限。 */}
        {archived.length > 0 ? (
          <View style={styles.archSection}>
            <Pressable
              onPress={() => setArchOpen((v) => !v)}
              accessibilityRole="button"
              accessibilityLabel={`${d.archived} (${archived.length})`}
              style={[styles.archToggle, { borderWidth: 1, borderColor: c.line2, borderStyle: "dashed" }]}
            >
              <View style={{ transform: archOpen ? [{ rotate: "180deg" }] : [] }}>
                <Icon as={ChevronDown} color={c.ink3} size={18} />
              </View>
              <Text style={[styles.archLabel, { color: c.ink2 }]}>
                {d.archived} ({archived.length})
              </Text>
            </Pressable>
            {archOpen ? (
              <View style={styles.archList}>
                {archived.map((h) => (
                  <View
                    key={h.id}
                    style={[styles.archItem, { backgroundColor: c.surface, borderWidth: 1, borderColor: c.line }]}
                  >
                    <Text style={[styles.archName, { color: c.ink }]} numberOfLines={1}>
                      {h.emoji} {lang === "zh" ? h.nameZh : h.name}
                    </Text>
                    <Pressable
                      onPress={() => archiveHabit(h.id, false)}
                      accessibilityRole="button"
                      accessibilityLabel={d.unarchive}
                      style={[styles.archBtn, { borderWidth: 1, borderColor: c.line2 }]}
                    >
                      <Text style={[styles.archBtnText, { color: c.accent }]}>{d.unarchive}</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => deleteHabitNow(h.id)}
                      accessibilityRole="button"
                      accessibilityLabel={d.delete}
                      style={[styles.archBtn, { borderWidth: 1, borderColor: c.danger }]}
                    >
                      <Text style={[styles.archBtnText, { color: c.danger }]}>{d.delete}</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex1: { flex: 1 },
  scrollH: { paddingHorizontal: 16 },
  header: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  brand: { fontSize: 28, fontWeight: "800", letterSpacing: -0.5 },
  slogan: { fontSize: 14 },
  addBtn: { height: 40, width: 40, alignItems: "center", justifyContent: "center", borderRadius: 9999 },
  emptyCard: {
    marginTop: 24,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    borderWidth: 2,
    borderStyle: "dashed",
    paddingHorizontal: 24,
    paddingVertical: 56,
  },
  emptyTitle: { marginTop: 12, textAlign: "center", fontSize: 19, fontWeight: "800" },
  emptySub: { marginTop: 8, textAlign: "center", fontSize: 16 },
  guideRow: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 16,
    borderWidth: 2,
    borderStyle: "dashed",
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  guideIcon: {
    height: 36,
    width: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9999,
    borderWidth: 2,
    borderStyle: "dashed",
  },
  guideTitle: { fontSize: 16, fontWeight: "500" },
  guideHint: { fontSize: 12 },
  archSection: { marginTop: 16 },
  archToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  archLabel: { flex: 1, fontSize: 15, fontWeight: "600" },
  archList: { marginTop: 8 },
  archItem: {
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  archName: { flex: 1, fontSize: 16 },
  archBtn: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  archBtnText: { fontSize: 14, fontWeight: "600" },
});
