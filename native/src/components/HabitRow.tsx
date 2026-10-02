/**
 * HabitRow（Today 卡片，v0.2 5.3）
 *  - 不放圆环 / 曲线预览（尺寸太小看不清）
 *  - 显示：习惯名称、当前连续、历史最长连续
 *  - 下方一行最近 7 天迷你圆点条（今天完成则实心；相邻点之间极细连线）
 *  - 右侧圆形勾选按钮：当日打卡入口
 *  - 点击卡片主体进入该习惯详情页（螺旋圆环视图）
 * 颜色（5.5）：完成=柔和青绿 / 计划休息=浅灰蓝 / 无记录=底色，不使用红色
 */
import React, { useRef } from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useApp } from "@/store/app";
import { todayStr } from "@/lib/dates";
import { fmt } from "@/lib/i18n";
import { pressScale } from "@/lib/tokens";
import type { Habit } from "@/store/app";

export function HabitRow({ habit }: { habit: Habit }) {
  const { colors: c, dict: d, lang, streakOf, bestOf, miniOf, toggleToday } = useApp();
  const router = useRouter();
  const layout = useRef({ x: 0, y: 0, w: 0, h: 0 });

  const today = todayStr();
  const done = !!habit.checkIns[today];
  const streak = streakOf(habit);
  const best = bestOf(habit);
  const week = miniOf(habit);

  const onCheck = () => {
    const r = layout.current;
    toggleToday(habit.id, { x: r.x + r.w / 2, y: r.y + r.h / 2 });
  };

  return (
    <Pressable
      onPress={() => router.push(`/habit/${habit.id}`)}
      className="mt-3 rounded-lg border px-4 py-3.5"
      style={({ pressed }) => ({
        backgroundColor: c.surface,
        borderColor: c.line,
        transform: [{ scale: pressed ? pressScale : 1 }],
      })}
    >
      <View className="flex-row items-center gap-3">
        {/* 图标底：规范面 pearl，不用强调色铺底，避免蓝色泛滥 */}
        <View className="h-9 w-9 items-center justify-center rounded-full" style={{ backgroundColor: c.surface2 }}>
          <Text style={{ fontSize: 17 }}>{habit.emoji}</Text>
        </View>

        {/* 名称与连续 */}
        <View className="flex-1">
          <View className="flex-row items-baseline gap-2">
            <Text className="text-[17px] font-semibold" style={{ color: c.ink }}>
              {lang === "zh" ? habit.nameZh : habit.name}
            </Text>
            {done ? (
              <Text className="text-xs" style={{ color: c.done }}>{lang === "zh" ? "今日已完成" : "Done today"}</Text>
            ) : habit.rests?.[today] ? (
              <Text className="text-xs" style={{ color: c.rest }}>{d.restToday}</Text>
            ) : null}
          </View>
          <View className="mt-0.5 flex-row gap-3">
            <Text className="text-[14px]" style={{ color: c.ink4 }}>
              {d.curStreak} · {streak}
            </Text>
            <Text className="text-[14px]" style={{ color: c.ink4 }}>
              {d.bestStreak} · {best}
            </Text>
          </View>
        </View>

        {/* 最近 7 天迷你点条 */}
        <View className="items-center">
          <View className="h-4 w-[62px] justify-center">
            <View style={{ position: "absolute", left: 4, right: 4, height: 1, backgroundColor: c.blank }} />
            <View className="flex-row items-center justify-between">
              {week.map((day) => {
                const filled = day.done || day.rest;
                const color = day.done ? c.done : day.rest ? c.rest : c.blank;
                return (
                  <View
                    key={day.date}
                    className="rounded-full"
                    style={{
                      width: day.isToday ? 9 : 7,
                      height: day.isToday ? 9 : 7,
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
          <Text className="mt-1 text-[10px]" style={{ color: c.ink4 }}>{fmt(d.nodeDays, { n: 1 })}</Text>
        </View>

        {/* 当日打卡圆钮 */}
        <Pressable
          onPress={onCheck}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={done ? d.dUndoToday : d.dCheckToday}
          onLayout={(e) => {
            const a = e.nativeEvent.layout;
            layout.current = { x: a.x, y: a.y, w: a.width, h: a.height };
          }}
          className="h-11 w-11 items-center justify-center rounded-full"
          style={{
            backgroundColor: done ? c.done : "transparent",
            borderWidth: 2,
            borderColor: done ? c.done : c.blank,
          }}
        >
          {done ? (
            <Text className="text-lg font-bold" style={{ color: c.surface }}>✓</Text>
          ) : (
            <View className="h-3 w-3 rounded-full" style={{ backgroundColor: c.blank }} />
          )}
        </Pressable>
      </View>
    </Pressable>
  );
}
