/**
 * AchievementCard 成就卡（Seeora）—— 纯 SVG 绘制，**同一份图形既用于屏幕预览、也用于导出 PNG**。
 *
 * 为什么整张卡都用 SVG（而不是 RN 的 View/Text 拼）：
 *   iOS 上把「任意 RN 视图」截成图片必须依赖 react-native-view-shot（社区原生模块）。
 *   本项目与 RockSort（922）同源，RockSort 当时正是为规避 iOS 26 / Xcode 26 的编译风险
 *   **刻意不引入**该类模块，改用 react-native-svg 自带的
 *   `Svg.toDataURL(callback, { width, height })` 导出（已在真机验证）。
 *   代价是卡片必须用 SVG 基本图元绘制；好处是「所见即所得」——
 *   预览与导出用的是同一棵 SVG 树，不会出现「屏幕上好看、导出来不一样」。
 *
 * ★ 布局单位说明：viewBox 固定 360×560，所有坐标/字号都在这个坐标系里。
 *   渲染尺寸（width/height，单位 pt）由调用方给，viewBox 会自动等比缩放，
 *   所以卡片在任何屏幕上都是同一版式，不存在「小屏挤、大屏空」。
 *
 * ★★ 导出不变式（RockSort 真机踩过，2026-10-04）：原生 toDataURL 里
 *   viewBox 变换的目标框取的是**视图布局尺寸**（不是 options），所以
 *       toDataURL 的 options.width/height  ==  <Svg> 的 width/height  ==  渲染尺寸
 *   三者必须完全相等；不相等时变换矩阵不是单位阵 → 导出图内容被放大并裁掉右侧/底部
 *   （实测放大 1.94~1.98 倍）。因此本组件的 width/height 是**必填数值**，
 *   调用方必须拿同一组数去 toDataURL —— 详见 app/share.tsx。
 *   导出图的像素尺寸 = 渲染尺寸(pt) × 屏幕 scale（3x），故 350pt 宽 → 约 1050px。
 *
 * ★ 导出时**不要**给 SVG 画圆角：圆角由外层 View（borderRadius + overflow:hidden）负责裁剪，
 *   这样屏幕上看着是圆角，而 PNG 是满幅不透明（社交平台压白底不会出现四个透明角）。
 */
import React from "react";
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from "react-native-svg";
import type { CurvePoint, NodeView } from "@/lib/habitLogic";
import type { Colors } from "@/lib/tokens";
import type { Dict, Lang } from "@/lib/i18n";
import { ellipsize, wrapText } from "@/lib/shareImage";

/** 卡片画布（viewBox 坐标系，与设备像素无关） */
export const CARD_W = 360;
export const CARD_H = 560;
const PAD = 24;
const INNER = CARD_W - PAD * 2;

const LOOP_NODES = 7;

export interface CardHabitData {
  nodes: NodeView[];
  curve: CurvePoint[];
  streak: number;
  best: number;
  cycles: number;
}

export interface AchievementCardProps {
  lang: Lang;
  dict: Dict;
  colors: Colors;
  /** 主标题（用户自定义或习惯名） */
  title: string;
  /** 副标题：日期串 */
  subtitle: string;
  quote: string;
  sign: string;
  note: string;
  /** 有值 = 单习惯成就卡；undefined = 全站总览卡 */
  habit?: CardHabitData;
  /** 全站总览卡的累计天数 */
  total: number;
  /**
   * 渲染尺寸（pt）—— ★ 不变式：**必须与导出时 toDataURL 的 options.width/height 完全相等**。
   * 原生实现里 viewBox 变换的目标框取的是「视图布局尺寸」（不是 options），
   * 两者不等时变换矩阵不是单位阵 → 导出图内容被放大并裁掉右侧/底部（RockSort 真机踩过，
   * 实测放大 1.94~1.98 倍）。所以这里显式接收数值，调用方用同一组数去 toDataURL。
   */
  width: number;
  height: number;
  /** 导出用：挂到根 <Svg> 上，调用 toDataURL 生成 PNG */
  svgRef?: React.Ref<Svg>;
}

/* ===================== 几何：螺旋圆环（与 SpiralRing.tsx 同算法） ===================== */

