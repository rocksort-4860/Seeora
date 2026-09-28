/**
 * BuyoutCard 买断说明卡（设置 › 数据安全）：展示「一次买断，永久属于你」+ 去买断按钮
 */
import React from "react";
import { Text, View } from "react-native";
import { useApp } from "@/store/app";
import { Text as T } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Gem } from "lucide-react-native";

export function BuyoutCard({ onPress }: { onPress: () => void }) {
  const { dict: d, colors: c } = useApp();
  return (
    <View className="px-4 py-3" style={{ borderBottomWidth: 1, borderColor: c.line }}>
      <View className="flex-row items-center gap-2">
        <Icon as={Gem} color={c.accent} size={18} />
        <T className="text-base font-semibold" style={{ color: c.ink }}>{d.buyoutTitle}</T>
      </View>
      <T className="mt-1.5 text-sm leading-6" style={{ color: c.ink3 }}>{d.buyoutBody}</T>
      <Button className="mt-3 h-10" style={{ backgroundColor: c.accent }} onPress={onPress}>
        <Text className="text-base font-bold" style={{ color: "#FFFFFF" }}>{d.dataBuyout}</Text>
      </Button>
    </View>
  );
}
