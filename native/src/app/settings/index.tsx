/**
 * Settings › 设置首页（Tab 右侧页）
 * 路由：/settings　子页：/settings/about
 *
 * ★ 2026-10-07 按 RockSort 最终定稿重构
 *   1) 语言 / 外观：**内联分段控件**（模仿 922/src/app/settings.tsx 的 SegmentCard + Segmented），
 *      不再跳转子页 —— 触发点紧贴当前行、关闭按钮在视线内（修复早先「底部弹整屏、关闭键远」）。
 *   2) 恢复购买：数据安全组新增「恢复购买」行，复用 useRestoreAction（busy 防连点 + 失败内联 +
 *      info/danger 语气分级，对齐 RockSort 最终定稿）。
 *   3) 导出 / 导入：改为 RockSort 式的 Sheet（原生 Modal，不再是页内 InlineExpand），
 *      导入走「选文件 → 同层内联二次确认 → 合并导入」，不嵌套第二层 Modal。
 *   4) 抹除数据：保留 InlineExpand 就地确认（破坏性操作红字不红底）。
 */
import React, { useState } from "react";
/* ★ 这里**不能**从 react-native 导入 Switch —— RN 自带的那个没有 checked/onCheckedChange，
   会覆盖掉项目的 rn-primitives 版并导致 tsc 报错。项目的开关在 @/components/ui/switch。 */
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Icon } from "@/components/ui/icon";
import { Text as T } from "@/components/ui/text";
import { Switch } from "@/components/ui/switch";
import { Shield, FileSpreadsheet, FileJson, FileUp, Trash2, RotateCcw } from "lucide-react-native";
import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";
import { useApp } from "@/store/app";
import type { Habit } from "@/store/app";
import { BuyoutCard } from "@/components/BuyoutCard";
import { Group, GroupTitle, Row, SegmentCard, Segmented } from "@/components/SettingsUI";
import { InlineExpand, ExpandOption } from "@/components/InlineExpand";
import { Sheet, SheetHeader } from "@/components/Sheet";
import { useRestoreAction } from "@/lib/useRestoreAction";
import { todayStr } from "@/lib/dates";

const VERSION = "1.0.0";

/** CSV 导出：导出列 + BOM（Excel 直接打开不乱码） */
function buildHabitCsv(habits: Habit[]): string {
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const header = ["name", "nameZh", "emoji", "color", "reminderEnabled", "reminderTime", "migratedTotalDays", "migratedCurrentStreak", "migratedStartDate", "migratedSource", "createdAt", "checkIns"];
  const rows = habits.map((h) =>
    [h.name, h.nameZh, h.emoji, h.color, h.reminderEnabled, h.reminderTime || "", h.migratedTotalDays, h.migratedCurrentStreak, h.migratedStartDate || "", h.migratedSource || "", h.createdAt, Object.keys(h.checkIns).join("|")]
      .map(esc)
      .join(",")
  );
  return "﻿" + [header.map(esc).join(","), ...rows].join("\r\n");
}

