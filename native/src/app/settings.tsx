/**
 * Settings 页：通用 / 通知 / 设备偏好 / 扩展集成（占位）/ 数据安全 / 关于
 */
import React, { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "@/components/ui/icon";
import { ChevronRight, Shield } from "lucide-react-native";
import { useApp } from "@/store/app";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Text as T } from "@/components/ui/text";
import { Switch } from "@/components/ui/switch";
import { BuyoutCard } from "@/components/BuyoutCard";
import { cn } from "@/lib/utils";

const VERSION = "1.0.0";

export default function SettingsScreen() {
  const {
    dict: d, colors: c, lang, setLang, theme, setTheme, settings,
    setWeekStartOn, setHaptics, setIcloudSync, setBadge,
    openOnboarding, openPro, openExport, openWipe,
  } = useApp();
  const insets = useSafeAreaInsets();
  const [privacyOpen, setPrivacyOpen] = useState(false);

  return (
    <View className="flex-1" style={{ backgroundColor: c.bg }}>
      <View className="px-5 pb-2" style={{ paddingTop: insets.top + 16 }}>
        <Text className="text-[28px] font-extrabold tracking-tight" style={{ color: c.ink }}>{d.settingsTitle}</Text>
      </View>

      <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {/* 通用 */}
        <Section title={d.setGeneral}>
          <Row label={d.setLang}>
            <Seg
              options={[{ value: "en", label: "EN" }, { value: "zh", label: "中" }]}
              value={lang}
              onChange={(v) => setLang(v as "en" | "zh")}
              colors={c}
            />
          </Row>
          <Row label={d.setTheme}>
            <Seg
              options={[{ value: "system", label: d.themeSystem }, { value: "light", label: d.themeLight }, { value: "dark", label: d.themeDark }]}
              value={theme}
              onChange={(v) => setTheme(v as "system" | "light" | "dark")}
              colors={c}
            />
          </Row>
          <PressableRow label={d.setOnboarding} onPress={openOnboarding} colors={c} />
        </Section>

        {/* 通知：v0.2 九·3 明确不做「连续打卡提醒推送」，只保留应用角标 */}
        <Section title={d.setNotif}>
          <Row label={d.setBadge}>
            <Switch checked={settings.badge} onCheckedChange={setBadge} />
          </Row>
        </Section>

        {/* 设备偏好 */}
        <Section title={d.setDevice}>
          <Row label={d.setHaptics}>
            <Switch checked={settings.haptics} onCheckedChange={setHaptics} />
          </Row>
          <Row label={d.setIcloud}>
            <Switch checked={settings.icloudSync} onCheckedChange={setIcloudSync} />
          </Row>
          <Row label={d.setWeekStart}>
            <Seg
              options={[{ value: "mon", label: d.weekMon }, { value: "sun", label: d.weekSun }]}
              value={settings.weekStartOn}
              onChange={(v) => setWeekStartOn(v as "mon" | "sun")}
              colors={c}
            />
          </Row>
        </Section>

        {/* 扩展集成（占位） */}
        <Section title={d.setExt}>
          <PlaceholderRow label={d.extHealth} sub={d.extHealthSub} colors={c} />
          <PlaceholderRow label={d.extSiri} sub={d.extSiriSub} colors={c} />
          <PlaceholderRow label={d.extWidget} sub={d.extWidgetSub} colors={c} last />
        </Section>

        {/* 数据安全 */}
        <Section title={d.setData}>
          <BuyoutCard onPress={openPro} />
          <PressableRow label={d.dataExport} onPress={openExport} colors={c} />
          <PressableRow label={d.dataWipe} onPress={openWipe} colors={c} danger />
        </Section>

        {/* 关于 */}
        <Section title={d.about} last>
          <Row label={d.version}>
            <T className="text-sm font-medium" style={{ color: c.ink2 }}>{d.version.replace("{v}", VERSION)}</T>
          </Row>
          <PressableRow label={d.privacy} onPress={() => setPrivacyOpen((v) => !v)} colors={c} />
          {privacyOpen && (
            <T className="mt-2 text-sm leading-6" style={{ color: c.ink3 }}>{d.privacyText}</T>
          )}
          <View className="mt-3 flex-row items-center gap-1.5">
            <Icon as={Shield} color={c.success} size={14} />
            <T className="text-xs" style={{ color: c.ink4 }}>{d.localPromise}</T>
          </View>
        </Section>
      </ScrollView>
    </View>
  );
}

/* ===================== 局部小组件 ===================== */

function Section({ title, children, last }: { title: string; children: React.ReactNode; last?: boolean }) {
  return (
    <View className={cn("mt-5", last ? "" : "")}>
      <T className="mb-2 px-1 text-sm font-bold uppercase tracking-wide" style={{ color: "#9AA0A8" }}>{title}</T>
      <Card className="gap-0 py-1">{children}</Card>
    </View>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View className="flex-row items-center justify-between px-4 py-3" style={{ borderBottomWidth: 1, borderColor: "transparent" }}>
      <T className="text-base" style={{ color: "#1A1B21" }}>{label}</T>
      <View>{children}</View>
    </View>
  );
}

function PressableRow({ label, onPress, colors: c, danger }: { label: string; onPress: () => void; colors: ReturnType<typeof useApp>["colors"]; danger?: boolean }) {
  return (
    <Pressable onPress={onPress} className="flex-row items-center justify-between px-4 py-3" hitSlop={4}>
      <T className="text-base" style={{ color: danger ? c.danger : c.ink }}>{label}</T>
      <Icon as={ChevronRight} color={c.ink4} size={18} />
    </Pressable>
  );
}

function PlaceholderRow({ label, sub, colors: c, last }: { label: string; sub: string; colors: ReturnType<typeof useApp>["colors"]; last?: boolean }) {
  return (
    <View className="px-4 py-3" style={{ opacity: 0.7, borderBottomWidth: last ? 0 : 1, borderColor: c.line }}>
      <T className="text-base" style={{ color: c.ink }}>{label}</T>
      <T className="mt-0.5 text-xs" style={{ color: c.ink4 }}>{sub}</T>
    </View>
  );
}

function Seg({ options, value, onChange, colors: c }: { options: { value: string; label: string }[]; value: string; onChange: (v: string) => void; colors: ReturnType<typeof useApp>["colors"] }) {
  return (
    <View className="flex-row gap-1.5">
      {options.map((o) => {
        const active = value === o.value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            className="rounded-full px-3 py-1.5"
            style={{ backgroundColor: active ? c.accent : c.surface2 }}
            hitSlop={4}
          >
            <T className="text-xs font-medium" style={{ color: active ? "#FFFFFF" : c.ink2 }}>{o.label}</T>
          </Pressable>
        );
      })}
    </View>
  );
}
