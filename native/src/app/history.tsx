/**
 * History 页：①累计坚持天数卡（拆分导入/真实）②荣誉室(有记录置顶·无记录沉底占位)
 * ③排行榜 ④打卡热力图（仅真实打卡）
 */
import React from "react";
import { ScrollView, Text, View } from "react-native";
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
    <View className="flex-1" style={{ backgroundColor: c.bg }}>
      <View className="px-5 pb-2" style={{ paddingTop: insets.top + 16 }}>
        <Text className="text-[28px] font-extrabold tracking-tight" style={{ color: c.ink }}>{d.historyTitle}</Text>
      </View>

      <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {honors.length > 0 && <HonorRoom />}

        {/* ① 累计坚持天数卡 */}
        <Card className="mt-4">
          <CardHeader>
            <View className="flex-row items-center justify-between">
              <CardTitle className="text-[21px] font-extrabold">{d.totalCard}</CardTitle>
              <Pressable
                onPress={() => openShare()}
                hitSlop={8}
                className="h-9 w-9 items-center justify-center rounded-full"
                style={{ backgroundColor: c.surface2 }}
                accessibilityLabel={d.shareTitle}
              >
                <Icon as={Share2} color={c.accent} size={18} />
              </Pressable>
            </View>
          </CardHeader>
          <View className="mt-1 items-center py-2">
            <Text className="text-[44px] font-extrabold tabular-nums" style={{ color: c.accent }}>{total}</Text>
            <T className="text-sm" style={{ color: c.ink3 }}>{d.statTotal}</T>
          </View>
          <View className="mt-2 flex-row">
            <View className="flex-1 items-center border-r" style={{ borderColor: c.line }}>
              <Text className="text-2xl font-bold tabular-nums" style={{ color: c.ink }}>{imported}</Text>
              <T className="text-xs" style={{ color: c.ink3 }}>{d.totalImported}</T>
            </View>
            <View className="flex-1 items-center">
              <Text className="text-2xl font-bold tabular-nums" style={{ color: c.ink }}>{realTotal}</Text>
              <T className="text-xs" style={{ color: c.ink3 }}>{d.totalReal}</T>
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