export default function SettingsScreen() {
  const {
    dict: d, colors: c, lang, theme, settings,
    setLang, setTheme,
    setWeekStartOn, setHaptics, setBadge,
    openOnboarding, openPro,
    openExport, openWipe, closeExport, closeWipe, exportVisible, wipeVisible, doWipe,
    habits, exportJson, importJson, showToast,
  } = useApp();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [impPending, setImpPending] = useState<string | null>(null);

  /* 路由类型快照（`.expo/types/router.d.ts`）由 dev server / EAS build 按 `src/app` 实际结构重新生成，
   且已被 .gitignore 忽略。新加的子页要等那次生成后才会出现在类型里，
   本机无法可靠触发（start / export 都不产出该文件），故这里收口成一个窄函数。
   ★ 关键：不要把 `as never` 散落到各个调用点 —— 那样路径拼错也不会报错。
     集中在这一处，且下面「路径存在性」用例会在 CI 里守住。 */
  const go = (path: string) => router.push(path as never);

  const langValue = lang === "zh" ? "中文" : "English";
  const themeValue = theme === "system" ? d.themeSystem : theme === "light" ? d.themeLight : d.themeDark;

  const langOptions = [
    { value: "zh", label: "中文", a11y: "中文" },
    { value: "en", label: "English", a11y: "English" },
  ];
  const themeOptions = [
    { value: "system", label: d.themeSystem, a11y: d.themeSystem },
    { value: "light", label: d.themeLight, a11y: d.themeLight },
    { value: "dark", label: d.themeDark, a11y: d.themeDark },
  ];

  // 恢复购买（复用 RockSort 最终定稿的 useRestoreAction）
  const restore = useRestoreAction();

  /* ---- 导出 / 导入 ----
   * 导出走系统分享面板；导入：选文件 → 同层内联二次确认 → 合并导入（不再嵌套 Modal）。 */
  const doExport = async (format: "csv" | "json") => {
    try {
      const name = format === "csv" ? `seeora-${todayStr()}.csv` : `seeora-${todayStr()}.json`;
      const content = format === "csv" ? buildHabitCsv(habits) : exportJson();
      const FS = await import("expo-file-system/legacy"); // 顶层同名函数在 SDK54+ 直接 throw
      if (!FS.cacheDirectory) { showToast(d.expFail); return; }
      const uri = FS.cacheDirectory + name;
      await FS.writeAsStringAsync(uri, content);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: format === "csv" ? "text/csv" : "application/json",
          dialogTitle: d.expTitle,
        });
      } else {
        showToast(d.expOk, true);
      }
    } catch {
      showToast(d.expFail);
    }
  };

  const doImportPick = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: "application/json", copyToCacheDirectory: true });
      if (res.canceled || !res.assets || res.assets.length === 0) return;
      const FS = await import("expo-file-system/legacy");
      const text = await FS.readAsStringAsync(res.assets[0].uri);
      setImpPending(text); // 选好文件后才弹「确认导入」（同一层内联，不叠第二层 Modal）
    } catch {
      showToast(d.impFail);
    }
  };

  const confirmImport = () => {
    if (impPending == null) return;
    importJson(impPending); // 内部解析 + 合并 + 内联 toast（Sheet 内 SheetToast 会显示）
    setImpPending(null);
    closeExport();
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      {/* iOS 大标题 */}
      <View style={{ paddingHorizontal: 22, paddingBottom: 6, paddingTop: insets.top + 14 }}>
        <Text style={{ color: c.ink, fontSize: 28, fontWeight: "800", letterSpacing: -0.5 }}>
          {d.settingsTitle}
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {/* ── 通用：语言 / 外观 内联分段控件（模仿 RockSort） ── */}
        <GroupTitle colors={c}>{d.setGeneral}</GroupTitle>
        <SegmentCard title={d.setLang} value={langValue} colors={c}>
          <Segmented
            options={langOptions}
            selected={lang}
            onSelect={(v) => setLang(v as "zh" | "en")}
            colors={c}
          />
        </SegmentCard>
        <SegmentCard title={d.setTheme} value={themeValue} colors={c}>
          <Segmented options={themeOptions} selected={theme} onSelect={(v) => setTheme(v as "system" | "light" | "dark")} colors={c} />
        </SegmentCard>
        <Group colors={c}>
          <Row label={d.setOnboarding} chevron colors={c} last onPress={openOnboarding} />
        </Group>

        {/* ── 通知 ── */}
        <GroupTitle colors={c}>{d.setNotif}</GroupTitle>
        <Group colors={c}>
          <Row label={d.setBadge} colors={c} first last>
            <Switch checked={settings.badge} onCheckedChange={setBadge} />
          </Row>
        </Group>

        {/* ── 设备偏好 ── */}
        <GroupTitle colors={c}>{d.setDevice}</GroupTitle>
        <Group colors={c}>
          <Row label={d.setHaptics} colors={c} first last>
            <Switch checked={settings.haptics} onCheckedChange={setHaptics} />
          </Row>
          <Row
            label={d.setWeekStart}
            value={settings.weekStartOn === "mon" ? d.weekMon : d.weekSun}
            colors={c}
            last
            onPress={() => setWeekStartOn(settings.weekStartOn === "mon" ? "sun" : "mon")}
          />
        </Group>

        {/* ── 数据安全 ── */}
        <GroupTitle colors={c}>{d.setData}</GroupTitle>
        <View style={{ paddingHorizontal: 16, paddingBottom: 20 }}>
          <BuyoutCard onPress={() => openPro()} />
        </View>
        <Group colors={c}>
          <Row label={d.dataExport} value={d.expCsv} chevron colors={c} first onPress={openExport} />
          {/* 恢复购买：模仿 RockSort 最终定稿，busy 防连点 + 失败内联 + 语气分级 */}
          <Pressable
            onPress={() => { void restore.run(); }}
            disabled={restore.busy}
            accessibilityRole="button"
            accessibilityLabel={d.restorePurchases}
            style={[styles.restoreRow, { opacity: restore.busy ? 0.6 : 1, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line }]}
          >
            <Icon as={RotateCcw} color={c.ink} size={20} />
            <Text style={[styles.restoreLabel, { color: c.ink }]}>{d.restorePurchases}</Text>
            {restore.busy ? <Text style={[styles.restoreBusy, { color: c.ink3 }]}>{d.payRestoring}</Text> : null}
          </Pressable>
          {restore.error ? (
            <Text
              style={[
                styles.restoreErr,
                { color: restore.errorTone === "danger" ? c.danger : c.ink3 },
              ]}
            >
              {restore.error}
            </Text>
          ) : null}
          <Row label={d.dataWipe} chevron colors={c} danger last onPress={openWipe} />
          <InlineExpand visible={wipeVisible} onClose={closeWipe}>
            <View style={{ paddingHorizontal: 16, paddingVertical: 14 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Icon as={Trash2} color={c.danger} size={18} />
                <Text style={{ color: c.ink, fontSize: 16, fontWeight: "600" }}>{d.wipeTitle}</Text>
              </View>
              <Text style={{ color: c.ink2, fontSize: 14, lineHeight: 20, marginTop: 8 }}>{d.wipeBody}</Text>
              <WipeConfirmButton label={d.wipeConfirm} onPress={doWipe} colors={c} />
              <Pressable
                onPress={closeWipe}
                accessibilityRole="button"
                accessibilityLabel={d.wipeCancel}
                style={{ height: 44, alignItems: "center", justifyContent: "center", marginTop: 4 }}
              >
                <Text style={{ color: c.ink2, fontSize: 16 }}>{d.wipeCancel}</Text>
              </Pressable>
            </View>
          </InlineExpand>
        </Group>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 22, marginTop: -14 }}>
          <Icon as={Shield} color={c.success} size={14} />
          <T className="text-xs" style={{ color: c.ink4 }}>{d.localPromise}</T>
        </View>

        {/* ── 扩展集成（占位） ── */}
        <GroupTitle colors={c}>{d.setExt}</GroupTitle>
        <Group colors={c}>
          <PlaceholderRow label={d.extHealth} sub={d.extHealthSub} colors={c} />
          <PlaceholderRow label={d.extSiri} sub={d.extSiriSub} colors={c} />
          <PlaceholderRow label={d.extWidget} sub={d.extWidgetSub} colors={c} />
        </Group>

        {/* ── 关于 ── */}
        <GroupTitle colors={c}>{d.about}</GroupTitle>
        <Group colors={c}>
          <Row label={d.version} value={VERSION} colors={c} first />
          <Row label={d.privacy} chevron colors={c} onPress={() => setPrivacyOpen((v) => !v)} />
          <Row label={d.about} chevron colors={c} last onPress={() => go("/settings/about")} />
        </Group>
        {privacyOpen ? (
          <T
            className="text-sm leading-6"
            style={{ color: c.ink3, paddingHorizontal: 22, marginTop: -12, marginBottom: 22 }}
            maxFontSizeMultiplier={1.5}
          >
            {d.privacyText}
          </T>
        ) : null}
      </ScrollView>

      {/* 导出 / 导入 Sheet（模仿 RockSort 的 ExportModal：同层内联导入确认，不嵌套 Modal） */}
      <Sheet visible={exportVisible} onClose={closeExport}>
        <SheetHeader title={d.dataExport} onClose={closeExport} />
        <Text style={styles.sheetNote}>{d.dataPrivacyNote}</Text>
        <View style={{ gap: 2 }}>
          <ExportRow label={`${d.expCsv} (CSV)`} icon={<Icon as={FileSpreadsheet} color={c.accent} size={20} />} onPress={() => doExport("csv")} colors={c} />
          <ExportRow label={`${d.expJson} (JSON)`} icon={<Icon as={FileJson} color={c.accent} size={20} />} onPress={() => doExport("json")} colors={c} />
          <ExportRow label={d.impJson} icon={<Icon as={FileUp} color={c.accent} size={20} />} onPress={doImportPick} colors={c} last />
        </View>
        {impPending ? (
          <View style={styles.confirmBox}>
            <Text style={[styles.confirmTitle, { color: c.ink }]}>{d.impConfirmTitle}</Text>
            <Text style={[styles.confirmMsg, { color: c.ink2 }]}>{d.impConfirmMsg}</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable
                onPress={() => setImpPending(null)}
                accessibilityRole="button"
                accessibilityLabel={d.no}
                style={[styles.confirmBtn, { backgroundColor: c.surface3 }]}
              >
                <Text style={{ color: c.ink, fontSize: 16, fontWeight: "600" }}>{d.no}</Text>
              </Pressable>
              <Pressable
                onPress={confirmImport}
                accessibilityRole="button"
                accessibilityLabel={d.yes}
                style={[styles.confirmBtn, { backgroundColor: c.accent }]}
              >
                <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "600" }}>{d.yes}</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
        <Pressable
          onPress={closeExport}
          accessibilityRole="button"
          accessibilityLabel={d.cancel}
          style={styles.cancelBtn}
        >
          <Text style={{ color: c.ink, fontSize: 16, fontWeight: "600" }}>{d.cancel}</Text>
        </Pressable>
      </Sheet>
    </View>
  );
}

