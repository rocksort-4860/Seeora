/**
 * WeekGrid 本周网格：每个习惯一行 7 天完成矩阵（依 settings.weekStartOn 归零）
 */
import React from "react";
import { Text, View } from "react-native";
import { useApp } from "@/store/app";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Text as T } from "@/components/ui/text";

export function WeekGrid() {
  const { habits, colors: c, dict: d, settings, weekStatsOf, lang } = useApp();
  if (habits.length === 0) return null;

  const labels = settings.weekStartOn === "mon"
    ? (lang === "zh" ? ["一", "二", "三", "四", "五", "六", "日"] : ["M", "T", "W", "T", "F", "S", "S"])
    : (lang === "zh" ? ["日", "一", "二", "三", "四", "五", "六"] : ["S", "M", "T", "W", "T", "F", "S"]);

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="text-[21px] font-extrabold">{d.weekGrid}</CardTitle>
      </CardHeader>
      <View className="mt-2 gap-2.5">
        {habits.map((h) => {
          const st = weekStatsOf(h);
          return (
            <View key={h.id} className="flex-row items-center gap-2">
              <View className="w-28 flex-row items-center gap-1.5">
                <Text style={{ fontSize: 15 }}>{h.emoji}</Text>
                <T className="flex-1 text-sm font-medium" numberOfLines={1} style={{ color: c.ink }}>{lang === "zh" ? h.nameZh : h.name}</T>
              </View>
              <View className="flex-1 flex-row items-center justify-between">
                {st.inWeek.map((on, i) => (
                  <View
                    key={i}
                    className="h-6 w-6 items-center justify-center rounded-full"
                    style={{ backgroundColor: on ? h.color : c.surface3 }}
                  >
                    <T className="text-[10px] font-semibold" style={{ color: on ? "#FFFFFF" : c.ink4 }}>{labels[i]}</T>
                  </View>
                ))}
              </View>
            </View>
          );
        })}
      </View>
    </Card>
  );
}
