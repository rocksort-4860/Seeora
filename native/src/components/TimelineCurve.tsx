/**
 * TimelineCurve 横向时间流曲线（v0.2 5.2）
 *  - 横轴：时间（从左到右推进）；纵轴：累计打卡次数（只增不减，曲线永远向上）
 *  - 相邻实心节点之间：平滑实线；出现漏签节点：相邻段切换为小圆点组成的点状虚线
 *  - 底部每 5 天一格浅灰色分隔，仅作阅读参考，不切割曲线
 * 颜色（5.5）：完成=柔和青绿；漏签=底色（不突出的小点），无红色
 */
import React, { useMemo } from "react";
import { View } from "react-native";
import Svg, { Circle, Line, Path } from "react-native-svg";
import { FadeIn } from "@/components/SpiralRing";
import type { CurvePoint } from "@/lib/habitLogic";
import type { Colors } from "@/lib/tokens";

export function TimelineCurve({
  points,
  colors: c,
  height = 120,
  width = 320,
}: {
  points: CurvePoint[];
  colors: Colors;
  height?: number;
  width?: number;
}) {
  const padX = 10;
  const padTop = 14;
  const padBottom = 18;

  const geo = useMemo(() => {
    if (!points.length) return null;
    const maxTotal = Math.max(1, points[points.length - 1].total);
    const n = points.length;
    const innerW = width - padX * 2;
    const innerH = height - padTop - padBottom;
    const xOf = (i: number) => padX + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW);
    const yOf = (t: number) => padTop + innerH - (t / maxTotal) * innerH;
    return { maxTotal, n, innerW, innerH, xOf, yOf };
  }, [points, width, height]);

  if (!geo) return null;

  const { maxTotal, n, xOf, yOf } = geo;
  const baseY = yOf(0);

  /** 每个采样点的屏幕坐标 */
  const coord = points.map((p, i) => ({ x: xOf(i), y: yOf(p.total) }));

  /** 线段：两端都有打卡 → 实线；否则按小圆点虚线处理 */
  const segments: { key: string; d: string; dotted: boolean; a: (typeof coord)[number]; b: (typeof coord)[number]; color: string }[] = [];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const dotted = !(a.has && b.has);
    segments.push({
      key: `s-${i}`,
      d: `M ${coord[i - 1].x} ${coord[i - 1].y} L ${coord[i].x} ${coord[i].y}`,
      dotted,
      a: coord[i - 1],
      b: coord[i],
      color: b.has ? c.done : c.blank,
    });
  }

  /** 每 5 天一格浅灰分隔（底部，不切割曲线） */
  const ticks: number[] = [];
  for (let i = 4; i < points.length; i += 5) ticks.push(xOf(i));

  return (
    <View style={{ opacity: 1 }}>
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        {/* 底部刻度：每 5 天一格 */}
        {ticks.map((x) => (
          <Line key={`t-${x}`} x1={x} y1={baseY} x2={x} y2={baseY + 4} stroke={c.blank} strokeWidth={1.5} />
        ))}

        {/* 曲线段 */}
        {segments.map((s) =>
          s.dotted ? (
            <DottedSeg key={s.key} x1={s.a.x} y1={s.a.y} x2={s.b.x} y2={s.b.y} color={s.color} />
          ) : (
            <FadeIn key={s.key} duration={520}>
              <Path d={s.d} stroke={c.done} strokeWidth={2} strokeLinecap="round" fill="none" />
            </FadeIn>
          )
        )}

        {/* 采样点：有打卡=实心；漏签=底色小点（不突出） */}
        {points.map((p, i) =>
          p.has ? (
            <FadeIn key={`p-${i}`} duration={450}>
              <Circle cx={xOf(i)} cy={yOf(p.total)} r={3} fill={c.done} />
            </FadeIn>
          ) : (
            <Circle key={`p-${i}`} cx={xOf(i)} cy={yOf(p.total)} r={2.5} fill={c.blank} />
          )
        )}
      </Svg>
    </View>
  );
}

/** 点状虚线段：沿两点间等分撒若干小圆点（漏签处相邻段） */
function DottedSeg({ x1, y1, x2, y2, color }: { x1: number; y1: number; x2: number; y2: number; color: string }) {
  const dots: { cx: number; cy: number; key: string }[] = [];
  const steps = 4;
  for (let k = 1; k < steps; k++) {
    const t = k / steps;
    dots.push({ key: `${k}`, cx: x1 + (x2 - x1) * t, cy: y1 + (y2 - y1) * t });
  }
  return (
    <FadeIn duration={420}>
      {dots.map((d) => (
        <Circle key={d.key} cx={d.cx} cy={d.cy} r={1.6} fill={color} />
      ))}
    </FadeIn>
  );
}
