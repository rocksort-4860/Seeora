/**
 * HabitRow（Today 卡片，v0.2 5.3）
 *  - 不放圆环 / 曲线预览（尺寸太小看不清）
 *  - 显示：习惯名称、当前连续、历史最长连续
 *  - 下方一行最近 7 天迷你圆点条（今天完成则实心；相邻点之间极细连线）
 *  - 右侧圆形勾选按钮：当日打卡入口
 *  - 点击卡片主体进入该习惯详情页（螺旋圆环视图）
 * 颜色（5.5）：完成=柔和青绿 / 计划休息=浅灰蓝 / 无记录=底色，不使用红色
 *
 * ★ 免费版「冻结」态（2026-10-06）：试用结束且未买断时，超出上限的习惯不可操作。
 *   store 层已用 blockIfFrozen 拦下全部写入口，但**界面上必须看得出来**——
 *   否则用户点打卡只得到一句 toast 并被弹到买断页，会以为 App 坏了。
 *   这里给出三重可见信号：整行降透明度 + 名称旁「已冻结」小标 + 打卡钮换成锁图标。
 *
 * ★ Pressable 的 style **必须传静态对象**，不能用 `style={({pressed}) => …}` 函数式：
 *   按压反馈统一用 onPressIn/onPressOut + useState 记录（iOS/Android 表现一致）。
 *   （2026-10-16 重写：className 已全部替换为 StyleSheet，交互与文案保持逐字不变。）
 */
import React, { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Lock } from "lucide-react-native";
import { useApp } from "@/store/app";
import { todayStr } from "@/lib/dates";
import { fmt } from "@/lib/i18n";
import { pressScale } from "@/lib/tokens";
import { Icon } from "@/components/ui/icon";
import type { Habit } from "@/store/app";

