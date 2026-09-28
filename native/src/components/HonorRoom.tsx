/**
 * HonorRoom 荣誉室：展示迁移来的历史成果（独立留存，不计入周达标/热力图）
 * 有记录时由 History 置顶；无记录时由 History 沉底并显示占位添加行
 */
import React from "react";
import { Pressable, Text, View } from "react-native";
import { useApp } from "@/store/app";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Text as T } from "@/components/ui/text";
import { Icon } from "@/components/ui/icon";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react-native";
import { cn } from "@/lib/utils";

export function HonorRoom() {
  const { honors, colors: c, dict: d, openHonorForm, lang } = useApp();

  if (honors.length === 0) {
    return (
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-[21px] font-extrabold">{d.hallOfFame}</CardTitle>
        </CardHeader>
        <Pressable
          onPress={() => openHonorForm(null)}
          className="mt-2 flex-row items-center gap-3 rounded-xl border-2 border-dashed px-4 py-3"
          style={{ borderColor: c.line2 }}
        >
          <Icon as={Plus} color={c.ink4} size={18} />
          <T className="text-base font-medium" style={{ color: c.ink4 }}>{d.hallEmpty}</T>
        </Pressable>
      </Card>
    );
  }

  return (
    <Card className="mt-4">
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-[21px] font-extrabold">{d.hallOfFame}</CardTitle>
        <Pressable onPress={() => openHonorForm(null)} hitSlop={10}>
          <Icon as={Plus} color={c.accent} size={20} />
        </Pressable>
      </CardHeader>
      <View className="mt-2 gap-2">
        {honors.map((h) => (
          <Pressable
            key={h.id}
            onPress={() => openHonorForm(h)}
            className="flex-row items-center justify-between rounded-xl px-3 py-2.5"
            style={{ backgroundColor: c.surface2 }}
          >
            <View className="flex-1">
              <T className="text-base font-semibold" style={{ color: c.ink }}>{lang === "zh" ? h.titleZh : h.title}</T>
              <T className="mt-0.5 text-xs" style={{ color: c.ink3 }}>
                {h.source ? h.source + " · " : ""}{h.days} {lang === "zh" ? "天" : "days"}
                {h.category ? " · " + h.category : ""}
              </T>
            </View>
            <Badge className="ml-2" style={{ backgroundColor: c.accentWash }}>
              <T className="text-xs font-semibold" style={{ color: c.accentText }}>{h.days}d</T>
            </Badge>
          </Pressable>
        ))}
      </View>
    </Card>
  );
}
