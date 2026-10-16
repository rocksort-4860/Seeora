/**
 * 习惯详情页（v0.2 主视图）：螺旋圆环 + 横向时间流曲线 + 当日打卡 / 计划休息日 / 补签
 *  - 5.1 螺旋圆环：7 点一圈，半径逐圈递增；相邻实心才连线
 *  - 5.2 横向时间流曲线：累计只增不减，漏签段转点状虚线
 *  - 5.4 首次进入顶部引导小字，操作一次后不再显示
 *  - 七 仪式：第一层弧段闭合→整圈呼吸 1s；第二层刷新最长连续→外沿光晕 + 顶部小字 3s
 *           多层同时只触发最高层；补签不触发仪式；无音效无弹窗
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "@/components/ui/icon";
import { ChevronLeft, Gem, Moon, Undo2 } from "lucide-react-native";
import { SpiralRing } from "@/components/SpiralRing";
import { TimelineCurve } from "@/components/TimelineCurve";
import { useApp } from "@/store/app";
import { FREE_HABIT_LIMIT } from "@/lib/limits";
import { todayStr } from "@/lib/dates";
import { fmt } from "@/lib/i18n";
import { sget, sset, SK } from "@/lib/storage";
import { pressScale } from "@/lib/tokens";
import { Text as T } from "@/components/ui/text";

export default function HabitDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const {
    colors: c, dict: d, lang, habits, streakOf, bestOf, nodesOf, curveOf,
    nodeIdxOf, nodeStateOf, freqOf, canRestOf, canMakeupOf,
    toggleToday, toggleRest, toggleBackfillDate, openShare, openHabitForm,
    deleteHabitNow, archiveHabit,
    frozenIds, openPro,
  } = useApp();
  const insets = useSafeAreaInsets();

  const habit = habits.find((h) => h.id === id);
  const today = todayStr();

  const [breatheNonce, setBreatheNonce] = useState(0);
  const [haloNonce, setHaloNonce] = useState(0);
  const [bestTip, setBestTip] = useState<string | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
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
      <View style={[styles.notFound, { backgroundColor: c.bg }]}>
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
  /** 免费版冻结（试用结束且未买断、且该习惯超出上限）：只看不改 */
  const frozen = frozenIds.has(habit.id);

  /** 过去 7 天补签位（由新到旧） */
  const makeupDays = Array.from({ length: 7 }, (_, i) => {
    const dt = new Date();
    dt.setDate(dt.getDate() - (i + 1));
    const date = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
    return { date, can: canMakeupOf(habit, date), has: !!habit.checkIns[date] };
  });

  return (
    <View style={[styles.flex1, { backgroundColor: c.bg }]}>
      {/* 顶栏：返回 + 名称 */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.iconBtn}>
          <Icon as={ChevronLeft} color={c.ink} size={26} />
        </Pressable>
        <View style={styles.nameRow}>
          <Text style={{ fontSize: 17 }}>{habit.emoji}</Text>
          <Text style={[styles.nameText, { color: c.ink }]}>
            {lang === "zh" ? habit.nameZh : habit.name}
          </Text>
        </View>
        <Pressable onPress={() => openHabitForm(habit)} hitSlop={10} style={styles.iconBtn}>
          <Text style={[styles.editText, { color: c.ink3 }]}>
            {lang === "zh" ? "编辑" : "Edit"}
          </Text>
        </Pressable>
      </View>

      {/* 仪式二层顶部小字（3 秒后自动淡褪） */}
      {bestTip ? (
        <View style={styles.tipWrap}>
          <Text style={[styles.tipText, { color: c.done }]}>{bestTip}</Text>
        </View>
      ) : null}

      <ScrollView style={[styles.flex1, styles.scrollH]} contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        {/* 5.4 首次引导 */}
        {showHint ? (
          <View style={styles.hintWrap}>
            <Text style={[styles.hintText, { color: c.ink4 }]}>{d.ringHint}</Text>
          </View>
        ) : null}

        {/* 冻结横幅：数据完整保留，但写操作（打卡/休息/补签/编辑）全部不可用。
            必须**在界面上说明原因并给出出路** —— 只拦操作不给解释 = 用户以为 App 坏了。 */}
        {frozen ? (
          <View
            accessibilityLiveRegion="polite"
            style={[styles.banner, { backgroundColor: c.surface, borderWidth: 1, borderColor: c.accentInk }]}
          >
            <Icon as={Gem} color={c.accent} size={18} />
            <View style={styles.flex1}>
              <T style={[styles.bannerTitle, { color: c.ink }]}>{d.habitFrozen}</T>
              <T style={[styles.bannerBody, { color: c.ink2 }]}>
                {fmt(d.habitFrozenTip, { n: FREE_HABIT_LIMIT })}
              </T>
              <Pressable
                onPress={() => openPro("habitLimit")}
                hitSlop={8}
                accessibilityRole="button"
                style={[styles.buyPill, { backgroundColor: c.accentInk }]}
              >
                <Text style={styles.buyPillText}>{d.proBuy}</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {/* 5.1 螺旋圆环 */}
        <View style={styles.ringWrap}>
          <SpiralRing nodes={nodes} colors={c} breatheNonce={breatheNonce} haloNonce={haloNonce} />
        </View>

        {/* 连续信息 */}
        <View style={styles.statsRow}>
          <Stat label={d.curStreak} value={streak} color={c.ink} labelColor={c.ink3} />
          <Stat label={d.bestStreak} value={best} color={c.ink} labelColor={c.ink3} />
          <Stat label={d.cycles} value={cycles} color={c.ink} labelColor={c.ink3} />
        </View>
        <Text style={[styles.nodeDays, { color: c.ink4 }]}>
          {fmt(d.nodeDays, { n: N })}
        </Text>

        {/* 当日打卡：规范两种按钮语法 —— 未打卡=行动色胶囊，已打卡=幽灵胶囊。
            ★ 按压反馈用静态 style + onPressIn/Out，iOS/Android 表现一致。 */}
        <ActionPill
          label={frozen
            ? d.habitFrozen
            : doneToday
              ? (lang === "zh" ? "今日已完成" : "Done today")
              : (lang === "zh" ? "完成今日打卡" : "Check in today")}
          onPress={onCheck}
          bg={frozen ? c.surface2 : doneToday ? "transparent" : c.accent}
          border={frozen ? c.line2 : c.accent}
          textColor={frozen ? c.inkGroup : doneToday ? c.accentText : c.inkInverse}
          style={styles.mt5}
        />

        {/* 计划休息日（只能提前或当天；历史禁止补设） */}
        <SectionTitle title={d.restTitle} />
        <Pressable
          onPress={() => { dismissHint(); toggleRest(habit.id, today); }}
          style={[styles.restRow, { backgroundColor: c.surface, borderWidth: 1, borderColor: restingToday ? c.rest : c.line }]}
        >
          <Icon as={Moon} color={restingToday ? c.rest : c.ink3} size={20} />
          <Text style={[styles.restLabel, { color: restingToday ? c.ink3 : c.ink }]}>
            {restingToday ? d.restToday : d.restAdd}
          </Text>
          <View style={[styles.restTrack, { backgroundColor: restingToday ? c.rest : c.surface3 }]}>
            <View style={[styles.restThumb, { backgroundColor: restingToday ? "#FFFFFF" : c.ink4, alignSelf: restingToday ? "flex-end" : "flex-start" }]} />
          </View>
        </Pressable>
        {!canRestOf(habit, today) ? (
          <Text style={[styles.restLocked, { color: c.ink4 }]}>{d.restLocked}</Text>
        ) : null}

        {/* 补签：过去 7 天（只能生成打卡，不能标休息） */}
        <SectionTitle title={d.makeupTitle} sub={d.makeupHint} />
        <View style={styles.makeupRow}>
          {makeupDays.map((m) => {
            const locked = !m.can;
            return (
              <Pressable
                key={m.date}
                onPress={() => { if (!locked) toggleBackfillDate(habit.id, m.date); }}
                style={[styles.center, { opacity: locked ? 0.4 : 1 }]}
              >
                <View
                  style={[styles.makeupCircle, {
                    backgroundColor: m.has ? c.done : "transparent",
                    borderWidth: 1.5,
                    borderColor: m.has ? c.done : c.blank,
                  }]}
                >
                  {m.has ? (
                    <Icon as={Undo2} color="#FFFFFF" size={16} />
                  ) : (
                    <View style={[styles.makeupDot, { backgroundColor: c.blank }]} />
                  )}
                </View>
                <Text style={[styles.makeupDate, { color: c.ink4 }]}>{m.date.slice(5)}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* 5.2 横向时间流曲线 */}
        <SectionTitle title={d.trendTitle} />
        <View style={[styles.trendCard, { backgroundColor: c.surface }]}>
          <TimelineCurve points={curve} colors={c} height={120} width={330} />
        </View>

        {/* 八：固定成就卡片入口 */}
        <ActionPill
          label={d.achieve}
          onPress={() => openShare(habit.id)}
          bg={c.accent}
          border={c.accent}
          textColor={c.inkInverse}
          style={styles.mt5}
        />
      </ScrollView>

      {/* 底部操作栏：删除 / 归档（iOS 经典「破坏性操作就地二次确认」）。
          这两个是显式的管理动作，不计入「打卡 / 补签 / 标休息 / 编辑」的冻结拦截。 */}
      <View
        style={[styles.bottomBar, { paddingBottom: insets.bottom + 12, borderTopWidth: 1, borderTopColor: c.line }]}
      >
        {confirmDel ? (
          <>
            <Pressable
              onPress={() => setConfirmDel(false)}
              accessibilityRole="button"
              accessibilityLabel={d.no}
              style={[styles.barBtn, { backgroundColor: c.surface2 }]}
            >
              <Text style={{ color: c.ink, fontSize: 16, fontWeight: "600" }}>{d.no}</Text>
            </Pressable>
            <Pressable
              onPress={() => { deleteHabitNow(habit.id); router.back(); }}
              accessibilityRole="button"
              accessibilityLabel={d.yes}
              style={[styles.barBtn, { backgroundColor: c.danger }]}
            >
              <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "700" }}>{d.yes}</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Pressable
              onPress={() => archiveHabit(habit.id, !habit.isArchived)}
              accessibilityRole="button"
              accessibilityLabel={habit.isArchived ? d.unarchive : d.archive}
              style={[styles.barBtn, { backgroundColor: c.surface2 }]}
            >
              <Text style={{ color: c.ink, fontSize: 16, fontWeight: "600" }}>
                {habit.isArchived ? d.unarchive : d.archive}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setConfirmDel(true)}
              accessibilityRole="button"
              accessibilityLabel={d.delete}
              style={[styles.barBtn, { backgroundColor: c.danger }]}
            >
              <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "700" }}>{d.delete}</Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

/**
 * 胶囊行动按钮（静态 style + 自管按压态）。
 * ★ 不用 `style={({pressed}) => …}`：用 onPressIn/Out 自行记录按压态，iOS/Android 表现一致。
 */
function ActionPill({
  label, onPress, bg, border, textColor, style,
}: {
  label: string;
  onPress: () => void;
  bg: string;
  border: string;
  textColor: string;
  style?: StyleProp<ViewStyle>;
}) {
  const [pressed, setPressed] = useState(false);
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      accessibilityRole="button"
      style={[styles.pill, style, {
        backgroundColor: bg,
        borderWidth: 1,
        borderColor: border,
        minHeight: 44,
        transform: [{ scale: pressed ? pressScale : 1 }],
      }]}
    >
      <Text style={[styles.pillText, { color: textColor }]}>{label}</Text>
    </Pressable>
  );
}

function Stat({ label, value, color, labelColor }: { label: string; value: number; color: string; labelColor: string }) {
  return (
    <View style={styles.center}>
      <Text style={[styles.statValue, { color, fontVariant: ["tabular-nums"] }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: labelColor }]}>{label}</Text>
    </View>
  );
}

function SectionTitle({ title, sub }: { title: string; sub?: string }) {
  const { colors: c } = useApp();
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: c.ink }]}>{title}</Text>
      {sub ? <Text style={[styles.sectionSub, { color: c.ink4 }]}>{sub}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex1: { flex: 1 },
  notFound: { flex: 1, alignItems: "center", justifyContent: "center" },
  scrollH: { paddingHorizontal: 16 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  iconBtn: { height: 40, width: 40, alignItems: "center", justifyContent: "center", borderRadius: 9999 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  nameText: { fontSize: 17, fontWeight: "600" },
  editText: { fontSize: 14, fontWeight: "600" },
  tipWrap: { alignItems: "center", paddingTop: 4 },
  tipText: { fontSize: 15, fontWeight: "500" },
  hintWrap: { marginTop: 4, alignItems: "center" },
  hintText: { fontSize: 12 },
  banner: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  bannerTitle: { fontSize: 15, fontWeight: "600" },
  bannerBody: { marginTop: 4, fontSize: 14, lineHeight: 20 },
  buyPill: { marginTop: 8, alignSelf: "flex-start", borderRadius: 9999, paddingHorizontal: 16, paddingVertical: 8 },
  buyPillText: { fontSize: 14, fontWeight: "700", color: "#FFFFFF" },
  ringWrap: { marginTop: 8, alignItems: "center" },
  statsRow: { marginTop: 4, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 24 },
  nodeDays: { marginTop: 4, textAlign: "center", fontSize: 12 },
  mt5: { marginTop: 20 },
  pill: { alignItems: "center", justifyContent: "center", borderRadius: 9999, paddingVertical: 16 },
  pillText: { fontSize: 17, fontWeight: "600" },
  restRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  restLabel: { flex: 1, fontSize: 17 },
  restTrack: { height: 24, width: 44, borderRadius: 9999, alignItems: "center", justifyContent: "center" },
  restThumb: { height: 20, width: 20, borderRadius: 9999 },
  restLocked: { marginTop: 4, fontSize: 12 },
  makeupRow: { marginTop: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  center: { alignItems: "center" },
  makeupCircle: { height: 36, width: 36, alignItems: "center", justifyContent: "center", borderRadius: 9999 },
  makeupDot: { height: 8, width: 8, borderRadius: 9999 },
  makeupDate: { marginTop: 4, fontSize: 10 },
  trendCard: { marginTop: 8, alignItems: "center", borderRadius: 8, paddingVertical: 12 },
  bottomBar: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingTop: 12 },
  barBtn: { flex: 1, alignItems: "center", justifyContent: "center", borderRadius: 9999, paddingVertical: 12 },
  statValue: { fontSize: 21, fontWeight: "600" },
  statLabel: { fontSize: 12 },
  section: { marginTop: 24 },
  sectionTitle: { fontSize: 17, fontWeight: "600" },
  sectionSub: { marginTop: 2, fontSize: 12 },
});
