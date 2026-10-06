/**
 * 撒花与粒子庆祝层（说明文档 §M7 + 秒哒复刻 · 完成庆祝动效）：
 * 1. 粒子爆裂（Burst）：34 片、9~18px、圆/方/彩条、全向扩散 90~250px 整体上扬、1000ms 缓动消散
 * 2. 顶部彩纸（Confetti）：**全部习惯完成当日目标**时自屏幕顶部撒下 60 个彩纸/emoji，
 *    1.8~3.8s 飘落旋转 720°，4.2s 自动移除。触发源是 store 的 confettiNonce
 *    （toggleToday 里判定「可操作的习惯全部达标」后 +1）。
 *    ★ 2026-10-06：此前由 `celVisible`（一个**没有 setter**、恒为 false 的 state）驱动，
 *      这段代码从未执行过 —— 属死功能，本轮接上真实触发条件。
 */
import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { useApp } from "@/store/app";
import { burstColors } from "@/lib/tokens";

interface BurstPieceData {
  key: string;
  x: number;
  y: number;
  size: number;
  color: string;
  round: boolean;
  bar: boolean;
  dx: number;
  dy: number;
  rot: number;
  delay: number;
}

function BurstPiece({ p }: { p: BurstPieceData }) {
  const prog = useSharedValue(0);
  useEffect(() => {
    prog.value = withDelay(
      p.delay,
      withTiming(1, { duration: 1000, easing: Easing.bezier(0.2, 0.8, 0.2, 1) })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: p.dx * prog.value },
      { translateY: p.dy * prog.value },
      { rotate: `${p.rot * prog.value}deg` },
    ],
    opacity: prog.value < 0.7 ? 1 : 1 - (prog.value - 0.7) / 0.3,
  }));
  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          left: p.x - p.size / 2,
          top: p.y - p.size / 2,
          width: p.size,
          height: p.bar ? p.size * 0.42 : p.size,
          backgroundColor: p.color,
          borderRadius: p.round ? p.size / 2 : 2,
        },
        style,
      ]}
    />
  );
}

interface ConfettiItemData {
  key: string;
  x: number;
  startY: number;
  duration: number;
  delay: number;
  size: number;
  color: string;
  char: string;
}

const CONFETTI_COLORS = ["#FFD60A", "#FF9F0A", "#FF375F", "#30D158", "#0A84FF", "#BF5AF2", "#64D2FF"];
const CONFETTI_EMOJIS = ["🎉", "✨", "🌟", "🎊", "💛", "⭐"];

function ConfettiItem({ item, screenHeight }: { item: ConfettiItemData; screenHeight: number }) {
  const prog = useSharedValue(0);
  useEffect(() => {
    prog.value = withDelay(
      item.delay,
      withTiming(1, { duration: item.duration, easing: Easing.linear })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: prog.value * (screenHeight + 40) },
      { rotate: `${prog.value * 720}deg` },
    ],
    opacity: prog.value < 0.85 ? 1 : 1 - (prog.value - 0.85) / 0.15,
  }));

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          left: item.x,
          top: item.startY,
        },
        style,
      ]}
    >
      <Text style={{ fontSize: item.size, color: item.color }}>{item.char}</Text>
    </Animated.View>
  );
}

export function ConfettiHost() {
  const { burst, confettiNonce } = useApp();
  const { width, height } = useWindowDimensions();
  const [bursts, setBursts] = useState<BurstPieceData[]>([]);
  const [confetti, setConfetti] = useState<ConfettiItemData[]>([]);

  // 1. 粒子爆裂响应
  useEffect(() => {
    if (!burst) return;
    const cx = burst.x ?? width * 0.5;
    const cy = burst.y ?? height * 0.62;
    const arr: BurstPieceData[] = Array.from({ length: 34 }, (_, i) => {
      const size = 9 + Math.random() * 9;
      const shape = Math.random();
      const ang = Math.random() * Math.PI * 2;
      const dist = 90 + Math.random() * 160;
      return {
        key: `${burst.nonce}-${i}`,
        x: cx,
        y: cy,
        size,
        color: burstColors[i % burstColors.length],
        round: shape < 0.34,
        bar: shape >= 0.67,
        dx: Math.cos(ang) * dist,
        dy: Math.sin(ang) * dist - (70 + Math.random() * 90),
        rot: Math.random() * 720 - 360,
        delay: Math.random() * 140,
      };
    });
    setBursts((prev) => [...prev, ...arr]);
    const timer = setTimeout(() => {
      setBursts((prev) => prev.filter((p) => !arr.some((a) => a.key === p.key)));
    }, 1200);
    return () => clearTimeout(timer);
  }, [burst, width, height]);

  // 2. 全部完成（fireConfetti 计数变化）时触发顶部 60 个彩纸撒花
  useEffect(() => {
    if (!confettiNonce) return;
    const count = 60;
    const arr: ConfettiItemData[] = Array.from({ length: count }, (_, i) => {
      const isEmoji = Math.random() < 0.5;
      return {
        key: `confetti-${Date.now()}-${i}`,
        x: Math.random() * width,
        startY: -24,
        duration: 1800 + Math.random() * 2000,
        delay: Math.random() * 700,
        size: 12 + Math.random() * 16,
        color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
        char: isEmoji ? CONFETTI_EMOJIS[Math.floor(Math.random() * CONFETTI_EMOJIS.length)] : "•",
      };
    });
    setConfetti(arr);
    const timer = setTimeout(() => setConfetti([]), 4200);
    return () => clearTimeout(timer);
  }, [confettiNonce, width]);

  if (!bursts.length && !confetti.length) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {bursts.map((p) => (
        <BurstPiece key={p.key} p={p} />
      ))}
      {confetti.map((item) => (
        <ConfettiItem key={item.key} item={item} screenHeight={height} />
      ))}
    </View>
  );
}