export function HabitRow({ habit }: { habit: Habit }) {
  const { colors: c, dict: d, lang, streakOf, bestOf, pausedOf, miniOf, toggleToday, frozenIds } = useApp();
  const router = useRouter();
  const layout = useRef({ x: 0, y: 0, w: 0, h: 0 });
  const [pressed, setPressed] = useState(false);

  const today = todayStr();
  const done = !!habit.checkIns[today];
  const streak = streakOf(habit);
  const best = bestOf(habit);
  const paused = pausedOf(habit);
  const week = miniOf(habit);
  const frozen = frozenIds.has(habit.id);

  const onCheck = () => {
    const r = layout.current;
    // 冻结习惯：toggleToday 内部的 blockIfFrozen 会给出 toast 并引导到买断页
    toggleToday(habit.id, { x: r.x + r.w / 2, y: r.y + r.h / 2 });
  };

  return (
    <Pressable
      onPress={() => router.push(`/habit/${habit.id}`)}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      accessibilityRole="button"
      accessibilityLabel={`${lang === "zh" ? habit.nameZh : habit.name}${frozen ? ` · ${d.habitFrozen}` : ""}`}
      style={[
        styles.row,
        {
          backgroundColor: c.surface,
          borderColor: frozen ? c.line2 : c.line,
          opacity: frozen ? 0.66 : 1,
          transform: [{ scale: pressed ? pressScale : 1 }],
        },
      ]}
    >
      <View style={styles.inner}>
        {/* 图标底：规范面 pearl，不用强调色铺底，避免蓝色泛滥 */}
        <View style={[styles.emojiWrap, { backgroundColor: c.surface2 }]}>
          <Text style={{ fontSize: 17 }}>{habit.emoji}</Text>
        </View>

        {/* 名称与连续 */}
        <View style={styles.flex1}>
          <View style={styles.nameRow}>
            <Text style={[styles.nameText, { color: c.ink }]}>
              {lang === "zh" ? habit.nameZh : habit.name}
            </Text>
            {frozen ? (
              <View style={[styles.frozenPill, { backgroundColor: c.surface2 }]}>
                <Text style={[styles.frozenText, { color: c.inkGroup }]}>{d.habitFrozen}</Text>
              </View>
            ) : done ? (
              <Text style={[styles.doneTag, { color: c.done }]}>{lang === "zh" ? "今日已完成" : "Done today"}</Text>
            ) : habit.rests?.[today] ? (
              <Text style={[styles.doneTag, { color: c.rest }]}>{d.restToday}</Text>
            ) : null}
          </View>
          <View style={styles.streakRow}>
            <Text style={[styles.streakText, { color: c.ink4 }]}>
              {d.curStreak} · {streak}
            </Text>
            <Text style={[styles.streakText, { color: c.ink4 }]}>
              {d.bestStreak} · {best}
            </Text>
          </View>
          {/* 方案 A：仅暂停状态展示浅灰辅助小字；无警示色、无催促词 */}
          {paused >= 1 ? (
            <Text style={[styles.pausedHint, { color: c.ink4 }]}>{d.streakPausedHint}</Text>
          ) : null}
        </View>

        {/* 最近 7 天迷你点条 */}
        <View style={styles.center}>
          <View style={styles.weekBar}>
            <View style={{ position: "absolute", left: 4, right: 4, height: 1, backgroundColor: c.blank }} />
            <View style={styles.weekDots}>
              {week.map((day) => {
                const filled = day.done || day.rest;
                const color = day.done ? c.done : day.rest ? c.rest : c.blank;
                return (
                  <View
                    key={day.date}
                    style={{
                      width: day.isToday ? 9 : 7,
                      height: day.isToday ? 9 : 7,
                      borderRadius: 9999,
                      backgroundColor: filled ? color : "transparent",
                      borderWidth: filled ? 0 : 1,
                      borderColor: c.blank,
                      opacity: filled ? 1 : 0.55,
                    }}
                  />
                );
              })}
            </View>
          </View>
          <Text style={[styles.weekLabel, { color: c.ink4 }]}>{fmt(d.nodeDays, { n: 1 })}</Text>
        </View>

        {/* 当日打卡圆钮（冻结 → 换成锁，点它照样走 blockIfFrozen 的升级引导） */}
        <Pressable
          onPress={onCheck}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={frozen ? d.habitFrozen : done ? d.dUndoToday : d.dCheckToday}
          onLayout={(e) => {
            const a = e.nativeEvent.layout;
            layout.current = { x: a.x, y: a.y, w: a.width, h: a.height };
          }}
          style={[
            styles.checkBtn,
            {
              backgroundColor: frozen ? c.surface2 : done ? c.done : "transparent",
              borderWidth: 2,
              borderColor: frozen ? "transparent" : done ? c.done : c.blank,
            },
          ]}
        >
          {frozen ? (
            <Icon as={Lock} color={c.inkGroup} size={16} />
          ) : done ? (
            <Text style={styles.checkMark}>✓</Text>
          ) : (
            <View style={[styles.checkDot, { backgroundColor: c.blank }]} />
          )}
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { marginTop: 12, borderRadius: 8, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 14 },
  inner: { flexDirection: "row", alignItems: "center", gap: 12 },
  emojiWrap: { height: 36, width: 36, alignItems: "center", justifyContent: "center", borderRadius: 9999 },
  flex1: { flex: 1 },
  nameRow: { flexDirection: "row", alignItems: "baseline", gap: 8 },
  nameText: { fontSize: 17, fontWeight: "600" },
  frozenPill: { borderRadius: 9999, paddingHorizontal: 6, paddingVertical: 2 },
  frozenText: { fontSize: 10, fontWeight: "500" },
  doneTag: { fontSize: 12 },
  streakRow: { marginTop: 2, flexDirection: "row", gap: 12 },
  streakText: { fontSize: 14 },
  pausedHint: { marginTop: 4, fontSize: 11 },
  center: { alignItems: "center" },
  weekBar: { height: 16, width: 62, justifyContent: "center" },
  weekDots: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  weekLabel: { marginTop: 4, fontSize: 10 },
  checkBtn: { height: 44, width: 44, alignItems: "center", justifyContent: "center", borderRadius: 9999 },
  checkMark: { fontSize: 18, fontWeight: "700", color: "#FFFFFF" },
  checkDot: { height: 12, width: 12, borderRadius: 9999 },
});
