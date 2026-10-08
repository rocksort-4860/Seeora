/**
 * HabitForm 新建/编辑习惯表单（Sheet 弹层）：标题 / 详情 / emoji / 主题色 / 每周目标 / 提醒 / 导入迁移
 * 编辑态含「补录打卡」与「删除」入口
 *
 * ★ 弹层容器来源：RockSort 已验证实现（922 工程）——自研 <Sheet>（RN 原生 Modal），
 *   不用 rn-primitives Dialog（其 Overlay 在 iOS 上被 FullWindowOverlay 提升到独立
 *   UIWindow，会盖住根层全局 Toast）。
 *   本表单的「请输入标题」校验提示、保存成功提示、免费版 5 个上限提示**全部是弹层
 *   开着时发出的** —— 用旧容器时它们都被盖住，用户看到的就是「点了保存没反应」。
 *
 * ★ 与弹层的衔接（勿改回）：「补录打卡」「删除」必须先 closeHabitForm() 再开下一个
 *   弹层。两个原生 Modal 并存会在 RN 0.83 上留下全屏透明层（关掉后整页点不动）。
 *   Sheet 内部有仲裁器兜底（见 @/lib/sheetArbiter），但调用点仍然必须先关。
 *   删除原本**没有**先关表单 —— 会真的出现两个弹层同时挂载，这里已修正。
 */
import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useApp } from "@/store/app";
import { Sheet, SheetHeader } from "@/components/Sheet";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Text as T } from "@/components/ui/text";
import { Icon } from "@/components/ui/icon";
import { Trash2, CalendarClock, Archive } from "lucide-react-native";
import { habitColors } from "@/lib/tokens";

const EMOJIS = ["🔥", "✅", "🏃", "📚", "🧘", "💧", "🌙", "☀️", "💪", "🎯", "🌟", "🥗"];

export function HabitForm() {
  const {
    dict: d, colors: c, habitFormVisible, editingHabitId, habitForm, setHabitForm, saveHabit, closeHabitForm,
    openBackfill, deleteHabitNow, habits, archiveHabit,
  } = useApp();
  // 当前编辑中的习惯（用于显示归档/取消归档的当前态，归档后就地翻转标签、不关表单）
  const editing = habits.find((h) => h.id === editingHabitId);
  const isArchived = editing?.isArchived ?? false;
  /* ★ 删除改为**表单内联第二步确认**（2026-10-06，替代原「关表单 → 再开确认弹层」）：
   *   原路径会让两个原生 Modal 在退场 270ms 内并存（RN 0.83 会留下全屏透明层，
   *   关掉后整页失去响应），且要多一次弹层切换。内联确认后这条路彻底不存在。
   * ★ 注意这里**不能提前 return null**：提前卸载会让 Sheet 看不到 visible=false，
   *   退场动画永远不播（详见 components/ModalHost.tsx 文件头）。 */
  const [confirmDel, setConfirmDel] = useState(false);
  // 每次「打开」重置为普通态；关闭过程中保留当前态，避免退场动画里内容突变
  useEffect(() => {
    if (habitFormVisible) setConfirmDel(false);
  }, [habitFormVisible]);

  const numOnly = (t: string) => {
    const n = t.replace(/[^0-9]/g, "");
    return n ? parseInt(n, 10) : 0;
  };

  return (
    <Sheet visible={habitFormVisible} onClose={closeHabitForm} center>
      <SheetHeader
        title={editingHabitId ? d.habitEditTitle : d.habitAddTitle}
        onClose={closeHabitForm}
        closeLabel={d.cancel}
      />
      {confirmDel ? (
        <DeleteConfirm
          colors={c}
          dict={d}
          onCancel={() => setConfirmDel(false)}
          onConfirm={() => {
            const id = editingHabitId;
            closeHabitForm();
            if (id) deleteHabitNow(id);
          }}
        />
      ) : (
        <HabitFields
          colors={c}
          dict={d}
          habitForm={habitForm}
          setHabitForm={setHabitForm}
          editingHabitId={editingHabitId}
          numOnly={numOnly}
          onBackfill={() => { if (editingHabitId) { const id = editingHabitId; closeHabitForm(); openBackfill(id); } }}
          onAskDelete={() => setConfirmDel(true)}
          onArchive={() => { if (editingHabitId) archiveHabit(editingHabitId, !isArchived); }}
          onSave={saveHabit}
          isArchived={isArchived}
        />
      )}
    </Sheet>
  );
}