const spiralPosOf = (idx: number, size: number) => {
  const baseR = size * 0.155;
  const step = size * 0.068;
  const center = size / 2;
  const loop = Math.floor(idx / LOOP_NODES);
  const p = ((idx % LOOP_NODES) + LOOP_NODES) % LOOP_NODES;
  const ang = ((-90 + (p * 360) / LOOP_NODES) * Math.PI) / 180;
  const r = baseR + loop * step;
  return { x: center + r * Math.cos(ang), y: center + r * Math.sin(ang), r, loop, baseR, step, center };
};

/** 螺旋圆环 → 纯图形列表（不含动画，导出与预览共用） */
function spiralGeometry(nodes: NodeView[], size: number, restColor: string, doneColor: string, blankColor: string) {
  const baseR = size * 0.155;
  const step = size * 0.068;
  const center = size / 2;
  const maxLoop = nodes.length ? Math.floor(nodes[nodes.length - 1].idx / LOOP_NODES) : 0;

  const guides = Array.from({ length: maxLoop + 1 }, (_, loop) => ({ r: baseR + loop * step }));

  const filled = (n: NodeView) => n.state !== "miss";

  const arcs = nodes
    .map((n, i) => ({ n, i }))
    .filter(({ n, i }) => {
      if (i === 0) return false;
      const prev = nodes[i - 1];
      if (Math.floor(n.idx / LOOP_NODES) !== Math.floor(prev.idx / LOOP_NODES)) return false;
      return filled(n) && filled(prev);
    })
    .map(({ n, i }) => {
      const a = spiralPosOf(nodes[i - 1].idx, size);
      const b = spiralPosOf(n.idx, size);
      return {
        key: `arc-${n.idx}`,
        d: `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} A ${a.r.toFixed(2)} ${a.r.toFixed(2)} 0 0 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)}`,
        color: n.state === "rest" ? restColor : doneColor,
      };
    });

  const dots = nodes.map((n) => {
    const p = spiralPosOf(n.idx, size);
    const on = filled(n);
    return {
      key: `n-${n.idx}`,
      cx: p.x,
      cy: p.y,
      r: on ? 6 : 5,
      on,
      color: on ? (n.state === "rest" ? restColor : doneColor) : blankColor,
    };
  });

  return { center, guides, arcs, dots };
}

/* ===================== 几何：累计曲线（与 TimelineCurve.tsx 同算法） ===================== */

function curveGeometry(points: CurvePoint[], width: number, height: number, doneColor: string, blankColor: string) {
  if (!points.length) return null;
  const padX = 10;
  const padTop = 12;
  const padBottom = 16;
  const maxTotal = Math.max(1, points[points.length - 1].total);
  const n = points.length;
  const innerW = width - padX * 2;
  const innerH = height - padTop - padBottom;
  const xOf = (i: number) => padX + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const yOf = (t: number) => padTop + innerH - (t / maxTotal) * innerH;

  const coord = points.map((p, i) => ({ x: xOf(i), y: yOf(p.total) }));

  const segs: { key: string; d: string; dotted: boolean; a: { x: number; y: number }; b: { x: number; y: number }; color: string }[] = [];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    segs.push({
      key: `s-${i}`,
      d: `M ${coord[i - 1].x.toFixed(2)} ${coord[i - 1].y.toFixed(2)} L ${coord[i].x.toFixed(2)} ${coord[i].y.toFixed(2)}`,
      dotted: !(a.has && b.has),
      a: coord[i - 1],
      b: coord[i],
      color: b.has ? doneColor : blankColor,
    });
  }

  const ticks: number[] = [];
  for (let i = 4; i < points.length; i += 5) ticks.push(xOf(i));

  const dots = points.map((p, i) => ({ cx: xOf(i), cy: yOf(p.total), has: p.has }));

  return { segs, ticks, dots, baseY: yOf(0) };
}

/* ===================== 卡片 ===================== */

