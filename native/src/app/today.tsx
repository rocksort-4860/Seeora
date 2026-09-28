/**
 * Today（默认页）：习惯列表；每条左侧序号 + 标题/详情 + 本周目标；右侧圆形按钮两步打卡
 * 列表底部常驻灰度虚线占位引导行；无习惯时额外大尺寸虚线引导卡
 */
import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "@/components/ui/icon";
import { Plus } from "lucide-react-native";
import { useApp } from "@/store/app";
import { HabitRow } from "@/components/HabitRow";
import { Text as T } from "@/components/ui/text";
import { cn } from "@/lib/utils";

export default function TodayScreen() {
  const { dict: d, colors: c, habits, openHabitForm, hydrated } = useApp();
  const insets = useSafeAreaInsets();

  const open = () => openHabitForm(null);

  return (
    <View className="flex-1" style={{ backgroundColor: c.bg }}>
      {/* 顶部标题栏 */}
      <View
        className="flex-row items-end justify-between px-5 pb-3"
        style={{ paddingTop: insets.top + 16 }}
      >
        <View>
          <Text className="text-[28px] font-extrabold tracking-tight" style={{ color: c.ink }}>{d.brand}</Text>
          <T className="text-sm" style={{ color: c.ink3 }}>{d.slogan}</T>
        </View>
        <Pressable
          onPress={open}
          hitSlop={12}
          className="h-10 w-10 items-center justify-center rounded-full"
          style={{ backgroundColor: c.accent }}
        >
          <Icon as={Plus} color="#FFFFFF" size={22} />
        </Pressable>
      </View>

      <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        {hydrated && habits.length === 0 && (
          <Pressable
            onPress={open}
            className="mt-6 items-center justify-center rounded-2xl border-2 border-dashed px-6 py-14"
            style={{ borderColor: c.line2 }}
          >
            <Text style={{ fontSize: 46 }}>🌱</Text>
            <T className="mt-3 text-center text-[19px] font-extrabold" style={{ color: c.ink2 }}>{d.emptyTitle}</T>
            <T className="mt-2 text-center text-base" style={{ color: c.ink3 }}>{d.emptySub}</T>
          </Pressable>
        )}

        {habits.map((h) => (
          <HabitRow key={h.id} habit={h} />
        ))}

        {/* 常驻灰度虚线占位引导行 */}
        <Pressable
          onPress={open}
          className="mt-3 flex-row items-center gap-3 rounded-2xl border-2 border-dashed px-4 py-4"
          style={{ borderColor: c.line2, opacity: 0.9 }}
        >
          <View
            className="h-9 w-9 items-center justify-center rounded-full border-2 border-dashed"
            style={{ borderColor: c.line2 }}
          >
            <Icon as={Plus} color={c.ink4} size={18} />
          </View>
          <View className="flex-1">
            <T className="text-base font-medium" style={{ color: c.ink4 }}>{d.addHabit}</T>
            <T className="text-xs" style={{ color: c.ink4 }}>{d.addHabitHint}</T>
          </View>
        </Pressable>
      </ScrollView>
    </View>
  );
}
