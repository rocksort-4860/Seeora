/**
 * ModalHost：按 store 弹层状态渲染各弹层
 * 含 HabitForm（内嵌删除二次确认）/ HonorForm / ExportSheet / 7 天补录 / 抹除二次确认
 * （Pro 买断页与 Share 分享卡为独立 modal 路由，见 app/pro.tsx、app/share.tsx）
 *
 * ★ 容器来源：RockSort 已验证实现（922 工程）——统一用自研 <Sheet>（RN 原生 Modal），
 *   不用 rn-primitives Dialog。Dialog 的 Overlay 在 iOS 上被 FullWindowOverlay 提升到
 *   独立 UIWindow，会把根层全局 Toast 整片盖住；而下面的弹层反馈全是 showToast：
 *     · 补录：单日锁定提示 / 取消打卡提示（弹层全程开着）
 *     · 抹除确认：已抹掉全部数据
 *
 * ★ 2026-10-06（#10）：删除确认不再走「关表单 → 开确认层」的链式弹层。
 *   现在由 HabitForm 内部就地二次确认（components/HabitForm.tsx 的 DeleteConfirm），
 *   原先那个独立的 ConfirmDialog 已删除（它就是「两个原生 Modal 并存」的元凶）。
 *
 * ★★ 2026-10-06 修复「退场动画不播」（台账 P1-4）：
 *   此前每个弹层都写成 `if (!visible) return null;` + `<Sheet visible>`（恒为 true）——
 *   组件在 visible 变 false 的**同一帧**就被 React 卸载，Sheet 根本没机会看到
 *   `visible=false`，于是 270ms 的退场动画（下滑 / 淡出）永远不播，弹层是「啪」地消失。
 *   修法：**去掉提前 return**，把真实布尔值传给 Sheet，由 Sheet 自己维持挂载直到动画结束。
 *   （Sheet 已保证：动画期间仍持有仲裁代号，期间新弹层会等它让位 —— 不会出现两个原生 Modal。）
 *   ★ 副作用（必须处理）：退场那 270ms 里数据源已被清空（如 backfillHabitId=null），
 *     直接读状态会让弹层内容**闪空**。所以依赖数据的弹层要缓存「最后一次有效值」。
 */
import React, { useRef } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useApp } from "@/store/app";
import type { Habit } from "@/store/app";
import { Sheet, SheetHeader } from "@/components/Sheet";
import { Button } from "@/components/ui/button";
import { Text as T } from "@/components/ui/text";
import { Icon } from "@/components/ui/icon";
import { Check, Lock, Trash2 } from "lucide-react-native";
import { fmtDate } from "@/lib/dates";
import { HabitForm } from "@/components/HabitForm";
import { HonorForm } from "@/components/HonorForm";
import { ExportSheet } from "@/components/ExportSheet";

const WK = ["日", "一", "二", "三", "四", "五", "六"];

export function ModalHost() {
  return (
    <>
      <HabitForm />
      <HonorForm />
      <ExportSheet />
      <Backfill />
      <WipeDialog />
    </>
  );
}

/* ===================== 7 天补录 ===================== */
function Backfill() {
  const { dict: d, colors: c, habits, backfillHabitId, closeBackfill, toggleBackfillDate, lang } = useApp();
  /* 退场期间数据源已清空（backfillHabitId=null），用 ref 兜住最后一次有效习惯，
   * 否则关闭动画那 270ms 里弹层内容会瞬间闪空。 */
  const lastRef = useRef<Habit | null>(null);
  const found = backfillHabitId ? habits.find((h) => h.id === backfillHabitId) : undefined;
  if (found) lastRef.current = found;
  const habit = found ?? lastRef.current;
  const visible = !!backfillHabitId;

  const days: string[] = [];
  for (let i = 0; i <= 7; i++) {
    const dt = new Date();
    dt.setDate(dt.getDate() - i);
    days.push(fmtDate(dt));
  }

  return (
    <Sheet visible={visible} onClose={closeBackfill} center>
      <SheetHeader title={d.backfillTitle} onClose={closeBackfill} closeLabel={d.close} />
      {habit ? (
        <>
          <T className="mb-3 text-sm" style={{ color: c.ink3 }}>{d.backfillSub}</T>

          {/* flexShrink:1 —— 8 行在小屏上会顶到弹层 88% 上限，超出部分滚动 */}
          <ScrollView style={{ flexShrink: 1 }} showsVerticalScrollIndicator={false}>
            <View className="gap-2">
              {days.map((date) => {
                const dt = new Date(date + "T00:00:00");
                const checked = !!habit.checkIns[date];
                const diff = Math.floor((new Date(fmtDate(new Date()) + "T00:00:00").getTime() - dt.getTime()) / 86400000);
                const locked = diff > 7;
                return (
                  <Pressable
                    key={date}
                    disabled={locked}
                    onPress={() => toggleBackfillDate(habit.id, date)}
                    className="flex-row items-center justify-between rounded-xl px-4 py-3"
                    style={{ backgroundColor: c.surface2, opacity: locked ? 0.5 : 1 }}
                  >
                    <View className="flex-row items-center gap-2">
                      <T className="text-base font-medium" style={{ color: c.ink }}>{lang === "zh" ? "周" + WK[dt.getDay()] : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][dt.getDay()]}</T>
                      <T className="text-sm" style={{ color: c.ink3 }}>{date.slice(5)}</T>
                    </View>
                    <View className="h-7 w-7 items-center justify-center rounded-full" style={{ backgroundColor: checked ? c.accentInk : c.surface3 }}>
                      {checked ? <Icon as={Check} color="#fff" size={16} /> : locked ? <Icon as={Lock} color={c.ink4} size={14} /> : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>

          <Button className="mt-4 h-12" style={{ backgroundColor: c.accentInk }} onPress={closeBackfill}>
            <Text className="text-base font-bold" style={{ color: "#fff" }}>{d.close}</Text>
          </Button>
        </>
      ) : null}
    </Sheet>
  );
}

/* ===================== 抹除二次确认 ===================== */
function WipeDialog() {
  const { dict: d, colors: c, wipeVisible, closeWipe, doWipe } = useApp();
  return (
    <Sheet visible={wipeVisible} onClose={closeWipe} center>
      <SheetHeader
        icon={<Icon as={Trash2} color={c.danger} size={20} />}
        title={d.wipeTitle}
        onClose={closeWipe}
        closeLabel={d.wipeCancel}
      />
      <T className="text-sm leading-6" style={{ color: c.ink3 }}>{d.wipeBody}</T>
      <View className="mt-4 flex-row gap-2">
        <Button variant="outline" className="flex-1" onPress={closeWipe}>
          <Text className="text-base font-medium" style={{ color: c.ink }}>{d.wipeCancel}</Text>
        </Button>
        <Button variant="destructive" className="flex-1" onPress={doWipe}>
          <Text className="text-base font-bold" style={{ color: "#fff" }}>{d.wipeConfirm}</Text>
        </Button>
      </View>
    </Sheet>
  );
}
