/**
 * DiagnosticErrorBoundary
 * ----------------------------------------------------------------------------
 * 诊断期全局错误边界（仅在诊断构建 EXPO_PUBLIC_TM_SURFACE=1 下挂载）。
 *
 * 作用：兜住「很多其他可能的问题」——任何 React 渲染期抛出的错误（不仅限于
 * TurboModule 原生吞弹，也包括 JS 侧组件崩溃、props 类型错、hook 误用等），
 * 不再变成白屏，而是把错误栈直接画在屏幕上，老板长按即可复制发我。
 *
 * 门控：本组件由 _layout.tsx 仅在 SURFACE 模式下包住整棵渲染树；生产构建
 * EXPO_PUBLIC_TM_SURFACE 未设置 → 不挂载 → 打包器摇树剔除，生产包零字节。
 *
 * 注意：ErrorBoundary 只能兜住「渲染期」错误。启动期若在渲染外抛错（极少），
 * 由 TurboModuleErrorSurface 的角落徽标提示「DIAG ON」辅助判断方向。
 */
import React from "react";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";

const ENABLED = process.env.EXPO_PUBLIC_TM_SURFACE === "1";

type Props = { children: React.ReactNode };
type State = { error: Error | null };

export class DiagnosticErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  private dismiss = () => this.setState({ error: null });

  render() {
    const e = this.state.error;
    if (!ENABLED || !e) return this.props.children;

    const msg = `${e.name || "Error"}: ${e.message}\n\n${e.stack ?? ""}`;
    return (
      <View style={styles.overlay}>
        <View style={styles.bar}>
          <Text style={styles.barTitle}>⚠️ React Render Error (Diagnostic)</Text>
<Pressable onPress={this.dismiss} hitSlop={12}>
          <Text style={styles.close}>✕</Text>
        </Pressable>
        </View>
        <ScrollView style={styles.body}>
          <Text selectable style={styles.mono}>
            {msg}
          </Text>
        </ScrollView>
      </View>
    );
  }
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
