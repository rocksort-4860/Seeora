/**
 * DiagProbe（仅诊断构建 EXPO_PUBLIC_TM_SURFACE=1 挂载；生产构建不挂载 → 摇树剔除，零字节）
 * ----------------------------------------------------------------------------
 * 背景：diagnose 包真机验证时发现「渲染正常、滑动正常、所有点击（Pressable /
 * TouchableOpacity）全部无反应」。为定位是「JS 线程卡死」还是「触摸事件分发断裂」，
 * 加两个**无需点击即可观测**的探针：
 *   ① JS ♥ HH:MM:SS —— 每秒自增时钟。走字 = JS 线程活着；冻结 = JS 卡死。
 *   ② TAP n —— 根层级 Pressable 计数器，点一下 +1。
 *      时钟走字 + 计数不动 = 触摸事件到不了 JS（分发断裂）；
 *      时钟冻结 = JS 已死；两个都动 = 点击链路正常（问题在别处）。
 * 探针挂在根布局最后（zIndex 高于路由子树），可区分「根层级也失灵（系统性）」
 * 与「仅页面内失灵（路由子树内）」。
 */
import React, { useEffect, useState } from "react";
import { Pressable, Text, View, StyleSheet } from "react-native";

const ENABLED = process.env.EXPO_PUBLIC_TM_SURFACE === "1";

export function DiagProbe() {
  const [now, setNow] = useState(() => new Date());
  const [taps, setTaps] = useState(0);

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
      <View style={styles.heart} pointerEvents="none">
        <Text style={styles.heartText}>{"JS ♥ " + hh + ":" + mm + ":" + ss}</Text>
      </View>
      <Pressable style={styles.tap} onPress={() => setTaps((n) => n + 1)} hitSlop={8}>
        <Text style={styles.tapText}>{"TAP " + taps}</Text>
      </Pressable>
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
  tap: {
    position: "absolute", bottom: 3, left: 4, zIndex: 99998,
    backgroundColor: "rgba(0,0,0,0.72)",
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6,
  },
  tapText: { color: "#FFD700", fontSize: 12, fontWeight: "700" },
});
