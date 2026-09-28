/**
 * 习惯详情页（v0.2 主视图）：螺旋圆环 + 横向时间流曲线 + 当日打卡 / 计划休息日 / 补签
 *  - 5.1 螺旋圆环：7 点一圈，半径逐圈递增；相邻实心才连线
 *  - 5.2 横向时间流曲线：累计只增不减，漏签段转点状虚线
 *  - 5.4 首次进入顶部引导小字，操作一次后不再显示
 *  - 七 仪式：第一层弧段闭合→整圈呼吸 1s；第二层刷新最长连续→外沿光晕 + 顶部小字 3s
 *           多层同时只触发最高层；补签不触发仪式；无音效无弹窗
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "@/components/ui/icon";
import { ChevronLeft, Moon, Undo2 } from "lucide-react-native";
import { SpiralRing } from "@/components/SpiralRing";
import { TimelineCurve } from "@/components/TimelineCurve";
import { useApp } from "@/store/app";
import { todayStr } from "@/lib/dates";
import { fmt } from "@/lib/i18n";
import { sget, sset, SK } from "@/lib/storage";
import { pressScale } from "@/lib/tokens";

export default function HabitDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const {
    colors: c, dict: d, lang, habits, streakOf, bestOf, nodesOf, curveOf,
    nodeIdxOf, nodeStateOf, freqOf, canRestOf, canMakeupOf,
    toggleToday, toggleRest, toggleBackfillDate, openShare, openHabitForm,
  } = useApp();
  const insets = useSafeAreaInsets();

  const habit = habits.find((h) => h.id === id);
  const today = todayStr();

  const [breatheNonce, setBreatheNonce] = useState(0);
  const [haloNonce, setHaloNonce] = useState(0);
  const [bestTip, setBestTip] = useState<string | null>(null);
  const [showHint, setShowHint] = useState(false);
  const tipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hintLoaded = useRef(false);

  /* 5.4：首次打开圆环视图显示引导小字 */
  useEffect(() => {
    if (hintLoaded.current) return;
    hintLoaded.current = true;
    let alive = true;
    void sget<boolean>(SK.ringHint, false).then((seen) => {
      if (alive) setShowHint(!seen);
    });
    return () => { alive = false; };
  }, []);

  const dismissHint = useCallback(() => {
    setShowHint(false);
    void sset(SK.ringHint, true);
  }, []);

  useEffect(() => () => { if (tipTimer.current) clearTimeout(tipTimer.current); }, []);

  const onCheck = useCallback(() => {
    if (habit) dismissHint();
    const h = habit;
    if (!h) return;
    const idx = nodeIdxOf(h, today);
    const prevFilled = idx > 0 && nodeStateOf(h, idx - 1) !== "miss";
    const nextFilled = nodeStateOf(h, idx + 1) !== "miss";
    const res = toggleToday(h.id);
    if (!res) return;
    // 仪式二层优先：刷新历史最长连续
    if (res.newBest) {
      setHaloNonce((n) => n + 1);
      setBestTip(fmt(d.newBest, { n: res.streak }));
      if (tipTimer.current) clearTimeout(tipTimer.current);
      tipTimer.current = setTimeout(() => setBestTip(null), 3000);
      return;
    }
    // 仪式一层：当前节点实心且与相邻实心节点弧线闭合
    if (prevFilled || nextFilled) setBreatheNonce((n) => n + 1);
  }, [habit, today, nodeIdxOf, nodeStateOf, toggleToday, dismissHint, d, fmt]);

  if (!habit) {
    return (
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: c.bg }}>
        <Text style={{ color: c.ink3 }}>{lang === "zh" ? "习惯不存在" : "Habit not found"}</Text>
      </View>
    );
  }

  const streak = streakOf(habit);
  const best = Math.max(bestOf(habit), streak);
  const cycles = Object.keys(habit.checkIns).length;
  const nodes = nodesOf(habit, 21);
  const curve = curveOf(habit, 60);
  const N = freqOf(habit);
  const doneToday = !!habit.checkIns[today];
  const restingToday = !!habit.rests?.[today];

  /** 过去 7 天补签位（由新到旧） */
  const makeupDays = Array.from({ length: 7 }, (_, i) => {
    const dt = new Date();
    dt.setDate(dt.getDate() - (i + 1));
    const date = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
    return { date, can: canMakeupOf(habit, date), has: !!habit.checkIns[date] };
  });

  return (
    <View className="flex-1" style={{ backgroundColor: c.bg }}>
      {/* 顶栏：返回 + 名称 */}
      <View
        className="flex-row items-center justify-between px-4 pb-2"
        style={{ paddingTop: insets.top + 10 }}
      >
        <Pressable onPress={() => router.back()} hitSlop={10} className="h-10 w-10 items-center justify-center rounded-full">
          <Icon as={ChevronLeft} color={c.ink} size={26} />
        </Pressable>
        <View className="flex-row items-center gap-2">
          <Text style={{ fontSize: 17 }}>{habit.emoji}</Text>
          <Text className="text-[17px] font-semibold" style={{ color: c.ink }}>
            {lang === "zh" ? habit.nameZh : habit.name}
          </Text>
        </View>
        <Pressable onPress={() => openHabitForm(habit)} hitSlop={10} className="h-10 w-10 items-center justify-center rounded-full">
          <Text className="text-[14px] font-semibold" style={{ color: c.ink3 }}>
            {lang === "zh" ? "编辑" : "Edit"}
          </Text>
        </Pressable>
      </View>

      {/* 仪式二层顶部小字（3 秒后自动淡褪） */}
      {bestTip ? (
        <View className="items-center pt-1">
          <Text className="text-[15px] font-medium" style={{ color: c.done }}>{bestTip}</Text>
        </View>
      ) : null}

      <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        {/* 5.4 首次引导 */}
        {showHint ? (
          <View className="mt-1 items-center">
            <Text className="text-xs" style={{ color: c.ink4 }}>{d.ringHint}</Text>
          </View>
        ) : null}

        {/* 5.1 螺旋圆环 */}
        <View className="mt-2 items-center">
          <SpiralRing nodes={nodes} colors={c} breatheNonce={breatheNonce} haloNonce={haloNonce} />
        </View>

        {/* 连续信息 */}
        <View className="mt-1 flex-row items-center justify-center gap-6">
          <Stat label={d.curStreak} value={streak} color={c.ink} labelColor={c.ink3} />
          <Stat label={d.bestStreak} value={best} color={c.ink} labelColor={c.ink3} />
          <Stat label={d.cycles} value={cycles} color={c.ink} labelColor={c.ink3} />
        </View>
        <Text className="mt-1 text-center text-xs" style={{ color: c.ink4 }}>
          {fmt(d.nodeDays, { n: N })}
        </Text>

        {/* 当日打卡：规范两种按钮语法 —— 未打卡=行动色胶囊，已打卡=幽灵胶囊 */}
        <Pressable
          onPress={onCheck}
          className="mt-5 items-center justify-center rounded-pill py-4"
          style={({ pressed }) => ({
            backgroundColor: doneToday ? "transparent" : c.accent,
            borderWidth: 1,
            borderColor: c.accent,
            minHeight: 44,
            transform: [{ scale: pressed ? pressScale : 1 }],
          })}
        >
          <Text className="text-[17px] font-semibold" style={{ color: doneToday ? c.accentText : c.inkInverse }}>
            {doneToday ? (lang === "zh" ? "今日已完成" : "Done today") : (lang === "zh" ? "完成今日打卡" : "Check in today")}
          </Text>
        </Pressable>

        {/* 计划休息日（只能提前或当天；历史禁止补设） */}
        <SectionTitle title={d.restTitle} />
        <Pressable
          onPress={() => { dismissHint(); toggleRest(habit.id, today); }}
          className="mt-2 flex-row items-center gap-3 rounded-lg px-4 py-3.5"
          style={{ backgroundColor: c.surface, borderWidth: 1, borderColor: restingToday ? c.rest : c.line }}
        >
          <Icon as={Moon} color={restingToday ? c.rest : c.ink3} size={20} />
          <Text className="flex-1 text-[17px]" style={{ color: restingToday ? c.ink3 : c.ink }}>
            {restingToday ? d.restToday : d.restAdd}
          </Text>
          <View className="h-6 w-11 rounded-full items-center justify-center" style={{ backgroundColor: restingToday ? c.rest : c.surface3 }}>
            <View className="h-5 w-5 rounded-full" style={{ backgroundColor: restingToday ? "#FFFFFF" : c.ink4, alignSelf: restingToday ? "flex-end" : "flex-start" }} />
          </View>
        </Pressable>
        {!canRestOf(habit, today) ? (
          <Text className="mt-1 text-xs" style={{ color: c.ink4 }}>{d.restLocked}</Text>
        ) : null}

        {/* 补签：过去 7 天（只能生成打卡，不能标休息） */}
        <SectionTitle title={d.makeupTitle} sub={d.makeupHint} />
        <View className="mt-2 flex-row items-center justify-between">
          {makeupDays.map((m) => {
            const locked = !m.can;
            return (
              <Pressable
                key={m.date}
                onPress={() => { if (!locked) toggleBackfillDate(habit.id, m.date); }}
                className="items-center"
                style={{ opacity: locked ? 0.4 : 1 }}
              >
                <View
                  className="h-9 w-9 items-center justify-center rounded-full"
                  style={{
                    backgroundColor: m.has ? c.done : "transparent",
                    borderWidth: 1.5,
                    borderColor: m.has ? c.done : c.blank,
                  }}
                >
                  {m.has ? (
                    <Icon as={Undo2} color="#FFFFFF" size={16} />
                  ) : (
                    <View className="h-2 w-2 rounded-full" style={{ backgroundColor: c.blank }} />
                  )}
                </View>
                <Text className="mt-1 text-[10px]" style={{ color: c.ink4 }}>{m.date.slice(5)}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* 5.2 横向时间流曲线 */}
        <SectionTitle title={d.trendTitle} />
        <View className="mt-2 items-center rounded-lg py-3" style={{ backgroundColor: c.surface }}>
          <TimelineCurve points={curve} colors={c} height={120} width={330} />
        </View>

        {/* 八：固定成就卡片入口 */}
        <Pressable
          onPress={() => openShare(habit.id)}
          className="mt-5 items-center justify-center rounded-pill py-4"
          style={({ pressed }) => ({
            backgroundColor: c.accent,
            minHeight: 44,
            transform: [{ scale: pressed ? pressScale : 1 }],
          })}
        >
          <Text className="text-[17px] font-semibold" style={{ color: c.inkInverse }}>{d.achieve}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function Stat({ label, value, color, labelColor }: { label: string; value: number; color: string; labelColor: string }) {
  return (
    <View className="items-center">
      <Text className="text-[21px] font-semibold" style={{ color, fontVariant: ["tabular-nums"] }}>{value}</Text>
      <Text className="text-[12px]" style={{ color: labelColor }}>{label}</Text>
    </View>
  );
}

function SectionTitle({ title, sub }: { title: string; sub?: string }) {
  const { colors: c } = useApp();
  return (
    <View className="mt-6">
      <Text className="text-[17px] font-semibold" style={{ color: c.ink }}>{title}</Text>
      {sub ? <Text className="mt-0.5 text-xs" style={{ color: c.ink4 }}>{sub}</Text> : null}
    </View>
  );
}
