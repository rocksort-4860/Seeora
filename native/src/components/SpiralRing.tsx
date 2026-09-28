/**
 * SpiralRing 螺旋圆环（v0.2 5.1，单习惯详情页主视图）
 *  - 每圈 7 个节点（对应 7 个周期节点），每往外一圈半径递增，随时间向外螺旋生长
 *  - 实心圆点 = 本周期已打卡 / 已标记休息日；空心圆点 = 普通漏签
 *  - 连线：同一圈上相邻两个实心节点之间生成平滑弧段；中间夹空心则不连
 *  - 6.2/七：新节点柔和淡入；仪式第一层整圈呼吸（opacity 1→0.85→1，1s）
 * 颜色（5.5）：完成=柔和青绿 / 计划休息=浅灰蓝 / 漏签=底色不突出，全图无红色语义
 */
import React, { useEffect, useRef } from "react";
import { Animated, Easing, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import type { NodeView } from "@/lib/habitLogic";
import type { Colors } from "@/lib/tokens";

/** 每圈节点数（文档固定 7） */
const LOOP_NODES = 7;

export function SpiralRing({
  nodes,
  colors: c,
  size = 224,
  /** 仪式一层 nonce：变化即触发整圈呼吸 */
  breatheNonce = 0,
  /** 仪式二层 nonce：变化即触发外沿光晕扩散一次 */
  haloNonce = 0,
}: {
  nodes: NodeView[];
  colors: Colors;
  size?: number;
  breatheNonce?: number;
  haloNonce?: number;
}) {
  const baseR = size * 0.155;
  const step = size * 0.068;
  const center = size / 2;

  const posOf = (idx: number) => {
    const loop = Math.floor(idx / LOOP_NODES);
    const p = ((idx % LOOP_NODES) + LOOP_NODES) % LOOP_NODES;
    const ang = ((-90 + (p * 360) / LOOP_NODES) * Math.PI) / 180;
    const r = baseR + loop * step;
    return { x: center + r * Math.cos(ang), y: center + r * Math.sin(ang), r };
  };

  const filledOf = (n: NodeView) => n.state !== "miss";

  /* 弧段：同圈相邻、两端都实心 */
  const arcs = nodes
    .map((n, i) => ({ n, i }))
    .filter(({ n, i }) => {
      if (i === 0) return false;
      const prev = nodes[i - 1];
      if (Math.floor(n.idx / LOOP_NODES) !== Math.floor(prev.idx / LOOP_NODES)) return false;
      return filledOf(n) && filledOf(prev);
    })
    .map(({ n, i }) => {
      const a = posOf(nodes[i - 1].idx);
      const b = posOf(n.idx);
      return {
        key: `arc-${n.idx}`,
        d: `M ${a.x} ${a.y} A ${a.r} ${a.r} 0 0 1 ${b.x} ${b.y}`,
        color: n.state === "rest" ? c.rest : c.done,
      };
    });

  /* ---------- 仪式一层：整圈呼吸 1 秒 ---------- */
  const breathe = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!breatheNonce) return;
    breathe.setValue(1);
    Animated.sequence([
      Animated.timing(breathe, {
        toValue: 0.85, duration: 500, easing: Easing.inOut(Easing.ease), useNativeDriver: true,
      }),
      Animated.timing(breathe, {
        toValue: 1, duration: 500, easing: Easing.inOut(Easing.ease), useNativeDriver: true,
      }),
    ]).start();
  }, [breatheNonce, breathe]);

  /* ---------- 仪式二层：外沿光晕扩散一次（1.5 秒） ---------- */
  const haloScale = useRef(new Animated.Value(0.72)).current;
  const haloOpacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!haloNonce) return;
    haloScale.setValue(0.72);
    haloOpacity.setValue(0.5);
    Animated.parallel([
      Animated.timing(haloScale, {
        toValue: 1, duration: 1500, easing: Easing.out(Easing.ease), useNativeDriver: true,
      }),
      Animated.timing(haloOpacity, {
        toValue: 0, duration: 1500, easing: Easing.out(Easing.ease), useNativeDriver: true,
      }),
    ]).start();
  }, [haloNonce, haloScale, haloOpacity]);

  const maxLoop = nodes.length ? Math.floor(nodes[nodes.length - 1].idx / LOOP_NODES) : 0;
  const haloSize = baseR + maxLoop * step + size * 0.16;

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      {/* 光晕（纯 View 变换，避免 SVG 属性动画的类型风险） */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: "absolute",
          width: haloSize,
          height: haloSize,
          borderRadius: haloSize / 2,
          borderWidth: 1.5,
          borderColor: c.halo,
          opacity: haloOpacity,
          transform: [{ scale: haloScale }],
        }}
      />

      <Animated.View style={{ width: size, height: size, opacity: breathe }}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {/* 整圆引导环：每一圈一条完整圆，让结构读起来是“一整个圆圈”（不内凹） */}
          {Array.from({ length: maxLoop + 1 }, (_, loop) => (
            <Circle
              key={`guide-${loop}`}
              cx={center}
              cy={center}
              r={baseR + loop * step}
              fill="none"
              stroke={c.blank}
              strokeWidth={2}
            />
          ))}
          {arcs.map((a) => (
            <FadeIn key={a.key} duration={520}>
              <Path d={a.d} stroke={a.color} strokeWidth={2.5} strokeLinecap="round" fill="none" />
            </FadeIn>
          ))}

          {nodes.map((n) => {
            const p = posOf(n.idx);
            if (filledOf(n)) {
              const color = n.state === "rest" ? c.rest : c.done;
              return (
                <FadeIn key={`n-${n.idx}`} duration={450}>
                  <Circle cx={p.x} cy={p.y} r={6} fill={color} />
                </FadeIn>
              );
            }
            return (
              <FadeIn key={`n-${n.idx}`} duration={450}>
                <Circle cx={p.x} cy={p.y} r={5} fill="none" stroke={c.blank} strokeWidth={2} />
              </FadeIn>
            );
          })}
        </Svg>
      </Animated.View>
    </View>
  );
}

/** 柔和淡入容器（6.2：新节点与弧段出现；取 0.42~0.52s，克制不张扬） */
export function FadeIn({ children, duration = 470 }: { children: React.ReactNode; duration?: number }) {
  const op = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    op.setValue(0);
    Animated.timing(op, { toValue: 1, duration, easing: Easing.out(Easing.ease), useNativeDriver: true }).start();
  }, [op, duration]);
  return <Animated.View style={{ opacity: op }}>{children}</Animated.View>;
}