function ExportRow({ label, icon, onPress, colors: c, last }: {
  label: string; icon: React.ReactNode; onPress: () => void; colors: ReturnType<typeof useApp>["colors"]; last?: boolean;
}) {
  const [pressed, setPressed] = React.useState(false);
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[
        styles.exportRow,
        { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line, backgroundColor: pressed ? c.surface3 : "transparent" },
        last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.line },
      ]}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
        {icon}
        <Text style={{ color: c.ink, fontSize: 16 }}>{label}</Text>
      </View>
    </Pressable>
  );
}

function PlaceholderRow({ label, sub, colors: c }: { label: string; sub: string; colors: ReturnType<typeof useApp>["colors"] }) {
  /* ★ 占位项用 View 而不是 Pressable：功能未实现，Pressable 会承诺「可点」
     却什么都不做（用户点了没反应）。想强调未开放就用 opacity，不要伪装成按钮。 */
  return (
    <View style={{ paddingHorizontal: 16, paddingVertical: 11, opacity: 0.55 }}>
      <Text style={{ color: c.ink, fontSize: 16 }}>{label}</Text>
      <Text style={{ color: c.ink4, fontSize: 12, marginTop: 2 }}>{sub}</Text>
    </View>
  );
}

/**
 * 「确认抹掉」按钮 —— 单独抽出只为用 useState 跟踪按压态。
 * ★ 不要写 `style={({pressed}) => …}`：NativeWind v4 在 Android 上会静默丢弃
 *   函数式 style（iOS 正常）→ 按钮在 Android 上完全不可见。
 */
