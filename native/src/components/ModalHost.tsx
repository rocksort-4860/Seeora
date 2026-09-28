/**
 * ModalHost：按 store 弹层状态渲染各 Dialog
 * 含 HabitForm / HonorForm / ExportSheet / 7 天补录 / 删除确认 / 抹除二次确认
 * （Pro 买断页与 Share 分享卡为独立 modal 路由，见 app/pro.tsx、app/share.tsx）
 */
import React from "react";
import { Pressable, Text, View } from "react-native";
import { useApp } from "@/store/app";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Text as T } from "@/components/ui/text";
import { Icon } from "@/components/ui/icon";
import { Check, Lock, Trash2 } from "lucide-react-native";
import { fmtDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
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
      <ConfirmDialog />
      <WipeDialog />
    </>
  );
}

/* ===================== 7 天补录 ===================== */
function Backfill() {
  const { dict: d, colors: c, habits, backfillHabitId, closeBackfill, toggleBackfillDate, lang } = useApp();
  if (!backfillHabitId) return null;
  const habit = habits.find((h) => h.id === backfillHabitId);
  if (!habit) return null;

  const days: string[] = [];
  for (let i = 0; i <= 7; i++) {
    const dt = new Date();
    dt.setDate(dt.getDate() - i);
    days.push(fmtDate(dt));
  }

  return (
    <Dialog open onOpenChange={(o) => !o && closeBackfill()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-[21px] font-extrabold">{d.backfillTitle}</DialogTitle>
          <T className="mt-1 text-sm" style={{ color: c.ink3 }}>{d.backfillSub}</T>
        </DialogHeader>
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
                <View className="h-7 w-7 items-center justify-center rounded-full" style={{ backgroundColor: checked ? c.accent : c.surface3 }}>
                  {checked ? <Icon as={Check} color="#fff" size={16} /> : locked ? <Icon as={Lock} color={c.ink4} size={14} /> : null}
                </View>
              </Pressable>
            );
          })}
        </View>
        <DialogFooter>
          <Button className="flex-1" style={{ backgroundColor: c.accent }} onPress={closeBackfill}>
            <Text className="text-base font-bold" style={{ color: "#fff" }}>{d.close}</Text>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ===================== 删除确认 ===================== */
function ConfirmDialog() {
  const { dict: d, colors: c, confirmVisible, closeConfirm, doDelete } = useApp();
  if (!confirmVisible) return null;
  return (
    <Dialog open onOpenChange={(o) => !o && closeConfirm()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-[19px] font-extrabold">{d.confirmDelTitle}</DialogTitle>
          <T className="mt-1 text-sm leading-6" style={{ color: c.ink3 }}>{d.confirmDelBody}</T>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" className="flex-1" onPress={closeConfirm}>
            <Text className="text-base font-medium" style={{ color: c.ink }}>{d.no}</Text>
          </Button>
          <Button variant="destructive" className="flex-1" onPress={doDelete}>
            <Text className="text-base font-bold" style={{ color: "#fff" }}>{d.yes}</Text>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ===================== 抹除二次确认 ===================== */
function WipeDialog() {
  const { dict: d, colors: c, wipeVisible, closeWipe, doWipe } = useApp();
  if (!wipeVisible) return null;
  return (
    <Dialog open onOpenChange={(o) => !o && closeWipe()}>
      <DialogContent>
        <DialogHeader>
          <View className="flex-row items-center gap-2">
            <Icon as={Trash2} color={c.danger} size={20} />
            <DialogTitle className="text-[19px] font-extrabold">{d.wipeTitle}</DialogTitle>
          </View>
          <T className="mt-1 text-sm leading-6" style={{ color: c.ink3 }}>{d.wipeBody}</T>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" className="flex-1" onPress={closeWipe}>
            <Text className="text-base font-medium" style={{ color: c.ink }}>{d.wipeCancel}</Text>
          </Button>
          <Button variant="destructive" className="flex-1" onPress={doWipe}>
            <Text className="text-base font-bold" style={{ color: "#fff" }}>{d.wipeConfirm}</Text>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
