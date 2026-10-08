/**
 * TurboModuleErrorSurface
 * ----------------------------------------------------------------------------
 * 读取原生补丁（withTurboModuleFix）落盘的吞弹错误，在屏幕上直接展示。
 *
 * 背景：iOS 26 + RN 0.83 新架构下，部分 TurboModule 在冷启动时抛 NSException，
 * 原补丁把 `throw` 改成 `RCTLogError + return`，进程不崩、UI 起不来 → 白屏。
 * 而 RCTLogError 在 Release 包里只进 iOS Unified Logging，Windows 上根本看不到。
 * 补丁现把被吞掉的 NSException 写进 `Documents/seeora_tm_error.txt`，
 * 本组件在诊断构建（EXPO_PUBLIC_TM_SURFACE=1）下读出并全屏展示，让根因现形。
 *
 * 重要：本组件仅在诊断构建启用。正常构建 EXPO_PUBLIC_TM_SURFACE 未设置，
 * 不挂载、不读文件、无任何副作用，符合上线红线。
 */
import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import { File as FSFile, Paths } from "expo-file-system";

const ENABLED = process.env.EXPO_PUBLIC_TM_SURFACE === "1";

export function TurboModuleErrorSurface() {
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    if (!ENABLED) return;
    let mounted = true;
    const file = new FSFile(Paths.document, "seeora_tm_error.txt");
    file
      .text()
      .then((content) => {
        if (mounted && content && content.trim().length > 0) setText(content);
      })
      .catch(() => {
        /* 文件不存在 = 本次未吞掉任何 TurboModule 异常，正常 */
      });
    return () => {
      mounted = false;
    };
  }, []);

  if (!ENABLED || !text) return null;

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <View style={styles.bar}>
        <Text style={styles.barTitle}>⚠️ Swallowed TurboModule NSException</Text>
        <TouchableOpacity onPress={() => setText(null)} hitSlop={12}>
          <Text style={styles.close}>✕</Text>
        </TouchableOpacity>
      </View>
      <ScrollView style={styles.body}>
        <Text style={styles.mono}>{text}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    zIndex: 99999,
    backgroundColor: "rgba(0,0,0,0.93)",
  },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#b00020",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  barTitle: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 13,
  },
  close: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
    paddingHorizontal: 8,
  },
  body: {
    flex: 1,
    padding: 12,
  },
  mono: {
    color: "#39FF14",
    fontFamily: "Courier",
    fontSize: 11,
    lineHeight: 16,
  },
});
