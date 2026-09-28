/**
 * HabitForm 新建/编辑习惯表单（Dialog）：标题 / 详情 / emoji / 主题色 / 每周目标 / 提醒 / 导入迁移
 * 编辑态含「补录打卡」与「删除」入口
 */
import React from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useApp } from "@/store/app";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Text as T } from "@/components/ui/text";
import { Icon } from "@/components/ui/icon";
import { Trash2, CalendarClock } from "lucide-react-native";
import { habitColors } from "@/lib/tokens";
import { cn } from "@/lib/utils";

const EMOJIS = ["🔥", "✅", "🏃", "📚", "🧘", "💧", "🌙", "☀️", "💪", "🎯", "🌟", "🥗"];

export function HabitForm() {
  const {
    dict: d, colors: c, habitFormVisible, editingHabitId, habitForm, setHabitForm, saveHabit, closeHabitForm,
    openBackfill, askDelete,
  } = useApp();
  if (!habitFormVisible) return null;

  const numOnly = (t: string) => {
    const n = t.replace(/[^0-9]/g, "");
    return n ? parseInt(n, 10) : 0;
  };

  return (
    <Dialog open={habitFormVisible} onOpenChange={(o) => !o && closeHabitForm()}>
      <DialogContent className="max-h-[88%]">
        <DialogHeader>
          <DialogTitle className="text-[21px] font-extrabold">{editingHabitId ? d.habitEditTitle : d.habitAddTitle}</DialogTitle>
        </DialogHeader>

        <ScrollView className="max-h-[60%]" showsVerticalScrollIndicator={false}>
          {/* 标题 */}
          <Field label={d.fName}>
            <Input value={habitForm.name} onChangeText={(t) => setHabitForm({ name: t })} placeholder={d.fNamePh} maxLength={40} />
          </Field>
          {/* 详情 */}
          <Field label={d.fDetail}>
            <Textarea value={habitForm.detail} onChangeText={(t) => setHabitForm({ detail: t })} placeholder={d.fDetailPh} />
          </Field>
          {/* emoji */}
          <Field label={d.fEmoji}>
            <View className="flex-row flex-wrap gap-2">
              {EMOJIS.map((e) => (
                <Pressable
                  key={e}
                  onPress={() => setHabitForm({ emoji: e })}
                  className="h-10 w-10 items-center justify-center rounded-xl border"
                  style={{ borderColor: habitForm.emoji === e ? c.accent : c.line, backgroundColor: habitForm.emoji === e ? c.accentWash : c.surface2 }}
                >
                  <Text style={{ fontSize: 20 }}>{e}</Text>
                </Pressable>
              ))}
            </View>
          </Field>
          {/* 主题色 */}
          <Field label={d.fColor}>
            <View className="flex-row flex-wrap gap-2">
              {habitColors.map((col) => (
                <Pressable
                  key={col}
                  onPress={() => setHabitForm({ color: col })}
                  className="h-8 w-8 rounded-full border-2"
                  style={{ backgroundColor: col, borderColor: habitForm.color === col ? c.ink : "transparent" }}
                />
              ))}
            </View>
          </Field>
          {/* v0.2 四：频率 N（一个节点代表 N 天，1~30）与窗口次数（1~20） */}
          <Field label={d.fFreq}>
            <View className="flex-row items-center gap-4">
              <StepBtn label="−" onPress={() => setHabitForm({ frequency: Math.max(1, habitForm.frequency - 1) })} colors={c} />
              <View className="items-center">
                <Text className="text-xl font-bold tabular-nums" style={{ color: c.ink }}>{habitForm.frequency}</Text>
                <T className="text-[11px]" style={{ color: c.ink4 }}>{d.fFreqPh}</T>
              </View>
              <StepBtn label="+" onPress={() => setHabitForm({ frequency: Math.min(30, habitForm.frequency + 1) })} colors={c} />
            </View>
          </Field>
          <Field label={d.fTimes}>
            <View className="flex-row items-center gap-4">
              <StepBtn label="−" onPress={() => setHabitForm({ timesPerWindow: Math.max(1, habitForm.timesPerWindow - 1) })} colors={c} />
              <View className="items-center">
                <Text className="text-xl font-bold tabular-nums" style={{ color: c.ink }}>{habitForm.timesPerWindow}</Text>
                <T className="text-[11px]" style={{ color: c.ink4 }}>{d.fTimesPh}</T>
              </View>
              <StepBtn label="+" onPress={() => setHabitForm({ timesPerWindow: Math.min(20, habitForm.timesPerWindow + 1) })} colors={c} />
            </View>
          </Field>
          {/* 提醒 */}
          <Field label={d.fReminder}>
            <View className="flex-row items-center justify-between">
              <T className="text-sm" style={{ color: c.ink2 }}>{habitForm.reminderEnabled ? d.fReminderOn : d.fReminderOff}</T>
              <Switch checked={habitForm.reminderEnabled} onCheckedChange={(v) => setHabitForm({ reminderEnabled: v })} />
            </View>
            {habitForm.reminderEnabled && (
              <Input
                className="mt-2"
                value={habitForm.reminderTime}
                onChangeText={(t) => setHabitForm({ reminderTime: t })}
                placeholder="20:00"
                keyboardType="default"
              />
            )}
          </Field>

          {/* 导入迁移 */}
          <View className="mt-3 mb-1 flex-row items-center gap-1.5">
            <Icon as={CalendarClock} color={c.accent} size={15} />
            <T className="text-sm font-semibold" style={{ color: c.ink2 }}>{d.fMigrated}</T>
          </View>
          <Field label={d.fMigratedDays}>
            <Input value={String(habitForm.migratedTotalDays)} onChangeText={(t) => setHabitForm({ migratedTotalDays: numOnly(t) })} keyboardType="number-pad" />
          </Field>
          <Field label={d.fMigratedStreak}>
            <Input value={String(habitForm.migratedCurrentStreak)} onChangeText={(t) => setHabitForm({ migratedCurrentStreak: numOnly(t) })} keyboardType="number-pad" />
          </Field>
          <Field label={d.fMigratedStart}>
            <Input value={habitForm.migratedStartDate} onChangeText={(t) => setHabitForm({ migratedStartDate: t })} placeholder="YYYY-MM-DD" />
          </Field>
          <Field label={d.fMigratedSource}>
            <Input value={habitForm.migratedSource} onChangeText={(t) => setHabitForm({ migratedSource: t })} placeholder="e.g. Apple Fitness" />
          </Field>
        </ScrollView>

        <DialogFooter className="gap-2">
          {editingHabitId && (
            <Button
              variant="outline"
              className="flex-1"
              onPress={() => { if (editingHabitId) { closeHabitForm(); openBackfill(editingHabitId); } }}
            >
              <Icon as={CalendarClock} color={c.ink} size={16} />
              <T className="text-sm font-medium" style={{ color: c.ink }}>{d.backfillTitle}</T>
            </Button>
          )}
          {editingHabitId && (
            <Button variant="destructive" className="flex-1" onPress={() => askDelete("habit", editingHabitId)}>
              <Icon as={Trash2} color="#fff" size={16} />
              <Text className="text-sm font-medium" style={{ color: "#fff" }}>{d.delete}</Text>
            </Button>
          )}
          <Button className="flex-1" style={{ backgroundColor: c.accent }} onPress={saveHabit}>
            <Text className="text-base font-bold" style={{ color: "#fff" }}>{d.save}</Text>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View className="mt-3">
      <T className="mb-1.5 text-sm font-medium" style={{ color: "#5B5E68" }}>{label}</T>
      {children}
    </View>
  );
}

function StepBtn({ label, onPress, colors: c }: { label: string; onPress: () => void; colors: ReturnType<typeof useApp>["colors"] }) {
  return (
    <Pressable
      onPress={onPress}
      className="h-9 w-9 items-center justify-center rounded-full"
      style={{ backgroundColor: c.surface2 }}
      hitSlop={6}
    >
      <Text className="text-xl font-bold" style={{ color: c.ink }}>{label}</Text>
    </Pressable>
  );
}
