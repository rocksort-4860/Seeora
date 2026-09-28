/**
 * HonorForm 新建/编辑荣誉（Dialog）：标题 / 来源 / 坚持天数 / 详情 / 分类
 * 荣誉为迁移来的历史成果，独立留存，不计入周达标与热力图
 */
import React from "react";
import { Text, View } from "react-native";
import { useApp } from "@/store/app";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Text as T } from "@/components/ui/text";

export function HonorForm() {
  const {
    dict: d, colors: c, honorFormVisible, editingHonorId, honorForm, setHonorForm, saveHonor, closeHonorForm,
  } = useApp();
  if (!honorFormVisible) return null;

  const numOnly = (t: string) => {
    const n = t.replace(/[^0-9]/g, "");
    return n ? parseInt(n, 10) : 0;
  };

  return (
    <Dialog open={honorFormVisible} onOpenChange={(o) => !o && closeHonorForm()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-[21px] font-extrabold">{editingHonorId ? d.honorEditTitle : d.honorAddTitle}</DialogTitle>
        </DialogHeader>

        <View className="gap-3">
          <Labeled label={d.fHonorTitle}>
            <Input value={honorForm.title} onChangeText={(t) => setHonorForm({ title: t })} placeholder={d.fNamePh} maxLength={40} />
          </Labeled>
          <Labeled label={d.fHonorSource}>
            <Input value={honorForm.source} onChangeText={(t) => setHonorForm({ source: t })} placeholder="e.g. Apple Fitness" />
          </Labeled>
          <Labeled label={d.fHonorDays}>
            <Input value={String(honorForm.days)} onChangeText={(t) => setHonorForm({ days: numOnly(t) })} keyboardType="number-pad" />
          </Labeled>
          <Labeled label={d.fHonorDetail}>
            <Textarea value={honorForm.details} onChangeText={(t) => setHonorForm({ details: t })} placeholder={d.fDetailPh} />
          </Labeled>
          <Labeled label={d.fHonorCategory}>
            <Input value={honorForm.category} onChangeText={(t) => setHonorForm({ category: t })} placeholder="e.g. Running" />
          </Labeled>
        </View>

        <DialogFooter className="gap-2">
          <Button variant="outline" className="flex-1" onPress={closeHonorForm}>
            <Text className="text-base font-medium" style={{ color: c.ink }}>{d.cancel}</Text>
          </Button>
          <Button className="flex-1" style={{ backgroundColor: c.accent }} onPress={saveHonor}>
            <Text className="text-base font-bold" style={{ color: "#fff" }}>{d.save}</Text>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View>
      <T className="mb-1.5 text-sm font-medium" style={{ color: "#5B5E68" }}>{label}</T>
      {children}
    </View>
  );
}
