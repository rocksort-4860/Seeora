/**
 * Leaderboard 排行榜：所有习惯按累计坚持天数；支持按 坚持天数/名称/创建时间 切换排序
 * 按天数显示时间段徽章（≥1年 / ≥半年 / ≥3月 / ≥1月 / 1月内）
 */
import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useApp } from "@/store/app";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Text as T } from "@/components/ui/text";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Badge as BadgeKey, LeaderSort } from "@/lib/habitLogic";

const BADGE_KEY: Record<BadgeKey, keyof ReturnType<typeof useApp>["dict"]> = {
  year: "badgeYear", half: "badgeHalf", quarter: "badgeQuarter", month: "badgeMonth", fresh: "badgeFresh",
};

export function Leaderboard() {
  const { habits, colors: c, dict: d, lang, leaderboardOf, badgeOf, allTotalOf } = useApp();
  const [sort, setSort] = useState<LeaderSort>("days");
  const list = leaderboardOf(sort);

  const sorts: { k: LeaderSort; label: string }[] = [
    { k: "days", label: d.sortDays },
    { k: "name", label: d.sortName },
    { k: "created", label: d.sortCreated },
  ];

  return (
    <Card className="mt-4">
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-[21px] font-extrabold">{d.leaderboard}</CardTitle>
        <View className="flex-row gap-1.5">
          {sorts.map((s) => (
            <PressableChip key={s.k} active={sort === s.k} label={s.label} onPress={() => setSort(s.k)} colors={c} />
          ))}
        </View>
      </CardHeader>
      <CardContent className="gap-1.5">
        {list.length === 0 ? (
          <T className="text-sm" style={{ color: c.ink3 }}>{d.emptySub}</T>
        ) : (
          list.map((h, i) => {
            const total = allTotalOf(h);
            const b = badgeOf(total);
            return (
              <View key={h.id} className="flex-row items-center gap-3 py-2" style={{ borderBottomWidth: i < list.length - 1 ? 1 : 0, borderColor: c.line }}>
                <T className="w-5 text-center text-sm font-bold" style={{ color: c.ink3 }}>{i + 1}</T>
                <Text style={{ fontSize: 18 }}>{h.emoji}</Text>
                <View className="flex-1">
                  <T className="text-base font-semibold" style={{ color: c.ink }}>{lang === "zh" ? h.nameZh : h.name}</T>
                </View>
                <T className="text-sm font-bold tabular-nums" style={{ color: c.ink }}>{total}</T>
                {b ? (
                  <Badge className="ml-1" style={{ backgroundColor: c.accentWash }}>
                    <T className="text-[11px] font-semibold" style={{ color: c.accentText }}>{d[BADGE_KEY[b]]}</T>
                  </Badge>
                ) : null}
              </View>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

function PressableChip({ active, label, onPress, colors: c }: { active: boolean; label: string; onPress: () => void; colors: ReturnType<typeof useApp>["colors"] }) {
  return (
    <Pressable
      onPress={onPress}
      className={cn("rounded-full px-3 py-1")}
      style={{ backgroundColor: active ? c.accent : c.surface2 }}
      hitSlop={6}
    >
      <T className="text-xs font-medium" style={{ color: active ? "#FFFFFF" : c.ink2 }}>{label}</T>
    </Pressable>
  );
}
