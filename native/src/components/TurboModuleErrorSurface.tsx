/**
 * TurboModuleErrorSurface
 * ----------------------------------------------------------------------------
 * 读取原生补丁（withTurboModuleFix）落盘的吞弹错误，在屏幕上直接展示。
 *
 * 背景：iOS 26 + RN 0.83 新架构下，部分 TurboModule 在冷启动时抛 NSException，
 * 原补丁把 `throw` 改成 `RCTLogError + return`，进程不崩、UI 起不来 → 白屏。
 * 而 RCTLogError 在 Release 包里只进 iOS Unified Logging，Windows 上根本看不到。
 * 补丁现把被吞掉的 NSException 写进 `Documents/seeora_tm_error.txt`（仅诊断构建），
 * 本组件在诊断构建（EXPO_PUBLIC_TM_SURFACE=1）下读出并全屏展示，让根因现形。
 *
 * 门控：本组件由 _layout.tsx 仅在 SURFACE 模式下挂载（{SURFACE && <.../>}）。
 * 生产构建 EXPO_PUBLIC_TM_SURFACE 未设置 → 不挂载 → 摇树剔除，生产包零字节。
 *
 * 行为（诊断构建内）：
 *   - 捕获到吞弹错误 → 全屏红底绿字展示（可长按复制）。
 *   - 未捕获到吞弹错误 → 仅显示角落小徽标「DIAG ON · no TM error captured」，
 *     点一下消失；用于区分「白屏但非 TurboModule 吞弹」→ 指向 splash/router 方向。
 */
import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { File as FSFile, Paths } from "expo-file-system";

const ENABLED = process.env.EXPO_PUBLIC_TM_SURFACE === "1";

export function TurboModuleErrorSurface() {
  const [text, setText] = useState<string | null>(null);
  const [badge, setBadge] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!ENABLED) return;
    let mounted = true;
    const file = new FSFile(Paths.document, "seeora_tm_error.txt");
    file
      .text()
      .then((content) => {
        if (!mounted) return;
        if (content && content.trim().length > 0) {
          setText(content);
        } else {
          setBadge(true);
        }
      })
      .catch(() => {
        if (mounted) setBadge(true); // 文件不存在 = 本次未吞掉任何 TurboModule 异常，正常
      });
    return () => {
      mounted = false;
    };
  }, []);

  if (!ENABLED) return null;

  // 捕获到吞弹错误 → 全屏展示
  if (text) {
    return (
      <View style={styles.overlay} pointerEvents="box-none">
        <View style={styles.bar}>
          <Text style={styles.barTitle}>⚠️ Swallowed TurboModule NSException</Text>
          <Pressable onPress={() => setText(null)} hitSlop={12}>
            <Text style={styles.close}>✕</Text>
          </Pressable>
        </View>
        <ScrollView style={styles.body}>
          <Text selectable style={styles.mono}>
            {text}
          </Text>
        </ScrollView>
      </View>
    );
  }

  // 未捕获到吞弹错误，但诊断构建已激活 → 角落徽标（点一下消失，不挡功能验证）
  if (badge && !dismissed) {
    return (
      <Pressable
        style={styles.badge}
        onPress={() => setDismissed(true)}
      >
        <Text style={styles.badgeText}>DIAG ON · no TM error captured（点此关闭）</Text>
      </Pressable>
    );
  }

  return null;
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
  badge: {
    position: "absolute",
    top: 8,
    right: 8,
    zIndex: 99999,
    backgroundColor: "rgba(0,0,0,0.72)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    color: "#39FF14",
    fontSize: 11,
    fontWeight: "700",
  },
});
