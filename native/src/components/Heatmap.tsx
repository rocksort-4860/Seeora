/**
 * Heatmap 打卡热力图：仅 Streakora 内真实打卡（导入天数不计入），按日期密度渐变
 * 最近 119 天（17 周 × 7 天）的网格；同日多习惯打卡则更亮
 */
import React, { useMemo } from "react";
import { View } from "react-native";
import { useApp } from "@/store/app";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Text as T } from "@/components/ui/text";
import { lastNDates } from "@/lib/habitLogic";
import { cn } from "@/lib/utils";

const DAYS = 119; // 17 周
const COLS = 17;

export function Heatmap() {
  const { habits, colors: c, dict: d } = useApp();

  const { cells, max } = useMemo(() => {
    const counts = new Map<string, number>();
    for (const h of habits) {
      for (const k of Object.keys(h.checkIns)) counts.set(k, (counts.get(k) || 0) + 1);
    }
    const dates = lastNDates(DAYS);
    const cells = dates.map((dt) => counts.get(dt) || 0);
    const max = Math.max(1, ...cells);
    return { cells, max };
  }, [habits]);

  if (habits.length === 0 || cells.every((x) => x === 0)) {
    return (
      <Card className="mt-4">
        <CardHeader><CardTitle className="text-[21px] font-extrabold">{d.heatmap}</CardTitle></CardHeader>
        <T className="mt-2 text-sm" style={{ color: c.ink3 }}>{d.heatmapEmpty}</T>
      </Card>
    );
  }

  const cell = 14;
  const gap = 4;

  return (
    <Card className="mt-4">
      <CardHeader><CardTitle className="text-[21px] font-extrabold">{d.heatmap}</CardTitle></CardHeader>
      <View className="mt-2 flex-row flex-wrap" style={{ gap }}>
        {cells.map((n, i) => {
          const ratio = n > 0 ? 0.35 + 0.65 * (n / max) : 0;
          return (
            <View
              key={i}
              className={cn("rounded-[3px]")}
              style={{
                width: cell, height: cell,
                backgroundColor: n > 0 ? c.accent : c.surface3,
                opacity: n > 0 ? ratio : 1,
              }}
            />
          );
        })}
      </View>
      <T className="mt-2 text-xs" style={{ color: c.ink4 }}>{d.last8weeks}</T>
    </Card>
  );
}
