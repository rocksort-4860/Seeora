/**
 * ExportSheet 数据安全备份（Dialog）：导出 CSV / JSON + 导入 JSON 备份
 * 导出通过 expo-file-system 写入缓存并以 expo-sharing 调起系统分享面板（保存/传递）
 * 导入通过 expo-document-picker 选取 JSON → 解析合并（破坏/非 JSON → 提示并终止）
 */
import React from "react";
import { Text, View } from "react-native";
import * as FileSystem from "expo-file-system";
import { Paths, File } from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";
import { useApp } from "@/store/app";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Text as T } from "@/components/ui/text";
import { Icon } from "@/components/ui/icon";
import { FileDown, FileUp, FileJson, FileSpreadsheet, type LucideIcon } from "lucide-react-native";
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
  if (!exportVisible) return null;

  const doExport = async (format: "csv" | "json") => {
    try {
      const name = format === "csv" ? `seeora-${todayStr()}.csv` : `seeora-${todayStr()}.json`;
      const content = format === "csv" ? buildHabitCsv(habits) : exportJson();
      const file = new File(Paths.cache, name);
      const uri = file.uri;
      await FileSystem.writeAsStringAsync(uri, content);
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
      const text = await FileSystem.readAsStringAsync(res.assets[0].uri);
      importJson(text);
    } catch {
      showToast(d.impFail);
    }
  };

  return (
    <Dialog open={exportVisible} onOpenChange={(o) => !o && closeExport()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-[21px] font-extrabold">{d.expTitle}</DialogTitle>
        </DialogHeader>

        <View className="gap-2.5">
          <ExportBtn icon={FileSpreadsheet} label={`${d.expCsv} (CSV)`} colors={c} dict={d} onPress={() => doExport("csv")} />
          <ExportBtn icon={FileJson} label={`${d.expJson} (JSON)`} colors={c} dict={d} onPress={() => doExport("json")} />
          <ExportBtn icon={FileUp} label={d.impJson} colors={c} dict={d} onPress={doImport} />
        </View>

        <Button variant="outline" className="mt-4" onPress={closeExport}>
          <Text className="text-base font-medium" style={{ color: c.ink }}>{d.cancel}</Text>
        </Button>
      </DialogContent>
    </Dialog>
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
