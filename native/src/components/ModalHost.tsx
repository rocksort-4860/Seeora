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
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useApp } from "@/store/app";
import type { Habit } from "@/store/app";
import { Sheet, SheetHeader } from "@/components/Sheet";
import { Button } from "@/components/ui/button";
import { Text as T } from "@/components/ui/text";
import { Icon } from "@/components/ui/icon";
import { Check, Lock } from "lucide-react-native";
import { fmtDate } from "@/lib/dates";
import { HabitForm } from "@/components/HabitForm";
import { HonorForm } from "@/components/HonorForm";

const WK = ["日", "一", "二", "三", "四", "五", "六"];

export function ModalHost() {
  return (
    <>
      <HabitForm />
      <HonorForm />
      {/* ★ 2026-10-06：ExportSheet 已改为「紧贴触发行原地展开」（settings.tsx 内的
            InlineExpand），承载方式从原生 Modal 换成页内 View。
            若这里继续挂 <ExportSheet />，它与设置页的展开面板会读**同一个
            exportVisible** → 点一下会同时冒出「底部抽屉 + 原地展开」两处。
            故不再挂载。导入逻辑（importJson）仍在 store 内，未受影响。 */}
      <Backfill />
      {/* ★ WipeDialog 同样改为设置页内就地展开（抹除确认就地做，关闭按钮就在手边）。
            与 InlineExpand 共用 wipeVisible，必须二选一，这里移除。 */}
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
          <T style={[styles.backfillSub, { color: c.ink3 }]}>{d.backfillSub}</T>

          {/* flexShrink:1 —— 8 行在小屏上会顶到弹层 88% 上限，超出部分滚动 */}
          <ScrollView style={{ flexShrink: 1 }} showsVerticalScrollIndicator={false}>
            <View style={styles.gap2}>
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
                    style={[styles.dayRow, { backgroundColor: c.surface2, opacity: locked ? 0.5 : 1 }]}
                  >
                    <View style={styles.dayNameRow}>
                      <T style={[styles.dayName, { color: c.ink }]}>{lang === "zh" ? "周" + WK[dt.getDay()] : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][dt.getDay()]}</T>
                      <T style={[styles.dayDate, { color: c.ink3 }]}>{date.slice(5)}</T>
                    </View>
                    <View style={[styles.dayCheck, { backgroundColor: checked ? c.accentInk : c.surface3 }]}>
                      {checked ? <Icon as={Check} color="#fff" size={16} /> : locked ? <Icon as={Lock} color={c.ink4} size={14} /> : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>

          <Button style={[styles.closeBtn, { backgroundColor: c.accentInk }]} onPress={closeBackfill}>
            <Text style={styles.closeBtnText}>{d.close}</Text>
          </Button>
        </>
      ) : null}
    </Sheet>
  );
}

/* ★ 抹除二次确认（WipeDialog）已删除，2026-10-06：
 *   改为设置页「抹除数据」那一行下方就地展开（settings.tsx 的 InlineExpand）。
 *   原因：底部抽屉的关闭按钮离触发点很远、盖住大半屏；
 *   而抹除只有一步确认，就地展开后「确认 / 取消」都在手指下方。
 *   ⚠️ 若将来要恢复成弹层，记住它与 InlineExpand 共用 store 的 wipeVisible，
 *      两者不能同时挂载（会一起响应）。 */

const styles = StyleSheet.create({
  backfillSub: { marginBottom: 12, fontSize: 14 },
  gap2: { gap: 8 },
  dayRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  dayNameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  dayName: { fontSize: 16, fontWeight: "500" },
  dayDate: { fontSize: 14 },
  dayCheck: { height: 28, width: 28, alignItems: "center", justifyContent: "center", borderRadius: 9999 },
  closeBtn: { marginTop: 16, minHeight: 48 },
  closeBtnText: { fontSize: 16, fontWeight: "700", color: "#FFFFFF" },
});