/* ===================== 表单主体 ===================== */
function HabitFields({
  colors: c, dict: d, habitForm, setHabitForm, editingHabitId, numOnly, onBackfill, onAskDelete, onArchive, onSave, isArchived,
}: {
  colors: ReturnType<typeof useApp>["colors"];
  dict: ReturnType<typeof useApp>["dict"];
  habitForm: ReturnType<typeof useApp>["habitForm"];
  setHabitForm: (f: Partial<ReturnType<typeof useApp>["habitForm"]>) => void;
  editingHabitId: string | null;
  numOnly: (t: string) => number;
  onBackfill: () => void;
  onAskDelete: () => void;
  onArchive: () => void;
  onSave: () => void;
  isArchived: boolean;
}) {
  return (
    <>
      {/* flexShrink:1 —— 内容超过弹层 88% 上限时由本容器滚动（否则按钮被挤出屏幕） */}
      <ScrollView style={{ flexShrink: 1 }} showsVerticalScrollIndicator={false}>
        {/* 标题 */}
        <Field colors={c} label={d.fName}>
          <Input value={habitForm.name} onChangeText={(t) => setHabitForm({ name: t })} placeholder={d.fNamePh} maxLength={40} />
        </Field>
        {/* 详情 */}
        <Field colors={c} label={d.fDetail}>
          <Textarea value={habitForm.detail} onChangeText={(t) => setHabitForm({ detail: t })} placeholder={d.fDetailPh} />
        </Field>
        {/* emoji */}
        <Field colors={c} label={d.fEmoji}>
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
        <Field colors={c} label={d.fColor}>
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
        <Field colors={c} label={d.fFreq}>
          <View className="flex-row items-center gap-4">
            <StepBtn label="−" onPress={() => setHabitForm({ frequency: Math.max(1, habitForm.frequency - 1) })} colors={c} />
            <View className="items-center">
              <Text className="text-xl font-bold tabular-nums" style={{ color: c.ink }}>{habitForm.frequency}</Text>
              <T className="text-[11px]" style={{ color: c.ink4 }}>{d.fFreqPh}</T>
            </View>
            <StepBtn label="+" onPress={() => setHabitForm({ frequency: Math.min(30, habitForm.frequency + 1) })} colors={c} />
          </View>
        </Field>
        <Field colors={c} label={d.fTimes}>
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
        <Field colors={c} label={d.fReminder}>
          <View className="flex-row items-center justify-between">
            <T className="text-sm" style={{ color: c.ink2 }}>{habitForm.reminderEnabled ? d.fReminderOn : d.fReminderOff}</T>
            <Switch checked={habitForm.reminderEnabled} onCheckedChange={(v) => setHabitForm({ reminderEnabled: v })} />
          </View>
          {habitForm.reminderEnabled && (
            <>
              {/* ★ 这个输入框此前**没有任何标签**：用户只能靠 placeholder "20:00" 猜它是什么，
                  VoiceOver 也读不出字段名。字典里早就有 fReminderTime，一直没接。 */}
              <T className="mt-3 text-[13px]" style={{ color: c.ink3 }}>{d.fReminderTime}</T>
              <Input
                className="mt-1"
                value={habitForm.reminderTime}
                onChangeText={(t) => setHabitForm({ reminderTime: t })}
                placeholder="20:00"
                keyboardType="default"
                autoCorrect={false}
                accessibilityLabel={d.fReminderTime}
              />
            </>
          )}
        </Field>

        {/* 导入迁移 */}
        <View className="mt-3 mb-1 flex-row items-center gap-1.5">
          <Icon as={CalendarClock} color={c.accent} size={15} />
          <T className="text-sm font-semibold" style={{ color: c.ink2 }}>{d.fMigrated}</T>
        </View>
        <Field colors={c} label={d.fMigratedDays}>
          <Input value={String(habitForm.migratedTotalDays)} onChangeText={(t) => setHabitForm({ migratedTotalDays: numOnly(t) })} keyboardType="number-pad" />
        </Field>
        <Field colors={c} label={d.fMigratedStreak}>
          <Input value={String(habitForm.migratedCurrentStreak)} onChangeText={(t) => setHabitForm({ migratedCurrentStreak: numOnly(t) })} keyboardType="number-pad" />
        </Field>
        <Field colors={c} label={d.fMigratedStart}>
          <Input value={habitForm.migratedStartDate} onChangeText={(t) => setHabitForm({ migratedStartDate: t })} placeholder="YYYY-MM-DD" />
        </Field>
        <Field colors={c} label={d.fMigratedSource}>
          <Input value={habitForm.migratedSource} onChangeText={(t) => setHabitForm({ migratedSource: t })} placeholder="e.g. Apple Fitness" />
        </Field>
      </ScrollView>

      {/* 横排（原 DialogFooter 原生端为 column-reverse，工具类在移动端没生效） */}
      <View className="mt-4 flex-row gap-2">
        {editingHabitId && (
          <Button variant="outline" className="flex-1" onPress={onBackfill}>
            <Icon as={CalendarClock} color={c.ink} size={16} />
            <T className="text-sm font-medium" style={{ color: c.ink }}>{d.backfillTitle}</T>
          </Button>
        )}
        {editingHabitId && (
          <Button variant="outline" className="flex-1" onPress={onArchive}>
            <Icon as={Archive} color={c.ink} size={16} />
            <T className="text-sm font-medium" style={{ color: c.ink }}>{isArchived ? d.unarchive : d.archive}</T>
          </Button>
        )}
        {editingHabitId && (
          <Button variant="destructive" className="flex-1" onPress={onAskDelete}>
            <Icon as={Trash2} color="#fff" size={16} />
            <Text className="text-sm font-medium" style={{ color: "#fff" }}>{d.delete}</Text>
          </Button>
        )}
        <Button className="flex-1" style={{ backgroundColor: c.accentInk }} onPress={onSave}>
          <Text className="text-base font-bold" style={{ color: "#fff" }}>{d.save}</Text>
        </Button>
      </View>
    </>
  );
}

