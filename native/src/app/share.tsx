/**
 * Share 分享成就卡页（Seeora）：modal 路由 /share
 *  - 单个习惯成就卡 /share?habit=<id>：螺旋圆环 + 横向累计曲线 + 最长连续 + 累计周期 + 备选文案 + 底部签名
 *  - 全站成就总卡 /share（无 habit 参数）：累计天数
 *  - 所有素材本机生成，不上传；无关联 App / 社交 / 评论
 *  - 视觉规范（desing.md）：全系统唯一一处投影，只给「落在台面上的产品」—— 成就卡就是那个产品
 */
import React, { useState } from "react";
import { Pressable, ScrollView, Share, Text, TextInput, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";
import { X } from "lucide-react-native";
import { SpiralRing } from "@/components/SpiralRing";
import { TimelineCurve } from "@/components/TimelineCurve";
import { useApp } from "@/store/app";
import { Text as T } from "@/components/ui/text";
import { Icon } from "@/components/ui/icon";
import { appleElevation } from "@/lib/appleDesign";
import { pressScale, type Colors } from "@/lib/tokens";

const QUOTES = ["quote1", "quote2", "quote3", "quote4"] as const;

/** 规范：全系统唯一一处投影，只给「落在台面上的产品」—— 成就卡就是那个产品 */
const productShadow = appleElevation.product;

/** 卡片内一块数据：规范要求展示级数字 21px / 600（不做 700），标签 12px 弱色 */
function CardStat({ value, label, c }: { value: number; label: string; c: Colors }) {
  return (
    <View className="items-center">
      <Text className="text-[21px] font-semibold tabular-nums" style={{ color: c.ink }}>
        {value}
      </Text>
      <Text className="text-[12px]" style={{ color: c.ink4 }}>
        {label}
      </Text>
    </View>
  );
}

export default function ShareScreen() {
  const { habit: habitId } = useLocalSearchParams<{ habit?: string }>();
  const { dict: d, colors: c, lang, closeShare, habits, importedTotalAll, streakOf, bestOf, nodesOf, curveOf, showToast } = useApp();
  const insets = useSafeAreaInsets();

  const habit = habitId ? habits.find((h) => h.id === habitId) : undefined;
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [sign, setSign] = useState("");
  const [quoteIdx, setQuoteIdx] = useState(0);

  const realTotal = habits.reduce((acc, h) => acc + Object.keys(h.checkIns).length, 0);
  const imported = importedTotalAll();
  const total = realTotal + imported;

  const best = habit ? Math.max(bestOf(habit), streakOf(habit)) : total;
  const cycles = habit ? Object.keys(habit.checkIns).length : total;
  const quote = d[QUOTES[quoteIdx]];

  const headTitle = title.trim() || (habit ? habit.name : lang === "zh" ? "我的坚持" : "My streak");

  const buildMessage = () => {
    const days = `${d.bestStreak} ${best} · ${d.cycles} ${cycles}`;
    const footer = lang === "zh" ? "Seeora · 记录坚持，允许休息，所有坚持永不止步" : "Seeora · Track habits. Rest is allowed. Every day stays.";
    let lines: string[];
    if (habit) {
      lines = lang === "zh"
        ? [headTitle, quote, days, sign.trim(), note.trim(), footer]
        : [headTitle, quote, days, sign.trim(), note.trim(), footer];
    } else {
      lines = lang === "zh"
        ? [headTitle, `已在 Seeora 累计坚持 ${total} 天`, note.trim(), footer]
        : [headTitle, `Keep it up for ${total} days on Seeora`, note.trim(), footer];
    }
    return lines.filter(Boolean).join("\n");
  };

  const onSave = async () => {
    await Clipboard.setStringAsync(buildMessage());
    showToast(d.shareCopied, true);
  };
  const onShare = async () => {
    try {
      await Share.share({ message: buildMessage(), title: "Seeora" });
    } catch {
      /* 用户取消分享，忽略 */
    }
  };

  return (
    <View className="flex-1" style={{ backgroundColor: c.bg }}>
      <View className="flex-row items-center justify-between px-5 pb-2" style={{ paddingTop: insets.top + 16 }}>
        <Text className="text-[24px] font-semibold" style={{ color: c.ink }}>
          {d.shareTitle}
        </Text>
        <Pressable
          onPress={closeShare}
          hitSlop={8}
          className="h-9 w-9 items-center justify-center rounded-full"
          style={{ backgroundColor: c.surface2 }}
          accessibilityLabel={d.close}
        >
          <Icon as={X} color={c.ink2} size={18} />
        </Pressable>
      </View>

      <ScrollView className="flex-1 px-5" contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {/* 成就卡：白面 + 全系统唯一投影（规范里“落在台面上的产品”） */}
        <View className="mt-2 items-center rounded-lg px-6 py-6" style={{ backgroundColor: c.surface, ...productShadow }}>
          <Text className="text-[12px] uppercase tracking-wide" style={{ color: c.ink4 }}>
            Seeora
          </Text>
          <Text className="mt-1 text-center text-[24px] font-semibold" style={{ color: c.ink }}>
            {headTitle}
          </Text>

          {habit ? (
            <>
              {/* 该习惯的螺旋圆环（白底直放，不再套蓝底卡片） */}
              <View className="mt-3 items-center">
                <SpiralRing nodes={nodesOf(habit, 14)} colors={c} size={172} />
              </View>
              {/* 该习惯的累计曲线 */}
              <View className="mt-1 items-center">
                <TimelineCurve points={curveOf(habit, 45)} colors={c} height={88} width={282} />
              </View>
              <View className="mt-3 flex-row items-center justify-center gap-8">
                <CardStat value={best} label={d.bestStreak} c={c} />
                <CardStat value={cycles} label={d.cycles} c={c} />
              </View>
              <Text className="mt-4 text-center text-[17px]" style={{ color: c.ink }}>
                {quote}
              </Text>
            </>
          ) : (
            <>
              <Text className="mt-3 text-[28px] font-semibold tabular-nums leading-none" style={{ color: c.ink }}>
                {total}
              </Text>
              <Text className="mt-1 text-[12px]" style={{ color: c.ink4 }}>
                {lang === "zh" ? "累计坚持天数" : "total days"}
              </Text>
            </>
          )}

          {sign.trim() ? (
            <Text className="mt-3 text-center text-[12px]" style={{ color: c.ink4 }}>
              —— {sign.trim()}
            </Text>
          ) : null}
          {note.trim() ? (
            <Text className="mt-2 text-center text-[12px]" style={{ color: c.ink4 }}>
              {note.trim()}
            </Text>
          ) : null}
        </View>

        {/* 编辑 */}
        <View className="mt-4 gap-3">
          <View className="rounded-xl px-4 py-3" style={{ backgroundColor: c.surface }}>
            <T className="mb-1 text-[12px] uppercase" style={{ color: c.ink4 }}>
              {d.shareMainTitle}
            </T>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder={d.shareMainTitle}
              placeholderTextColor={c.ink4}
              className="text-[17px]"
              style={{ color: c.ink }}
            />
          </View>

          {habit ? (
            <>
              <View className="rounded-xl px-4 py-3" style={{ backgroundColor: c.surface }}>
                <T className="mb-2 text-[12px] uppercase" style={{ color: c.ink4 }}>
                  {d.quoteLabel}
                </T>
                {QUOTES.map((q, i) => (
                  <Pressable
                    key={q}
                    onPress={() => setQuoteIdx(i)}
                    className="flex-row items-center gap-2 py-1.5"
                  >
                    <View
                      className="h-4 w-4 rounded-full border"
                      style={{ borderColor: c.line2, backgroundColor: quoteIdx === i ? c.accent : "transparent" }}
                    />
                    <T className="text-[14px]" style={{ color: quoteIdx === i ? c.ink : c.ink4 }}>
                      {d[q]}
                    </T>
                  </Pressable>
                ))}
              </View>
              <View className="rounded-xl px-4 py-3" style={{ backgroundColor: c.surface }}>
                <T className="mb-1 text-[12px] uppercase" style={{ color: c.ink4 }}>
                  {d.signLabel}
                </T>
                <TextInput
                  value={sign}
                  onChangeText={setSign}
                  placeholder={d.signLabel}
                  placeholderTextColor={c.ink4}
                  className="text-[17px]"
                  style={{ color: c.ink }}
                />
              </View>
            </>
          ) : null}

          <View className="rounded-xl px-4 py-3" style={{ backgroundColor: c.surface }}>
            <T className="mb-1 text-[12px] uppercase" style={{ color: c.ink4 }}>
              {d.shareNote}
            </T>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder={d.shareNote}
              placeholderTextColor={c.ink4}
              className="text-[17px]"
              style={{ color: c.ink }}
              multiline
            />
          </View>
        </View>

        {/* 动作：规范按钮语法 —— 主 CTA = 行动色胶囊；次级 = 幽灵胶囊（透明底 + 1px 强调色描边） */}
        <View className="mt-5 gap-2">
          <Pressable
            onPress={() => {
              void onSave();
            }}
            className="w-full items-center justify-center rounded-pill"
            style={({ pressed }) => ({
              backgroundColor: c.accent,
              minHeight: 48,
              transform: [{ scale: pressed ? pressScale : 1 }],
            })}
          >
            <Text className="text-[17px] font-semibold" style={{ color: c.inkInverse }}>
              {d.shareSave}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => {
              void onShare();
            }}
            className="w-full items-center justify-center rounded-pill border"
            style={({ pressed }) => ({
              backgroundColor: "transparent",
              borderColor: c.accent,
              minHeight: 48,
              transform: [{ scale: pressed ? pressScale : 1 }],
            })}
          >
            <Text className="text-[17px]" style={{ color: c.accentText }}>
              {d.shareShare}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}
