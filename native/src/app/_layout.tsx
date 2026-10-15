/**
 * 根布局（Seeora）：纯本地 App，无登录
 * 全局挂载：GestureHandler > AppProvider > ThemedStatusBar > 路由(Slot) > Toast/Confetti/Modal/Portal
 * 崩溃红线：Linking 兜底 + iap 懒加载 + 启动时绝不初始化原生模块
 */
import "../global.css";
import React from "react";
import { View, Text } from "react-native";
import { Linking } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import { Slot } from "expo-router";
import { PortalHost } from "@rn-primitives/portal";
import { AppProvider, useApp } from "@/store/app";
import { ToastHost } from "@/components/Toast";
import { ConfettiHost } from "@/components/Confetti";
import { ModalHost } from "@/components/ModalHost";
import { TurboModuleErrorSurface } from "@/components/TurboModuleErrorSurface";
import { DiagnosticErrorBoundary } from "@/components/DiagnosticErrorBoundary";
import { DiagProbe } from "@/components/DiagProbe";
import TodayScreen from "@/app/today";

// ── 崩溃红线 #4：Linking 兜底 ──
// 裸 scheme URL（seeora://... 无后续路径）在 expo-router 启动期会触发崩溃；中性化为 null
const _orig = Linking.getInitialURL;
Linking.getInitialURL = async () => {
  const u = await _orig();
  return u && u.startsWith("seeora://") && u.replace("seeora://", "").replace(/\/$/, "") === "" ? null : u;
};

// ── 冷启动崩溃「二分诊断」开关（仅排查用；正常构建不设）──
const DIAG = process.env.EXPO_PUBLIC_DIAG === "1";
const STAGE = Number(process.env.EXPO_PUBLIC_DIAG_STAGE ?? "0");

// ── 诊断浮层总开关（仅 diagnose 构建设 EXPO_PUBLIC_TM_SURFACE=1）──
// 生产构建该值为 undefined → 下面两个诊断组件不被挂载 → 打包器摇树剔除，生产包零字节。
const SURFACE = process.env.EXPO_PUBLIC_TM_SURFACE === "1";

function ThemedStatusBar() {
  const { dark, colors } = useApp();
  return <StatusBar style={dark ? "light" : "dark"} backgroundColor={colors.bg} />;
}

function DiagBadge({ stage }: { stage: number }) {
  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute", top: 8, left: 8, backgroundColor: "rgba(0,0,0,0.72)",
        paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, zIndex: 9999,
      }}
    >
      <Text style={{ color: "#39FF14", fontSize: 12, fontWeight: "700" }}>DIAG STAGE {stage}</Text>
    </View>
  );
}

export default function RootLayout() {
  if (!DIAG) {
    const tree = (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <AppProvider>
          <ThemedStatusBar />
          <Slot />
          <ToastHost />
          <ConfettiHost />
          <ModalHost />
          <PortalHost />
          {SURFACE && <TurboModuleErrorSurface />}
          {SURFACE && <DiagProbe />}
        </AppProvider>
      </GestureHandlerRootView>
    );
    // 诊断构建：用 ErrorBoundary 兜住所有渲染期报错（含非 TurboModule 的 JS 崩），
    // 同时挂载 TurboModule 吞弹错误浮层；生产构建（SURFACE=false）直接返回 tree，
    // 诊断组件不进入渲染树 → 被摇树剔除。
    return SURFACE ? (
      <DiagnosticErrorBoundary>{tree}</DiagnosticErrorBoundary>
    ) : (
      tree
    );
  }

  if (STAGE <= -1) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" }}>
        <Text style={{ fontSize: 18, color: "#111" }}>BARE STAGE -1</Text>
      </View>
    );
  }

  const withStatusBar = STAGE >= 1;
  const withGesture = STAGE >= 3;
  const withOverlay = STAGE >= 4;

  /* ★★ 二分诊断专用（STAGE === 2.5 用小数区分）：裸渲染 today 页，不经过 expo-router Tabs。
   * 现象（build 12 真机）：走 Tabs 时主界面全黑，但 JS 活着、Pressable 可点。
   * 这里直接渲染 TodayScreen 组件本体（绕过 Tabs / react-native-screens 那一层）：
   *   · 裸渲染有内容 → 问题在 Tabs / react-native-screens（iOS 26 + Fabric 已知失灵族）
   *   · 裸渲染仍黑   → 问题在 Today 页自身或配色层（看 DiagProbe 的 THEME / VIEW 行）
   * 仅在 EXPO_PUBLIC_DIAG=1 且 DIAG_STAGE=2.5 时命中，生产构建永不进入。 */
  /* ★ 二分第二刀（STAGE === 0.5）：在 2.5 的基础上只加 GestureHandlerRootView 一层。
   * 2.5 已证实：裸 Today 正常。0.5 只多手势根视图这一个原生包装层：
   *   · 0.5 黑屏 → 元凶是 GestureHandlerRootView（App 内无任何手势组件依赖它，删掉即修）
   *   · 0.5 正常 → 手势层排除，元凶是 Slot/RNSScreen 导航层
   * 仅在 EXPO_PUBLIC_DIAG=1 且 DIAG_STAGE=0.5 时命中，生产构建永不进入。 */
  if (STAGE === 0.5) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <AppProvider>
          <ThemedStatusBar />
          <TodayScreen />
          <DiagBadge stage={STAGE} />
          {SURFACE && <DiagProbe />}
        </AppProvider>
      </GestureHandlerRootView>
    );
  }

  if (STAGE === 2.5) {
    return (
      <AppProvider>
        <ThemedStatusBar />
        <TodayScreen />
        {SURFACE && <DiagProbe />}
      </AppProvider>
    );
  }

  const inner = (
    <>
      {withStatusBar && <ThemedStatusBar />}
      <Slot />
      {withOverlay && (<><ToastHost /><ConfettiHost /><ModalHost /><PortalHost /></>)}
    </>
  );

  if (withGesture) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <AppProvider>
          {inner}
          <DiagBadge stage={STAGE} />
        </AppProvider>
      </GestureHandlerRootView>
    );
  }
  return (
    <AppProvider>
      {inner}
      <DiagBadge stage={STAGE} />
    </AppProvider>
  );
}
