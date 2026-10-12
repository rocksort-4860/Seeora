/**
 * DiagProbe v2（仅诊断构建 EXPO_PUBLIC_TM_SURFACE=1 挂载；生产构建不挂载 → 摇树剔除，零字节）
 * ----------------------------------------------------------------------------
 * build 12 真机实测（2026-10-12）已证：
 *   · JS ♥ 时钟走字     → JS 线程活着，React 正常重绘
 *   · TAP n 可 +1       → Pressable 的触摸链路完好
 *   · 「点此关闭」无反应 → 同一位置换成 TouchableOpacity 就失效
 *   · 主界面出来但全黑 → 与触摸链路无关，属渲染/配色层
 *
 * 本版（v2）在根布局最高层给出**决定性读数**，一次真机测试即可定位黑屏：
 *   ① JS ♥ 时钟       —— JS 线程存活
 *   ② TAP n / TOUCH n —— Pressable vs TouchableOpacity 同屏 A/B 对照
 *                        （TOUCH 恒 0 即坐实 TouchableOpacity 在本环境整体失效）
 *   ③ THEME 行        —— 直接打出 useColorScheme() 与 store 的 dark / colors.bg 实际值，
 *                        判定「黑色是否来自深色模式误判」
 *   ④ VIEW 行         —— hydrated / habits 长度，区分「渲染崩了」与「渲染成功但内容空」
 */
import React, { useEffect, useState } from "react";
import { Pressable, Text, TouchableOpacity, View, useColorScheme, StyleSheet } from "react-native";
import { useApp } from "@/store/app";

const ENABLED = process.env.EXPO_PUBLIC_TM_SURFACE === "1";

export function DiagProbe() {
  const [now, setNow] = useState(() => new Date());
  const [taps, setTaps] = useState(0);
  const [touches, setTouches] = useState(0);
  const scheme = useColorScheme();
  // 探针挂在 AppProvider 之内，useApp() 一定拿得到。
  const app = useApp();

  useEffect(() => {
    if (!ENABLED) return;
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!ENABLED) return null;

  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");

  return (
    <>
      {/* ① JS 心跳 + ③ 主题读数 + ④ 渲染状态读数 */}
      <View style={styles.heart} pointerEvents="none">
        <Text style={styles.heartText}>
          {"JS ♥ " + hh + ":" + mm + ":" + ss}
        </Text>
        <Text style={styles.heartText}>
          {"THEME=" + String(scheme) + " dark=" + String(app.dark) + " bg=" + String(app.colors.bg)}
        </Text>
        <Text style={styles.heartText}>
          {"VIEW hydrated=" + String(app.hydrated) + " habits=" + String(app.habits.length)}
        </Text>
      </View>

      {/* ② 触摸 A/B 对照：同屏并列，一眼判定 */}
      <View style={styles.tapRow} pointerEvents="box-none">
        <Pressable style={styles.tap} onPress={() => setTaps((n) => n + 1)} hitSlop={8}>
          <Text style={styles.tapText}>{"TAP " + taps}</Text>
        </Pressable>
        <TouchableOpacity style={styles.tap} onPress={() => setTouches((n) => n + 1)} activeOpacity={0.5}>
          <Text style={styles.touchText}>{"TOUCH " + touches}</Text>
        </TouchableOpacity>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  heart: {
    position: "absolute", top: 28, left: 8, zIndex: 99998,
    backgroundColor: "rgba(0,0,0,0.72)",
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
  },
  heartText: { color: "#39FF14", fontSize: 11, fontWeight: "700" },
  tapRow: { position: "absolute", bottom: 3, left: 4, zIndex: 99998, flexDirection: "row" },
  tap: {
    marginRight: 6,
    backgroundColor: "rgba(0,0,0,0.72)",
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6,
  },
  tapText: { color: "#FFD700", fontSize: 12, fontWeight: "700" },
  touchText: { color: "#FF6B6B", fontSize: 12, fontWeight: "700" },
});