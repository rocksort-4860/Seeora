/**
 * ExportSheet 数据安全备份（Sheet 弹层）：导出 CSV / JSON + 导入 JSON 备份
 * 导出通过 expo-file-system 写入缓存并以 expo-sharing 调起系统分享面板（保存/传递）
 * 导入通过 expo-document-picker 选取 JSON → 解析合并（破坏/非 JSON → 提示并终止）
 *
 * ★★ 2026-10-06 修复（此前导出/导入**全程失败**，但已被 catch 吞成「导出失败，请重试」）：
 *   `expo-file-system` 顶层导出的 `writeAsStringAsync` / `readAsStringAsync` 在 SDK 54+
 *   已变成**运行期直接 throw 的弃用壳**（源码注释原文：「This method will throw in runtime」，
 *   正版实现被挪到 `expo-file-system/legacy`）。原实现正是从顶层 import 调的，
 *   于是每次导出都在第一行抛错 → 用户看到「导出失败」。
 *   修法：改从 `expo-file-system/legacy` 动态 import（与 RockSort 已验证写法一致），
 *   不用新版的 `File.write()` —— 后者是同步写，且是否自动建文件在真机上未经验证。
 *
 * ★ 弹层容器来源：RockSort 已验证实现（922 工程）——用自研 <Sheet>（RN 原生 Modal），
 *   不用 rn-primitives Dialog（后者在 iOS 上被 FullWindowOverlay 提升到独立 UIWindow，
 *   会把根层的全局 Toast 整片盖住）。
 *   本弹层尤其需要：**导出/导入的结果提示全部是 showToast**，而弹层全程开着 ——
 *   用户看到的现象就是「点了导出没反应」「导入完不知道结果」。
 *   Sheet 内部自带 SheetToast（同一份 toastMsg 的第二处渲染），这里的提示才真正可见。
 */
import React from "react";
import { Text, View } from "react-native";
import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";
import { useApp } from "@/store/app";
import { Sheet, SheetHeader } from "@/components/Sheet";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { FileUp, FileJson, FileSpreadsheet, type LucideIcon } from "lucide-react-native";
import { todayStr } from "@/lib/dates";
import type { Habit } from "@/store/app";

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

export function ExportSheet() {
  const { dict: d, colors: c, exportVisible, closeExport, habits, exportJson, importJson, showToast } = useApp();
  /* ★ 不提前 return null（2026-10-06）：提前卸载会让 Sheet 看不到 visible=false，
   *   退场动画永远不播。详见 components/ModalHost.tsx 文件头。 */

  const doExport = async (format: "csv" | "json") => {
    try {
      const name = format === "csv" ? `seeora-${todayStr()}.csv` : `seeora-${todayStr()}.json`;
      const content = format === "csv" ? buildHabitCsv(habits) : exportJson();
      /* ★ 必须走 legacy 子路径：顶层 export 的同名函数在运行期直接 throw（见文件头）。 */
      const FS = await import("expo-file-system/legacy");
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

  const doImport = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: "application/json", copyToCacheDirectory: true });
      if (res.canceled || !res.assets || res.assets.length === 0) return;
      /* 同上：读文件也必须走 legacy，顶层 readAsStringAsync 同样是 throw 壳。 */
      const FS = await import("expo-file-system/legacy");
      const text = await FS.readAsStringAsync(res.assets[0].uri);
      importJson(text);
    } catch {
      showToast(d.impFail);
    }
  };

  return (
    <Sheet visible={exportVisible} onClose={closeExport} center>
      <SheetHeader title={d.expTitle} onClose={closeExport} closeLabel={d.close} />

      <View className="gap-2.5">
        <ExportBtn icon={FileSpreadsheet} label={`${d.expCsv} (CSV)`} colors={c} dict={d} onPress={() => doExport("csv")} />
        <ExportBtn icon={FileJson} label={`${d.expJson} (JSON)`} colors={c} dict={d} onPress={() => doExport("json")} />
        <ExportBtn icon={FileUp} label={d.impJson} colors={c} dict={d} onPress={doImport} />
      </View>

      <Button variant="outline" className="mt-4" onPress={closeExport}>
        <Text className="text-base font-medium" style={{ color: c.ink }}>{d.cancel}</Text>
      </Button>
    </Sheet>
  );
}

function ExportBtn({ icon, label, colors: c, onPress }: { icon: LucideIcon; label: string; colors: ReturnType<typeof useApp>["colors"]; dict: ReturnType<typeof useApp>["dict"]; onPress: () => void }) {
  return (
    <Button variant="outline" className="h-12 flex-row justify-start gap-3" onPress={onPress}>
      <Icon as={icon} color={c.accent} size={20} />
      <Text className="text-base font-medium" style={{ color: c.ink }}>{label}</Text>
    </Button>
  );
}