function WipeConfirmButton({ label, onPress, colors: c }: {
  label: string;
  onPress: () => void;
  colors: ReturnType<typeof useApp>["colors"];
}) {
  const [pressed, setPressed] = React.useState(false);
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        marginTop: 14, height: 46, borderRadius: 10,
        alignItems: "center", justifyContent: "center",
        backgroundColor: c.danger, opacity: pressed ? 0.85 : 1,
      }}
    >
      <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "600" }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  restoreRow: {
    minHeight: 44, flexDirection: "row", alignItems: "center", gap: 10,
    paddingLeft: 16, paddingRight: 12, paddingVertical: 11,
  },
  restoreLabel: { flex: 1, fontSize: 16 },
  restoreBusy: { fontSize: 14 },
  restoreErr: { fontSize: 13, lineHeight: 18, paddingHorizontal: 16, paddingBottom: 12, paddingTop: 2 },
  sheetNote: { fontSize: 12, color: "#8a8a85", textAlign: "center", lineHeight: 18, marginTop: 4, marginBottom: 12, paddingHorizontal: 16 },
  exportRow: { minHeight: 48, flexDirection: "row", alignItems: "center", paddingHorizontal: 16 },
  confirmBox: { marginTop: 12, paddingHorizontal: 16, paddingBottom: 8 },
  confirmTitle: { fontSize: 16, fontWeight: "600" },
  confirmMsg: { fontSize: 14, lineHeight: 20, marginTop: 6 },
  confirmBtn: { flex: 1, height: 46, borderRadius: 10, alignItems: "center", justifyContent: "center", marginTop: 12 },
  cancelBtn: {
    marginTop: 20, minHeight: 48, borderRadius: 11,
    backgroundColor: "#e0e0e0", alignItems: "center", justifyContent: "center",
    marginHorizontal: 16,
  },
});
