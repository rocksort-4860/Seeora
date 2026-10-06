/**
 * Today（默认页）：习惯列表；每条左侧序号 + 标题/详情 + 本周目标；右侧圆形按钮两步打卡
 * 列表底部常驻灰度虚线占位引导行；无习惯时额外大尺寸虚线引导卡
 *
 * 免费版上限（5 个习惯）的升级引导在**入口层**拦截：
 *   达上限时点击「添加习惯」不再展开表单（否则用户填完标题、点保存才被告知超限，
 *   白做一遍且体验像"点了没反应"），而是直接进买断页 /pro，并在该页说明原因。
 */
import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "@/components/ui/icon";
import { Gem, Plus } from "lucide-react-native";
import { useApp } from "@/store/app";
import { FREE_HABIT_LIMIT } from "@/lib/limits";
import { HabitRow } from "@/components/HabitRow";
import { Text as T } from "@/components/ui/text";

export default function TodayScreen() {
  const { dict: d, colors: c, habits, openHabitForm, openPro, pro, hydrated } = useApp();
  const insets = useSafeAreaInsets();

  // 免费版已满：pro 为 false（未买断且试用已结束）且习惯数达上限
  const atLimit = !pro && habits.length >= FREE_HABIT_LIMIT;
  // 上限数字走插值，避免文案把「5」写死、日后改常量却不改文案
  const limitTitle = d.habitLimitTitle.replace("{n}", String(FREE_HABIT_LIMIT));

  const open = () => {
    if (atLimit) {
      openPro("habitLimit");
      return;
    }
    openHabitForm(null);
  };

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
          accessibilityRole="button"
          accessibilityLabel={atLimit ? limitTitle : d.addHabit}
          className="h-10 w-10 items-center justify-center rounded-full"
          style={{ backgroundColor: c.accent }}
        >
          <Icon as={atLimit ? Gem : Plus} color="#FFFFFF" size={22} />
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

        {/* 常驻灰度虚线占位引导行；达免费版上限时切换为升级引导样式 */}
        <Pressable
          onPress={open}
          accessibilityRole="button"
          accessibilityLabel={atLimit ? `${limitTitle} · ${d.habitLimitBody}` : d.addHabit}
          className="mt-3 flex-row items-center gap-3 rounded-2xl border-2 border-dashed px-4 py-4"
          style={{ borderColor: atLimit ? c.accent : c.line2, opacity: 0.9 }}
        >
          <View
            className="h-9 w-9 items-center justify-center rounded-full border-2 border-dashed"
            style={{ borderColor: atLimit ? c.accent : c.line2 }}
          >
            <Icon as={atLimit ? Gem : Plus} color={atLimit ? c.accent : c.ink4} size={18} />
          </View>
          <View className="flex-1">
            <T className="text-base font-medium" style={{ color: atLimit ? c.ink : c.ink4 }}>
              {atLimit ? limitTitle : d.addHabit}
            </T>
            <T className="text-xs" style={{ color: atLimit ? c.accentText : c.ink4 }}>
              {atLimit ? d.habitLimitBody : d.addHabitHint}
            </T>
          </View>
        </Pressable>
      </ScrollView>
    </View>
  );
}
