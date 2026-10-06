/**
 * HonorForm 新建/编辑荣誉（Sheet 弹层）：标题 / 来源 / 坚持天数 / 详情 / 分类
 * 荣誉为迁移来的历史成果，独立留存，不计入周达标与热力图
 *
 * ★ 弹层容器来源：RockSort 已验证实现（922 工程）——自研 <Sheet>（RN 原生 Modal），
 *   不用 rn-primitives Dialog。原因：Dialog 的 Overlay 在 iOS 上被 FullWindowOverlay
 *   提升到独立 UIWindow，会把根层全局 Toast 整片盖住。
 *   本表单的「请输入标题」校验提示、保存成功提示都是弹层**开着**时发出的 ——
 *   用旧容器时用户看到的就是「点了保存没反应」。
 *
 * ★ 2026-10-06：去掉 `if (!visible) return null;` —— 提前卸载会让 Sheet 看不到
 *   visible=false，270ms 退场动画永远不播（弹层「啪」地消失）。由 Sheet 自己维持挂载。
 *   表单内容来自 store 的 honorForm（关闭时不清空），退场期间不会闪空。
 */
import React from "react";
import { Text, View } from "react-native";
import { useApp } from "@/store/app";
import { Sheet, SheetHeader } from "@/components/Sheet";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Text as T } from "@/components/ui/text";

export function HonorForm() {
  const {
    dict: d, colors: c, honorFormVisible, editingHonorId, honorForm, setHonorForm, saveHonor, closeHonorForm,
  } = useApp();

  const numOnly = (t: string) => {
    const n = t.replace(/[^0-9]/g, "");
    return n ? parseInt(n, 10) : 0;
  };

  return (
    <Sheet visible={honorFormVisible} onClose={closeHonorForm} center>
      <SheetHeader
        title={editingHonorId ? d.honorEditTitle : d.honorAddTitle}
        onClose={closeHonorForm}
        closeLabel={d.cancel}
      />

      {/* flexShrink:1 —— 内容超过弹层 88% 上限时由本容器滚动，而不是把按钮顶出屏幕 */}
      <View className="gap-3" style={{ flexShrink: 1 }}>
        <Labeled label={d.fHonorTitle} colors={c}>
          <Input value={honorForm.title} onChangeText={(t) => setHonorForm({ title: t })} placeholder={d.fNamePh} maxLength={40} />
        </Labeled>
        <Labeled label={d.fHonorSource} colors={c}>
          <Input value={honorForm.source} onChangeText={(t) => setHonorForm({ source: t })} placeholder="e.g. Apple Fitness" />
        </Labeled>
        <Labeled label={d.fHonorDays} colors={c}>
          <Input value={String(honorForm.days)} onChangeText={(t) => setHonorForm({ days: numOnly(t) })} keyboardType="number-pad" />
        </Labeled>
        <Labeled label={d.fHonorDetail} colors={c}>
          <Textarea value={honorForm.details} onChangeText={(t) => setHonorForm({ details: t })} placeholder={d.fDetailPh} />
        </Labeled>
        <Labeled label={d.fHonorCategory} colors={c}>
          <Input value={honorForm.category} onChangeText={(t) => setHonorForm({ category: t })} placeholder="e.g. Running" />
        </Labeled>
      </View>

      {/* 横排：取消在左、保存在右（Apple HIG 双按钮确认框的标准排布）。
          原 DialogFooter 在原生端是 column-reverse（从 DOM 反着堆），
          属于工具类在移动端没生效的产物；此处按它 flex-1 的原始意图改为横排。 */}
      <View className="mt-4 flex-row gap-2">
        <Button variant="outline" className="flex-1" onPress={closeHonorForm}>
          <Text className="text-base font-medium" style={{ color: c.ink }}>{d.cancel}</Text>
        </Button>
        <Button className="flex-1" style={{ backgroundColor: c.accentInk }} onPress={saveHonor}>
          <Text className="text-base font-bold" style={{ color: "#fff" }}>{d.save}</Text>
        </Button>
      </View>
    </Sheet>
  );
}

function Labeled({ label, children, colors: c }: { label: string; children: React.ReactNode; colors: ReturnType<typeof useApp>["colors"] }) {
  return (
    <View>
      {/* 标签字色走 c.ink2：原先硬编码 #5B5E68，深色模式下不可读 */}
      <T className="mb-1.5 text-sm font-medium" style={{ color: c.ink2 }}>{label}</T>
      {children}
    </View>
  );
}