export function AchievementCard({
  lang, dict, colors: c, title, subtitle, quote, sign, note, habit, total, width, height, svgRef,
}: AchievementCardProps) {
  /* —— 视觉区块（122 ~ 362）：有习惯 → 螺旋圆环 + 累计曲线；总览卡 → 大数字 —— */
  const RING_SIZE = 150;
  const RING_Y = 124;
  const CURVE_W = 264;
  const CURVE_H = 68;
  const CURVE_X = (CARD_W - CURVE_W) / 2;
  const CURVE_Y = 284;

  const spiral = habit ? spiralGeometry(habit.nodes, RING_SIZE, c.rest, c.done, c.blank) : null;
  const curve = habit ? curveGeometry(habit.curve, CURVE_W, CURVE_H, c.done, c.blank) : null;

  /* —— 文本排版：SVG 不自动折行，先算好行 —— */
  const titleLine = ellipsize(title, 26, INNER);
  const subLine = ellipsize(subtitle, 12, INNER);
  const quoteLines = wrapText(quote, 16, INNER - 8, 2);
  const signLine = sign ? ellipsize(`—— ${sign}`, 12, INNER) : "";
  const noteLines = note ? wrapText(note, 12, INNER, 2) : [];

  const footer = lang === "zh"
    ? "Seeora · 看见自己越来越好"
    : "Seeora · See yourself getting better.";

  const statCells = habit
    ? [
        { v: habit.streak, l: dict.curStreak },
        { v: habit.best, l: dict.bestStreak },
        { v: habit.cycles, l: dict.cycles },
      ]
    : [];

  return (
    <Svg
      ref={svgRef}
      width={width}
      height={height}
      viewBox={`0 0 ${CARD_W} ${CARD_H}`}
      /* 满幅不透明底：圆角由外层 View 裁剪，PNG 不带透明角 */
    >
      <Rect x={0} y={0} width={CARD_W} height={CARD_H} fill={c.surface} />

      {/* ── 页眉 ── */}
      <SvgText
        x={PAD}
        y={44}
        fontFamily="-apple-system, system-ui, sans-serif"
        fontSize={11}
        fontWeight="600"
        letterSpacing={2.4}
        fill={c.ink4}
      >
        SEEORA
      </SvgText>
      <Circle cx={CARD_W - PAD - 5} cy={39} r={5} fill={c.accent} />

      {/* ── 标题 / 副标题 ── */}
      <SvgText
        x={PAD}
        y={84}
        fontFamily="-apple-system, system-ui, sans-serif"
        fontSize={26}
        fontWeight="600"
        letterSpacing={-0.374}
        fill={c.ink}
      >
        {titleLine}
      </SvgText>
      <SvgText x={PAD} y={106} fontFamily="-apple-system, system-ui, sans-serif" fontSize={12} fill={c.ink4}>
        {subLine}
      </SvgText>
      <Line x1={PAD} y1={122} x2={CARD_W - PAD} y2={122} stroke={c.line} strokeWidth={1} />

      {/* ── 视觉区块 ── */}
      {habit && spiral && curve ? (
        <>
          <G transform={`translate(${(CARD_W - RING_SIZE) / 2}, ${RING_Y})`}>
            {spiral.guides.map((g, i) => (
              <Circle key={`g-${i}`} cx={spiral.center} cy={spiral.center} r={g.r} fill="none" stroke={c.blank} strokeWidth={1.6} />
            ))}
            {spiral.arcs.map((a) => (
              <Path key={a.key} d={a.d} stroke={a.color} strokeWidth={2.2} strokeLinecap="round" fill="none" />
            ))}
            {spiral.dots.map((d) =>
              d.on ? (
                <Circle key={d.key} cx={d.cx} cy={d.cy} r={d.r} fill={d.color} />
              ) : (
                <Circle key={d.key} cx={d.cx} cy={d.cy} r={d.r} fill="none" stroke={d.color} strokeWidth={1.6} />
              )
            )}
          </G>

          <G transform={`translate(${CURVE_X}, ${CURVE_Y})`}>
            {curve.ticks.map((x, i) => (
              <Line key={`t-${i}`} x1={x} y1={curve.baseY} x2={x} y2={curve.baseY + 4} stroke={c.blank} strokeWidth={1.2} />
            ))}
            {curve.segs.map((s) =>
              s.dotted ? (
                <G key={s.key}>
                  {[1, 2, 3].map((k) => {
                    const t = k / 4;
                    return (
                      <Circle
                        key={`${s.key}-d${k}`}
                        cx={s.a.x + (s.b.x - s.a.x) * t}
                        cy={s.a.y + (s.b.y - s.a.y) * t}
                        r={1.5}
                        fill={s.color}
                      />
                    );
                  })}
                </G>
              ) : (
                <Path key={s.key} d={s.d} stroke={c.done} strokeWidth={1.8} strokeLinecap="round" fill="none" />
              )
            )}
            {curve.dots.map((d, i) =>
              d.has ? (
                <Circle key={`p-${i}`} cx={d.cx} cy={d.cy} r={2.6} fill={c.done} />
              ) : (
                <Circle key={`p-${i}`} cx={d.cx} cy={d.cy} r={2.2} fill={c.blank} />
              )
            )}
          </G>
        </>
      ) : (
        /* 全站总览卡：一个大数字替代图形区 */
        <>
          <SvgText
            x={CARD_W / 2}
            y={250}
            textAnchor="middle"
            fontFamily="-apple-system, system-ui, sans-serif"
            fontSize={76}
            fontWeight="600"
            letterSpacing={-1.5}
            fill={c.ink}
          >
            {String(total)}
          </SvgText>
          <SvgText
            x={CARD_W / 2}
            y={282}
            textAnchor="middle"
            fontFamily="-apple-system, system-ui, sans-serif"
            fontSize={13}
            fill={c.ink4}
          >
            {lang === "zh" ? "累计坚持天数" : "total days"}
          </SvgText>
          <SvgText
            x={CARD_W / 2}
            y={326}
            textAnchor="middle"
            fontFamily="-apple-system, system-ui, sans-serif"
            fontSize={14}
            fill={c.ink3}
          >
            {lang === "zh" ? "越来越好" : "Getting better."}
          </SvgText>
        </>
      )}

      {/* ── 三宫格数据（仅单习惯卡） ── */}
      {habit
        ? statCells.map((s, i) => {
            const cx = PAD + (INNER * (i + 0.5)) / statCells.length;
            return (
              <React.Fragment key={`stat-${i}`}>
                <SvgText
                  x={cx}
                  y={396}
                  textAnchor="middle"
                  fontFamily="-apple-system, system-ui, sans-serif"
                  fontSize={26}
                  fontWeight="600"
                  letterSpacing={-0.374}
                  fill={c.ink}
                >
                  {String(s.v)}
                </SvgText>
                <SvgText x={cx} y={416} textAnchor="middle" fontFamily="-apple-system, system-ui, sans-serif" fontSize={11} fill={c.ink4}>
                  {ellipsize(s.l, 11, INNER / 3 - 4)}
                </SvgText>
              </React.Fragment>
            );
          })
        : null}

      <Line x1={PAD} y1={434} x2={CARD_W - PAD} y2={434} stroke={c.line} strokeWidth={1} />

      {/* ── 文案 / 签名 / 备注 ── */}
      {quoteLines.map((ln, i) => (
        <SvgText
          key={`q-${i}`}
          x={CARD_W / 2}
          y={458 + i * 22}
          textAnchor="middle"
          fontFamily="-apple-system, system-ui, sans-serif"
          fontSize={16}
          fill={c.ink}
        >
          {ln}
        </SvgText>
      ))}
      {signLine ? (
        <SvgText x={CARD_W / 2} y={506} textAnchor="middle" fontFamily="-apple-system, system-ui, sans-serif" fontSize={12} fill={c.ink4}>
          {signLine}
        </SvgText>
      ) : null}
      {noteLines.map((ln, i) => (
        <SvgText
          key={`n-${i}`}
          x={CARD_W / 2}
          /* ★ 页码位不能被挤掉：有签名时从 522 起、行距 15（原 524/16）。
           *   原参数下第二行基线 540，descender 落到 543，而页脚（y=548，9.5pt）
           *   字顶约在 541 —— 两者会叠约 2px。收紧 1~2px 后空出 1px，仍保持留白观感。
           *   没有签名时起始位仍是 506，与旧版一致。 */
          y={(signLine ? 522 : 506) + i * 15}
          textAnchor="middle"
          fontFamily="-apple-system, system-ui, sans-serif"
          fontSize={12}
          fill={c.ink4}
        >
          {ln}
        </SvgText>
      ))}

      {/* ── 页脚落款 ── */}
      <SvgText x={CARD_W / 2} y={548} textAnchor="middle" fontFamily="-apple-system, system-ui, sans-serif" fontSize={9.5} fill={c.ink4}>
        {ellipsize(footer, 9.5, INNER)}
      </SvgText>
    </Svg>
  );
}