/* ===================== 删除：就地二次确认（不新开弹层） ===================== */
function DeleteConfirm({
  colors: c, dict: d, onCancel, onConfirm,
}: {
  colors: ReturnType<typeof useApp>["colors"];
  dict: ReturnType<typeof useApp>["dict"];
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <View>
      <View className="mb-2 flex-row items-center gap-2">
        <Icon as={Trash2} color={c.danger} size={18} />
        <T className="text-[17px] font-semibold" style={{ color: c.ink }}>{d.confirmDelTitle}</T>
      </View>
      <T className="text-sm leading-6" style={{ color: c.ink3 }}>{d.confirmDelBody}</T>
      <View className="mt-4 flex-row gap-2">
        <Button variant="outline" className="flex-1" onPress={onCancel}>
          <Text className="text-base font-medium" style={{ color: c.ink }}>{d.no}</Text>
        </Button>
        <Button variant="destructive" className="flex-1" onPress={onConfirm}>
          <Text className="text-base font-bold" style={{ color: "#fff" }}>{d.yes}</Text>
        </Button>
      </View>
    </View>
  );
}

function Field({ label, children, colors: c }: { label: string; children: React.ReactNode; colors: ReturnType<typeof useApp>["colors"] }) {
  return (
    <View className="mt-3">
      {/* 表单标签字色走 c.ink2：原先硬编码 #5B5E68 绕过设计令牌 */}
      <T className="mb-1.5 text-sm font-medium" style={{ color: c.ink2 }}>{label}</T>
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
