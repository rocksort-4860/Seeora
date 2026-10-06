/**
 * Onboarding 首启引导：3 张理念卡，左右滑动 + 跳过 + 完成；完成后进入 Today
 * 仅当 AppProvider 中 visited=false 时由 index.tsx 叠加显示
 */
import React, { useRef, useState } from "react";
import { Pressable, ScrollView, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "@/store/app";
import { Button } from "@/components/ui/button";
import { Text as T } from "@/components/ui/text";
import { cn } from "@/lib/utils";

export function Onboarding() {
  const { dict: d, colors: c, enterApp } = useApp();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [page, setPage] = useState(0);
  const ref = useRef<ScrollView>(null);

  const cards = [
    { t: d.ob1T, b: d.ob1B, icon: "🌿" },
    { t: d.ob2T, b: d.ob2B, icon: "🔁" },
    { t: d.ob3T, b: d.ob3B, icon: "💎" },
  ];

  const go = (i: number) => {
    const next = Math.max(0, Math.min(cards.length - 1, i));
    ref.current?.scrollTo({ x: next * width, animated: true });
    setPage(next);
  };

  const finish = () => enterApp();

  return (
    <View
      className="absolute inset-0 z-50"
      style={{ backgroundColor: c.bg }}
      pointerEvents="auto"
    >
      <View className="flex-row items-center justify-between px-5" style={{ paddingTop: insets.top + 12, height: 56 }}>
        <Text className="text-[21px] font-extrabold" style={{ color: c.ink }}>{d.brand}</Text>
        <Pressable onPress={finish} hitSlop={12}>
          <Text className="text-base font-medium" style={{ color: c.accent }}>{d.obSkip}</Text>
        </Pressable>
      </View>

      <ScrollView
        ref={ref}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        className="flex-1"
        onMomentumScrollEnd={(e) => {
          const i = Math.round(e.nativeEvent.contentOffset.x / width);
          setPage(i);
        }}
      >
        {cards.map((card, i) => (
          <View key={i} className="items-center justify-center px-8" style={{ width }}>
            <Text style={{ fontSize: 64 }}>{card.icon}</Text>
            <T className="mt-6 text-center text-[26px] font-extrabold" style={{ color: c.ink }}>{card.t}</T>
            <T className="mt-4 text-center text-base leading-7" style={{ color: c.ink2 }}>{card.b}</T>
          </View>
        ))}
      </ScrollView>

      {/* 圆点 */}
      <View className="flex-row items-center justify-center gap-2" style={{ paddingBottom: 12 }}>
        {cards.map((_, i) => (
          <View
            key={i}
            className={cn("h-2 rounded-full", page === i ? "w-6" : "w-2")}
            style={{ backgroundColor: page === i ? c.accent : c.line2 }}
          />
        ))}
      </View>

      <View className="px-6" style={{ paddingBottom: insets.bottom + 20 }}>
        <Button
          className="h-12"
          style={{ backgroundColor: c.accent }}
          onPress={() => (page === cards.length - 1 ? finish() : go(page + 1))}
        >
          <Text className="text-base font-bold" style={{ color: "#FFFFFF" }}>
            {page === cards.length - 1 ? d.obDone : d.obNext}
          </Text>
        </Button>
      </View>
    </View>
  );
}
